/**
 * Unified Paystack Webhook Dispatcher
 *
 * Provides a single, secure, idempotent entry point for all Paystack webhook events:
 * 1. Verifies HMAC-SHA512 signature using timing-safe comparison on raw body
 * 2. Deduplicates events using ProcessedProviderEvent with safe retry handling
 * 3. Dispatches to appropriate domain handlers:
 *    - Paid ticket checkout (strict amount/currency verification + atomic finalization)
 *    - Token purchases
 *    - Subscription management and event passes
 *    - Credit top-ups
 * 4. Ensures ProcessedProviderEvent transitions atomically from PROCESSING to PROCESSED/FAILED
 */

import prisma from '@/lib/prisma'
import { verifyPaystackWebhookSignature } from '@/lib/paystack'
import {
  generateProviderEventIdempotencyKey,
  evaluateEventProcessingDecision,
  sanitizeEventError,
} from '@/lib/providerEvents'
import {
  activateEventPassPayment,
  activateSubscriptionPayment,
  finalizePaidEventOrderPayment,
} from '@/lib/paymentFinalizers'
import { creditTokens } from '@/lib/tokens'
import { toMinorUnits } from '@/lib/financialLedger'

export type WebhookDispatchResult = {
  status: number
  body: { message?: string; error?: string; received?: boolean }
}

export async function dispatchPaystackWebhook(params: {
  rawBody: string
  signature: string | null | undefined
}): Promise<WebhookDispatchResult> {
  const { rawBody, signature } = params

  if (process.env.PAYMENTS_ENABLED === 'false') {
    return { status: 200, body: { message: 'Payments not active' } }
  }

  // 1. Signature Verification (timing-safe, fail-closed)
  const isValid = verifyPaystackWebhookSignature({
    rawBody,
    signature,
  })

  if (!isValid) {
    console.error('[PaystackWebhook] Invalid signature received')
    return { status: 401, body: { error: 'Invalid signature' } }
  }

  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    return { status: 400, body: { error: 'Malformed JSON payload' } }
  }

  const eventType: string = event.event || 'unknown'
  const eventData = event.data || {}
  const reference: string | null = eventData.reference || null
  const providerEventId: string | number | null = event.id ?? null

  // 2. Generate Deterministic Idempotency Key
  let idempotencyKey: string
  try {
    idempotencyKey = generateProviderEventIdempotencyKey({
      provider: 'paystack',
      eventType,
      providerEventId,
      reference,
    })
  } catch (err) {
    console.error('[PaystackWebhook] Cannot derive idempotency key:', err)
    return { status: 400, body: { error: 'Unidentifiable event payload' } }
  }

  // 3. Idempotency Check & Lock Acquisition
  const existingRecord = await prisma.processedProviderEvent.findUnique({
    where: { idempotencyKey },
  })

  const decision = evaluateEventProcessingDecision(existingRecord)
  if (!decision.shouldProcess) {
    return { status: 200, body: { message: decision.reason } }
  }

  let eventRecordId: string
  const now = new Date()

  if (existingRecord) {
    await prisma.processedProviderEvent.update({
      where: { id: existingRecord.id },
      data: {
        status: 'PROCESSING',
        lastAttemptAt: now,
        attemptCount: { increment: 1 },
      },
    })
    eventRecordId = existingRecord.id
  } else {
    const created = await prisma.processedProviderEvent.create({
      data: {
        provider: 'paystack',
        eventId: providerEventId ? String(providerEventId) : null,
        eventType,
        idempotencyKey,
        status: 'PROCESSING',
        reference,
        firstSeenAt: now,
        lastAttemptAt: now,
        attemptCount: 1,
      },
    })
    eventRecordId = created.id
  }

  // 4. Dispatch Event to Domain Handlers
  try {
    switch (eventType) {
      case 'charge.success': {
        const metadata = eventData.metadata || {}
        const amountMinor = Number(eventData.amount || 0)
        const currency = (eventData.currency || 'KES').toUpperCase()
        const { type, orderId, paymentRecordId, userId, tokens } = metadata

        // Handler A: Paid Ticket Checkout
        if (type === 'paid_event_checkout' || orderId || paymentRecordId) {
          const targetOrderId = orderId || paymentRecordId
          if (targetOrderId) {
            const order = await prisma.paidEventOrder.findUnique({
              where: { id: targetOrderId },
              select: { id: true, amountKes: true, currency: true, status: true },
            })

            if (order) {
              // Strict verification: Amount in minor units must match order
              const expectedMinor = Number(toMinorUnits(order.amountKes, order.currency))
              if (amountMinor !== expectedMinor) {
                throw new Error(
                  `Payment amount mismatch for order ${order.id}: expected ${expectedMinor} minor units, got ${amountMinor}`
                )
              }
              if (currency !== order.currency.toUpperCase()) {
                throw new Error(
                  `Currency mismatch for order ${order.id}: expected ${order.currency}, got ${currency}`
                )
              }

              await finalizePaidEventOrderPayment(order.id, reference)
            }
          }
          break
        }

        // Handler B: Tokens Purchase
        if (userId && tokens) {
          const exists = await prisma.tokenTransaction.findFirst({
            where: { referenceId: reference, type: 'PURCHASE' },
          })
          if (!exists) {
            await creditTokens(
              userId,
              parseInt(tokens),
              'PURCHASE',
              `Token purchase - ${tokens} tokens via Paystack`,
              reference ?? undefined
            )

            await prisma.auditLog.create({
              data: {
                actorId: userId,
                action: 'TOKEN_PURCHASE',
                metadata: { reference, tokens, amount: eventData.amount },
              },
            })
          }
          break
        }

        // Handler C: User Credits Top-Up
        if (metadata?.type === 'credits') {
          const creditsToAdd = amountMinor / 100
          await prisma.user.update({
            where: { id: metadata.userId },
            data: { creditBalance: { increment: creditsToAdd } },
          })
          break
        }

        // Handler D: Subscription Plan Payment
        if (metadata?.type === 'subscription_plan' && metadata?.paymentRecordId) {
          await activateSubscriptionPayment(metadata.paymentRecordId, reference ?? null)
          if (metadata?.userId && eventData.customer?.customer_code) {
            await prisma.user.update({
              where: { id: metadata.userId },
              data: { paystackCustomerCode: eventData.customer.customer_code },
            }).catch(() => {})
          }
          break
        }

        // Handler E: Event Pass Payment
        if (metadata?.type === 'event_pass' && metadata?.paymentRecordId) {
          await activateEventPassPayment(metadata.paymentRecordId, reference ?? null)
          break
        }

        break
      }

      // Handler F: Subscription Lifecycle Events
      case 'subscription.create': {
        const { customer, subscription_code } = eventData
        const userId = eventData.metadata?.userId
        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: 'free',
              billingCycle: null,
              planEndDate: null,
              paystackCustomerCode: customer?.customer_code,
              paystackSubscriptionCode: subscription_code,
            },
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const subscriptionCode = eventData.subscription?.subscription_code
        if (subscriptionCode) {
          const user = await prisma.user.findFirst({
            where: { paystackSubscriptionCode: subscriptionCode },
          })
          if (user) {
            await prisma.notification.create({
              data: {
                userId: user.id,
                type: 'EVENT',
                title: 'Payment Failed',
                message: 'Your last payment failed. Please update your payment method to keep your plan active.',
                link: '/dashboard/billing',
              },
            })
          }
        }
        break
      }

      case 'subscription.disable': {
        const subscriptionCode = eventData.subscription_code
        if (subscriptionCode) {
          const user = await prisma.user.findFirst({
            where: { paystackSubscriptionCode: subscriptionCode },
          })
          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                plan: 'free',
                billingCycle: null,
                planEndDate: null,
                paystackSubscriptionCode: null,
              },
            })
          }
        }
        break
      }

      case 'subscription.not_renew': {
        const { subscription_code, next_payment_date } = eventData
        if (subscription_code && next_payment_date) {
          const user = await prisma.user.findFirst({
            where: { paystackSubscriptionCode: subscription_code },
          })
          if (user) {
            await prisma.user.update({
              where: { id: user.id },
              data: { planEndDate: new Date(next_payment_date) },
            })
          }
        }
        break
      }

      default:
        // Other events received and acknowledged without action
        break
    }

    // 5. Transition to PROCESSED
    await prisma.processedProviderEvent.update({
      where: { id: eventRecordId },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
        error: null,
      },
    })

    return { status: 200, body: { received: true, message: 'OK' } }
  } catch (err: unknown) {
    const sanitizedMsg = sanitizeEventError(err)
    console.error(`[PaystackWebhook] Error processing event ${idempotencyKey}:`, sanitizedMsg)

    // 6. Record failure so retry is permitted
    await prisma.processedProviderEvent.update({
      where: { id: eventRecordId },
      data: {
        status: 'FAILED',
        error: sanitizedMsg,
      },
    }).catch(() => {})

    return { status: 500, body: { error: 'Internal processing error' } }
  }
}
