import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { generateConfirmationCode } from '@/lib/confirmationCode'
import { generateTicketForRegistration } from '@/lib/tickets'
import { sendConfirmationEmail, sendWaitlistJoinedEmail } from '@/lib/email'
import { calculatePaidEventCommission } from '@/lib/paidEventCommission'
import { offerNextPaidWaitlistSpot } from '@/lib/paidEventWaitlist'
import { sendEventCapacityMilestones, sendTierCapacityMilestones } from '@/lib/capacityNotifications'

type SubscriptionIntent = {
  userId?: string
  planId?: string
  billingCycle?: 'MONTHLY' | 'ANNUAL' | string
  priceUsd?: number
  amountKes?: number
  phone?: string
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

export async function finalizePaidEventOrderPayment(orderId: string, providerReference?: string | null) {
  const eventOrder = await prisma.paidEventOrder.findUnique({
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
    },
  })

  if (!eventOrder) return
  if (eventOrder.status === 'PAID') return

  const paidAt = new Date()
  const existingRegistration = await prisma.registration.findFirst({
    where: { paidOrderId: eventOrder.id },
    select: { id: true, confirmationCode: true },
  })

  let confirmationCode = existingRegistration?.confirmationCode ?? null
  let registrationId = existingRegistration?.id ?? null
  let ticketId: string | null = null

  if (eventOrder.promotionRegistrationId) {
    const promoted = await prisma.$transaction(async (tx) => {
      const updatedRegistration = await tx.registration.update({
        where: { id: eventOrder.promotionRegistrationId! },
        data: {
          status: 'confirmed',
          paidOrderId: eventOrder.id,
          confirmationCode: confirmationCode ?? generateConfirmationCode(),
          submittedAt: paidAt,
        },
        select: { id: true, confirmationCode: true },
      })

      await tx.event.update({
        where: { id: eventOrder.eventId },
        data: { confirmedCount: { increment: 1 } },
      })

      await tx.ticketTier.update({
        where: { id: eventOrder.ticketTierId },
        data: { soldCount: { increment: 1 } },
      })

      await tx.paidEventOrder.update({
        where: { id: eventOrder.id },
        data: {
          status: 'PAID',
          providerReference: providerReference ?? eventOrder.providerReference,
          mpesaReceiptNumber: providerReference ?? eventOrder.mpesaReceiptNumber,
          paidAt,
        },
      })

      return updatedRegistration
    })

    confirmationCode = promoted.confirmationCode
    registrationId = promoted.id
  } else if (!existingRegistration) {
    const registrationNumber = (await prisma.registration.count({ where: { eventId: eventOrder.eventId } })) + 1
    confirmationCode = generateConfirmationCode()

    const registration = await prisma.$transaction(async (tx) => {
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

      await tx.event.update({
        where: { id: eventOrder.eventId },
        data: { confirmedCount: { increment: 1 } },
      })

      await tx.ticketTier.update({
        where: { id: eventOrder.ticketTierId },
        data: { soldCount: { increment: 1 } },
      })

      await tx.paidEventOrder.update({
        where: { id: eventOrder.id },
        data: {
          status: 'PAID',
          providerReference: providerReference ?? eventOrder.providerReference,
          mpesaReceiptNumber: providerReference ?? eventOrder.mpesaReceiptNumber,
          paidAt,
        },
      })

      return created
    })

    registrationId = registration.id
  } else {
    await prisma.paidEventOrder.update({
      where: { id: eventOrder.id },
      data: {
        status: 'PAID',
        providerReference: providerReference ?? eventOrder.providerReference,
        mpesaReceiptNumber: providerReference ?? eventOrder.mpesaReceiptNumber,
        paidAt,
      },
    })
  }

  if (registrationId) {
    const ticket = await generateTicketForRegistration(registrationId)
    ticketId = ticket.id

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        ticketTierId: eventOrder.ticketTierId,
        ticketTierName: eventOrder.ticketTier.name,
        amountPaidKes: eventOrder.amountKes,
        admissionsTotal: Math.max(1, eventOrder.ticketTier.bundleSize ?? 1),
        admissionsUsed: 0,
        verifiedEntries: [],
      },
    }).catch(() => {})
  }

  const commission = calculatePaidEventCommission(eventOrder.amountKes, eventOrder.event.organizer?.plan ?? 'free')
  await prisma.payment.updateMany({
    where: { paidEventOrderId: eventOrder.id },
    data: {
      registrationId,
      ticketId,
      amount: eventOrder.amountKes,
      commissionAmount: commission.commissionAmount,
      organizerAmount: commission.organizerAmount,
      commissionRate: commission.commissionRate,
      mpesaRef: providerReference ?? eventOrder.mpesaReceiptNumber,
      status: 'SUCCESS',
      paidAt,
    },
  })

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

export async function activateSubscriptionPayment(paymentId: string, providerReference?: string | null) {
  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      subscriptionId: true,
      amountUsd: true,
      description: true,
      status: true,
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

  const { userId, planId, billingCycle, priceUsd, phone } = intent
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
        paymentProvider: 'intasend',
        mpesaPhone: phone,
        lastPaymentRef: providerReference ?? existingSub.lastPaymentRef,
        lastPaymentAmount: priceUsd ?? payment.amountUsd,
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
        paymentProvider: 'intasend',
        mpesaPhone: phone,
        lastPaymentRef: providerReference ?? null,
        lastPaymentAmount: priceUsd ?? payment.amountUsd,
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

