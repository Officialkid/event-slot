/** @jest-environment node */

import prisma from '@/lib/prisma'
import {
  calculatePaidEventCommission,
  getPaidEventCommissionRate,
  FLAT_PAID_EVENT_COMMISSION_RATE,
} from '@/lib/paidEventCommission'
import {
  toMinorUnits,
  fromMinorUnits,
  getMinorUnitFactor,
  calculateLedgerBalance,
} from '@/lib/financialLedger'
import {
  completeOrganizerWithdrawal,
  failAndReleaseOrganizerWithdrawal,
  reverseOrganizerWithdrawal,
  reconcileOrganizerWithdrawal,
  isAmbiguousDispatchError,
} from '@/lib/withdrawalService'
import {
  processSettlementBatchEvidence,
  SettlementVerificationError,
} from '@/lib/settlementVerification'
import { dispatchPaystackWebhook } from '@/lib/paystackWebhookDispatcher'
import { PaystackApiError, PaystackValidationError } from '@/lib/paystack'
import crypto from 'crypto'

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
      create: jest.fn().mockResolvedValue({ id: 'audit-log-54' }),
    },
    user: {
      findUnique: jest.fn(),
    },
    processedProviderEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-54' }),
      update: jest.fn().mockResolvedValue({ id: 'event-54' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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

describe('Phase 5.4: Adversarial Financial Integrity & Security Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_secret_key_54'
  })

  // =========================================================================
  // 1. Commission Precision & Mathematical Invariants
  // =========================================================================
  describe('1. Commission & Monetary Precision Invariants', () => {
    it('enforces flat 5% commission rate uniformly across all subscription plans', () => {
      const plans = ['free', 'standard', 'pro', 'business', 'enterprise', null, undefined]
      for (const plan of plans) {
        expect(getPaidEventCommissionRate(plan)).toBe(0.05)
        const calc = calculatePaidEventCommission(1000, plan)
        expect(calc.commissionRate).toBe(0.05)
        expect(calc.commissionAmount).toBe(50)
        expect(calc.organizerAmount).toBe(950)
      }
    })

    it('guarantees organizerAmount + commissionAmount === amountKes for all test amounts', () => {
      const amounts = [1, 2, 5, 10, 15, 19, 99, 100, 150, 499, 1000, 2500, 100000, 9999999]
      for (const amt of amounts) {
        const { commissionAmount, organizerAmount } = calculatePaidEventCommission(amt)
        expect(commissionAmount + organizerAmount).toBe(amt)
        expect(commissionAmount).toBe(Math.round(amt * 0.05))
        expect(organizerAmount).toBe(amt - Math.round(amt * 0.05))
      }
    })

    it('handles zero, negative, NaN, and Infinity safely without throwing', () => {
      const invalidInputs = [0, -1, -500, NaN, Infinity, -Infinity]
      for (const bad of invalidInputs) {
        const res = calculatePaidEventCommission(bad)
        expect(res.commissionAmount).toBe(0)
        expect(res.organizerAmount).toBe(0)
        expect(toMinorUnits(bad, 'KES')).toBe(BigInt(0))
      }
    })

    it('converts major to minor units without floating-point representation loss', () => {
      expect(toMinorUnits(100.55, 'KES')).toBe(BigInt(10055))
      expect(toMinorUnits(0.01, 'KES')).toBe(BigInt(1))
      expect(toMinorUnits(1234567.89, 'KES')).toBe(BigInt(123456789))
      expect(fromMinorUnits(BigInt(10055), 'KES')).toBe(100.55)
      expect(getMinorUnitFactor('KES')).toBe(100)
      expect(getMinorUnitFactor('USD')).toBe(100)
    })

    it('uses pure BigInt arithmetic for ledger balance calculation', () => {
      const entries = [
        { direction: 'CREDIT' as const, amountMinorUnits: BigInt(100000) }, // +1000 KES
        { direction: 'DEBIT' as const, amountMinorUnits: BigInt(5000) },    // -50 KES
        { direction: 'DEBIT' as const, amountMinorUnits: BigInt(95000) },   // -950 KES
      ]
      const bal = calculateLedgerBalance(entries)
      expect(bal.balanceMinorUnits).toBe(BigInt(0))
      expect(bal.totalCreditsMinorUnits).toBe(BigInt(100000))
      expect(bal.totalDebitsMinorUnits).toBe(BigInt(100000))
    })
  })

  // =========================================================================
  // 2. Withdrawal Terminal State Machine Hardening
  // =========================================================================
  describe('2. Withdrawal Terminal State Machine Integrity', () => {
    it('refuses to complete a withdrawal that is already in FAILED status', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-failed-1',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'FAILED',
      })

      const res = await completeOrganizerWithdrawal({
        withdrawalId: 'wd-failed-1',
        providerReference: 'trf_late_success',
      })

      expect(res.success).toBe(false)
      expect(res.message).toMatch(/already FAILED and reservation was released/i)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('refuses to complete a withdrawal that is already in REVERSED status', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-rev-1',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'REVERSED',
      })

      const res = await completeOrganizerWithdrawal({
        withdrawalId: 'wd-rev-1',
      })

      expect(res.success).toBe(false)
      expect(res.message).toMatch(/already REVERSED/i)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('refuses to complete a withdrawal that is CANCELLED', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-canc-1',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'CANCELLED',
      })

      const res = await completeOrganizerWithdrawal({
        withdrawalId: 'wd-canc-1',
      })

      expect(res.success).toBe(false)
      expect(res.message).toMatch(/already CANCELLED/i)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('refuses to release funds for a withdrawal that is already REVERSED', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-rev-2',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'REVERSED',
      })

      const res = await failAndReleaseOrganizerWithdrawal({
        withdrawalId: 'wd-rev-2',
        reason: 'Late failure event after reversal',
      })

      expect(res.success).toBe(false)
      expect(res.message).toMatch(/already REVERSED and funds were restored/i)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('refuses to reverse a withdrawal that is already FAILED', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-fail-3',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'FAILED',
      })

      const res = await reverseOrganizerWithdrawal({
        withdrawalId: 'wd-fail-3',
        reason: 'Spurious reversal webhook',
      })

      expect(res.success).toBe(false)
      expect(res.message).toMatch(/already FAILED and reservation was released/i)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('idempotently acknowledges duplicate completions, failures, and reversals', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'w1', status: 'COMPLETED' })
        .mockResolvedValueOnce({ id: 'w2', status: 'FAILED' })
        .mockResolvedValueOnce({ id: 'w3', status: 'REVERSED' })

      const cRes = await completeOrganizerWithdrawal({ withdrawalId: 'w1' })
      expect(cRes.success).toBe(true)
      expect(cRes.duplicate).toBe(true)

      const fRes = await failAndReleaseOrganizerWithdrawal({ withdrawalId: 'w2', reason: 'fail' })
      expect(fRes.success).toBe(true)
      expect(fRes.duplicate).toBe(true)

      const rRes = await reverseOrganizerWithdrawal({ withdrawalId: 'w3', reason: 'rev' })
      expect(rRes.success).toBe(true)
      expect(rRes.duplicate).toBe(true)
    })
  })

  // =========================================================================
  // 3. Settlement Reference Normalization & Tolerance
  // =========================================================================
  describe('3. Settlement Ingestion Tolerance', () => {
    it('matches payment records whether settlement report references have paystack: prefix or not', async () => {
      const mockPayment = {
        id: 'pay-settle-norm',
        status: 'SUCCESS',
        settlementStatus: 'PENDING',
        amount: 1000,
        paidEventOrderId: 'order-norm-1',
        paidEventOrder: { currency: 'KES', id: 'order-norm-1' },
      }

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          settlementBatch: { upsert: jest.fn() },
          payment: {
            findFirst: jest.fn().mockResolvedValue(mockPayment),
            update: jest.fn().mockResolvedValue({ ...mockPayment, settlementStatus: 'SETTLED' }),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      const evidence = {
        provider: 'paystack' as const,
        batchReference: 'BATCH-PREFIX-TOLERANCE',
        currency: 'KES',
        totalAmountMinorUnits: BigInt(100000),
        settledAt: new Date(),
        evidenceSource: 'paystack_settlement_report' as const,
        transactions: [
          {
            reference: 'paystack:pes_order123_abc',
            amountMinorUnits: BigInt(100000),
            currency: 'KES',
          },
        ],
      }

      const res = await processSettlementBatchEvidence(evidence)
      expect(res.success).toBe(true)
      expect(res.settledCount).toBe(1)
      expect(res.unmatchedReferences).toHaveLength(0)
    })
  })

  // =========================================================================
  // 4. Webhook Security & Verification Hardening
  // =========================================================================
  describe('4. Webhook Ingestion & Payout Discrepancy Logging', () => {
    function createSignature(payload: string, secret: string) {
      return crypto.createHmac('sha512', secret).update(payload).digest('hex')
    }

    it('rejects webhooks with invalid HMAC SHA-512 signatures with HTTP 401', async () => {
      const res = await dispatchPaystackWebhook({
        rawBody: JSON.stringify({ event: 'charge.success' }),
        signature: 'invalid_sha512_signature',
      })
      expect(res.status).toBe(401)
      expect(res.body.error).toMatch(/Invalid signature/i)
    })

    it('rejects webhook transfer events when payout amounts do not match withdrawal minor units', async () => {
      const payload = JSON.stringify({
        event: 'transfer.success',
        id: 991823,
        data: {
          reference: 'wd_org1_test12345678',
          transfer_code: 'TRF_TEST_123',
          amount: 5000, // 50 KES
          currency: 'KES',
        },
      })
      const signature = createSignature(payload, 'sk_test_mock_secret_key_54')

      ;(prisma.withdrawal.findFirst as jest.Mock).mockResolvedValue({
        id: 'wd-amount-mismatch',
        amount: 500, // 500 KES expected (50,000 minor)
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'PROCESSING',
      })

      const res = await dispatchPaystackWebhook({
        rawBody: payload,
        signature,
      })

      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/Transfer amount mismatch/i)
    })
  })
})
