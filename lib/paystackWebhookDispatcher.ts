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
import {
  completeOrganizerWithdrawal,
  failAndReleaseOrganizerWithdrawal,
  reverseOrganizerWithdrawal,
} from '@/lib/withdrawalService'
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

  // 3. Idempotency Check & Distributed Lease Acquisition
  const now = new Date()
  const LEASE_TIMEOUT_MS = 60_000 // 60 seconds lease window
  let eventRecordId: string = ''

  let existingRecord = await prisma.processedProviderEvent.findUnique({
    where: { idempotencyKey },
  })

  if (!existingRecord) {
    try {
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
    } catch (createErr: any) {
      if (createErr?.code === 'P2002') {
        // Race condition: another worker inserted simultaneously. Fetch that record.
        existingRecord = await prisma.processedProviderEvent.findUnique({
          where: { idempotencyKey },
        })
      } else {
        throw createErr
      }
    }
  }

  if (existingRecord) {
    // A. Already durably completed
    if (existingRecord.status === 'PROCESSED') {
      return { status: 200, body: { message: 'Event was already successfully processed.' } }
    }

    // B. In PROCESSING: check lease age
    if (existingRecord.status === 'PROCESSING') {
      const lastAttempt = existingRecord.lastAttemptAt ?? existingRecord.firstSeenAt
      const ageMs = now.getTime() - new Date(lastAttempt).getTime()

      if (ageMs < LEASE_TIMEOUT_MS) {
        // Active worker in progress. Wait briefly with short polling to confirm durable completion
        const waitIntervals = [200, 400, 600, 800]
        let settledRecord = null

        for (const waitMs of waitIntervals) {
          await new Promise((res) => setTimeout(res, waitMs))
          const polled = await prisma.processedProviderEvent.findUnique({
            where: { idempotencyKey },
          })
          if (polled?.status === 'PROCESSED') {
            return { status: 200, body: { message: 'Event was already successfully processed.' } }
          }
          if (polled?.status === 'FAILED') {
            settledRecord = polled
            break
          }
        }

        if (!settledRecord) {
          // Worker is still in progress and lease has not expired.
          // Return 503 so Paystack will retry if worker crashes. Do NOT falsely acknowledge 200!
          return {
            status: 503,
            body: { message: 'Event processing currently in progress by another worker. Retry pending.' },
          }
        }
        existingRecord = settledRecord
      }
    }

    // C. Status is FAILED or lease expired (stale PROCESSING): acquire lease atomically via optimistic lock
    const acquired = await prisma.processedProviderEvent.updateMany({
      where: {
        id: existingRecord.id,
        status: existingRecord.status,
        lastAttemptAt: existingRecord.lastAttemptAt,
      },
      data: {
        status: 'PROCESSING',
        lastAttemptAt: now,
        attemptCount: { increment: 1 },
      },
    })

    if (acquired.count === 0) {
      // Another concurrent worker acquired the lease simultaneously
      return {
        status: 503,
        body: { message: 'Concurrent lease contention; retry pending.' },
      }
    }

    eventRecordId = existingRecord.id
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

              const finalResult = await finalizePaidEventOrderPayment(order.id, reference)
              if (finalResult.status === 'OVERCAPACITY_PAID') {
                console.warn(`[PaystackWebhook] Order ${order.id} marked OVERCAPACITY_PAID: ${finalResult.message}`)
              }
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
        if (metadata?.type === 'credits' && metadata?.userId) {
          const existingCreditTx = reference
            ? await prisma.creditTransaction.findFirst({
                where: { userId: metadata.userId, reference, type: 'PURCHASE' },
              })
            : null

          if (!existingCreditTx) {
            const creditsToAdd = amountMinor / 100
            await prisma.$transaction([
              prisma.user.update({
                where: { id: metadata.userId },
                data: { creditBalance: { increment: creditsToAdd } },
              }),
              prisma.creditTransaction.create({
                data: {
                  userId: metadata.userId,
                  amount: creditsToAdd,
                  type: 'PURCHASE',
                  description: 'Credits purchase via Paystack',
                  reference: reference ?? null,
                },
              }),
            ])
          }
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

      // Handler G: Payout Transfer Events
      case 'transfer.success': {
        const transferRef = eventData.reference
        const transferCode = eventData.transfer_code
        if (!transferRef && !transferCode) {
          console.warn('[PaystackWebhook] transfer.success event received without reference or transfer_code')
          break
        }

        const withdrawal = await prisma.withdrawal.findFirst({
          where: {
            OR: [
              ...(transferRef ? [{ providerRef: transferRef }] : []),
              ...(transferCode ? [{ transferCode }] : []),
            ],
          },
        })

        if (!withdrawal) {
          console.warn(`[PaystackWebhook] transfer.success event for unknown withdrawal (ref: ${transferRef}, code: ${transferCode})`)
          break
        }

        // Integrity check: Amount and currency validation
        if (eventData.amount !== undefined) {
          const webhookMinor = BigInt(eventData.amount)
          const expectedMinor = withdrawal.amountMinorUnits ?? toMinorUnits(withdrawal.amount, withdrawal.currency)
          if (webhookMinor !== expectedMinor) {
            console.error(`[PaystackWebhook] Transfer amount mismatch for withdrawal ${withdrawal.id}: expected ${expectedMinor}, got ${webhookMinor}`)
            return { status: 400, body: { error: 'Transfer amount mismatch' } }
          }
        }
        if (eventData.currency) {
          const webhookCurr = eventData.currency.toString().trim().toUpperCase()
          if (webhookCurr !== withdrawal.currency.toUpperCase()) {
            console.error(`[PaystackWebhook] Transfer currency mismatch for withdrawal ${withdrawal.id}: expected ${withdrawal.currency}, got ${webhookCurr}`)
            return { status: 400, body: { error: 'Transfer currency mismatch' } }
          }
        }

        const settledAt = eventData.transferred_at ? new Date(eventData.transferred_at) : new Date()
        const compRes = await completeOrganizerWithdrawal({
          withdrawalId: withdrawal.id,
          providerReference: transferRef || withdrawal.providerRef || undefined,
          settledAt,
          actorId: 'PAYSTACK_WEBHOOK',
        })
        if (!compRes.success && !compRes.duplicate) {
          console.error(`[PaystackWebhook] CRITICAL DISCREPANCY on transfer.success for withdrawal ${withdrawal.id}: ${compRes.message}`)
        }
        break
      }

      case 'transfer.failed': {
        const transferRef = eventData.reference
        const transferCode = eventData.transfer_code
        if (!transferRef && !transferCode) {
          console.warn('[PaystackWebhook] transfer.failed event received without reference or transfer_code')
          break
        }

        const withdrawal = await prisma.withdrawal.findFirst({
          where: {
            OR: [
              ...(transferRef ? [{ providerRef: transferRef }] : []),
              ...(transferCode ? [{ transferCode }] : []),
            ],
          },
        })

        if (!withdrawal) {
          console.warn(`[PaystackWebhook] transfer.failed event for unknown withdrawal (ref: ${transferRef}, code: ${transferCode})`)
          break
        }

        // Integrity check: Amount and currency validation
        if (eventData.amount !== undefined) {
          const webhookMinor = BigInt(eventData.amount)
          const expectedMinor = withdrawal.amountMinorUnits ?? toMinorUnits(withdrawal.amount, withdrawal.currency)
          if (webhookMinor !== expectedMinor) {
            console.error(`[PaystackWebhook] Transfer amount mismatch for withdrawal ${withdrawal.id}: expected ${expectedMinor}, got ${webhookMinor}`)
            return { status: 400, body: { error: 'Transfer amount mismatch' } }
          }
        }
        if (eventData.currency) {
          const webhookCurr = eventData.currency.toString().trim().toUpperCase()
          if (webhookCurr !== withdrawal.currency.toUpperCase()) {
            console.error(`[PaystackWebhook] Transfer currency mismatch for withdrawal ${withdrawal.id}: expected ${withdrawal.currency}, got ${webhookCurr}`)
            return { status: 400, body: { error: 'Transfer currency mismatch' } }
          }
        }

        const failRes = await failAndReleaseOrganizerWithdrawal({
          withdrawalId: withdrawal.id,
          reason: eventData.reason || eventData.message || 'Transfer failed on payment provider',
          actorId: 'PAYSTACK_WEBHOOK',
        })
        if (!failRes.success && !failRes.duplicate) {
          console.error(`[PaystackWebhook] CRITICAL DISCREPANCY on transfer.failed for withdrawal ${withdrawal.id}: ${failRes.message}`)
        }
        break
      }

      case 'transfer.reversed': {
        const transferRef = eventData.reference
        const transferCode = eventData.transfer_code
        if (!transferRef && !transferCode) {
          console.warn('[PaystackWebhook] transfer.reversed event received without reference or transfer_code')
          break
        }

        const withdrawal = await prisma.withdrawal.findFirst({
          where: {
            OR: [
              ...(transferRef ? [{ providerRef: transferRef }] : []),
              ...(transferCode ? [{ transferCode }] : []),
            ],
          },
        })

        if (!withdrawal) {
          console.warn(`[PaystackWebhook] transfer.reversed event for unknown withdrawal (ref: ${transferRef}, code: ${transferCode})`)
          break
        }

        // Integrity check: Amount and currency validation
        if (eventData.amount !== undefined) {
          const webhookMinor = BigInt(eventData.amount)
          const expectedMinor = withdrawal.amountMinorUnits ?? toMinorUnits(withdrawal.amount, withdrawal.currency)
          if (webhookMinor !== expectedMinor) {
            console.error(`[PaystackWebhook] Transfer amount mismatch for withdrawal ${withdrawal.id}: expected ${expectedMinor}, got ${webhookMinor}`)
            return { status: 400, body: { error: 'Transfer amount mismatch' } }
          }
        }
        if (eventData.currency) {
          const webhookCurr = eventData.currency.toString().trim().toUpperCase()
          if (webhookCurr !== withdrawal.currency.toUpperCase()) {
            console.error(`[PaystackWebhook] Transfer currency mismatch for withdrawal ${withdrawal.id}: expected ${withdrawal.currency}, got ${webhookCurr}`)
            return { status: 400, body: { error: 'Transfer currency mismatch' } }
          }
        }

        const revRes = await reverseOrganizerWithdrawal({
          withdrawalId: withdrawal.id,
          reason: eventData.reason || eventData.message || 'Transfer reversed by recipient institution',
          actorId: 'PAYSTACK_WEBHOOK',
        })
        if (!revRes.success && !revRes.duplicate) {
          console.error(`[PaystackWebhook] CRITICAL DISCREPANCY on transfer.reversed for withdrawal ${withdrawal.id}: ${revRes.message}`)
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
    try {
      await prisma.processedProviderEvent.update({
        where: { id: eventRecordId },
        data: {
          status: 'FAILED',
          error: sanitizedMsg,
        },
      })
    } catch {
      // Ignore secondary error recording failure
    }

    return { status: 500, body: { error: 'Internal processing error' } }
  }
}
