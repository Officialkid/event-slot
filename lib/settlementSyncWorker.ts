/**
 * Production-Ready Paystack Settlement Synchronization Worker
 *
 * Implements authoritative settlement reconciliation against the official Paystack Settlements API:
 * 1. GET /settlement — lists settlement payout batches with status 'success'
 * 2. GET /settlement/:id/transactions — lists all transactions that compose a specific settlement payout
 *
 * Safety & Invariants:
 * - Disabled by default: Requires explicit environment activation (ENABLE_PAYSTACK_SETTLEMENT_SYNC=true)
 *   or manual invocation with allowDisabled=true / dryRun=true.
 * - Server-side only: Uses PAYSTACK_SECRET_KEY via getPaystackSecretKey().
 * - Secrets, bank numbers, and auth headers are completely redacted in logs.
 * - Idempotent: Repeated syncs skip already processed batches or acknowledge already settled payments.
 * - Partial Page Failure Guard: If any page of transactions fails to fetch or validate, the entire batch
 *   is aborted and NEVER marked as completed.
 * - Fee Tracking: Records gross transaction amounts, provider fees, and effective net settlement amounts.
 * - Detailed discrepancy reporting: Records unmatched transaction references in batch metadata.
 */

import prisma from '@/lib/prisma'
import {
  getPaystackSecretKey,
  PAYSTACK_BASE_URL,
  DEFAULT_PAYSTACK_TIMEOUT_MS,
  PaystackApiError,
  sanitizePaystackPayload,
} from '@/lib/paystack'
import {
  processSettlementBatchEvidence,
  SettlementBatchEvidence,
  SettlementTransactionEvidence,
} from '@/lib/settlementVerification'

export type PaystackSettlementItem = {
  id: number
  domain: string
  status: 'success' | 'processing' | 'pending' | 'failed'
  currency: string
  integration?: number
  total_amount: number // in minor units
  effective_amount: number // in minor units
  total_fees: number // in minor units
  total_processed: number // in minor units
  deductions?: unknown
  settlement_date?: string
  createdAt: string
  updatedAt: string
}

export type PaystackSettlementTransactionItem = {
  id: number
  reference: string
  amount: number // in minor units (e.g. 100000 for KES 1,000)
  currency: string
  status: string
  paid_at?: string
  createdAt?: string
  fees?: number
}

export type SettlementSyncOptions = {
  dryRun?: boolean
  allowDisabled?: boolean
  from?: Date
  to?: Date
  batchId?: number | string
  limit?: number
  actorId?: string
}

export type SyncBatchResult = {
  batchId: number
  batchReference: string
  status: string
  transactionCount: number
  settledCount: number
  alreadySettledCount: number
  unmatchedCount: number
  unmatchedReferences: string[]
  error?: string
}

export type SettlementSyncResult = {
  success: boolean
  dryRun: boolean
  batchesInspected: number
  batchesProcessed: number
  batchesSkipped: number
  totalSettledPayments: number
  totalAlreadySettled: number
  unmatchedTransactions: Array<{ batchId: number; reference: string; amountMinor: string }>
  batchResults: SyncBatchResult[]
  message: string
}

/**
 * Fetches settlement batches from GET /settlement with timeout and rate-limit handling.
 */
export async function fetchPaystackSettlements(params?: {
  page?: number
  perPage?: number
  status?: string
  from?: Date
  to?: Date
}): Promise<{
  settlements: PaystackSettlementItem[]
  meta?: { total: number; page: number; pageCount: number; perPage: number }
}> {
  const secretKey = getPaystackSecretKey()
  const url = new URL(`${PAYSTACK_BASE_URL}/settlement`)
  url.searchParams.set('perPage', String(params?.perPage ?? 50))
  url.searchParams.set('page', String(params?.page ?? 1))
  url.searchParams.set('status', params?.status ?? 'success')

  if (params?.from) {
    url.searchParams.set('from', params.from.toISOString())
  }
  if (params?.to) {
    url.searchParams.set('to', params.to.toISOString())
  }

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(DEFAULT_PAYSTACK_TIMEOUT_MS),
  })

  const raw = await res.json().catch(() => null)
  if (!res.ok || !raw?.status) {
    throw new PaystackApiError(
      raw?.message || `Failed to fetch settlements (HTTP ${res.status})`,
      res.status,
      sanitizePaystackPayload(raw)
    )
  }

  return {
    settlements: Array.isArray(raw.data) ? raw.data : [],
    meta: raw.meta,
  }
}

/**
 * Fetches all transactions for a specific settlement batch, handling multi-page pagination.
 * If any page fails to fetch, throws an error so the caller never partially ingests a batch.
 */
export async function fetchAllSettlementTransactions(
  settlementId: number | string
): Promise<PaystackSettlementTransactionItem[]> {
  const secretKey = getPaystackSecretKey()
  const transactions: PaystackSettlementTransactionItem[] = []
  let page = 1
  const perPage = 50
  let hasMore = true

  while (hasMore) {
    const url = `${PAYSTACK_BASE_URL}/settlement/${encodeURIComponent(settlementId)}/transactions?perPage=${perPage}&page=${page}`

    let res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(DEFAULT_PAYSTACK_TIMEOUT_MS),
    })

    // Fallback to singular endpoint path if plural is not recognized
    if (res.status === 404) {
      const fallbackUrl = `${PAYSTACK_BASE_URL}/settlement/${encodeURIComponent(settlementId)}/transaction?perPage=${perPage}&page=${page}`
      res = await fetch(fallbackUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(DEFAULT_PAYSTACK_TIMEOUT_MS),
      })
    }

    const raw = await res.json().catch(() => null)
    if (!res.ok || !raw?.status) {
      throw new PaystackApiError(
        raw?.message || `Failed to fetch transactions for settlement ${settlementId} on page ${page} (HTTP ${res.status})`,
        res.status,
        sanitizePaystackPayload(raw)
      )
    }

    const pageItems = Array.isArray(raw.data) ? raw.data : []
    transactions.push(...pageItems)

    if (pageItems.length < perPage || (raw.meta && raw.meta.page >= raw.meta.pageCount)) {
      hasMore = false
    } else {
      page++
    }
  }

  return transactions
}

/**
 * Main settlement synchronization runner.
 * Fetches confirmed settlement batches from Paystack, validates them, and ingests evidence.
 */
export async function runPaystackSettlementSync(
  options?: SettlementSyncOptions
): Promise<SettlementSyncResult> {
  const isEnabled = process.env.ENABLE_PAYSTACK_SETTLEMENT_SYNC === 'true'
  const isExplicitRun = Boolean(options?.allowDisabled || options?.dryRun)

  if (!isEnabled && !isExplicitRun) {
    return {
      success: false,
      dryRun: false,
      batchesInspected: 0,
      batchesProcessed: 0,
      batchesSkipped: 0,
      totalSettledPayments: 0,
      totalAlreadySettled: 0,
      unmatchedTransactions: [],
      batchResults: [],
      message:
        'Settlement synchronization worker is DISABLED by default. Set ENABLE_PAYSTACK_SETTLEMENT_SYNC=true or invoke with allowDisabled=true or dryRun=true.',
    }
  }

  const dryRun = Boolean(options?.dryRun)
  const actorId = options?.actorId || 'SETTLEMENT_SYNC_WORKER'
  const limit = options?.limit ?? 10

  // 1. Fetch confirmed settlements from Paystack
  let settlements: PaystackSettlementItem[] = []
  try {
    if (options?.batchId) {
      settlements = [
        {
          id: Number(options.batchId),
          domain: 'live',
          status: 'success',
          currency: 'KES',
          total_amount: 0,
          effective_amount: 0,
          total_fees: 0,
          total_processed: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]
    } else {
      const fetched = await fetchPaystackSettlements({
        status: 'success',
        perPage: limit,
        from: options?.from,
        to: options?.to,
      })
      settlements = fetched.settlements
    }
  } catch (err: any) {
    return {
      success: false,
      dryRun,
      batchesInspected: 0,
      batchesProcessed: 0,
      batchesSkipped: 0,
      totalSettledPayments: 0,
      totalAlreadySettled: 0,
      unmatchedTransactions: [],
      batchResults: [],
      message: `Failed to fetch settlement list from Paystack: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  let batchesProcessed = 0
  let batchesSkipped = 0
  let totalSettledPayments = 0
  let totalAlreadySettled = 0
  const unmatchedTransactions: Array<{ batchId: number; reference: string; amountMinor: string }> = []
  const batchResults: SyncBatchResult[] = []

  for (const batch of settlements) {
    const batchReference = `paystack_settle_${batch.id}`

    // 2. Check if batch has already been recorded and fully processed
    const existingBatch = await prisma.settlementBatch.findUnique({
      where: { batchReference },
    })

    if (existingBatch) {
      const meta = (existingBatch.metadata as Record<string, unknown>) || {}
      if (meta.syncCompleted === true) {
        batchesSkipped++
        batchResults.push({
          batchId: batch.id,
          batchReference,
          status: 'SKIPPED_ALREADY_PROCESSED',
          transactionCount: existingBatch.transactionCount,
          settledCount: 0,
          alreadySettledCount: existingBatch.transactionCount,
          unmatchedCount: 0,
          unmatchedReferences: [],
        })
        continue
      }
    }

    // 3. Fetch all transaction pages for this batch
    let transactions: PaystackSettlementTransactionItem[] = []
    try {
      transactions = await fetchAllSettlementTransactions(batch.id)
    } catch (txErr: any) {
      console.error(
        `[SettlementSyncWorker] Failed to fetch transaction pages for batch ${batch.id}:`,
        txErr instanceof Error ? txErr.message : String(txErr)
      )
      batchResults.push({
        batchId: batch.id,
        batchReference,
        status: 'PAGE_FETCH_FAILED',
        transactionCount: 0,
        settledCount: 0,
        alreadySettledCount: 0,
        unmatchedCount: 0,
        unmatchedReferences: [],
        error: txErr instanceof Error ? txErr.message : String(txErr),
      })
      continue
    }

    if (transactions.length === 0) {
      batchesSkipped++
      batchResults.push({
        batchId: batch.id,
        batchReference,
        status: 'SKIPPED_EMPTY_BATCH',
        transactionCount: 0,
        settledCount: 0,
        alreadySettledCount: 0,
        unmatchedCount: 0,
        unmatchedReferences: [],
      })
      continue
    }

    // 4. Calculate total gross amount and validate records
    const normalizedCurrency = (batch.currency || transactions[0]?.currency || 'KES').toUpperCase()
    let batchGrossMinor = BigInt(0)
    const validEvidenceTransactions: SettlementTransactionEvidence[] = []
    const seenRefs = new Set<string>()

    for (const tx of transactions) {
      const ref = tx.reference?.trim()
      if (!ref || seenRefs.has(ref)) continue
      seenRefs.add(ref)

      const amountMinor = BigInt(tx.amount || 0)
      if (amountMinor <= BigInt(0)) continue

      batchGrossMinor += amountMinor
      validEvidenceTransactions.push({
        reference: ref,
        amountMinorUnits: amountMinor,
        currency: (tx.currency || normalizedCurrency).toUpperCase(),
        providerTransactionId: tx.id,
      })
    }

    if (validEvidenceTransactions.length === 0) {
      batchesSkipped++
      continue
    }

    const evidence: SettlementBatchEvidence = {
      provider: 'paystack',
      batchReference,
      currency: normalizedCurrency,
      totalAmountMinorUnits: batchGrossMinor,
      settledAt: new Date(batch.settlement_date || batch.createdAt || Date.now()),
      evidenceSource: 'paystack_settlement_report',
      transactions: validEvidenceTransactions,
      metadata: {
        paystackSettlementId: batch.id,
        totalFeesMinor: batch.total_fees ? String(batch.total_fees) : '0',
        effectiveAmountMinor: batch.effective_amount ? String(batch.effective_amount) : '0',
        totalProcessedMinor: batch.total_processed ? String(batch.total_processed) : '0',
        syncActorId: actorId,
        syncedAt: new Date().toISOString(),
      },
    }

    // 5. Dry-run Mode vs Authoritative Execution
    if (dryRun) {
      let previewSettledCount = 0
      let previewAlreadySettledCount = 0
      const previewUnmatched: string[] = []

      for (const item of validEvidenceTransactions) {
        const payment = await prisma.payment.findFirst({
          where: {
            OR: [
              { mpesaRef: item.reference },
              { paidEventOrder: { providerReference: `paystack:${item.reference}` } },
              { paidEventOrder: { providerReference: item.reference } },
            ],
          },
          select: { id: true, status: true, settlementStatus: true },
        })

        if (!payment) {
          previewUnmatched.push(item.reference)
          unmatchedTransactions.push({
            batchId: batch.id,
            reference: item.reference,
            amountMinor: item.amountMinorUnits.toString(),
          })
        } else if (payment.settlementStatus === 'SETTLED') {
          previewAlreadySettledCount++
        } else if (payment.status === 'SUCCESS') {
          previewSettledCount++
        }
      }

      batchesProcessed++
      totalSettledPayments += previewSettledCount
      totalAlreadySettled += previewAlreadySettledCount

      batchResults.push({
        batchId: batch.id,
        batchReference,
        status: 'DRY_RUN_PREVIEW',
        transactionCount: validEvidenceTransactions.length,
        settledCount: previewSettledCount,
        alreadySettledCount: previewAlreadySettledCount,
        unmatchedCount: previewUnmatched.length,
        unmatchedReferences: previewUnmatched,
      })
      continue
    }

    // 6. Ingest Batch Authoritatively
    try {
      const ingestResult = await processSettlementBatchEvidence(evidence)

      // Mark batch metadata as completed
      await prisma.settlementBatch.update({
        where: { batchReference },
        data: {
          metadata: {
            ...(evidence.metadata ?? {}),
            syncCompleted: true,
            settledCount: ingestResult.settledCount,
            alreadySettledCount: ingestResult.alreadySettledCount,
            unmatchedCount: ingestResult.unmatchedReferences.length,
            unmatchedReferences: ingestResult.unmatchedReferences,
          },
        },
      })

      batchesProcessed++
      totalSettledPayments += ingestResult.settledCount
      totalAlreadySettled += ingestResult.alreadySettledCount

      for (const unmatchedRef of ingestResult.unmatchedReferences) {
        unmatchedTransactions.push({
          batchId: batch.id,
          reference: unmatchedRef,
          amountMinor: '0',
        })
      }

      batchResults.push({
        batchId: batch.id,
        batchReference,
        status: 'SUCCESS_SETTLED',
        transactionCount: validEvidenceTransactions.length,
        settledCount: ingestResult.settledCount,
        alreadySettledCount: ingestResult.alreadySettledCount,
        unmatchedCount: ingestResult.unmatchedReferences.length,
        unmatchedReferences: ingestResult.unmatchedReferences,
      })
    } catch (ingestErr: any) {
      console.error(
        `[SettlementSyncWorker] Ingestion failed for batch ${batch.id}:`,
        ingestErr instanceof Error ? ingestErr.message : String(ingestErr)
      )
      batchResults.push({
        batchId: batch.id,
        batchReference,
        status: 'INGESTION_FAILED',
        transactionCount: validEvidenceTransactions.length,
        settledCount: 0,
        alreadySettledCount: 0,
        unmatchedCount: 0,
        unmatchedReferences: [],
        error: ingestErr instanceof Error ? ingestErr.message : String(ingestErr),
      })
    }
  }

  return {
    success: true,
    dryRun,
    batchesInspected: settlements.length,
    batchesProcessed,
    batchesSkipped,
    totalSettledPayments,
    totalAlreadySettled,
    unmatchedTransactions,
    batchResults,
    message: dryRun
      ? `Dry run complete. Inspected ${settlements.length} batches; ${totalSettledPayments} payments eligible for settlement.`
      : `Settlement sync complete. Processed ${batchesProcessed} batches, marked ${totalSettledPayments} payments settled.`,
  }
}
