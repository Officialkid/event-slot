/**
 * Server-Side Settlement Verification & Reconciliation Abstraction
 *
 * Implements strict, authoritative settlement evidence ingestion and validation.
 *
 * Core Financial Invariants:
 * 1. A successful Paystack charge (Payment.status = SUCCESS) is NOT proof of settlement.
 * 2. An organizer may withdraw only when funds have settled in EventSlot's Paystack merchant balance.
 * 3. Settlement evidence must be cryptographically or authoritatively verified.
 * 4. Ingestion is strictly idempotent — duplicate settlement evidence never credits funds twice.
 * 5. Mismatched amounts, currencies, or unverified transactions FAIL CLOSED (remain unavailable).
 */

import prisma from '@/lib/prisma'
import { toMinorUnits } from '@/lib/financialLedger'

export class SettlementVerificationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SettlementVerificationError'
  }
}

export type SettlementTransactionEvidence = {
  reference: string
  amountMinorUnits: bigint
  currency: string
  providerTransactionId?: string | number
}

export type SettlementBatchEvidence = {
  provider: 'paystack'
  batchReference: string
  currency: string
  totalAmountMinorUnits: bigint
  settledAt: Date
  evidenceSource: 'paystack_settlement_report' | 'paystack_webhook' | 'paystack_balance_reconciliation'
  transactions: SettlementTransactionEvidence[]
  metadata?: Record<string, unknown>
}

export type SettlementProcessingResult = {
  success: boolean
  batchReference: string
  totalProcessed: number
  settledCount: number
  alreadySettledCount: number
  unmatchedReferences: string[]
}

/**
 * Validates and ingests authoritative Paystack settlement evidence into the financial database.
 * Atomically transitions verified Payment records from PENDING to SETTLED.
 */
export async function processSettlementBatchEvidence(
  evidence: SettlementBatchEvidence
): Promise<SettlementProcessingResult> {
  // 1. Strict Validation
  if (evidence.provider !== 'paystack') {
    throw new SettlementVerificationError(`Unsupported settlement provider: ${evidence.provider}`)
  }

  if (!evidence.batchReference || !evidence.batchReference.trim()) {
    throw new SettlementVerificationError('Settlement batchReference is required.')
  }

  const normalizedCurrency = (evidence.currency || 'KES').trim().toUpperCase()
  if (normalizedCurrency !== 'KES' && normalizedCurrency !== 'USD') {
    throw new SettlementVerificationError(`Unsupported settlement currency: ${normalizedCurrency}`)
  }

  if (!Array.isArray(evidence.transactions) || evidence.transactions.length === 0) {
    throw new SettlementVerificationError('Settlement evidence must contain at least one transaction.')
  }

  // 2. Validate transaction amounts sum to batch total
  let calculatedBatchTotal = BigInt(0)
  for (const item of evidence.transactions) {
    if (!item.reference || !item.reference.trim()) {
      throw new SettlementVerificationError('Transaction evidence item is missing reference.')
    }
    if (typeof item.amountMinorUnits !== 'bigint' || item.amountMinorUnits <= BigInt(0)) {
      throw new SettlementVerificationError(
        `Invalid minor units amount for transaction ${item.reference}: ${item.amountMinorUnits}`
      )
    }
    if (item.currency.trim().toUpperCase() !== normalizedCurrency) {
      throw new SettlementVerificationError(
        `Currency mismatch in batch for ${item.reference}: expected ${normalizedCurrency}, got ${item.currency}`
      )
    }
    calculatedBatchTotal += item.amountMinorUnits
  }

  if (calculatedBatchTotal !== evidence.totalAmountMinorUnits) {
    throw new SettlementVerificationError(
      `Settlement batch total mismatch: evidence header states ${evidence.totalAmountMinorUnits} minor units, but transaction sum is ${calculatedBatchTotal}`
    )
  }

  // 3. Atomic Database Ingestion
  return prisma.$transaction(async (tx) => {
    // Upsert SettlementBatch record idempotently
    await tx.settlementBatch.upsert({
      where: { batchReference: evidence.batchReference },
      create: {
        provider: 'paystack',
        batchReference: evidence.batchReference,
        currency: normalizedCurrency,
        totalAmountMinor: evidence.totalAmountMinorUnits,
        transactionCount: evidence.transactions.length,
        settledAt: evidence.settledAt,
        metadata: {
          evidenceSource: evidence.evidenceSource,
          ...(evidence.metadata ?? {}),
        },
      },
      update: {
        settledAt: evidence.settledAt,
      },
    })

    let settledCount = 0
    let alreadySettledCount = 0
    const unmatchedReferences: string[] = []

    for (const item of evidence.transactions) {
      // Find matching payment record
      const payment = await tx.payment.findFirst({
        where: {
          OR: [
            { mpesaRef: item.reference },
            { paidEventOrder: { providerReference: `paystack:${item.reference}` } },
            { paidEventOrder: { providerReference: item.reference } },
          ],
        },
        include: {
          paidEventOrder: {
            select: { id: true, status: true, amountKes: true, currency: true },
          },
        },
      })

      if (!payment) {
        unmatchedReferences.push(item.reference)
        continue
      }

      // Invariant: Only successful charges can be settled
      if (payment.status !== 'SUCCESS') {
        throw new SettlementVerificationError(
          `Cannot settle payment ${payment.id} for reference ${item.reference}: payment status is ${payment.status}, not SUCCESS`
        )
      }

      // Invariant: Exact amount and currency match
      const expectedMinorUnits = toMinorUnits(payment.amount, payment.paidEventOrder?.currency || 'KES')
      if (expectedMinorUnits !== item.amountMinorUnits) {
        throw new SettlementVerificationError(
          `Amount mismatch for payment ${payment.id} (${item.reference}): database expected ${expectedMinorUnits} minor units, settlement evidence reports ${item.amountMinorUnits}`
        )
      }

      // Idempotency: if already settled under the same or another verified batch
      if (payment.settlementStatus === 'SETTLED') {
        alreadySettledCount++
        continue
      }

      // Transition to SETTLED
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          settlementStatus: 'SETTLED',
          settledAt: evidence.settledAt,
          settlementRef: item.reference,
          settlementBatchId: evidence.batchReference,
          settlementEvidence: {
            source: evidence.evidenceSource,
            batchReference: evidence.batchReference,
            settledAt: evidence.settledAt.toISOString(),
            amountMinorUnits: item.amountMinorUnits.toString(),
          },
        },
      })

      await tx.auditLog.create({
        data: {
          actorId: 'SYSTEM_SETTLEMENT_VERIFIER',
          action: 'PAYMENT_SETTLED',
          metadata: {
            paymentId: payment.id,
            orderId: payment.paidEventOrderId,
            reference: item.reference,
            batchReference: evidence.batchReference,
            amountMinorUnits: item.amountMinorUnits.toString(),
            settledAt: evidence.settledAt.toISOString(),
          },
        },
      })

      settledCount++
    }

    return {
      success: true,
      batchReference: evidence.batchReference,
      totalProcessed: evidence.transactions.length,
      settledCount,
      alreadySettledCount,
      unmatchedReferences,
    }
  })
}
