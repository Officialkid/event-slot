import crypto from 'crypto'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { generateConfirmationCode } from '@/lib/confirmationCode'
import { generateTicketForRegistration } from '@/lib/tickets'
import { sendConfirmationEmail, sendWaitlistJoinedEmail } from '@/lib/email'
import { calculatePaidEventCommission } from '@/lib/paidEventCommission'
import { offerNextPaidWaitlistSpot } from '@/lib/paidEventWaitlist'
import { sendEventCapacityMilestones, sendTierCapacityMilestones } from '@/lib/capacityNotifications'
import { getEffectiveEventPlan } from '@/lib/eventPasses'
import { getEventPassExpiryDate } from '@/lib/oneTimePassCatalog'
import {
  toMinorUnits,
  buildOrderProceedsIdempotencyKey,
  buildOrderCommissionIdempotencyKey,
} from '@/lib/financialLedger'

type SubscriptionIntent = {
  userId?: string
  planId?: string
  billingCycle?: 'MONTHLY' | 'ANNUAL' | string
  priceUsd?: number
  planAmountUsd?: number
  taxAmountUsd?: number
  totalUsd?: number
  totalKes?: number
  amountKes?: number
  phone?: string
  paymentProvider?: string
  paymentMethod?: string
}

type EventPassIntent = {
  eventId?: string
  organizerId?: string
  tier?: string
  priceUsd?: number
  priceKes?: number
  exchangeRate?: number
  paymentProvider?: string
  paymentMethod?: string
  mpesaPhone?: string
}

async function logPaidTicketEmail(orderId: string, data: {
  attendeeEmail: string
  status: 'sent' | 'failed'
  error?: string
}) {
  await prisma.errorLog.create({
    data: {
      route: `paid-ticket-email:${orderId}`,
      message: JSON.stringify({
        orderId,
        attendeeEmail: data.attendeeEmail,
        status: data.status,
        error: data.error ?? null,
        createdAt: new Date().toISOString(),
      }),
    },
  }).catch(() => {})
}

async function updateOrganiserBalance(
  input: {
    organiserId: string | null
    currency: string | null | undefined
    gross: number
    commission: number
    net: number
  },
  db: Prisma.TransactionClient | typeof prisma = prisma
) {
  if (!input.organiserId) return

  const currency = (input.currency ?? "").trim().toUpperCase() === "USD" ? "USD" : "KES"
  const createData =
    currency === "USD"
      ? {
          organiserId: input.organiserId,
          grossUSD: input.gross,
          commissionUSD: input.commission,
          netUSD: input.net,
        }
      : {
          organiserId: input.organiserId,
          grossKES: input.gross,
          commissionKES: input.commission,
          netKES: input.net,
        }

  const updateData =
    currency === "USD"
      ? {
          grossUSD: { increment: input.gross },
          commissionUSD: { increment: input.commission },
          netUSD: { increment: input.net },
        }
      : {
          grossKES: { increment: input.gross },
          commissionKES: { increment: input.commission },
          netKES: { increment: input.net },
        }

  await db.organiserBalance.upsert({
    where: { organiserId: input.organiserId },
    create: createData,
    update: updateData,
  })
}

export async function failPaidEventOrderPayment(orderId: string, status: 'FAILED' | 'CANCELLED') {
  const order = await prisma.paidEventOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      eventId: true,
      ticketTierId: true,
      promotionRegistrationId: true,
      status: true,
    },
  })

  if (!order) return
  if (order.status === 'PAID' || order.status === 'FAILED' || order.status === 'CANCELLED') return

  await prisma.paidEventOrder.update({
    where: { id: orderId },
    data: { status },
  })

  await prisma.payment.updateMany({
    where: { paidEventOrderId: orderId },
    data: { status },
  })

  await offerNextPaidWaitlistSpot(order.eventId, order.ticketTierId).catch(() => {})
}

export type FinalizePaidEventOrderResult =
  | { status: 'PAID'; registrationId: string; confirmationCode: string }
  | { status: 'OVERCAPACITY_PAID'; message: string; fulfillmentStatus?: string }
  | { status: 'NOT_FOUND' }

export async function finalizePaidEventOrderPayment(
  orderId: string,
  providerReference?: string | null
): Promise<FinalizePaidEventOrderResult> {
  const paidAt = new Date()

  // ---------------------------------------------------------------------------
  // Single Atomic Database Transaction for Entire Finalization & Ledger Posting
  // ---------------------------------------------------------------------------
  const outcome = await prisma.$transaction(async (tx) => {
    // 1. Fetch order within transaction with relations
    const eventOrder = await tx.paidEventOrder.findUnique({
      where: { id: orderId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            eventDate: true,
            location: true,
            confirmedCount: true,
            capacity: true,
            currency: true,
            organizerId: true,
            organizer: { select: { plan: true } },
          },
        },
        ticketTier: {
          select: {
            id: true,
            name: true,
            priceKes: true,
            bundleSize: true,
            soldCount: true,
            capacity: true,
          },
        },
        registrations: {
          select: { id: true, confirmationCode: true },
          take: 1,
        },
      },
    })

    if (!eventOrder) {
      return { kind: 'not_found' as const }
    }

    // Idempotency: If already finalized as PAID, return existing registration without re-processing
    if (eventOrder.status === 'PAID') {
      const existingReg = eventOrder.registrations[0] ?? (await tx.registration.findFirst({
        where: { paidOrderId: eventOrder.id },
        select: { id: true, confirmationCode: true },
      }))
      return {
        kind: 'already_paid' as const,
        registrationId: existingReg?.id ?? '',
        confirmationCode: existingReg?.confirmationCode ?? '',
        eventOrder,
      }
    }

    // Idempotency: If already placed in OVERCAPACITY_PAID exception resolution state, return
    if (eventOrder.status === 'OVERCAPACITY_PAID') {
      return {
        kind: 'overcapacity' as const,
        eventOrder,
      }
    }

    // 2. Lock TicketTier row to check authoritative capacity
    try {
      await tx.$queryRaw`SELECT id, capacity, "soldCount" FROM "TicketTier" WHERE id = ${eventOrder.ticketTierId} FOR UPDATE`
    } catch {
      // Fallback for non-Postgres test environments
    }

    const freshTier = await tx.ticketTier.findUnique({
      where: { id: eventOrder.ticketTierId },
      select: { id: true, capacity: true, soldCount: true },
    })

    const isHoldExpired = eventOrder.holdExpiresAt < new Date() || eventOrder.status === 'EXPIRED'

    // Check for other active checkout holds and waitlist promotion holds on this tier
    const activeHolds =
      typeof tx.paidEventOrder?.count === 'function'
        ? await tx.paidEventOrder
            .count({
              where: {
                ticketTierId: eventOrder.ticketTierId,
                status: { in: ['PENDING', 'PAYMENT_PENDING'] },
                holdExpiresAt: { gt: new Date() },
                id: { not: eventOrder.id },
              },
            })
            .catch(() => 0)
        : 0

    const isTierFull = freshTier
      ? freshTier.soldCount + activeHolds >= freshTier.capacity
      : false

    // 3. Late Payment Handling:
    // If the hold expired and the tier is now completely full (or committed to active waitlist offers):
    // DO NOT oversell. DO NOT issue a ticket. DO NOT discard payment.
    // Provider payment succeeded and is recorded as SUCCESS with zero organizer entitlement until resolved.
    // Order transitions to OVERCAPACITY_PAID with fulfillmentStatus = OVERCAPACITY_HOLD.
    if (isHoldExpired && isTierFull) {
      await tx.paidEventOrder.update({
        where: { id: eventOrder.id },
        data: {
          status: 'OVERCAPACITY_PAID',
          fulfillmentStatus: 'OVERCAPACITY_HOLD',
          exceptionReason: 'Hold expired and tier capacity was exhausted before payment confirmation. Requires refund or manual organizer resolution.',
          providerReference: providerReference ?? eventOrder.providerReference,
          mpesaReceiptNumber: providerReference ?? eventOrder.mpesaReceiptNumber,
          paidAt,
        },
      })

      // The Paystack charge was verified and succeeded. Do not falsely mark provider payment as FAILED!
      // Commission and organizer entitlements are held at 0 minor units until the exception is resolved.
      await tx.payment.updateMany({
        where: { paidEventOrderId: eventOrder.id },
        data: {
          status: 'SUCCESS',
          amount: eventOrder.amountKes,
          commissionAmount: 0,
          organizerAmount: 0,
          commissionRate: 0,
          mpesaRef: providerReference ?? eventOrder.mpesaReceiptNumber,
          paidAt,
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: eventOrder.event.organizerId || 'SYSTEM',
          action: 'OVERCAPACITY_PAID_EXCEPTION',
          metadata: {
            orderId: eventOrder.id,
            eventId: eventOrder.eventId,
            ticketTierId: eventOrder.ticketTierId,
            attendeeEmail: eventOrder.attendeeEmail,
            amountKes: eventOrder.amountKes,
            providerReference,
            paymentStatus: 'SUCCESS',
            fulfillmentStatus: 'OVERCAPACITY_HOLD',
            reason: 'Hold expired and tier capacity was exhausted before payment confirmation. Requires refund or manual organizer resolution.',
          },
        },
      }).catch(() => {})

      return {
        kind: 'overcapacity' as const,
        eventOrder,
      }
    }

    // 4. Capacity Available: Fulfill registration, ticket issuance, and ledger posting
    let confirmationCode = eventOrder.registrations[0]?.confirmationCode ?? generateConfirmationCode()
    let registrationId = eventOrder.registrations[0]?.id

    if (eventOrder.promotionRegistrationId) {
      const updatedRegistration = await tx.registration.update({
        where: { id: eventOrder.promotionRegistrationId },
        data: {
          status: 'confirmed',
          paidOrderId: eventOrder.id,
          confirmationCode,
          submittedAt: paidAt,
        },
        select: { id: true, confirmationCode: true },
      })
      registrationId = updatedRegistration.id
      confirmationCode = updatedRegistration.confirmationCode ?? confirmationCode
    } else if (!registrationId) {
      const registrationNumber = (await tx.registration.count({ where: { eventId: eventOrder.eventId } })) + 1
      const created = await tx.registration.create({
        data: {
          eventId: eventOrder.eventId,
          ticketTierId: eventOrder.ticketTierId,
          paidOrderId: eventOrder.id,
          answers: eventOrder.attendeePayload as Prisma.InputJsonValue,
          status: 'confirmed',
          registrationNumber,
          submittedAt: paidAt,
          notified: false,
          attendeeEmail: eventOrder.attendeeEmail,
          consentTransactional: true,
          consentMarketing: false,
          confirmationCode,
          qrCode: crypto.randomUUID(),
          source: 'paid-checkout',
        },
        select: { id: true, confirmationCode: true },
      })
      registrationId = created.id
      confirmationCode = created.confirmationCode ?? confirmationCode
    }

    // Atomically increment confirmed attendee count and sold ticket count
    await tx.event.update({
      where: { id: eventOrder.eventId },
      data: { confirmedCount: { increment: 1 } },
    })

    await tx.ticketTier.update({
      where: { id: eventOrder.ticketTierId },
      data: { soldCount: { increment: 1 } },
    })

    // Atomically issue ticket record
    const ticketCode = crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()
    const admissionsTotal = Math.max(1, eventOrder.ticketTier.bundleSize ?? 1)

    const existingTicket = await tx.ticket.findUnique({ where: { registrationId: registrationId! } })
    const ticket = existingTicket ?? await tx.ticket.create({
      data: {
        registrationId: registrationId!,
        code: ticketCode,
        admissionsTotal,
        ticketTierId: eventOrder.ticketTierId,
        ticketTierName: eventOrder.ticketTier.name,
        amountPaidKes: eventOrder.amountKes,
        admissionsUsed: 0,
      },
      select: { id: true },
    })

    // Update order status to PAID
    await tx.paidEventOrder.update({
      where: { id: eventOrder.id },
      data: {
        status: 'PAID',
        providerReference: providerReference ?? eventOrder.providerReference,
        mpesaReceiptNumber: providerReference ?? eventOrder.mpesaReceiptNumber,
        paidAt,
      },
    })

    // Calculate commission & update payment record
    const effectivePlan = eventOrder.event.organizer?.plan ?? 'free'
    const commission = calculatePaidEventCommission(eventOrder.amountKes, effectivePlan)

    await tx.payment.updateMany({
      where: { paidEventOrderId: eventOrder.id },
      data: {
        registrationId,
        ticketId: ticket.id,
        amount: eventOrder.amountKes,
        commissionAmount: commission.commissionAmount,
        organizerAmount: commission.organizerAmount,
        commissionRate: commission.commissionRate,
        mpesaRef: providerReference ?? eventOrder.mpesaReceiptNumber,
        status: 'SUCCESS',
        paidAt,
      },
    })

    // Update legacy organizer balance inside transaction
    if (eventOrder.event.organizerId) {
      await updateOrganiserBalance(
        {
          organiserId: eventOrder.event.organizerId,
          currency: eventOrder.currency || eventOrder.event.currency,
          gross: eventOrder.amountKes,
          commission: commission.commissionAmount,
          net: commission.organizerAmount,
        },
        tx
      )

      // Post immutable Financial Ledger entries atomically
      const organizerId = eventOrder.event.organizerId
      const proceedsKey = buildOrderProceedsIdempotencyKey(eventOrder.id)
      const commissionKey = buildOrderCommissionIdempotencyKey(eventOrder.id)
      const proceedsMinor = toMinorUnits(eventOrder.amountKes, eventOrder.currency || 'KES')
      const commissionMinor = toMinorUnits(commission.commissionAmount, eventOrder.currency || 'KES')

      await tx.financialLedgerEntry.upsert({
        where: { idempotencyKey: proceedsKey },
        create: {
          organizerId,
          eventId: eventOrder.event.id,
          orderId: eventOrder.id,
          entryType: 'TICKET_PROCEEDS',
          direction: 'CREDIT',
          amountMinorUnits: proceedsMinor,
          currency: eventOrder.currency || 'KES',
          idempotencyKey: proceedsKey,
          providerReference: providerReference ?? eventOrder.providerReference,
          description: `Ticket proceeds for order ${eventOrder.id} (${eventOrder.ticketTier.name})`,
        },
        update: {},
      })

      await tx.financialLedgerEntry.upsert({
        where: { idempotencyKey: commissionKey },
        create: {
          organizerId,
          eventId: eventOrder.event.id,
          orderId: eventOrder.id,
          entryType: 'PLATFORM_COMMISSION',
          direction: 'DEBIT',
          amountMinorUnits: commissionMinor,
          currency: eventOrder.currency || 'KES',
          idempotencyKey: commissionKey,
          providerReference: providerReference ?? eventOrder.providerReference,
          description: `Platform commission (5%) for order ${eventOrder.id}`,
        },
        update: {},
      })
    }

    return {
      kind: 'fulfilled' as const,
      registrationId: registrationId!,
      confirmationCode,
      eventOrder,
    }
  })

  // Post-Transaction Side Effects
  if (outcome.kind === 'not_found') {
    return { status: 'NOT_FOUND' }
  }

  if (outcome.kind === 'overcapacity') {
    return {
      status: 'OVERCAPACITY_PAID',
      fulfillmentStatus: 'OVERCAPACITY_HOLD',
      message: 'Hold expired and tier reached capacity before payment confirmation. Payment succeeded on provider but ticket fulfillment requires resolution.',
    }
  }

  const { eventOrder, confirmationCode, registrationId } = outcome

  if (outcome.kind === 'fulfilled') {
    if (eventOrder.attendeeEmail && confirmationCode) {
      sendConfirmationEmail({
        to: eventOrder.attendeeEmail,
        name: eventOrder.attendeeName || 'there',
        eventTitle: eventOrder.event.title,
        confirmationNumber: confirmationCode,
        userId: null,
        eventDate: eventOrder.event.eventDate,
        eventSlug: eventOrder.event.slug,
        eventLocation: eventOrder.event.location,
      })
        .then(() => logPaidTicketEmail(eventOrder.id, {
          attendeeEmail: eventOrder.attendeeEmail as string,
          status: 'sent',
        }))
        .catch((error) => logPaidTicketEmail(eventOrder.id, {
          attendeeEmail: eventOrder.attendeeEmail as string,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown email error',
        }))
    }

    await sendTierCapacityMilestones({
      eventId: eventOrder.event.id,
      eventSlug: eventOrder.event.slug,
      eventTitle: eventOrder.event.title,
      organizerId: eventOrder.event.organizerId,
      tierId: eventOrder.ticketTier.id,
      tierName: eventOrder.ticketTier.name,
      previousSoldCount: eventOrder.ticketTier.soldCount,
      capacity: eventOrder.ticketTier.capacity,
    }).catch(() => {})

    await sendEventCapacityMilestones({
      eventId: eventOrder.event.id,
      eventSlug: eventOrder.event.slug,
      eventTitle: eventOrder.event.title,
      organizerId: eventOrder.event.organizerId,
      previousConfirmedCount: eventOrder.event.confirmedCount,
      capacity: eventOrder.event.capacity,
    }).catch(() => {})
  }

  return {
    status: 'PAID',
    registrationId,
    confirmationCode,
  }
}

export type ResolveOvercapacityResult =
  | {
      success: true
      duplicate?: boolean
      status: string
      fulfillmentStatus: string
      resolvedAt: Date
      resolution?: 'MANUAL_FULFILLMENT' | 'MANUAL_REFUND'
      registrationId?: string
      confirmationCode?: string
    }
  | {
      success: false
      error: string
    }

/**
 * Idempotently and auditably resolves an order in OVERCAPACITY_PAID exception state.
 * Supports manual fulfillment (allocating ticket and crediting ledger) or manual refund marking.
 * Does NOT invoke external provider refund APIs.
 */
export async function resolveOvercapacityPaidOrder(input: {
  orderId: string
  resolution: 'MANUAL_FULFILLMENT' | 'MANUAL_REFUND'
  notes?: string
  actorId: string
}): Promise<ResolveOvercapacityResult> {
  const order = await prisma.paidEventOrder.findUnique({
    where: { id: input.orderId },
    include: {
      event: { select: { id: true, organizerId: true, title: true, currency: true, organizer: { select: { plan: true } } } },
      ticketTier: true,
      payment: true,
      registrations: true,
    },
  })

  if (!order) {
    return { success: false, error: 'Order not found' }
  }

  if (order.status !== 'OVERCAPACITY_PAID') {
    return {
      success: false,
      error: `Order is not in OVERCAPACITY_PAID status (current status: ${order.status})`,
    }
  }

  // Idempotency: if already resolved, return existing outcome
  if (order.fulfillmentStatus === 'RESOLVED' || order.fulfillmentStatus === 'REFUNDED') {
    return {
      success: true,
      duplicate: true,
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      resolvedAt: order.resolvedAt ?? new Date(),
    }
  }

  const now = new Date()

  if (input.resolution === 'MANUAL_REFUND') {
    await prisma.$transaction(async (tx) => {
      await tx.paidEventOrder.update({
        where: { id: order.id },
        data: {
          status: 'REFUNDED',
          fulfillmentStatus: 'REFUNDED',
          resolvedAt: now,
          resolutionNotes: input.notes ?? 'Marked as refunded by operator',
        },
      })

      await tx.payment.updateMany({
        where: { paidEventOrderId: order.id },
        data: {
          status: 'REFUNDED',
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: input.actorId,
          action: 'ORDER_OVERCAPACITY_MANUAL_REFUND',
          metadata: {
            orderId: order.id,
            amountKes: order.amountKes,
            notes: input.notes,
            resolvedAt: now.toISOString(),
          },
        },
      })
    })

    return {
      success: true,
      status: 'REFUNDED',
      fulfillmentStatus: 'REFUNDED',
      resolvedAt: now,
    }
  }

  // Manual Fulfillment: Issue ticket and post organizer entitlement ledger entries
  return prisma.$transaction(async (tx) => {
    let confirmationCode = order.registrations[0]?.confirmationCode ?? generateConfirmationCode()
    let registrationId = order.registrations[0]?.id

    if (!registrationId) {
      const registrationNumber = (await tx.registration.count({ where: { eventId: order.eventId } })) + 1
      const created = await tx.registration.create({
        data: {
          eventId: order.eventId,
          ticketTierId: order.ticketTierId,
          paidOrderId: order.id,
          answers: order.attendeePayload as Prisma.InputJsonValue,
          status: 'confirmed',
          registrationNumber,
          submittedAt: now,
          notified: false,
          attendeeEmail: order.attendeeEmail,
          consentTransactional: true,
          consentMarketing: false,
          confirmationCode,
          qrCode: crypto.randomUUID(),
          source: 'paid-checkout-manual-resolution',
        },
        select: { id: true, confirmationCode: true },
      })
      registrationId = created.id
      confirmationCode = created.confirmationCode ?? confirmationCode
    }

    await tx.event.update({
      where: { id: order.eventId },
      data: { confirmedCount: { increment: 1 } },
    })

    await tx.ticketTier.update({
      where: { id: order.ticketTierId },
      data: { soldCount: { increment: 1 } },
    })

    const ticketCode = crypto.randomUUID().replace(/-/g, '').substring(0, 12).toUpperCase()
    const admissionsTotal = Math.max(1, order.ticketTier.bundleSize ?? 1)
    const existingTicket = await tx.ticket.findUnique({ where: { registrationId: registrationId! } })
    const ticket = existingTicket ?? await tx.ticket.create({
      data: {
        registrationId: registrationId!,
        code: ticketCode,
        admissionsTotal,
        ticketTierId: order.ticketTierId,
        ticketTierName: order.ticketTier.name,
        amountPaidKes: order.amountKes,
        admissionsUsed: 0,
      },
      select: { id: true },
    })

    const effectivePlan = order.event.organizer?.plan ?? 'free'
    const commission = calculatePaidEventCommission(order.amountKes, effectivePlan)

    await tx.paidEventOrder.update({
      where: { id: order.id },
      data: {
        status: 'PAID',
        fulfillmentStatus: 'RESOLVED',
        resolvedAt: now,
        resolutionNotes: input.notes ?? 'Manually fulfilled by operator',
      },
    })

    await tx.payment.updateMany({
      where: { paidEventOrderId: order.id },
      data: {
        registrationId,
        ticketId: ticket.id,
        amount: order.amountKes,
        commissionAmount: commission.commissionAmount,
        organizerAmount: commission.organizerAmount,
        commissionRate: commission.commissionRate,
        status: 'SUCCESS',
      },
    })

    if (order.event.organizerId) {
      await updateOrganiserBalance(
        {
          organiserId: order.event.organizerId,
          currency: order.currency || order.event.currency,
          gross: order.amountKes,
          commission: commission.commissionAmount,
          net: commission.organizerAmount,
        },
        tx
      )

      const organizerId = order.event.organizerId
      const proceedsKey = buildOrderProceedsIdempotencyKey(order.id)
      const commissionKey = buildOrderCommissionIdempotencyKey(order.id)
      const proceedsMinor = toMinorUnits(order.amountKes, order.currency || 'KES')
      const commissionMinor = toMinorUnits(commission.commissionAmount, order.currency || 'KES')

      await tx.financialLedgerEntry.upsert({
        where: { idempotencyKey: proceedsKey },
        create: {
          organizerId,
          eventId: order.event.id,
          orderId: order.id,
          entryType: 'TICKET_PROCEEDS',
          direction: 'CREDIT',
          amountMinorUnits: proceedsMinor,
          currency: order.currency || 'KES',
          idempotencyKey: proceedsKey,
          providerReference: order.providerReference,
          description: `Ticket proceeds for manually resolved order ${order.id} (${order.ticketTier.name})`,
        },
        update: {},
      })

      await tx.financialLedgerEntry.upsert({
        where: { idempotencyKey: commissionKey },
        create: {
          organizerId,
          eventId: order.event.id,
          orderId: order.id,
          entryType: 'PLATFORM_COMMISSION',
          direction: 'DEBIT',
          amountMinorUnits: commissionMinor,
          currency: order.currency || 'KES',
          idempotencyKey: commissionKey,
          providerReference: order.providerReference,
          description: `Platform commission (5%) for manually resolved order ${order.id}`,
        },
        update: {},
      })
    }

    await tx.auditLog.create({
      data: {
        actorId: input.actorId,
        action: 'ORDER_OVERCAPACITY_MANUAL_FULFILLMENT',
        metadata: {
          orderId: order.id,
          registrationId,
          ticketId: ticket.id,
          notes: input.notes,
          resolvedAt: now.toISOString(),
        },
      },
    })

    return {
      success: true,
      status: 'PAID',
      fulfillmentStatus: 'RESOLVED',
      registrationId,
      confirmationCode,
      resolvedAt: now,
    }
  })
}
export async function activateSubscriptionPayment(paymentId: string, providerReference?: string | null) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      subscriptionId: true,
      amountUsd: true,
      description: true,
      status: true,
      provider: true,
    },
  })

  if (!payment || payment.status === 'SUCCESS') return

  let intent: SubscriptionIntent = {}
  try {
    const parsed = JSON.parse(payment.description ?? '{}') as unknown
    if (parsed && typeof parsed === 'object') {
      intent = parsed as SubscriptionIntent
    }
  } catch {
    throw new Error(`Could not parse payment intent for subscription payment ${payment.id}`)
  }

  const { userId, planId, billingCycle, priceUsd, totalUsd, phone, paymentProvider } = intent
  if (!userId || !planId) {
    throw new Error(`Subscription payment ${payment.id} is missing userId or planId`)
  }

  const now = new Date()
  const isAnnual = billingCycle === 'ANNUAL'
  const periodEnd = new Date(now)
  if (isAnnual) {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    select: { name: true },
  })
  if (!plan) {
    throw new Error(`Subscription payment ${payment.id} is referencing a missing plan`)
  }

  const effectiveProvider = paymentProvider ?? payment.provider ?? 'intasend'
  const effectiveAmount = totalUsd ?? priceUsd ?? payment.amountUsd

  const existingSub = await prisma.subscription.findFirst({
    where: { userId },
  })

  if (existingSub) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: {
        planId,
        billingCycle: isAnnual ? 'ANNUAL' : 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentProvider: effectiveProvider,
        mpesaPhone: phone,
        lastPaymentRef: providerReference ?? existingSub.lastPaymentRef,
        lastPaymentAmount: effectiveAmount,
        lastPaymentAt: now,
      },
    })
  } else {
    const newSub = await prisma.subscription.create({
      data: {
        userId,
        planId,
        billingCycle: isAnnual ? 'ANNUAL' : 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        paymentProvider: effectiveProvider,
        mpesaPhone: phone,
        lastPaymentRef: providerReference ?? null,
        lastPaymentAmount: effectiveAmount,
        lastPaymentAt: now,
      },
    })

    await prisma.subscriptionPayment.update({
      where: { id: payment.id },
      data: { subscriptionId: newSub.id },
    })
  }

  await prisma.subscriptionPayment.update({
    where: { id: payment.id },
    data: {
      status: 'SUCCESS',
      providerRef: providerReference ?? undefined,
      paidAt: now,
    },
  })

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: plan.name,
      billingCycle: isAnnual ? 'annual' : 'monthly',
      planStartDate: now,
      planEndDate: periodEnd,
    },
  })
}

export async function activateEventPassPayment(paymentId: string, providerReference?: string | null) {
  const payment = await prisma.eventPassPayment.findUnique({
    where: { id: paymentId },
    include: {
      eventPass: {
        include: {
          event: {
            select: {
              id: true,
              eventDate: true,
              eventEndAt: true,
            },
          },
        },
      },
    },
  })

  if (!payment || payment.status === 'SUCCESS') return

  let intent: EventPassIntent = {}
  try {
    const parsed = JSON.parse(payment.description ?? '{}') as unknown
    if (parsed && typeof parsed === 'object') {
      intent = parsed as EventPassIntent
    }
  } catch {
    throw new Error(`Could not parse payment intent for event pass payment ${payment.id}`)
  }

  const now = new Date()
  const expiry = getEventPassExpiryDate(payment.eventPass.event.eventDate, payment.eventPass.event.eventEndAt) ?? now

  await prisma.$transaction(async (tx) => {
    await tx.eventPass.update({
      where: { id: payment.eventPassId },
      data: {
        status: expiry.getTime() <= now.getTime() ? 'EXPIRED' : 'ACTIVE',
        paymentProvider: intent.paymentProvider ?? payment.provider,
        paymentReference: providerReference ?? payment.providerRef,
        checkoutRequestId: payment.checkoutRequestId ?? payment.providerRef ?? providerReference ?? undefined,
        activatedAt: now,
        expiresAt: expiry,
      },
    })

    await tx.eventPassPayment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        providerRef: providerReference ?? payment.providerRef ?? undefined,
        paidAt: now,
      },
    })
  })
}

export async function failSubscriptionPayment(paymentId: string, status: 'FAILED' | 'CANCELLED') {
  await prisma.subscriptionPayment.update({
    where: { id: paymentId },
    data: { status },
  }).catch(() => {})
}

export async function joinPaidEventWaitlist(input: {
  eventId: string
  eventSlug: string
  eventTitle: string
  ticketTierId: string
  ticketTierWaitlistCount: number
  attendeeEmail: string | null
  attendeeAnswers: Array<{ questionId: string; value: string }>
  consentTransactional: boolean
  consentMarketing: boolean
  source: string
  refCode: string | null
  utmSource: string | null
  countryCode: string | null
}) {
  const registrationNumber = (await prisma.registration.count({ where: { eventId: input.eventId } })) + 1
  const nextPosition = input.ticketTierWaitlistCount + 1

  const registration = await prisma.$transaction(async (tx) => {
    const created = await tx.registration.create({
      data: {
        eventId: input.eventId,
        ticketTierId: input.ticketTierId,
        answers: input.attendeeAnswers,
        status: 'waitlist',
        waitlistPosition: nextPosition,
        registrationNumber,
        attendeeEmail: input.attendeeEmail,
        consentTransactional: input.consentTransactional,
        consentMarketing: input.consentMarketing,
        source: input.source,
        refCode: input.refCode,
        utmSource: input.utmSource,
        countryCode: input.countryCode ?? undefined,
      },
      select: { id: true, registrationNumber: true, waitlistPosition: true },
    })

    await tx.event.update({
      where: { id: input.eventId },
      data: { waitlistCount: { increment: 1 } },
    })

    await tx.ticketTier.update({
      where: { id: input.ticketTierId },
      data: { waitlistCount: { increment: 1 } },
    })

    return created
  })

  if (input.attendeeEmail) {
    sendWaitlistJoinedEmail({
      to: input.attendeeEmail,
      eventTitle: input.eventTitle,
      waitlistPosition: registration.waitlistPosition,
      eventDate: null,
      eventSlug: input.eventSlug,
      eventLocation: null,
    }).catch(() => {})
  }

  return registration
}

