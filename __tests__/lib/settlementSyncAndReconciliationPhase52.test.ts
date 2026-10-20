/** @jest-environment node */

import prisma from '@/lib/prisma'
import {
  runPaystackSettlementSync,
  fetchPaystackSettlements,
  fetchAllSettlementTransactions,
} from '@/lib/settlementSyncWorker'
import {
  requestOrganizerWithdrawal,
  reconcileOrganizerWithdrawal,
  runWithdrawalReconciliationWorker,
  isAmbiguousDispatchError,
} from '@/lib/withdrawalService'
import { PaystackApiError, PaystackValidationError } from '@/lib/paystack'

jest.mock('@/lib/prisma', () => {
  const mockClient = {
    payment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    settlementBatch: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    withdrawal: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    financialLedgerEntry: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    organiserBalance: {
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-log-1' }),
    },
    user: {
      findUnique: jest.fn(),
    },
    processedProviderEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-1' }),
      update: jest.fn().mockResolvedValue({ id: 'event-1' }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(),
  }
  return {
    __esModule: true,
    default: mockClient,
    prisma: mockClient,
  }
})

// Mock global fetch for Paystack API calls
const originalFetch = global.fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe('Phase 5.2: Settlement Synchronization & Durable Reconciliation Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.ENABLE_PAYSTACK_SETTLEMENT_SYNC
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_secret_key_52'
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  // =========================================================================
  // 1. Settlement Sync Worker: Safety & Disabled-by-Default Guard
  // =========================================================================
  describe('1. Settlement Sync Worker Safety & Configuration', () => {
    it('is disabled by default when ENABLE_PAYSTACK_SETTLEMENT_SYNC is not set and allowDisabled is false', async () => {
      const res = await runPaystackSettlementSync()
      expect(res.success).toBe(false)
      expect(res.batchesInspected).toBe(0)
      expect(res.message).toMatch(/DISABLED by default/i)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('runs when ENABLE_PAYSTACK_SETTLEMENT_SYNC is explicitly set to true', async () => {
      process.env.ENABLE_PAYSTACK_SETTLEMENT_SYNC = 'true'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          message: 'Settlements retrieved',
          data: [],
        }),
      })

      const res = await runPaystackSettlementSync()
      expect(res.success).toBe(true)
      expect(res.batchesInspected).toBe(0)
    })
  })

  // =========================================================================
  // 2. Settlement Sync Pagination & Multi-Page Transaction Aggregation
  // =========================================================================
  describe('2. Multi-Page Settlement Transactions Fetching', () => {
    it('fetches multiple pages until all settlement transactions are collected', async () => {
      // Page 1: 50 items
      const page1Items = Array.from({ length: 50 }, (_, i) => ({
        id: i + 1,
        reference: `ref-tx-${i + 1}`,
        amount: 100000,
        currency: 'KES',
        status: 'success',
      }))
      // Page 2: 10 items (end of pagination)
      const page2Items = Array.from({ length: 10 }, (_, i) => ({
        id: i + 51,
        reference: `ref-tx-${i + 51}`,
        amount: 100000,
        currency: 'KES',
        status: 'success',
      }))

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            status: true,
            data: page1Items,
            meta: { total: 60, page: 1, pageCount: 2, perPage: 50 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            status: true,
            data: page2Items,
            meta: { total: 60, page: 2, pageCount: 2, perPage: 50 },
          }),
        })

      const all = await fetchAllSettlementTransactions(101)
      expect(all).toHaveLength(60)
      expect(all[0].reference).toBe('ref-tx-1')
      expect(all[59].reference).toBe('ref-tx-60')
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('fails closed and throws error if any page fails to fetch', async () => {
      // Page 1 succeeds, Page 2 fails with 500
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            status: true,
            data: Array.from({ length: 50 }, (_, i) => ({ id: i, reference: `r-${i}`, amount: 100 })),
            meta: { total: 100, page: 1, pageCount: 2, perPage: 50 },
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ status: false, message: 'Internal Server Error' }),
        })

      await expect(fetchAllSettlementTransactions(102)).rejects.toThrow(PaystackApiError)
    })
  })

  // =========================================================================
  // 3. Dry-Run Mode vs Authoritative Execution
  // =========================================================================
  describe('3. Settlement Sync Dry-Run Mode', () => {
    it('executes in dry-run mode without mutating database records', async () => {
      // 1 batch with 1 transaction
      const mockSettlements = [
        {
          id: 5001,
          domain: 'live',
          status: 'success' as const,
          currency: 'KES',
          total_amount: 100000,
          effective_amount: 98000,
          total_fees: 2000,
          total_processed: 100000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      const mockTxs = [
        {
          id: 9001,
          reference: 'pes_ticket_dry_run_1',
          amount: 100000, // KES 1,000
          currency: 'KES',
          status: 'success',
        },
      ]

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ status: true, data: mockSettlements }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ status: true, data: mockTxs }),
        })

      ;(prisma.settlementBatch.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-dry-1',
        amount: 1000,
        status: 'SUCCESS',
        settlementStatus: 'PENDING',
      })

      const res = await runPaystackSettlementSync({ dryRun: true, allowDisabled: true })

      expect(res.success).toBe(true)
      expect(res.dryRun).toBe(true)
      expect(res.totalSettledPayments).toBe(1)
      // Transaction was NOT committed to DB (no payment update, no batch upsert)
      expect(prisma.payment.update).not.toHaveBeenCalled()
      expect(prisma.settlementBatch.upsert).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 4. Inconclusive 404 Handling During Initiation
  // =========================================================================
  describe('4. Inconclusive 404 Handling During Withdrawal Initiation', () => {
    it('treats 404 from verifyPaystackTransfer after dispatch timeout as INCONCLUSIVE and preserves reservation', async () => {
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          withdrawal: {
            findUnique: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue({
              id: 'wd-timeout-404',
              organiserId: 'org-1',
              amount: 500,
              currency: 'KES',
              status: 'PROCESSING',
              providerRef: 'ref-timeout-404',
            }),
          },
          payment: {
            findMany: jest.fn().mockResolvedValue([
              {
                amount: 1000,
                commissionAmount: 50,
                organizerAmount: 950,
                settlementStatus: 'SETTLED',
                paidEventOrder: { currency: 'KES' },
                event: { currency: 'KES' },
              },
            ]),
          },
          financialLedgerEntry: { findMany: jest.fn().mockResolvedValue([]), upsert: jest.fn().mockResolvedValue({}) },
          organiserBalance: { upsert: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      // Dispatcher times out
      const mockDispatcher = jest.fn().mockRejectedValue(new Error('Network timeout after 15000ms'))
      // Verification immediately returns 404
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ status: false, message: 'Transfer not found' }),
      })

      const res = await requestOrganizerWithdrawal(
        {
          organizerId: 'org-1',
          amount: 500,
          currency: 'KES',
          method: 'MPESA',
          destination: '0712345678',
          destinationPayload: { phone: '0712345678' },
          clientReference: 'ref-timeout-404',
        },
        mockDispatcher
      )

      // Withdrawal must REMAIN in PROCESSING (fail closed)
      expect(res.status).toBe('PROCESSING')
      expect(res.success).toBe(false)
      expect(res.message).toMatch(/funds remain safely reserved|do not retry/i)
      // Withdrawal was NOT updated to FAILED
      expect(prisma.withdrawal.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
      )
    })
  })

  // =========================================================================
  // 5. Durable Transfer Reconciliation & Recovery
  // =========================================================================
  describe('5. Durable Transfer Reconciliation Worker', () => {
    it('reconciles a PROCESSING withdrawal to COMPLETED when Paystack API confirms success', async () => {
      const processingWithdrawal = {
        id: 'wd-recon-succ',
        organiserId: 'org-1',
        amount: 800,
        amountMinorUnits: BigInt(80000),
        currency: 'KES',
        status: 'PROCESSING',
        providerRef: 'trf_verify_success',
        idempotencyKey: 'wd:org-1:trf_verify_success',
      }
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue(processingWithdrawal)

      // Paystack verify returns success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          data: {
            reference: 'trf_verify_success',
            transfer_code: 'TRF_9988',
            status: 'success',
            amount: 80000,
            currency: 'KES',
            transferred_at: new Date().toISOString(),
          },
        }),
      })

      let completedUpdated = false
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          withdrawal: {
            update: jest.fn().mockImplementation((args) => {
              if (args.data.status === 'COMPLETED') completedUpdated = true
            }),
          },
          financialLedgerEntry: { upsert: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      const res = await reconcileOrganizerWithdrawal({ withdrawalId: 'wd-recon-succ' })
      expect(res.status).toBe('COMPLETED')
      expect(res.reconciled).toBe(true)
      expect(completedUpdated).toBe(true)
    })

    it('reconciles a PROCESSING withdrawal to FAILED and releases funds when Paystack confirms failure', async () => {
      const processingWithdrawal = {
        id: 'wd-recon-fail',
        organiserId: 'org-1',
        amount: 800,
        amountMinorUnits: BigInt(80000),
        currency: 'KES',
        status: 'PROCESSING',
        providerRef: 'trf_verify_failed',
        idempotencyKey: 'wd:org-1:trf_verify_failed',
      }
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue(processingWithdrawal)

      // Paystack verify returns failed
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          data: {
            reference: 'trf_verify_failed',
            transfer_code: 'TRF_9989',
            status: 'failed',
            amount: 80000,
            currency: 'KES',
          },
        }),
      })

      let releaseCredited = false
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          withdrawal: { update: jest.fn() },
          financialLedgerEntry: {
            upsert: jest.fn().mockImplementation((args) => {
              if (args.create.entryType === 'WITHDRAWAL_RELEASE') releaseCredited = true
            }),
          },
          organiserBalance: { upsert: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      const res = await reconcileOrganizerWithdrawal({ withdrawalId: 'wd-recon-fail' })
      expect(res.status).toBe('FAILED')
      expect(res.reconciled).toBe(true)
      expect(releaseCredited).toBe(true)
    })

    it('keeps withdrawal in PROCESSING when reconciliation check returns 404 or times out', async () => {
      const processingWithdrawal = {
        id: 'wd-recon-inc',
        organiserId: 'org-1',
        amount: 800,
        amountMinorUnits: BigInt(80000),
        currency: 'KES',
        status: 'PROCESSING',
        providerRef: 'trf_inconclusive',
        idempotencyKey: 'wd:org-1:trf_inconclusive',
      }
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue(processingWithdrawal)

      // Paystack verify fails with 504 Gateway Timeout
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 504,
        json: async () => ({ status: false, message: 'Gateway Timeout' }),
      })

      const res = await reconcileOrganizerWithdrawal({ withdrawalId: 'wd-recon-inc' })
      expect(res.status).toBe('PROCESSING')
      expect(res.reconciled).toBe(false)
      expect(res.message).toMatch(/inconclusive|strictly maintained/i)
      // Must NOT have called transaction to release funds
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('allows authorized manual administrative release ONLY when forceReason is provided', async () => {
      const processingWithdrawal = {
        id: 'wd-admin-force',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'PROCESSING',
        providerRef: 'ref-manual',
        idempotencyKey: 'wd:org-1:ref-manual',
      }
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue(processingWithdrawal)

      // 1. Rejects manual release when forceReason is missing
      await expect(
        reconcileOrganizerWithdrawal({
          withdrawalId: 'wd-admin-force',
          forceRelease: true,
          forceReason: '   ',
        })
      ).rejects.toThrow(/forceReason is strictly required/i)

      // 2. Succeeds when valid forceReason and operator actorId are provided
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          withdrawal: { update: jest.fn() },
          financialLedgerEntry: { upsert: jest.fn().mockResolvedValue({}) },
          organiserBalance: { upsert: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      const res = await reconcileOrganizerWithdrawal({
        withdrawalId: 'wd-admin-force',
        forceRelease: true,
        forceReason: 'Confirmed via Paystack dashboard audit that reference never executed',
        actorId: 'HEAD_FINANCE_OPERATOR_001',
      })

      expect(res.status).toBe('FAILED')
      expect(res.reconciled).toBe(true)
      expect(res.message).toMatch(/manually released by operator/i)
    })
  })
})
