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
  resolveOvercapacityPaidOrder,
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
        if (type === 'paid_event_checkout' || orderId || (paymentRecordId && type !== 'subscription_plan' && type !== 'event_pass')) {
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

        // Handler D2: Recurring renewal charge without paymentRecordId
        if (eventData.plan && (eventData.customer?.customer_code || eventData.customer?.email)) {
          const custCode = eventData.customer?.customer_code
          const custEmail = eventData.customer?.email
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                ...(custCode ? [{ paystackCustomerCode: custCode }] : []),
                ...(custEmail ? [{ email: custEmail }] : []),
              ],
            },
          })
          if (user) {
            const subscription = await prisma.subscription.findFirst({
              where: { userId: user.id },
              orderBy: { updatedAt: 'desc' },
            })
            if (subscription) {
              const amountKes = amountMinor / 100
              const isAnnual = subscription.billingCycle === 'ANNUAL'
              const now = new Date()
              const nextEnd = new Date(now)
              if (isAnnual) nextEnd.setFullYear(nextEnd.getFullYear() + 1)
              else nextEnd.setMonth(nextEnd.getMonth() + 1)

              await prisma.$transaction([
                prisma.subscriptionPayment.create({
                  data: {
                    subscriptionId: subscription.id,
                    amountKes,
                    amountUsd: Math.round((amountKes / 130) * 100) / 100,
                    exchangeRate: 130,
                    provider: 'paystack',
                    providerRef: reference ?? null,
                    status: 'SUCCESS',
                    paidAt: now,
                    description: `Automatic subscription renewal via Paystack (${subscription.billingCycle})`,
                  },
                }),
                prisma.subscription.update({
                  where: { id: subscription.id },
                  data: {
                    status: 'ACTIVE',
                    currentPeriodStart: now,
                    currentPeriodEnd: nextEnd,
                    lastPaymentRef: reference ?? subscription.lastPaymentRef,
                    lastPaymentAmount: amountKes,
                    lastPaymentAt: now,
                    cancelledAt: null,
                  },
                }),
                prisma.user.update({
                  where: { id: user.id },
                  data: {
                    planEndDate: nextEnd,
                  },
                }),
              ])
              break
            }
          }
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
        const { customer, subscription_code, plan: subPlan, next_payment_date } = eventData
        const userId =
          eventData.metadata?.userId ||
          (customer?.customer_code
            ? (await prisma.user.findFirst({
                where: { paystackCustomerCode: customer.customer_code },
                select: { id: true },
              }))?.id
            : null) ||
          (customer?.email
            ? (await prisma.user.findFirst({
                where: { email: customer.email },
                select: { id: true },
              }))?.id
            : null)

        if (userId) {
          const planKey = (
            eventData.metadata?.planKey ||
            subPlan?.name ||
            'standard'
          )
            .toString()
            .trim()
            .toLowerCase()
          const isAnnual =
            eventData.metadata?.billingCycle === 'annual' ||
            subPlan?.interval === 'annually' ||
            subPlan?.interval === 'annual'
          const periodEnd = next_payment_date
            ? new Date(next_payment_date)
            : (() => {
                const d = new Date()
                if (isAnnual) d.setFullYear(d.getFullYear() + 1)
                else d.setMonth(d.getMonth() + 1)
                return d
              })()

          const dbPlan = await prisma.plan.findUnique({
            where: { name: planKey },
          })

          const now = new Date()

          const existingSub = await prisma.subscription.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
          })

          if (existingSub) {
            await prisma.subscription.update({
              where: { id: existingSub.id },
              data: {
                ...(dbPlan ? { planId: dbPlan.id } : {}),
                status: 'ACTIVE',
                billingCycle: isAnnual ? 'ANNUAL' : 'MONTHLY',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                paymentProvider: 'paystack',
                cancelledAt: null,
              },
            })
          } else if (dbPlan) {
            await prisma.subscription.create({
              data: {
                userId,
                planId: dbPlan.id,
                status: 'ACTIVE',
                billingCycle: isAnnual ? 'ANNUAL' : 'MONTHLY',
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                paymentProvider: 'paystack',
              },
            })
          }

          await prisma.user.update({
            where: { id: userId },
            data: {
              plan: planKey,
              billingCycle: isAnnual ? 'annual' : 'monthly',
              planStartDate: now,
              planEndDate: periodEnd,
              paystackCustomerCode: customer?.customer_code,
              paystackSubscriptionCode: subscription_code,
            },
          })

          await prisma.auditLog.create({
            data: {
              actorId: userId,
              action: 'SUBSCRIPTION_CREATED',
              metadata: {
                subscriptionCode: subscription_code,
                planKey,
                isAnnual,
                periodEnd: periodEnd.toISOString(),
              },
            },
          }).catch(() => {})
        }
        break
      }

      case 'invoice.create': {
        console.info(
          `[PaystackWebhook] Received invoice.create for subscription ${eventData.subscription?.subscription_code || eventData.id}`
        )
        break
      }

      case 'invoice.update': {
        const isPaid = eventData.status === 'success' || eventData.paid === true
        const subscriptionCode =
          eventData.subscription?.subscription_code || eventData.subscription_code
        const txRef = eventData.transaction?.reference || eventData.reference

        if (isPaid && subscriptionCode) {
          const user = await prisma.user.findFirst({
            where: { paystackSubscriptionCode: subscriptionCode },
          })

          if (user) {
            const subscription = await prisma.subscription.findFirst({
              where: { userId: user.id },
              orderBy: { updatedAt: 'desc' },
            })

            const now = new Date()
            const periodStart = eventData.period_start ? new Date(eventData.period_start) : now
            const periodEnd = eventData.period_end
              ? new Date(eventData.period_end)
              : (() => {
                  const d = new Date(periodStart)
                  if (subscription?.billingCycle === 'ANNUAL') d.setFullYear(d.getFullYear() + 1)
                  else d.setMonth(d.getMonth() + 1)
                  return d
                })()

            const amountMinor = Number(eventData.amount || 0)
            const amountKes = amountMinor / 100

            if (subscription) {
              await prisma.$transaction([
                prisma.subscriptionPayment.create({
                  data: {
                    subscriptionId: subscription.id,
                    amountKes,
                    amountUsd: Math.round((amountKes / 130) * 100) / 100,
                    exchangeRate: 130,
                    provider: 'paystack',
                    providerRef: txRef ?? null,
                    status: 'SUCCESS',
                    paidAt: now,
                    description: `Paystack subscription renewal invoice (${subscription.billingCycle})`,
                  },
                }),
                prisma.subscription.update({
                  where: { id: subscription.id },
                  data: {
                    status: 'ACTIVE',
                    currentPeriodStart: periodStart,
                    currentPeriodEnd: periodEnd,
                    lastPaymentRef: txRef ?? subscription.lastPaymentRef,
                    lastPaymentAmount: amountKes,
                    lastPaymentAt: now,
                    cancelledAt: null,
                  },
                }),
                prisma.user.update({
                  where: { id: user.id },
                  data: {
                    planEndDate: periodEnd,
                  },
                }),
              ])

              await prisma.notification.create({
                data: {
                  userId: user.id,
                  type: 'EVENT',
                  title: 'Subscription Renewed',
                  message: `Your ${user.plan} subscription has renewed through ${periodEnd.toLocaleDateString()}.`,
                  link: '/dashboard/billing',
                },
              }).catch(() => {})

              await prisma.auditLog.create({
                data: {
                  actorId: user.id,
                  action: 'SUBSCRIPTION_RENEWED',
                  metadata: {
                    subscriptionCode,
                    amountKes,
                    txRef,
                    periodEnd: periodEnd.toISOString(),
                  },
                },
              }).catch(() => {})
            }
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const subscriptionCode =
          eventData.subscription?.subscription_code || eventData.subscription_code
        if (subscriptionCode) {
          const user = await prisma.user.findFirst({
            where: { paystackSubscriptionCode: subscriptionCode },
          })
          if (user) {
            const subscription = await prisma.subscription.findFirst({
              where: { userId: user.id },
              orderBy: { updatedAt: 'desc' },
            })

            const now = new Date()
            const periodEnd = subscription?.currentPeriodEnd || user.planEndDate
            const inGracePeriod = periodEnd
              ? now.getTime() <= new Date(periodEnd).getTime() + 3 * 24 * 60 * 60 * 1000
              : false

            if (subscription) {
              await prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                  status: inGracePeriod ? 'PAST_DUE' : 'EXPIRED',
                },
              })
            }

            if (!inGracePeriod) {
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  plan: 'free',
                  billingCycle: null,
                  planEndDate: null,
                },
              })
            }

            await prisma.notification.create({
              data: {
                userId: user.id,
                type: 'EVENT',
                title: 'Subscription Payment Failed',
                message: inGracePeriod
                  ? 'Your renewal payment failed. You are currently in a 3-day grace period. Please update your payment method to keep your benefits active.'
                  : 'Your subscription renewal failed and the grace period has ended. Your account has been placed on the Free tier.',
                link: '/dashboard/billing',
              },
            }).catch(() => {})

            await prisma.auditLog.create({
              data: {
                actorId: user.id,
                action: 'SUBSCRIPTION_PAYMENT_FAILED',
                metadata: {
                  subscriptionCode,
                  inGracePeriod,
                  reason: eventData.message || eventData.description,
                },
              },
            }).catch(() => {})
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
            const now = new Date()
            const subscription = await prisma.subscription.findFirst({
              where: { userId: user.id },
              orderBy: { updatedAt: 'desc' },
            })

            const isPeriodEnded = subscription?.currentPeriodEnd
              ? now.getTime() >= subscription.currentPeriodEnd.getTime()
              : true

            if (subscription) {
              await prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                  status: 'CANCELLED',
                  cancelledAt: now,
                },
              })
            }

            if (isPeriodEnded) {
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  plan: 'free',
                  billingCycle: null,
                  planEndDate: null,
                  paystackSubscriptionCode: null,
                },
              })
            } else {
              await prisma.user.update({
                where: { id: user.id },
                data: {
                  paystackSubscriptionCode: null,
                },
              })
            }

            await prisma.auditLog.create({
              data: {
                actorId: user.id,
                action: 'SUBSCRIPTION_DISABLED',
                metadata: {
                  subscriptionCode,
                  isPeriodEnded,
                },
              },
            }).catch(() => {})
          }
        }
        break
      }

      case 'subscription.not_renew': {
        const { subscription_code, next_payment_date } = eventData
        if (subscription_code) {
          const user = await prisma.user.findFirst({
            where: { paystackSubscriptionCode: subscription_code },
          })
          if (user) {
            const now = new Date()
            const subscription = await prisma.subscription.findFirst({
              where: { userId: user.id },
              orderBy: { updatedAt: 'desc' },
            })

            const finalDate = next_payment_date ? new Date(next_payment_date) : subscription?.currentPeriodEnd || now

            if (subscription) {
              await prisma.subscription.update({
                where: { id: subscription.id },
                data: {
                  cancelledAt: now,
                },
              })
            }

            await prisma.user.update({
              where: { id: user.id },
              data: {
                planEndDate: finalDate,
              },
            })

            await prisma.auditLog.create({
              data: {
                actorId: user.id,
                action: 'SUBSCRIPTION_NOT_RENEWING',
                metadata: {
                  subscriptionCode: subscription_code,
                  finalDate: finalDate.toISOString(),
                },
              },
            }).catch(() => {})
          }
        }
        break
      }

      case 'subscription.expiring_cards': {
        const { subscription_code, brand, expiry_month, expiry_year } = eventData
        if (subscription_code) {
          const user = await prisma.user.findFirst({
            where: { paystackSubscriptionCode: subscription_code },
          })
          if (user) {
            await prisma.notification.create({
              data: {
                userId: user.id,
                type: 'EVENT',
                title: 'Card Expiring Soon',
                message: `Your ${brand || 'payment'} card ends ${expiry_month}/${expiry_year}. Please update it in Billing to avoid service interruption.`,
                link: '/dashboard/billing',
              },
            }).catch(() => {})
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

      // Handler H: Refund Events
      case 'refund.processed': {
        const refundRef =
          eventData.reference ||
          (typeof eventData.id === 'string' ? eventData.id : String(eventData.id || ''))
        const txObj =
          typeof eventData.transaction === 'object' && eventData.transaction !== null
            ? eventData.transaction
            : null
        const txRef =
          (txObj && typeof txObj.reference === 'string' && txObj.reference) ||
          (typeof eventData.transaction_reference === 'string' && eventData.transaction_reference) ||
          (typeof eventData.transaction === 'string' && eventData.transaction) ||
          null

        if (!refundRef && !txRef) {
          console.warn(
            '[PaystackWebhook] refund.processed event received without refund reference or transaction reference'
          )
          break
        }

        const order = await prisma.paidEventOrder.findFirst({
          where: {
            OR: [
              ...(txRef ? [{ providerReference: txRef }] : []),
              ...(refundRef ? [{ providerReference: refundRef }] : []),
            ],
          },
          select: {
            id: true,
            status: true,
            fulfillmentStatus: true,
            amountKes: true,
            currency: true,
            providerReference: true,
          },
        })

        if (!order) {
          console.warn(
            `[PaystackWebhook] refund.processed event for unknown order (txRef: ${txRef}, refundRef: ${refundRef})`
          )
          break
        }

        // Integrity check: amount & currency
        if (eventData.amount !== undefined) {
          const webhookMinor = BigInt(eventData.amount)
          const expectedMinor = toMinorUnits(order.amountKes, order.currency || 'KES')
          if (webhookMinor !== expectedMinor) {
            console.error(
              `[PaystackWebhook] Refund amount mismatch for order ${order.id}: expected ${expectedMinor}, got ${webhookMinor}`
            )
            return { status: 400, body: { error: 'Refund amount mismatch' } }
          }
        }
        if (eventData.currency) {
          const webhookCurr = eventData.currency.toString().trim().toUpperCase()
          const orderCurr = (order.currency || 'KES').toUpperCase()
          if (webhookCurr !== orderCurr) {
            console.error(
              `[PaystackWebhook] Refund currency mismatch for order ${order.id}: expected ${orderCurr}, got ${webhookCurr}`
            )
            return { status: 400, body: { error: 'Refund currency mismatch' } }
          }
        }

        const refundRes = await resolveOvercapacityPaidOrder({
          orderId: order.id,
          resolution: 'MANUAL_REFUND',
          actorId: 'PAYSTACK_WEBHOOK',
          providerRefundReference: refundRef,
          refundMetadata: {
            webhookEvent: 'refund.processed',
            refundId: eventData.id,
            transactionReference: txRef,
            amountMinorUnits: eventData.amount,
            currency: eventData.currency,
            refundedAt: eventData.refunded_at,
          },
          notes:
            eventData.customer_note ||
            eventData.merchant_note ||
            'Refund confirmed by Paystack webhook (refund.processed)',
        })

        if (!refundRes.success && !refundRes.duplicate) {
          console.error(
            `[PaystackWebhook] Failed to process refund.processed for order ${order.id}: ${refundRes.error}`
          )
        }
        break
      }

      case 'refund.failed': {
        const refundRef =
          eventData.reference ||
          (typeof eventData.id === 'string' ? eventData.id : String(eventData.id || ''))
        const txObj =
          typeof eventData.transaction === 'object' && eventData.transaction !== null
            ? eventData.transaction
            : null
        const txRef =
          (txObj && typeof txObj.reference === 'string' && txObj.reference) ||
          (typeof eventData.transaction_reference === 'string' && eventData.transaction_reference) ||
          (typeof eventData.transaction === 'string' && eventData.transaction) ||
          null

        if (!refundRef && !txRef) {
          console.warn('[PaystackWebhook] refund.failed event received without reference')
          break
        }

        const order = await prisma.paidEventOrder.findFirst({
          where: {
            OR: [
              ...(txRef ? [{ providerReference: txRef }] : []),
              ...(refundRef ? [{ providerReference: refundRef }] : []),
            ],
          },
          select: {
            id: true,
            status: true,
            fulfillmentStatus: true,
          },
        })

        if (!order) {
          console.warn(
            `[PaystackWebhook] refund.failed event for unknown order (txRef: ${txRef}, refundRef: ${refundRef})`
          )
          break
        }

        if (order.status === 'OVERCAPACITY_PAID' || order.fulfillmentStatus?.startsWith('REFUND_')) {
          await prisma.paidEventOrder.update({
            where: { id: order.id },
            data: {
              fulfillmentStatus: 'REFUND_FAILED',
              resolutionNotes: `Provider reported refund failed via webhook: ${
                eventData.reason || eventData.message || refundRef
              }`,
            },
          })

          await prisma.auditLog.create({
            data: {
              actorId: 'PAYSTACK_WEBHOOK',
              action: 'ORDER_OVERCAPACITY_REFUND_FAILED',
              metadata: {
                orderId: order.id,
                refundReference: refundRef,
                transactionReference: txRef,
                reason: eventData.reason || eventData.message,
                receivedAt: new Date().toISOString(),
              },
            },
          }).catch(() => {})
        }
        break
      }

      case 'settlement.create':
      case 'settlement.success': {
        // Paystack does not provide per-transaction breakdown in webhook payloads.
        // Webhooks only signal that a bulk merchant payout was created/completed.
        // Invariant: NEVER mark individual payments as settled from an unverified bulk webhook signal.
        // Settlement verification MUST ingest authoritative transaction evidence via the verified
        // settlement API sync worker (GET /settlement/:id/transactions) or verified settlement reports.
        console.info(
          `[PaystackWebhook] Received bulk ${eventType} event (id: ${eventData.id}, batch: ${eventData.settlement_date || eventData.createdAt}). ` +
          `Per-transaction settlement evidence must be verified through the settlement sync worker.`
        )
        break
      }

      // Handler I: Charge Dispute & Quarantine Events
      case 'charge.dispute.create':
      case 'charge.dispute.remind': {
        const txObj =
          typeof eventData.transaction === 'object' && eventData.transaction !== null
            ? eventData.transaction
            : null
        const txRef =
          (txObj && typeof txObj.reference === 'string' && txObj.reference) ||
          (typeof eventData.transaction_reference === 'string' && eventData.transaction_reference) ||
          (typeof eventData.reference === 'string' && eventData.reference) ||
          null

        if (!txRef) {
          console.warn(`[PaystackWebhook] ${eventType} event received without transaction reference`)
          break
        }

        const payment = await prisma.payment.findFirst({
          where: {
            OR: [
              { mpesaRef: txRef },
              { paidEventOrder: { providerReference: txRef } },
            ],
          },
          include: {
            event: { select: { id: true, organizerId: true } },
            paidEventOrder: { select: { id: true } },
          },
        })

        if (!payment) {
          console.warn(`[PaystackWebhook] ${eventType} event for unknown payment (txRef: ${txRef})`)
          break
        }

        // Quarantines the disputed funds: immediately transitions settlementStatus to DISPUTED
        // This removes the funds from the organizer's withdrawable balance in organizerBalanceEngine
        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            settlementStatus: 'DISPUTED',
            settlementEvidence: {
              ...(typeof payment.settlementEvidence === 'object' && payment.settlementEvidence !== null
                ? (payment.settlementEvidence as Record<string, unknown>)
                : {}),
              dispute: {
                disputeId: eventData.id,
                status: eventData.status,
                amountMinorUnits: eventData.amount,
                currency: eventData.currency,
                reason: eventData.reason,
                evidenceSupplied: eventData.evidence,
                createdAt: new Date().toISOString(),
              },
            },
          },
        })

        await prisma.auditLog.create({
          data: {
            actorId: 'PAYSTACK_WEBHOOK',
            action: 'PAYMENT_DISPUTE_QUARANTINED',
            metadata: {
              paymentId: payment.id,
              orderId: payment.paidEventOrderId,
              organizerId: payment.event.organizerId,
              disputeId: eventData.id,
              amount: eventData.amount,
              reason: eventData.reason,
            },
          },
        }).catch(() => {})

        console.warn(
          `[PaystackWebhook] Quarantined disputed payment ${payment.id} (tx: ${txRef}, dispute: ${eventData.id})`
        )
        break
      }

      case 'charge.dispute.resolve': {
        const txObj =
          typeof eventData.transaction === 'object' && eventData.transaction !== null
            ? eventData.transaction
            : null
        const txRef =
          (txObj && typeof txObj.reference === 'string' && txObj.reference) ||
          (typeof eventData.transaction_reference === 'string' && eventData.transaction_reference) ||
          (typeof eventData.reference === 'string' && eventData.reference) ||
          null

        if (!txRef) {
          console.warn('[PaystackWebhook] charge.dispute.resolve event received without transaction reference')
          break
        }

        const payment = await prisma.payment.findFirst({
          where: {
            OR: [
              { mpesaRef: txRef },
              { paidEventOrder: { providerReference: txRef } },
            ],
          },
          include: {
            event: { select: { id: true, organizerId: true } },
          },
        })

        if (!payment) {
          console.warn(`[PaystackWebhook] charge.dispute.resolve event for unknown payment (txRef: ${txRef})`)
          break
        }

        const resolution = (eventData.resolution || eventData.status || '').toString().toLowerCase()
        const isDisputeWon =
          resolution === 'merchant-accepted' ||
          resolution === 'won' ||
          resolution === 'resolved'

        const nextSettlementStatus = isDisputeWon
          ? (payment.settledAt || payment.settlementBatchId ? 'SETTLED' : 'PENDING')
          : 'REVERSED'

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            settlementStatus: nextSettlementStatus,
            settlementEvidence: {
              ...(typeof payment.settlementEvidence === 'object' && payment.settlementEvidence !== null
                ? (payment.settlementEvidence as Record<string, unknown>)
                : {}),
              disputeResolution: {
                disputeId: eventData.id,
                resolution,
                resolvedAt: new Date().toISOString(),
              },
            },
          },
        })

        await prisma.auditLog.create({
          data: {
            actorId: 'PAYSTACK_WEBHOOK',
            action: isDisputeWon ? 'PAYMENT_DISPUTE_RESOLVED_WON' : 'PAYMENT_DISPUTE_RESOLVED_LOST',
            metadata: {
              paymentId: payment.id,
              orderId: payment.paidEventOrderId,
              organizerId: payment.event.organizerId,
              disputeId: eventData.id,
              resolution,
              newSettlementStatus: nextSettlementStatus,
            },
          },
        }).catch(() => {})

        console.info(
          `[PaystackWebhook] Dispute ${eventData.id} for payment ${payment.id} resolved (${resolution} -> ${nextSettlementStatus})`
        )
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
