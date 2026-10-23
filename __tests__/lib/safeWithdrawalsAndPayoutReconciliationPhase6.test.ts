/** @jest-environment node */

import prisma from '@/lib/prisma'
import {
  completeOrganizerWithdrawal,
  failAndReleaseOrganizerWithdrawal,
  reverseOrganizerWithdrawal,
  reconcileOrganizerWithdrawal,
  runWithdrawalReconciliationWorker,
} from '@/lib/withdrawalService'
import { verifyPaystackTransfer } from '@/lib/paystackPayouts'
import { dispatchPaystackWebhook } from '@/lib/paystackWebhookDispatcher'
import { GET as getPayoutReconciliation, POST as postPayoutReconciliation } from '@/app/api/cron/payout-reconciliation/route'
import { NextRequest } from 'next/server'
import crypto from 'crypto'

jest.mock('@/lib/prisma', () => {
  const mockClient: any = {
    payment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    withdrawal: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    financialLedgerEntry: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    organiserBalance: {
      upsert: jest.fn(),
    },
    auditLog: {
      create: jest.fn().mockResolvedValue({ id: 'audit-log-6' }),
    },
    user: {
      findUnique: jest.fn(),
    },
    processedProviderEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-6' }),
      update: jest.fn().mockResolvedValue({ id: 'event-6' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
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

jest.mock('@/lib/paystackPayouts', () => ({
  verifyPaystackTransfer: jest.fn(),
}))

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

describe('Phase 6: Safe Withdrawals and Payout Reconciliation Suite', () => {
  const secretKey = 'sk_test_mock_secret_key_6'

  beforeEach(() => {
    jest.clearAllMocks()
    delete process.env.CRON_SECRET
    process.env.PAYSTACK_SECRET_KEY = secretKey
  })

  describe('1. Concurrency & Race Condition Protection in Transitions', () => {
    it('prevents double-release and double-decrementing balances if a concurrent caller races failAndReleaseOrganizerWithdrawal', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-race-1',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'PROCESSING',
      })

      // Simulate that another concurrent transaction already transitioned this withdrawal away from PROCESSING
      ;(prisma.withdrawal.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

      const res = await failAndReleaseOrganizerWithdrawal({
        withdrawalId: 'wd-race-1',
        reason: 'Network failure',
      })

      // Balance decrement and ledger entry MUST NOT be executed if count is 0
      expect(prisma.organiserBalance.upsert).not.toHaveBeenCalled()
      expect(prisma.financialLedgerEntry.upsert).not.toHaveBeenCalled()
    })

    it('prevents duplicate completion entries if a concurrent caller races completeOrganizerWithdrawal', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-race-2',
        organiserId: 'org-1',
        amount: 1000,
        amountMinorUnits: BigInt(100000),
        currency: 'KES',
        status: 'PROCESSING',
      })

      ;(prisma.withdrawal.updateMany as jest.Mock).mockResolvedValue({ count: 0 })

      const res = await completeOrganizerWithdrawal({
        withdrawalId: 'wd-race-2',
        providerReference: 'trf_prov_race',
      })

      expect(prisma.financialLedgerEntry.upsert).not.toHaveBeenCalled()
    })
  })

  describe('2. Transfer Evidence, Amount & Currency Matching', () => {
    it('refuses to complete withdrawal and logs critical mismatch if Paystack returns mismatched amount', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-mismatch-amt',
        organiserId: 'org-1',
        amount: 1000,
        amountMinorUnits: BigInt(100000), // KES 1,000
        currency: 'KES',
        status: 'PROCESSING',
      })

      ;(verifyPaystackTransfer as jest.Mock).mockResolvedValue({
        status: 'success',
        reference: 'trf_prov_mismatch_amt',
        amountMinorUnits: BigInt(50000), // KES 500 (MISMATCH!)
        currency: 'KES',
        transferredAt: new Date(),
      })

      const res = await reconcileOrganizerWithdrawal({
        withdrawalId: 'wd-mismatch-amt',
      })

      expect(res.reconciled).toBe(false)
      expect(res.status).toBe('PROCESSING')
      expect(res.message).toMatch(/amount mismatch/i)
      expect(prisma.withdrawal.updateMany).not.toHaveBeenCalled()
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'WITHDRAWAL_RECONCILIATION_MISMATCH',
          }),
        })
      )
    })

    it('refuses to complete withdrawal if Paystack returns mismatched currency', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-mismatch-curr',
        organiserId: 'org-1',
        amount: 100,
        amountMinorUnits: BigInt(10000),
        currency: 'KES',
        status: 'PROCESSING',
      })

      ;(verifyPaystackTransfer as jest.Mock).mockResolvedValue({
        status: 'success',
        reference: 'trf_prov_mismatch_curr',
        amountMinorUnits: BigInt(10000),
        currency: 'USD', // MISMATCH!
        transferredAt: new Date(),
      })

      const res = await reconcileOrganizerWithdrawal({
        withdrawalId: 'wd-mismatch-curr',
      })

      expect(res.reconciled).toBe(false)
      expect(res.status).toBe('PROCESSING')
      expect(res.message).toMatch(/currency mismatch/i)
      expect(prisma.withdrawal.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('3. Worker Concurrency & Distributed Lease', () => {
    it('prevents worker execution when another reconciliation lease is actively held', async () => {
      ;(prisma.processedProviderEvent.findUnique as jest.Mock).mockResolvedValue({
        id: 'lease-1',
        idempotencyKey: 'lock:withdrawal_reconciliation_worker',
        status: 'PROCESSING',
        firstSeenAt: new Date(Date.now() - 60 * 1000), // 1 minute ago (active within 5 min window)
      })

      const res = await runWithdrawalReconciliationWorker()

      expect(res.totalInspected).toBe(0)
      expect(res.message).toMatch(/lease is currently held/i)
      expect(prisma.withdrawal.findMany).not.toHaveBeenCalled()
    })
  })

  describe('4. Payout Reconciliation Endpoint Authorization & Operations', () => {
    it('rejects unauthorized requests with HTTP 401 when no token or admin session is present', async () => {
      process.env.CRON_SECRET = 'secret_cron_pass'
      const req = new NextRequest('http://localhost/api/cron/payout-reconciliation')

      const res = await getPayoutReconciliation(req)
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('Unauthorized')
    })

    it('allows execution when valid Bearer CRON_SECRET is supplied', async () => {
      process.env.CRON_SECRET = 'secret_cron_pass'
      const req = new NextRequest('http://localhost/api/cron/payout-reconciliation?dryRun=true', {
        headers: { authorization: 'Bearer secret_cron_pass' },
      })

      ;(prisma.withdrawal.findMany as jest.Mock).mockResolvedValue([])

      const res = await postPayoutReconciliation(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.dryRun).toBe(true)
    })

    it('rejects force-release attempts made without administrator session', async () => {
      process.env.CRON_SECRET = 'secret_cron_pass'
      const req = new NextRequest(
        'http://localhost/api/cron/payout-reconciliation?withdrawalId=wd-1&forceRelease=true&forceReason=testing',
        {
          headers: { authorization: 'Bearer secret_cron_pass' },
        }
      )

      const res = await postPayoutReconciliation(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toMatch(/manual force release requires an authenticated administrator/i)
    })
  })

  describe('5. Dispute & Quarantined Funds Webhook Handling', () => {
    it('transitions settlementStatus to DISPUTED and creates quarantine audit log on charge.dispute.create', async () => {
      const payload = JSON.stringify({
        event: 'charge.dispute.create',
        id: 998811,
        data: {
          id: 7721,
          status: 'pending',
          reference: 'tx_disputed_reference',
          amount: 250000,
          currency: 'KES',
          reason: 'Customer reported unauthorized card charge',
        },
      })

      const hmac = crypto.createHmac('sha512', secretKey).update(payload).digest('hex')

      ;(prisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-disputed-1',
        paidEventOrderId: 'ord-dispute-1',
        settlementStatus: 'SETTLED',
        settlementEvidence: {},
        event: { id: 'evt-1', organizerId: 'org-disputed' },
      })

      const res = await dispatchPaystackWebhook({
        rawBody: payload,
        signature: hmac,
      })

      expect(res.status).toBe(200)
      expect(prisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-disputed-1' },
          data: expect.objectContaining({
            settlementStatus: 'DISPUTED',
          }),
        })
      )
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'PAYMENT_DISPUTE_QUARANTINED',
          }),
        })
      )
    })
  })
})
