/** @jest-environment node */

import prisma from '@/lib/prisma'
import {
  runPaystackSettlementSync,
  fetchPaystackSettlements,
  fetchAllSettlementTransactions,
} from '@/lib/settlementSyncWorker'
import { processSettlementBatchEvidence, SettlementVerificationError } from '@/lib/settlementVerification'
import { dispatchPaystackWebhook } from '@/lib/paystackWebhookDispatcher'
import { GET as getCronReconciliation, POST as postCronReconciliation } from '@/app/api/cron/settlement-reconciliation/route'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

jest.mock('@/lib/prisma', () => {
  const mockClient: any = {
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
    $transaction: jest.fn((callback: (tx: any) => any) => callback(mockClient)),
  }
  return {
    __esModule: true,
    default: mockClient,
    prisma: mockClient,
  }
})

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/isAdmin', () => ({
  hasAdminAccess: jest.fn(),
  isAdminEmail: jest.fn(),
}))

// Mock global fetch for Paystack API calls
const originalFetch = global.fetch
const mockFetch = jest.fn()
global.fetch = mockFetch as any

describe('Phase 5.21: Safe Paystack Settlement Reconciliation Suite', () => {
  const secretKey = 'sk_test_mock_secret_key_521'
  const webhookSecret = 'whsec_test_secret_521'

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.ENABLE_PAYSTACK_SETTLEMENT_SYNC
    delete process.env.CRON_SECRET
    process.env.PAYSTACK_SECRET_KEY = secretKey
    process.env.PAYSTACK_WEBHOOK_SECRET = webhookSecret
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  describe('1. Cron & Reconciliation Endpoint Authorization & Guards', () => {
    it('rejects unauthorized requests with HTTP 401 when no token or admin session is present', async () => {
      process.env.CRON_SECRET = 'correct_cron_secret_123'
      const req = new NextRequest('http://localhost/api/cron/settlement-reconciliation')

      const res = await getCronReconciliation(req)
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('rejects requests with an incorrect bearer token', async () => {
      process.env.CRON_SECRET = 'correct_cron_secret_123'
      const req = new NextRequest('http://localhost/api/cron/settlement-reconciliation', {
        headers: { authorization: 'Bearer wrong_token' },
      })

      const res = await postCronReconciliation(req)
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('returns disabled notification by default when ENABLE_PAYSTACK_SETTLEMENT_SYNC is unset', async () => {
      process.env.CRON_SECRET = 'correct_cron_secret_123'
      const req = new NextRequest('http://localhost/api/cron/settlement-reconciliation', {
        headers: { authorization: 'Bearer correct_cron_secret_123' },
      })

      const res = await getCronReconciliation(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(false)
      expect(json.enabled).toBe(false)
      expect(json.message).toMatch(/disabled by default/i)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('executes dry-run mode safely when dryRun=true even if feature flag is unset', async () => {
      process.env.CRON_SECRET = 'correct_cron_secret_123'
      const req = new NextRequest('http://localhost/api/cron/settlement-reconciliation?dryRun=true', {
        headers: { authorization: 'Bearer correct_cron_secret_123' },
      })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          message: 'Settlements retrieved',
          data: [],
        }),
      })

      const res = await getCronReconciliation(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.dryRun).toBe(true)
      expect(json.batchesInspected).toBe(0)
    })
  })

  describe('2. Idempotency & Replay Safety', () => {
    it('skips batches that have already been fully synchronized (syncCompleted: true)', async () => {
      process.env.ENABLE_PAYSTACK_SETTLEMENT_SYNC = 'true'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          data: [
            {
              id: 9991,
              domain: 'live',
              status: 'success',
              currency: 'KES',
              total_amount: 100000,
              effective_amount: 95000,
              total_fees: 5000,
              total_processed: 100000,
              createdAt: '2026-04-01T00:00:00Z',
              updatedAt: '2026-04-01T00:00:00Z',
            },
          ],
        }),
      })

      ;(prisma.settlementBatch.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'sb-1',
        batchReference: 'paystack_settle_9991',
        transactionCount: 1,
        metadata: { syncCompleted: true },
      })

      const result = await runPaystackSettlementSync()

      expect(result.success).toBe(true)
      expect(result.batchesSkipped).toBe(1)
      expect(result.batchesProcessed).toBe(0)
      expect(result.batchResults[0].status).toBe('SKIPPED_ALREADY_PROCESSED')
      expect(prisma.payment.update).not.toHaveBeenCalled()
    })

    it('skips payments that are already marked SETTLED without duplicate audit logs or double-crediting', async () => {
      const evidence = {
        provider: 'paystack' as const,
        batchReference: 'paystack_settle_replay_test',
        currency: 'KES',
        totalAmountMinorUnits: BigInt(500000),
        settledAt: new Date('2026-04-01T12:00:00Z'),
        evidenceSource: 'paystack_settlement_report' as const,
        transactions: [
          {
            reference: 'tx_already_settled',
            amountMinorUnits: BigInt(500000),
            currency: 'KES',
          },
        ],
      }

      ;(prisma.payment.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'pay-already-settled',
        amount: 5000,
        status: 'SUCCESS',
        settlementStatus: 'SETTLED', // Already marked SETTLED
        paidEventOrder: { id: 'ord-1', currency: 'KES', amountKes: 5000 },
      })

      const res = await processSettlementBatchEvidence(evidence)

      expect(res.success).toBe(true)
      expect(res.settledCount).toBe(0)
      expect(res.alreadySettledCount).toBe(1)
      expect(prisma.payment.update).not.toHaveBeenCalled()
    })
  })

  describe('3. Concurrency Protection & In-Progress Batch Guard', () => {
    it('skips batches that are currently leased and in-progress by another worker', async () => {
      process.env.ENABLE_PAYSTACK_SETTLEMENT_SYNC = 'true'

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          data: [
            {
              id: 8882,
              domain: 'live',
              status: 'success',
              currency: 'KES',
              total_amount: 50000,
              effective_amount: 47500,
              total_fees: 2500,
              total_processed: 50000,
              createdAt: '2026-04-01T00:00:00Z',
              updatedAt: '2026-04-01T00:00:00Z',
            },
          ],
        }),
      })

      // Batch currently leased by concurrent execution 2 minutes ago
      ;(prisma.settlementBatch.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'sb-leased',
        batchReference: 'paystack_settle_8882',
        transactionCount: 0,
        metadata: {
          syncInProgress: true,
          syncStartedAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        },
      })

      const result = await runPaystackSettlementSync()

      expect(result.success).toBe(true)
      expect(result.batchesSkipped).toBe(1)
      expect(result.batchResults[0].status).toBe('SKIPPED_IN_PROGRESS')
      expect(prisma.payment.update).not.toHaveBeenCalled()
    })
  })

  describe('4. Paystack Webhook Settlement Event Safety', () => {
    it('acknowledges bulk settlement.success webhook without marking payments as settled from unverified signal', async () => {
      const payload = JSON.stringify({
        event: 'settlement.success',
        id: 12345,
        data: {
          id: 5555,
          domain: 'live',
          status: 'success',
          total_amount: 1000000,
          currency: 'KES',
          settlement_date: '2026-04-01T04:00:00Z',
        },
      })

      const hmac = crypto.createHmac('sha512', secretKey).update(payload).digest('hex')

      const result = await dispatchPaystackWebhook({
        rawBody: payload,
        signature: hmac,
      })

      expect(result.status).toBe(200)
      expect(result.body.received).toBe(true)

      // Invariant: Unverified bulk webhook signals MUST NEVER mark individual payments as settled!
      expect(prisma.payment.update).not.toHaveBeenCalled()
    })
  })
})
