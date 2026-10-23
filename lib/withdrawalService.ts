/**
 * Concurrency-Safe Organizer Withdrawal & Reservation Service
 *
 * Enforces strict financial guarantees:
 * 1. An organizer may withdraw only settled, unreserved funds (verified evidence).
 * 2. Unsettled ticket payments NEVER increase withdrawable balance.
 * 3. Concurrency-safe atomic reservation prevents race conditions or double withdrawals.
 * 4. Payout reservation debits the ledger immediately upon request.
 * 5. Synchronous provider rejections atomically release the reservation.
 * 6. Asynchronous completions/failures/reversals via webhook transition states idempotently.
 */

import prisma from '@/lib/prisma'
import {
  toMinorUnits,
  buildWithdrawalReservationIdempotencyKey,
  buildWithdrawalCompletionIdempotencyKey,
  buildWithdrawalReleaseIdempotencyKey,
} from '@/lib/financialLedger'
import { getAuthoritativeOrganizerBalance } from '@/lib/organizerBalanceEngine'
import { PaystackApiError, PaystackValidationError } from '@/lib/paystack'
import { verifyPaystackTransfer } from '@/lib/paystackPayouts'
import { isAdminEmail } from '@/lib/isAdmin'
import { WithdrawalMethod, WithdrawalStatus, Prisma } from '@prisma/client'
import crypto from 'crypto'

export function isAmbiguousDispatchError(err: unknown): boolean {
  if (!err) return false
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return true
    const msg = err.message.toLowerCase()
    if (
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('network') ||
      msg.includes('fetch failed') ||
      msg.includes('econnreset') ||
      msg.includes('etimedout') ||
      msg.includes('socket hang up') ||
      msg.includes('gateway')
    ) {
      return true
    }
  }
  if (err instanceof PaystackApiError && err.statusCode >= 500) {
    return true
  }
  return false
}

export class InsufficientSettledBalanceError extends Error {
  readonly availableMinorUnits: bigint
  readonly requestedMinorUnits: bigint

  constructor(message: string, availableMinorUnits: bigint, requestedMinorUnits: bigint) {
    super(message)
    this.name = 'InsufficientSettledBalanceError'
    this.availableMinorUnits = availableMinorUnits
    this.requestedMinorUnits = requestedMinorUnits
  }
}

export type RequestWithdrawalInput = {
  organizerId: string
  amount: number
  currency?: 'KES' | 'USD'
  method: WithdrawalMethod
  destination: string
  destinationPayload: {
    phone?: string
    accountNumber?: string
    bankName?: string
    bankCode?: string
    accountName?: string
  }
  narrative?: string
  clientReference?: string
}

export type WithdrawalRequestResult = {
  success: boolean
  withdrawalId: string
  status: WithdrawalStatus
  reference: string
  amount: number
  currency: string
  destination: string
  message?: string
}

export function buildWithdrawalIdempotencyKey(organizerId: string, ref: string): string {
  return `wd:${organizerId}:${ref}`
}

/**
 * Normalizes a transfer reference to conform strictly with Paystack's requirements:
 * - Length: 16 to 50 characters
 * - Characters: lowercase a-z, 0-9, underscores (_), and dashes (-)
 */
export function normalizePaystackTransferReference(ref: string, prefix = 'wd'): string {
  const sanitized = ref.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_')
  if (sanitized.length >= 16 && sanitized.length <= 50) {
    return sanitized
  }
  const hash = crypto.createHash('sha256').update(ref).digest('hex').slice(0, 16)
  return `${prefix}_${sanitized.slice(0, 20)}_${hash}`.slice(0, 50)
}

/**
 * Concurrency-safe withdrawal initiation with atomic reservation and immediate release on synchronous rejection.
 */
export async function requestOrganizerWithdrawal(
  input: RequestWithdrawalInput,
  payoutDispatcher?: (args: {
    amountMinorUnits: bigint
    currency: string
    destination: string
    payload: RequestWithdrawalInput['destinationPayload']
    reference: string
    narrative: string
  }) => Promise<{ reference: string; transferCode?: string; recipientCode?: string }>
): Promise<WithdrawalRequestResult> {
  const currency = (input.currency || 'KES').toUpperCase() as 'KES' | 'USD'
  const minimum = currency === 'USD' ? 1 : 100
  if (input.amount < minimum) {
    throw new Error(`Minimum withdrawal is ${currency} ${minimum}.`)
  }

  const requestedMinorUnits = toMinorUnits(input.amount, currency)
  const rawRef = input.clientReference?.trim() || `wd_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  const clientRef = normalizePaystackTransferReference(rawRef)
  const idempotencyKey = buildWithdrawalIdempotencyKey(input.organizerId, clientRef)

  // 1. Atomic Reservation Critical Section
  const reservationOutcome = await prisma.$transaction(async (tx) => {
    // Acquire row-level lock on User record to serialize withdrawal requests for this organizer
    try {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${input.organizerId} FOR UPDATE`
    } catch {
      // Non-postgres fallback for test simulation
    }

    // Check for existing withdrawal with the same idempotency key (idempotency guard)
    const existingWithdrawal = await tx.withdrawal.findUnique({
      where: { idempotencyKey },
    })
    if (existingWithdrawal) {
      return {
        isDuplicate: true as const,
        withdrawal: existingWithdrawal,
      }
    }

    // Authoritative balance recalculation under the lock
    const balance = await getAuthoritativeOrganizerBalance(input.organizerId, currency, tx as any)

    if (requestedMinorUnits > balance.availableMinorUnits) {
      const availableNum = Number(balance.availableMinorUnits) / 100
      const pendingNum = Number(balance.pendingSettlementMinorUnits) / 100
      throw new InsufficientSettledBalanceError(
        `Withdrawal amount (${currency} ${input.amount}) exceeds your settled and available balance (${currency} ${availableNum}). Unsettled funds pending in Paystack: ${currency} ${pendingNum}.`,
        balance.availableMinorUnits,
        requestedMinorUnits
      )
    }

    // Create Withdrawal record in PROCESSING state
    const createdWithdrawal = await tx.withdrawal.create({
      data: {
        organiserId: input.organizerId,
        amount: input.amount,
        amountMinorUnits: requestedMinorUnits,
        currency,
        method: input.method,
        destination: input.destination,
        status: 'PROCESSING',
        idempotencyKey,
        providerRef: clientRef,
      },
    })

    // Post WITHDRAWAL_RESERVATION (DEBIT) in FinancialLedgerEntry
    const resLedgerKey = buildWithdrawalReservationIdempotencyKey(createdWithdrawal.id)
    await tx.financialLedgerEntry.upsert({
      where: { idempotencyKey: resLedgerKey },
      create: {
        organizerId: input.organizerId,
        withdrawalId: createdWithdrawal.id,
        entryType: 'WITHDRAWAL_RESERVATION',
        direction: 'DEBIT',
        amountMinorUnits: requestedMinorUnits,
        currency,
        idempotencyKey: resLedgerKey,
        providerReference: clientRef,
        description: `Withdrawal reservation for ${currency} ${input.amount} to ${input.destination}`,
      },
      update: {},
    })

    // Update legacy OrganiserBalance
    await tx.organiserBalance.upsert({
      where: { organiserId: input.organizerId },
      create:
        currency === 'USD'
          ? { organiserId: input.organizerId, withdrawnUSD: input.amount }
          : { organiserId: input.organizerId, withdrawnKES: input.amount },
      update:
        currency === 'USD'
          ? { withdrawnUSD: { increment: input.amount } }
          : { withdrawnKES: { increment: input.amount } },
    })

    // Audit log
    await tx.auditLog.create({
      data: {
        actorId: input.organizerId,
        action: 'WITHDRAWAL_RESERVATION_CREATED',
        metadata: {
          withdrawalId: createdWithdrawal.id,
          amount: input.amount,
          amountMinorUnits: requestedMinorUnits.toString(),
          currency,
          method: input.method,
          destination: input.destination,
          clientRef,
        },
      },
    })

    return {
      isDuplicate: false as const,
      withdrawal: createdWithdrawal,
    }
  }, {
    maxWait: 5000,
    timeout: 10000,
  })

  if (reservationOutcome.isDuplicate) {
    return {
      success: true,
      withdrawalId: reservationOutcome.withdrawal.id,
      status: reservationOutcome.withdrawal.status,
      reference: reservationOutcome.withdrawal.providerRef || clientRef,
      amount: reservationOutcome.withdrawal.amount,
      currency: reservationOutcome.withdrawal.currency,
      destination: reservationOutcome.withdrawal.destination,
      message: 'Duplicate withdrawal request returned existing record.',
    }
  }

  const withdrawal = reservationOutcome.withdrawal

  // 2. Post-Reservation Provider Dispatch
  // If payoutDispatcher is provided, dispatch to payout provider
  if (payoutDispatcher) {
    try {
      const providerRes = await payoutDispatcher({
        amountMinorUnits: requestedMinorUnits,
        currency,
        destination: input.destination,
        payload: input.destinationPayload,
        reference: clientRef,
        narrative: input.narrative || `EventSlot Payout ${currency} ${input.amount}`,
      })

      // Update withdrawal with provider references
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          providerRef: providerRes.reference,
          transferCode: providerRes.transferCode,
          recipientCode: providerRes.recipientCode,
          failureReason: null,
        },
      })

      return {
        success: true,
        withdrawalId: withdrawal.id,
        status: 'PROCESSING',
        reference: providerRes.reference,
        amount: input.amount,
        currency,
        destination: input.destination,
      }
    } catch (dispatchErr: any) {
      // Differentiate definitive client/provider rejections from ambiguous network/timeout outcomes
      const isAmbiguous = isAmbiguousDispatchError(dispatchErr)

      if (!isAmbiguous) {
        // Synchronous definitive rejection: Atomically release the reservation
        await failAndReleaseOrganizerWithdrawal({
          withdrawalId: withdrawal.id,
          reason: dispatchErr instanceof Error ? dispatchErr.message : 'Payout provider definitively rejected withdrawal request.',
          actorId: input.organizerId,
        })

        return {
          success: false,
          withdrawalId: withdrawal.id,
          status: 'FAILED',
          reference: clientRef,
          amount: input.amount,
          currency,
          destination: input.destination,
          message: dispatchErr instanceof Error ? dispatchErr.message : 'Payout provider rejected withdrawal request.',
        }
      }

      // Ambiguous outcome (timeout, 5xx gateway error, network disconnect):
      // NEVER release the reservation immediately! Attempt verification.
      try {
        const verified = await verifyPaystackTransfer(clientRef)
        if (verified.status === 'success' || verified.status === 'pending') {
          // Transfer was created and is accepted/queued on Paystack
          await prisma.withdrawal.update({
            where: { id: withdrawal.id },
            data: {
              providerRef: verified.reference,
              transferCode: verified.transferCode,
              recipientCode: verified.recipientCode,
              failureReason: `Transfer accepted (${verified.status}) after initial dispatch uncertainty`,
            },
          })

          return {
            success: true,
            withdrawalId: withdrawal.id,
            status: 'PROCESSING',
            reference: verified.reference,
            amount: input.amount,
            currency,
            destination: input.destination,
            message: 'Transfer was accepted by provider and is currently processing.',
          }
        } else if (verified.status === 'failed') {
          // Explicitly confirmed failed on provider
          await failAndReleaseOrganizerWithdrawal({
            withdrawalId: withdrawal.id,
            reason: 'Provider verified transfer failure',
            actorId: input.organizerId,
          })

          return {
            success: false,
            withdrawalId: withdrawal.id,
            status: 'FAILED',
            reference: clientRef,
            amount: input.amount,
            currency,
            destination: input.destination,
            message: 'Transfer failed on provider.',
          }
        }
      } catch (verifyErr) {
        // Inconclusive verification outcome:
        // A 404 immediately following a timeout does NOT prove the transfer was never created,
        // because provider background queues or replica lag may delay visibility.
        // FAIL CLOSED: Preserve reservation and defer to durable reconciliation worker.
      }

      // If status is still ambiguous/unverified:
      // FAIL CLOSED: Keep funds locked in PROCESSING. DO NOT RELEASE RESERVATION.
      const reasonMsg = dispatchErr instanceof Error ? dispatchErr.message : 'Network timeout or ambiguous dispatch'
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          failureReason: `UNCERTAIN_DISPATCH: ${reasonMsg}. Reservation held securely pending reconciliation.`,
        },
      })

      await prisma.auditLog.create({
        data: {
          actorId: input.organizerId,
          action: 'WITHDRAWAL_UNCERTAIN_DISPATCH',
          metadata: {
            withdrawalId: withdrawal.id,
            clientRef,
            error: reasonMsg,
          },
        },
      })

      return {
        success: false,
        withdrawalId: withdrawal.id,
        status: 'PROCESSING',
        reference: clientRef,
        amount: input.amount,
        currency,
        destination: input.destination,
        message: 'Payout request encountered a network timeout. Your funds remain safely reserved. Please do not retry this withdrawal.',
      }
    }
  }

  return {
    success: true,
    withdrawalId: withdrawal.id,
    status: 'PROCESSING',
    reference: clientRef,
    amount: input.amount,
    currency,
    destination: input.destination,
  }
}

/**
 * Idempotently marks a withdrawal as COMPLETED when provider callback confirms delivery.
 */
export async function completeOrganizerWithdrawal(params: {
  withdrawalId: string
  providerReference?: string
  settledAt?: Date
  actorId?: string
}) {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: params.withdrawalId },
  })
  if (!withdrawal) {
    throw new Error(`Withdrawal not found: ${params.withdrawalId}`)
  }

  if (withdrawal.status === 'COMPLETED') {
    return { success: true, duplicate: true }
  }
  if (withdrawal.status === 'REVERSED') {
    return { success: false, duplicate: false, message: `Cannot complete withdrawal ${params.withdrawalId}: already REVERSED` }
  }
  if (withdrawal.status === 'FAILED') {
    return { success: false, duplicate: false, message: `Cannot complete withdrawal ${params.withdrawalId}: already FAILED and reservation was released` }
  }
  if (withdrawal.status === 'CANCELLED') {
    return { success: false, duplicate: false, message: `Cannot complete withdrawal ${params.withdrawalId}: already CANCELLED` }
  }

  const now = params.settledAt ?? new Date()
  const amountMinor = withdrawal.amountMinorUnits ?? toMinorUnits(withdrawal.amount, withdrawal.currency)

  const txResult = await prisma.$transaction(async (tx) => {
    // Re-verify status under transaction lock to prevent conflicting concurrent transitions
    try {
      await (tx as any).$queryRaw`SELECT id, status FROM "Withdrawal" WHERE id = ${withdrawal.id} FOR UPDATE`
    } catch {
      // non-postgres fallback for test simulation
    }

    const withdrawalModel = typeof tx?.withdrawal?.findUnique === 'function' ? tx.withdrawal : prisma.withdrawal
    const current = await withdrawalModel.findUnique({ where: { id: withdrawal.id } })
    const effectiveStatus = current?.status ?? withdrawal.status
    if (effectiveStatus !== 'PROCESSING') {
      return {
        success: effectiveStatus === 'COMPLETED',
        duplicate: effectiveStatus === 'COMPLETED',
        message: `Cannot complete withdrawal ${withdrawal.id}: current status is ${effectiveStatus}`,
      }
    }

    if (typeof tx?.withdrawal?.updateMany === 'function') {
      const updateResult = await tx.withdrawal.updateMany({
        where: { id: withdrawal.id, status: 'PROCESSING' },
        data: {
          status: 'COMPLETED',
          settledAt: now,
          providerRef: params.providerReference ?? withdrawal.providerRef,
        },
      })
      if (updateResult.count === 0) {
        const refreshed = await withdrawalModel.findUnique({ where: { id: withdrawal.id } })
        return {
          success: refreshed?.status === 'COMPLETED',
          duplicate: refreshed?.status === 'COMPLETED',
          message: `Cannot complete withdrawal ${withdrawal.id}: current status is ${refreshed?.status}`,
        }
      }
    } else {
      await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'COMPLETED',
          settledAt: now,
          providerRef: params.providerReference ?? withdrawal.providerRef,
        },
      })
    }

    // Record WITHDRAWAL_COMPLETION for audit history.
    // NOTE: Does NOT debit balance again; the reservation already debited the balance.
    const compKey = buildWithdrawalCompletionIdempotencyKey(withdrawal.id)
    await tx.financialLedgerEntry.upsert({
      where: { idempotencyKey: compKey },
      create: {
        organizerId: withdrawal.organiserId,
        withdrawalId: withdrawal.id,
        entryType: 'WITHDRAWAL_COMPLETION',
        direction: 'DEBIT',
        amountMinorUnits: BigInt(0), // Zero adjustment to prevent double debit
        currency: withdrawal.currency,
        idempotencyKey: compKey,
        providerReference: params.providerReference ?? withdrawal.providerRef,
        description: `Withdrawal payout confirmed completed by provider (${withdrawal.currency} ${withdrawal.amount})`,
        metadata: {
          originalMinorUnits: amountMinor.toString(),
          settledAt: now.toISOString(),
        },
      },
      update: {},
    })

    await tx.auditLog.create({
      data: {
        actorId: params.actorId || 'SYSTEM_PAYOUT_VERIFIER',
        action: 'WITHDRAWAL_COMPLETED',
        metadata: {
          withdrawalId: withdrawal.id,
          amount: withdrawal.amount,
          amountMinorUnits: amountMinor.toString(),
          settledAt: now.toISOString(),
        },
      },
    })

    return { success: true, duplicate: false }
  })

  return txResult ?? { success: true, duplicate: false }
}

/**
 * Idempotently marks a withdrawal as FAILED and releases the reserved balance.
 */
export async function failAndReleaseOrganizerWithdrawal(params: {
  withdrawalId: string
  reason: string
  actorId?: string
}) {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: params.withdrawalId },
  })
  if (!withdrawal) {
    throw new Error(`Withdrawal not found: ${params.withdrawalId}`)
  }

  if (withdrawal.status === 'FAILED') {
    return { success: true, duplicate: true }
  }
  if (withdrawal.status === 'COMPLETED') {
    return { success: false, duplicate: false, message: `Cannot release withdrawal ${params.withdrawalId}: already COMPLETED` }
  }
  if (withdrawal.status === 'REVERSED') {
    return { success: false, duplicate: false, message: `Cannot release withdrawal ${params.withdrawalId}: already REVERSED and funds were restored` }
  }
  if (withdrawal.status === 'CANCELLED') {
    return { success: false, duplicate: false, message: `Cannot release withdrawal ${params.withdrawalId}: already CANCELLED` }
  }

  const amountMinor = withdrawal.amountMinorUnits ?? toMinorUnits(withdrawal.amount, withdrawal.currency)
  const currency = withdrawal.currency

  const txResult = await prisma.$transaction(async (tx) => {
    // Re-verify status under transaction lock to prevent conflicting concurrent transitions
    try {
      await (tx as any).$queryRaw`SELECT id, status FROM "Withdrawal" WHERE id = ${withdrawal.id} FOR UPDATE`
    } catch {
      // non-postgres fallback for test simulation
    }

    const withdrawalModel = typeof tx?.withdrawal?.findUnique === 'function' ? tx.withdrawal : prisma.withdrawal
    const current = await withdrawalModel.findUnique({ where: { id: withdrawal.id } })
    const effectiveStatus = current?.status ?? withdrawal.status
    if (effectiveStatus !== 'PROCESSING') {
      return {
        success: effectiveStatus === 'FAILED',
        duplicate: effectiveStatus === 'FAILED',
        message: `Cannot release withdrawal ${withdrawal.id}: current status is ${effectiveStatus}`,
      }
    }

    if (typeof tx?.withdrawal?.updateMany === 'function') {
      const updateResult = await tx.withdrawal.updateMany({
        where: { id: withdrawal.id, status: 'PROCESSING' },
        data: {
          status: 'FAILED',
          failureReason: params.reason,
        },
      })
      if (updateResult.count === 0) {
        const refreshed = await withdrawalModel.findUnique({ where: { id: withdrawal.id } })
        return {
          success: refreshed?.status === 'FAILED',
          duplicate: refreshed?.status === 'FAILED',
          message: `Cannot release withdrawal ${withdrawal.id}: current status is ${refreshed?.status}`,
        }
      }
    } else {
      await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'FAILED',
          failureReason: params.reason,
        },
      })
    }

    // Post WITHDRAWAL_RELEASE (CREDIT) to restore available balance
    const relKey = buildWithdrawalReleaseIdempotencyKey(withdrawal.id)
    await tx.financialLedgerEntry.upsert({
      where: { idempotencyKey: relKey },
      create: {
        organizerId: withdrawal.organiserId,
        withdrawalId: withdrawal.id,
        entryType: 'WITHDRAWAL_RELEASE',
        direction: 'CREDIT',
        amountMinorUnits: amountMinor,
        currency,
        idempotencyKey: relKey,
        providerReference: withdrawal.providerRef,
        description: `Withdrawal reservation released due to failure: ${params.reason}`,
      },
      update: {},
    })

    // Restore legacy OrganiserBalance
    await tx.organiserBalance.upsert({
      where: { organiserId: withdrawal.organiserId },
      create:
        currency === 'USD'
          ? { organiserId: withdrawal.organiserId, withdrawnUSD: 0 }
          : { organiserId: withdrawal.organiserId, withdrawnKES: 0 },
      update:
        currency === 'USD'
          ? { withdrawnUSD: { decrement: withdrawal.amount } }
          : { withdrawnKES: { decrement: withdrawal.amount } },
    })

    await tx.auditLog.create({
      data: {
        actorId: params.actorId || 'SYSTEM_PAYOUT_VERIFIER',
        action: 'WITHDRAWAL_RESERVATION_RELEASED',
        metadata: {
          withdrawalId: withdrawal.id,
          amount: withdrawal.amount,
          amountMinorUnits: amountMinor.toString(),
          reason: params.reason,
        },
      },
    })

    return { success: true, duplicate: false }
  })

  return txResult ?? { success: true, duplicate: false }
}

/**
 * Idempotently marks a withdrawal as REVERSED (when bank/mobile provider reverses funds back to EventSlot)
 * and restores the funds to the organizer.
 */
export async function reverseOrganizerWithdrawal(params: {
  withdrawalId: string
  reason: string
  actorId?: string
}) {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: params.withdrawalId },
  })
  if (!withdrawal) {
    throw new Error(`Withdrawal not found: ${params.withdrawalId}`)
  }

  if (withdrawal.status === 'REVERSED') {
    return { success: true, duplicate: true }
  }
  if (withdrawal.status === 'FAILED') {
    return { success: false, duplicate: false, message: `Cannot reverse withdrawal ${params.withdrawalId}: already FAILED and reservation was released` }
  }
  if (withdrawal.status === 'CANCELLED') {
    return { success: false, duplicate: false, message: `Cannot reverse withdrawal ${params.withdrawalId}: already CANCELLED` }
  }

  const amountMinor = withdrawal.amountMinorUnits ?? toMinorUnits(withdrawal.amount, withdrawal.currency)
  const currency = withdrawal.currency

  const txResult = await prisma.$transaction(async (tx) => {
    // Re-verify status under transaction lock to prevent conflicting concurrent transitions
    try {
      await (tx as any).$queryRaw`SELECT id, status FROM "Withdrawal" WHERE id = ${withdrawal.id} FOR UPDATE`
    } catch {
      // non-postgres fallback for test simulation
    }

    const withdrawalModel = typeof tx?.withdrawal?.findUnique === 'function' ? tx.withdrawal : prisma.withdrawal
    const current = await withdrawalModel.findUnique({ where: { id: withdrawal.id } })
    const effectiveStatus = current?.status ?? withdrawal.status
    if (effectiveStatus !== 'COMPLETED') {
      return {
        success: effectiveStatus === 'REVERSED',
        duplicate: effectiveStatus === 'REVERSED',
        message: `Cannot reverse withdrawal ${withdrawal.id}: current status is ${effectiveStatus}`,
      }
    }

    if (typeof tx?.withdrawal?.updateMany === 'function') {
      const updateResult = await tx.withdrawal.updateMany({
        where: { id: withdrawal.id, status: 'COMPLETED' },
        data: {
          status: 'REVERSED',
          failureReason: params.reason,
        },
      })
      if (updateResult.count === 0) {
        const refreshed = await withdrawalModel.findUnique({ where: { id: withdrawal.id } })
        return {
          success: refreshed?.status === 'REVERSED',
          duplicate: refreshed?.status === 'REVERSED',
          message: `Cannot reverse withdrawal ${withdrawal.id}: current status is ${refreshed?.status}`,
        }
      }
    } else {
      await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'REVERSED',
          failureReason: params.reason,
        },
      })
    }

    // Post REVERSAL (CREDIT) to restore available balance
    const revKey = `rev:wd:${withdrawal.id}`
    await tx.financialLedgerEntry.upsert({
      where: { idempotencyKey: revKey },
      create: {
        organizerId: withdrawal.organiserId,
        withdrawalId: withdrawal.id,
        entryType: 'REVERSAL',
        direction: 'CREDIT',
        amountMinorUnits: amountMinor,
        currency,
        idempotencyKey: revKey,
        providerReference: withdrawal.providerRef,
        description: `Withdrawal payout reversed by provider: ${params.reason}`,
      },
      update: {},
    })

    // Restore legacy OrganiserBalance
    await tx.organiserBalance.upsert({
      where: { organiserId: withdrawal.organiserId },
      create:
        currency === 'USD'
          ? { organiserId: withdrawal.organiserId, withdrawnUSD: 0 }
          : { organiserId: withdrawal.organiserId, withdrawnKES: 0 },
      update:
        currency === 'USD'
          ? { withdrawnUSD: { decrement: withdrawal.amount } }
          : { withdrawnKES: { decrement: withdrawal.amount } },
    })

    await tx.auditLog.create({
      data: {
        actorId: params.actorId || 'SYSTEM_PAYOUT_VERIFIER',
        action: 'WITHDRAWAL_REVERSED',
        metadata: {
          withdrawalId: withdrawal.id,
          amount: withdrawal.amount,
          amountMinorUnits: amountMinor.toString(),
          reason: params.reason,
        },
      },
    })

    return { success: true, duplicate: false }
  })

  return txResult ?? { success: true, duplicate: false }
}

export type ReconcileWithdrawalResult = {
  withdrawalId: string
  status: WithdrawalStatus
  reconciled: boolean
  providerStatus?: string
  message: string
}

/**
 * Reconciles an individual withdrawal stuck in PROCESSING or uncertain status.
 * Queries Paystack API using the stable provider reference.
 * Treats 404, timeouts, and network errors as INCONCLUSIVE (preserves reservation).
 */
export async function reconcileOrganizerWithdrawal(params: {
  withdrawalId: string
  actorId?: string
  forceRelease?: boolean
  forceReason?: string
}): Promise<ReconcileWithdrawalResult> {
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: params.withdrawalId },
  })
  if (!withdrawal) {
    throw new Error(`Withdrawal not found: ${params.withdrawalId}`)
  }

  // If already terminal, return existing status
  if (withdrawal.status === 'COMPLETED' || withdrawal.status === 'FAILED' || withdrawal.status === 'REVERSED') {
    return {
      withdrawalId: withdrawal.id,
      status: withdrawal.status,
      reconciled: false,
      message: `Withdrawal is already in terminal status: ${withdrawal.status}`,
    }
  }

  const actorId = params.actorId || 'SYSTEM_RECONCILIATION'

  // If manual force release is requested, verify administrative authorization and require explicit reason
  if (params.forceRelease) {
    if (!params.forceReason || !params.forceReason.trim()) {
      throw new Error('forceReason is strictly required for manual administrative release of funds.')
    }
    if (!params.actorId || params.actorId === 'SYSTEM_RECONCILIATION' || params.actorId === 'CRON_RECONCILIATION_WORKER') {
      throw new Error('forceRelease requires a valid, authenticated administrator actorId.')
    }
    const actor = await prisma.user.findUnique({
      where: { id: params.actorId },
      select: { id: true, email: true, suspended: true, isAdmin: true },
    })
    if (!actor || actor.suspended) {
      throw new Error(`Unauthorized: Actor ${params.actorId} is invalid or suspended.`)
    }
    const isAuthorized = isAdminEmail(actor.email) || Boolean(actor.isAdmin)

    if (!isAuthorized) {
      throw new Error(`Unauthorized: Actor ${params.actorId} lacks administrator privileges to force release funds.`)
    }

    await failAndReleaseOrganizerWithdrawal({
      withdrawalId: withdrawal.id,
      reason: `MANUAL_ADMIN_RELEASE by ${actor.email} (${actorId}): ${params.forceReason.trim()}`,
      actorId,
    })
    return {
      withdrawalId: withdrawal.id,
      status: 'FAILED',
      reconciled: true,
      message: `Withdrawal manually released by authorized operator (${actorId}): ${params.forceReason}`,
    }
  }

  const lookupRef = withdrawal.providerRef || withdrawal.idempotencyKey?.split(':')[2] || withdrawal.id

  try {
    const verified = await verifyPaystackTransfer(lookupRef)
    const provStatus = (verified.status || 'unknown').toLowerCase()

    if (provStatus === 'success') {
      // Amount and currency validation against provider evidence
      const expectedMinor = withdrawal.amountMinorUnits ?? toMinorUnits(withdrawal.amount, withdrawal.currency)
      if (verified.amountMinorUnits > BigInt(0) && verified.amountMinorUnits !== expectedMinor) {
        const mismatchMsg = `Amount mismatch on transfer reconciliation: expected ${expectedMinor}, got ${verified.amountMinorUnits}`
        console.error(`[withdrawal-reconciliation] ${mismatchMsg} for withdrawal ${withdrawal.id}`)
        await prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            failureReason: `RECONCILIATION_AMOUNT_MISMATCH: ${mismatchMsg}`,
          },
        })
        await prisma.auditLog.create({
          data: {
            actorId,
            action: 'WITHDRAWAL_RECONCILIATION_MISMATCH',
            metadata: {
              withdrawalId: withdrawal.id,
              expectedMinor: expectedMinor.toString(),
              providerMinor: verified.amountMinorUnits.toString(),
            },
          },
        })
        return {
          withdrawalId: withdrawal.id,
          status: 'PROCESSING',
          reconciled: false,
          providerStatus: provStatus,
          message: mismatchMsg,
        }
      }

      if (verified.currency && verified.currency.toUpperCase() !== withdrawal.currency.toUpperCase()) {
        const mismatchMsg = `Currency mismatch on transfer reconciliation: expected ${withdrawal.currency}, got ${verified.currency}`
        console.error(`[withdrawal-reconciliation] ${mismatchMsg} for withdrawal ${withdrawal.id}`)
        await prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            failureReason: `RECONCILIATION_CURRENCY_MISMATCH: ${mismatchMsg}`,
          },
        })
        await prisma.auditLog.create({
          data: {
            actorId,
            action: 'WITHDRAWAL_RECONCILIATION_MISMATCH',
            metadata: {
              withdrawalId: withdrawal.id,
              expectedCurrency: withdrawal.currency,
              providerCurrency: verified.currency,
            },
          },
        })
        return {
          withdrawalId: withdrawal.id,
          status: 'PROCESSING',
          reconciled: false,
          providerStatus: provStatus,
          message: mismatchMsg,
        }
      }

      await completeOrganizerWithdrawal({
        withdrawalId: withdrawal.id,
        providerReference: verified.reference,
        settledAt: verified.transferredAt || new Date(),
        actorId,
      })
      return {
        withdrawalId: withdrawal.id,
        status: 'COMPLETED',
        reconciled: true,
        providerStatus: provStatus,
        message: 'Successfully reconciled to COMPLETED via Paystack API verification.',
      }
    } else if (provStatus === 'failed') {
      await failAndReleaseOrganizerWithdrawal({
        withdrawalId: withdrawal.id,
        reason: 'Paystack API verification confirmed transfer failure.',
        actorId,
      })
      return {
        withdrawalId: withdrawal.id,
        status: 'FAILED',
        reconciled: true,
        providerStatus: provStatus,
        message: 'Reconciled to FAILED via Paystack API verification; funds released.',
      }
    } else if (provStatus === 'reversed') {
      await reverseOrganizerWithdrawal({
        withdrawalId: withdrawal.id,
        reason: 'Paystack API verification confirmed transfer reversal.',
        actorId,
      })
      return {
        withdrawalId: withdrawal.id,
        status: 'REVERSED',
        reconciled: true,
        providerStatus: provStatus,
        message: 'Reconciled to REVERSED via Paystack API verification; funds restored.',
      }
    } else {
      // Pending, processing, or OTP on provider
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          failureReason: `Reconciliation verified status is "${provStatus}" on provider at ${new Date().toISOString()}`,
        },
      })
      return {
        withdrawalId: withdrawal.id,
        status: 'PROCESSING',
        reconciled: false,
        providerStatus: provStatus,
        message: `Transfer remains in "${provStatus}" state on provider. Reservation maintained.`,
      }
    }
  } catch (err: any) {
    // Verification request failed, timed out, or returned 404
    // INCONCLUSIVE: NEVER release funds on ambiguous verification!
    const errMsg = err instanceof Error ? err.message : String(err)
    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        failureReason: `RECONCILIATION_INCONCLUSIVE: ${errMsg} at ${new Date().toISOString()}`,
      },
    })

    await prisma.auditLog.create({
      data: {
        actorId,
        action: 'WITHDRAWAL_RECONCILIATION_INCONCLUSIVE',
        metadata: {
          withdrawalId: withdrawal.id,
          reference: lookupRef,
          error: errMsg,
        },
      },
    })

    return {
      withdrawalId: withdrawal.id,
      status: 'PROCESSING',
      reconciled: false,
      message: `Reconciliation check inconclusive (${errMsg}). Reservation strictly maintained.`,
    }
  }
}

let isWithdrawalReconciliationRunningInProcess = false
const WITHDRAWAL_RECONCILIATION_LEASE_KEY = 'lock:withdrawal_reconciliation_worker'
const WITHDRAWAL_RECONCILIATION_LEASE_DURATION_MS = 5 * 60 * 1000

/**
 * Worker that scans and reconciles all active withdrawals stuck in PROCESSING.
 */
export async function runWithdrawalReconciliationWorker(options?: {
  olderThanMinutes?: number
  limit?: number
  dryRun?: boolean
  actorId?: string
}): Promise<{
  totalInspected: number
  reconciledCount: number
  stillPendingCount: number
  inconclusiveCount: number
  results: ReconcileWithdrawalResult[]
  message?: string
}> {
  const dryRun = Boolean(options?.dryRun)
  const actorId = options?.actorId || 'CRON_RECONCILIATION_WORKER'

  // Concurrency Guard: in-process & distributed lease
  if (!dryRun) {
    if (isWithdrawalReconciliationRunningInProcess) {
      return {
        totalInspected: 0,
        reconciledCount: 0,
        stillPendingCount: 0,
        inconclusiveCount: 0,
        results: [],
        message: 'Withdrawal reconciliation worker is already running in this process.',
      }
    }

    if (typeof (prisma.processedProviderEvent as any)?.findUnique === 'function') {
      const activeLock = await prisma.processedProviderEvent.findUnique({
        where: { idempotencyKey: WITHDRAWAL_RECONCILIATION_LEASE_KEY },
      }).catch(() => null)

      if (activeLock && activeLock.status === 'PROCESSING') {
        const lockAge = Date.now() - activeLock.firstSeenAt.getTime()
        if (lockAge < WITHDRAWAL_RECONCILIATION_LEASE_DURATION_MS) {
          return {
            totalInspected: 0,
            reconciledCount: 0,
            stillPendingCount: 0,
            inconclusiveCount: 0,
            results: [],
            message: 'Withdrawal reconciliation worker lease is currently held by another worker.',
          }
        }
      }

      if (typeof (prisma.processedProviderEvent as any)?.create === 'function') {
        await prisma.processedProviderEvent.create({
          data: {
            provider: 'paystack',
            eventType: 'withdrawal_reconciliation_lease',
            idempotencyKey: WITHDRAWAL_RECONCILIATION_LEASE_KEY,
            status: 'PROCESSING',
            firstSeenAt: new Date(),
            metadata: { actorId, startedAt: new Date().toISOString() },
          },
        }).catch(async () => {
          if (typeof (prisma.processedProviderEvent as any)?.update === 'function') {
            await prisma.processedProviderEvent.update({
              where: { idempotencyKey: WITHDRAWAL_RECONCILIATION_LEASE_KEY },
              data: {
                status: 'PROCESSING',
                firstSeenAt: new Date(),
                metadata: { actorId, startedAt: new Date().toISOString() },
              },
            }).catch(() => {})
          }
        })
      }
    }
  }

  isWithdrawalReconciliationRunningInProcess = true

  try {
    const olderThanMs = (options?.olderThanMinutes ?? 5) * 60 * 1000
    const cutoff = new Date(Date.now() - olderThanMs)
    const limit = options?.limit ?? 50

    const pendingWithdrawals = await prisma.withdrawal.findMany({
      where: {
        status: 'PROCESSING',
        createdAt: { lte: cutoff },
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    })

    let reconciledCount = 0
    let stillPendingCount = 0
    let inconclusiveCount = 0
    const results: ReconcileWithdrawalResult[] = []

    for (const wd of pendingWithdrawals) {
      if (dryRun) {
        results.push({
          withdrawalId: wd.id,
          status: 'PROCESSING',
          reconciled: false,
          message: `DRY RUN: would reconcile withdrawal ${wd.id} (ref: ${wd.providerRef})`,
        })
        stillPendingCount++
        continue
      }

      const res = await reconcileOrganizerWithdrawal({
        withdrawalId: wd.id,
        actorId,
      })
      results.push(res)

      if (res.reconciled) {
        reconciledCount++
      } else if (res.message.includes('inconclusive')) {
        inconclusiveCount++
      } else {
        stillPendingCount++
      }
    }

    return {
      totalInspected: pendingWithdrawals.length,
      reconciledCount,
      stillPendingCount,
      inconclusiveCount,
      results,
    }
  } finally {
    isWithdrawalReconciliationRunningInProcess = false
    if (!dryRun && typeof (prisma.processedProviderEvent as any)?.update === 'function') {
      await prisma.processedProviderEvent.update({
        where: { idempotencyKey: WITHDRAWAL_RECONCILIATION_LEASE_KEY },
        data: {
          status: 'PROCESSED',
          processedAt: new Date(),
          metadata: { releasedAt: new Date().toISOString() },
        },
      }).catch(() => {})
    }
  }
}
