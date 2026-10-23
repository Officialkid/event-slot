/** @jest-environment node */

import prisma from '@/lib/prisma'
import {
  processSettlementBatchEvidence,
  SettlementVerificationError,
} from '@/lib/settlementVerification'
import { getAuthoritativeOrganizerBalance } from '@/lib/organizerBalanceEngine'
import {
  requestOrganizerWithdrawal,
  completeOrganizerWithdrawal,
  failAndReleaseOrganizerWithdrawal,
  reverseOrganizerWithdrawal,
  InsufficientSettledBalanceError,
} from '@/lib/withdrawalService'
import { dispatchPaystackWebhook } from '@/lib/paystackWebhookDispatcher'
import crypto from 'crypto'

jest.mock('@/lib/prisma', () => {
  const mockClient = {
    payment: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    settlementBatch: {
      upsert: jest.fn(),
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
      create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    },
    user: {
      findUnique: jest.fn(),
    },
    processedProviderEvent: {
      create: jest.fn().mockResolvedValue({ id: 'rec-default' }),
      update: jest.fn().mockResolvedValue({ id: 'rec-default' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  }
  return {
    __esModule: true,
    default: mockClient,
    prisma: mockClient,
  }
})

function computePaystackSignature(payload: string, secret: string) {
  return crypto.createHmac('sha512', secret).update(payload).digest('hex')
}

describe('Phase 5: Organizer Balances, Settlement Verification & Safe Withdrawals', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.PAYSTACK_SECRET_KEY = 'sk_test_mock_secret_key_12345'
  })

  describe('1. Settlement Verification & Fail-Closed Availability', () => {
    it('keeps successful charge UNAVAILABLE for withdrawal when settlement evidence is missing', async () => {
      // Payment collected successfully, but settlementStatus is PENDING
      ;(prisma.payment.findMany as jest.Mock).mockResolvedValue([
        {
          amount: 1000,
          commissionAmount: 50,
          organizerAmount: 950,
          settlementStatus: 'PENDING', // Unsettled
          paidEventOrder: { currency: 'KES' },
          event: { currency: 'KES' },
        },
      ])
      ;(prisma.withdrawal.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.financialLedgerEntry.findMany as jest.Mock).mockResolvedValue([
        { entryType: 'TICKET_PROCEEDS', direction: 'CREDIT', amountMinorUnits: BigInt(100000) },
        { entryType: 'PLATFORM_COMMISSION', direction: 'DEBIT', amountMinorUnits: BigInt(5000) },
      ])

      const balance = await getAuthoritativeOrganizerBalance('org-1', 'KES')

      // Total entitlement is KES 950
      expect(balance.totalEntitlementMinorUnits).toBe(BigInt(95000))
      // Unsettled is KES 950
      expect(balance.pendingSettlementMinorUnits).toBe(BigInt(95000))
      // Settled is KES 0
      expect(balance.settledEntitlementMinorUnits).toBe(BigInt(0))
      // Available for withdrawal is strictly ZERO!
      expect(balance.availableMinorUnits).toBe(BigInt(0))
      expect(balance.formatted.available).toBe(0)
    })

    it('makes funds withdrawable ONLY when authoritative settlement evidence is verified', async () => {
      // 1. Process settlement evidence batch
      const mockPayment = {
        id: 'pay-100',
        amount: 2000,
        status: 'SUCCESS',
        settlementStatus: 'PENDING',
        paidEventOrder: { id: 'ord-100', currency: 'KES' },
      }

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          settlementBatch: { upsert: jest.fn().mockResolvedValue({}) },
          payment: {
            findFirst: jest.fn().mockResolvedValue(mockPayment),
            update: jest.fn().mockResolvedValue({ ...mockPayment, settlementStatus: 'SETTLED' }),
          },
          auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
        }
        return callback(tx)
      })

      const evidence = {
        provider: 'paystack' as const,
        batchReference: 'BATCH_2026_10_20_001',
        currency: 'KES',
        totalAmountMinorUnits: BigInt(200000), // KES 2,000 in minor units
        settledAt: new Date(),
        evidenceSource: 'paystack_settlement_report' as const,
        transactions: [
          {
            reference: 'pes_tx_settle_100',
            amountMinorUnits: BigInt(200000),
            currency: 'KES',
          },
        ],
      }

      const res = await processSettlementBatchEvidence(evidence)
      expect(res.success).toBe(true)
      expect(res.settledCount).toBe(1)

      // 2. Now check balance calculation when settlementStatus is SETTLED
      ;(prisma.payment.findMany as jest.Mock).mockResolvedValue([
        {
          amount: 2000,
          commissionAmount: 100, // 5%
          organizerAmount: 1900, // 95%
          settlementStatus: 'SETTLED', // Verified settled!
          paidEventOrder: { currency: 'KES' },
          event: { currency: 'KES' },
        },
      ])
      ;(prisma.withdrawal.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.financialLedgerEntry.findMany as jest.Mock).mockResolvedValue([
        { entryType: 'TICKET_PROCEEDS', direction: 'CREDIT', amountMinorUnits: BigInt(200000) },
        { entryType: 'PLATFORM_COMMISSION', direction: 'DEBIT', amountMinorUnits: BigInt(10000) },
      ])

      const balance = await getAuthoritativeOrganizerBalance('org-1', 'KES')

      expect(balance.settledEntitlementMinorUnits).toBe(BigInt(190000))
      expect(balance.pendingSettlementMinorUnits).toBe(BigInt(0))
      expect(balance.availableMinorUnits).toBe(BigInt(190000))
      expect(balance.formatted.available).toBe(1900)
    })

    it('rejects contradictory or mismatched settlement evidence (FAIL CLOSED)', async () => {
      const evidence = {
        provider: 'paystack' as const,
        batchReference: 'BATCH_FAIL',
        currency: 'KES',
        totalAmountMinorUnits: BigInt(500000), // Header claims 500,000
        settledAt: new Date(),
        evidenceSource: 'paystack_settlement_report' as const,
        transactions: [
          {
            reference: 'tx_1',
            amountMinorUnits: BigInt(100000), // But items only sum to 100,000!
            currency: 'KES',
          },
        ],
      }

      await expect(processSettlementBatchEvidence(evidence)).rejects.toThrow(
        /batch total mismatch/i
      )
    })
  })

  describe('2. Safe Withdrawal Reservations & Concurrency Protection', () => {
    it('blocks withdrawal when requested amount exceeds settled available balance', async () => {
      // Organizer has only KES 500 settled, but requests KES 1000
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          withdrawal: {
            findUnique: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
          },
          payment: {
            findMany: jest.fn().mockResolvedValue([
              {
                amount: 526,
                commissionAmount: 26,
                organizerAmount: 500,
                settlementStatus: 'SETTLED',
                paidEventOrder: { currency: 'KES' },
                event: { currency: 'KES' },
              },
            ]),
          },
          financialLedgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
        }
        return callback(tx)
      })

      await expect(
        requestOrganizerWithdrawal({
          organizerId: 'org-1',
          amount: 1000,
          currency: 'KES',
          method: 'MPESA',
          destination: '0712345678',
          destinationPayload: { phone: '0712345678' },
        })
      ).rejects.toThrow(InsufficientSettledBalanceError)
    })

    it('serializes concurrent withdrawals under row lock and prevents double reservation', async () => {
      // Exactly KES 1,000 available. Two requests for KES 1,000 arrive simultaneously.
      let availableBalance = BigInt(100000) // KES 1,000
      let committedReservations = 0

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          withdrawal: {
            findUnique: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockImplementation((args) => {
              committedReservations++
              availableBalance -= BigInt(100000) // Deducted!
              return {
                id: 'wd-winner',
                amount: 1000,
                currency: 'KES',
                status: 'PROCESSING',
                destination: '0712345678',
                providerRef: 'ref-winner',
              }
            }),
          },
          payment: {
            findMany: jest.fn().mockImplementation(async () => [
              {
                amount: 1052,
                commissionAmount: 52,
                organizerAmount: 1000,
                settlementStatus: 'SETTLED',
                paidEventOrder: { currency: 'KES' },
                event: { currency: 'KES' },
              },
            ]),
          },
          financialLedgerEntry: {
            findMany: jest.fn().mockResolvedValue([]),
            upsert: jest.fn().mockResolvedValue({}),
          },
          organiserBalance: { upsert: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return callback(tx)
      })

      // Request 1 succeeds
      const res1 = await requestOrganizerWithdrawal({
        organizerId: 'org-1',
        amount: 1000,
        currency: 'KES',
        method: 'MPESA',
        destination: '0712345678',
        destinationPayload: { phone: '0712345678' },
        clientReference: 'req-1',
      })
      expect(res1.success).toBe(true)
      expect(res1.status).toBe('PROCESSING')

      // Request 2 evaluates under the updated balance and must be rejected!
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          withdrawal: {
            findUnique: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([
              { amount: 1000, amountMinorUnits: BigInt(100000), status: 'PROCESSING' },
            ]),
          },
          payment: {
            findMany: jest.fn().mockResolvedValue([
              {
                amount: 1052,
                commissionAmount: 52,
                organizerAmount: 1000,
                settlementStatus: 'SETTLED',
                paidEventOrder: { currency: 'KES' },
                event: { currency: 'KES' },
              },
            ]),
          },
          financialLedgerEntry: { findMany: jest.fn().mockResolvedValue([]) },
        }
        return callback(tx)
      })

      await expect(
        requestOrganizerWithdrawal({
          organizerId: 'org-1',
          amount: 1000,
          currency: 'KES',
          method: 'MPESA',
          destination: '0712345678',
          destinationPayload: { phone: '0712345678' },
          clientReference: 'req-2',
        })
      ).rejects.toThrow(InsufficientSettledBalanceError)

      expect(committedReservations).toBe(1)
    })

    it('atomically releases reservation when provider synchronously rejects the transfer', async () => {
      let reservationDebited = false
      let reservationReleased = false

      const mockFailedDispatchWd = {
        id: 'wd-failed-dispatch',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'PROCESSING',
      }
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue(mockFailedDispatchWd)

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          withdrawal: {
            findUnique: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockImplementation(() => {
              reservationDebited = true
              return { id: 'wd-failed-dispatch', amount: 500, currency: 'KES', status: 'PROCESSING', destination: '0799999999' }
            }),
            update: jest.fn().mockImplementation(() => {
              reservationReleased = true
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
          financialLedgerEntry: {
            findMany: jest.fn().mockResolvedValue([]),
            upsert: jest.fn().mockResolvedValue({}),
          },
          organiserBalance: { upsert: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return callback(tx)
      })

      // Dispatcher throws synchronous provider error
      const mockDispatcher = jest.fn().mockRejectedValue(new Error('Invalid recipient phone number'))

      const res = await requestOrganizerWithdrawal(
        {
          organizerId: 'org-1',
          amount: 500,
          currency: 'KES',
          method: 'MPESA',
          destination: '0799999999',
          destinationPayload: { phone: '0799999999' },
        },
        mockDispatcher
      )

      expect(res.success).toBe(false)
      expect(res.status).toBe('FAILED')
      expect(reservationDebited).toBe(true)
      expect(reservationReleased).toBe(true)
    })
  })

  describe('3. Payout Lifecycle Webhook Transitions', () => {
    it('handles transfer.success: completes withdrawal and audits completion without double debiting', async () => {
      const payload = JSON.stringify({
        event: 'transfer.success',
        id: 998877,
        data: {
          reference: 'trf_ref_success_1',
          transfer_code: 'TRF_12345',
          amount: 50000, // 500 KES in minor units
          currency: 'KES',
          transferred_at: new Date().toISOString(),
        },
      })
      const signature = computePaystackSignature(payload, 'sk_test_mock_secret_key_12345')

      ;(prisma.processedProviderEvent.findUnique as jest.Mock).mockResolvedValueOnce(null)
      ;(prisma.processedProviderEvent.create as jest.Mock).mockResolvedValueOnce({ id: 'rec-1' })
      const mockWd = {
        id: 'wd-1',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'PROCESSING',
      }
      ;(prisma.withdrawal.findFirst as jest.Mock).mockResolvedValue(mockWd)
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue(mockWd)

      let completedStatusSet = false
      let ledgerAdjustmentAmount: bigint | null = null

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          withdrawal: {
            update: jest.fn().mockImplementation((args) => {
              completedStatusSet = args.data.status === 'COMPLETED'
            }),
          },
          financialLedgerEntry: {
            upsert: jest.fn().mockImplementation((args) => {
              ledgerAdjustmentAmount = args.create.amountMinorUnits
            }),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return callback(tx)
      })

      const res = await dispatchPaystackWebhook({ rawBody: payload, signature })

      expect(res.status).toBe(200)
      expect(completedStatusSet).toBe(true)
      // Must NOT debit the balance a second time! Adjustment is 0
      expect(ledgerAdjustmentAmount).toBe(BigInt(0))
    })

    it('handles transfer.failed: releases reservation and restores available balance', async () => {
      const payload = JSON.stringify({
        event: 'transfer.failed',
        id: 998878,
        data: {
          reference: 'trf_ref_failed_1',
          transfer_code: 'TRF_FAILED_1',
          amount: 50000,
          currency: 'KES',
          reason: 'Beneficiary account restricted',
        },
      })
      const signature = computePaystackSignature(payload, 'sk_test_mock_secret_key_12345')

      ;(prisma.processedProviderEvent.findUnique as jest.Mock).mockResolvedValueOnce(null)
      ;(prisma.processedProviderEvent.create as jest.Mock).mockResolvedValueOnce({ id: 'rec-2' })
      const mockFailedWd = {
        id: 'wd-failed-1',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'PROCESSING',
      }
      ;(prisma.withdrawal.findFirst as jest.Mock).mockResolvedValue(mockFailedWd)
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue(mockFailedWd)

      let releaseCredited = false
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          withdrawal: { update: jest.fn() },
          financialLedgerEntry: {
            upsert: jest.fn().mockImplementation((args) => {
              if (args.create.entryType === 'WITHDRAWAL_RELEASE' && args.create.direction === 'CREDIT') {
                releaseCredited = true
              }
            }),
          },
          organiserBalance: { upsert: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return callback(tx)
      })

      const res = await dispatchPaystackWebhook({ rawBody: payload, signature })

      expect(res.status).toBe(200)
      expect(releaseCredited).toBe(true)
    })
  })
})
