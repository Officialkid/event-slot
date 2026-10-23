/** @jest-environment node */

import prisma from '@/lib/prisma'
import {
  processSettlementBatchEvidence,
  SettlementVerificationError,
} from '@/lib/settlementVerification'
import {
  getAuthoritativeOrganizerBalance,
} from '@/lib/organizerBalanceEngine'
import {
  requestOrganizerWithdrawal,
  completeOrganizerWithdrawal,
  failAndReleaseOrganizerWithdrawal,
  reverseOrganizerWithdrawal,
  InsufficientSettledBalanceError,
  isAmbiguousDispatchError,
} from '@/lib/withdrawalService'
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
      create: jest.fn().mockResolvedValue({ id: 'audit-log-id' }),
    },
    user: {
      findUnique: jest.fn(),
    },
    processedProviderEvent: {
      create: jest.fn().mockResolvedValue({ id: 'event-rec-1' }),
      update: jest.fn().mockResolvedValue({ id: 'event-rec-1' }),
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

function computePaystackSignature(payload: string, secret: string) {
  return crypto.createHmac('sha512', secret).update(payload).digest('hex')
}

describe('Phase 5.1: Settlement, Payout & Ledger Integrity Audit Suite', () => {
  const SECRET_KEY = 'sk_test_mock_secret_key_audit_51'

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.PAYSTACK_SECRET_KEY = SECRET_KEY
  })

  // =========================================================================
  // Scenario 1: Fabricated or unauthenticated settlement evidence
  // =========================================================================
  describe('Scenario 1: Fabricated or Unauthenticated Settlement Evidence', () => {
    it('rejects settlement evidence from unsupported provider', async () => {
      const badProviderEvidence: any = {
        provider: 'untrusted_gateway',
        batchReference: 'BATCH-001',
        currency: 'KES',
        totalAmountMinorUnits: BigInt(100000),
        settledAt: new Date(),
        evidenceSource: 'paystack_settlement_report',
        transactions: [{ reference: 'ref-1', amountMinorUnits: BigInt(100000), currency: 'KES' }],
      }

      await expect(processSettlementBatchEvidence(badProviderEvidence)).rejects.toThrow(
        /Unsupported settlement provider/i
      )
    })

    it('rejects settlement evidence with missing or blank batch reference', async () => {
      const blankBatchEvidence: any = {
        provider: 'paystack',
        batchReference: '   ',
        currency: 'KES',
        totalAmountMinorUnits: BigInt(100000),
        settledAt: new Date(),
        evidenceSource: 'paystack_settlement_report',
        transactions: [{ reference: 'ref-1', amountMinorUnits: BigInt(100000), currency: 'KES' }],
      }

      await expect(processSettlementBatchEvidence(blankBatchEvidence)).rejects.toThrow(
        /batchReference is required/i
      )
    })

    it('rejects evidence with unsupported currency or empty transactions array', async () => {
      const emptyTxEvidence: any = {
        provider: 'paystack',
        batchReference: 'BATCH-EMPTY',
        currency: 'KES',
        totalAmountMinorUnits: BigInt(0),
        settledAt: new Date(),
        evidenceSource: 'paystack_settlement_report',
        transactions: [],
      }

      await expect(processSettlementBatchEvidence(emptyTxEvidence)).rejects.toThrow(
        /contain at least one transaction/i
      )
    })
  })

  // =========================================================================
  // Scenario 2: Settlement batch replay and partial processing
  // =========================================================================
  describe('Scenario 2: Settlement Batch Replay and Partial Processing', () => {
    it('handles idempotent replay of already settled transactions without duplicate credits', async () => {
      const mockPayment = {
        id: 'pay-settled-1',
        amount: 1000,
        status: 'SUCCESS',
        settlementStatus: 'SETTLED', // Already settled in prior run!
        paidEventOrder: { id: 'ord-1', currency: 'KES' },
      }

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          settlementBatch: { upsert: jest.fn().mockResolvedValue({}) },
          payment: {
            findFirst: jest.fn().mockResolvedValue(mockPayment),
            update: jest.fn(),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      const evidence = {
        provider: 'paystack' as const,
        batchReference: 'BATCH-REPLAY-01',
        currency: 'KES',
        totalAmountMinorUnits: BigInt(100000),
        settledAt: new Date(),
        evidenceSource: 'paystack_settlement_report' as const,
        transactions: [{ reference: 'ref-replay-1', amountMinorUnits: BigInt(100000), currency: 'KES' }],
      }

      const result = await processSettlementBatchEvidence(evidence)
      expect(result.success).toBe(true)
      expect(result.settledCount).toBe(0) // No new records marked settled
      expect(result.alreadySettledCount).toBe(1) // Acknowledged as already settled
      expect(result.unmatchedReferences).toHaveLength(0)
    })
  })

  // =========================================================================
  // Scenario 3: Amount, currency, merchant, and provider-reference mismatch
  // =========================================================================
  describe('Scenario 3: Amount, Currency, and Reference Mismatch', () => {
    it('fails closed when transaction sum does not match batch header total', async () => {
      const mismatchedEvidence = {
        provider: 'paystack' as const,
        batchReference: 'BATCH-SUM-MISMATCH',
        currency: 'KES',
        totalAmountMinorUnits: BigInt(500000), // Header claims 5,000 KES
        settledAt: new Date(),
        evidenceSource: 'paystack_settlement_report' as const,
        transactions: [
          { reference: 'ref-1', amountMinorUnits: BigInt(200000), currency: 'KES' }, // Sum is only 2,000 KES!
        ],
      }

      await expect(processSettlementBatchEvidence(mismatchedEvidence)).rejects.toThrow(
        /batch total mismatch/i
      )
    })

    it('rejects batch containing duplicate transaction references within the same batch', async () => {
      const duplicateRefsEvidence = {
        provider: 'paystack' as const,
        batchReference: 'BATCH-DUP-REFS',
        currency: 'KES',
        totalAmountMinorUnits: BigInt(200000),
        settledAt: new Date(),
        evidenceSource: 'paystack_settlement_report' as const,
        transactions: [
          { reference: 'duplicate-ref-1', amountMinorUnits: BigInt(100000), currency: 'KES' },
          { reference: 'duplicate-ref-1', amountMinorUnits: BigInt(100000), currency: 'KES' },
        ],
      }

      await expect(processSettlementBatchEvidence(duplicateRefsEvidence)).rejects.toThrow(
        /Duplicate transaction reference within settlement batch/i
      )
    })

    it('rejects settlement when individual payment amount in database does not match evidence', async () => {
      const mockPayment = {
        id: 'pay-mismatch',
        amount: 1500, // DB has KES 1,500 (150,000 minor)
        status: 'SUCCESS',
        settlementStatus: 'PENDING',
        paidEventOrder: { id: 'ord-mismatch', currency: 'KES' },
      }

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          settlementBatch: { upsert: jest.fn().mockResolvedValue({}) },
          payment: {
            findFirst: jest.fn().mockResolvedValue(mockPayment),
            update: jest.fn(),
          },
          auditLog: { create: jest.fn() },
        }
        return cb(tx)
      })

      const evidence = {
        provider: 'paystack' as const,
        batchReference: 'BATCH-AMT-MISMATCH',
        currency: 'KES',
        totalAmountMinorUnits: BigInt(100000),
        settledAt: new Date(),
        evidenceSource: 'paystack_settlement_report' as const,
        transactions: [{ reference: 'ref-mismatch', amountMinorUnits: BigInt(100000), currency: 'KES' }],
      }

      await expect(processSettlementBatchEvidence(evidence)).rejects.toThrow(
        /Amount mismatch for payment/i
      )
    })
  })

  // =========================================================================
  // Scenario 4: Duplicate withdrawal request and duplicate provider initiation
  // =========================================================================
  describe('Scenario 4: Duplicate Withdrawal Request Idempotency', () => {
    it('returns existing withdrawal and does NOT initiate duplicate transfer when idempotencyKey matches', async () => {
      const existingWithdrawal = {
        id: 'wd-existing-123',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        method: 'MPESA',
        destination: '0712345678',
        status: 'PROCESSING',
        idempotencyKey: 'wd:org-1:client-req-abc',
        providerRef: 'client-req-abc',
      }

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          withdrawal: {
            findUnique: jest.fn().mockResolvedValue(existingWithdrawal),
          },
        }
        return cb(tx)
      })

      const mockDispatcher = jest.fn()

      const res = await requestOrganizerWithdrawal(
        {
          organizerId: 'org-1',
          amount: 500,
          currency: 'KES',
          method: 'MPESA',
          destination: '0712345678',
          destinationPayload: { phone: '0712345678' },
          clientReference: 'client-req-abc',
        },
        mockDispatcher
      )

      expect(res.success).toBe(true)
      expect(res.withdrawalId).toBe('wd-existing-123')
      expect(res.message).toMatch(/duplicate/i)
      // Must NOT call provider dispatcher a second time!
      expect(mockDispatcher).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // Scenario 5: Timeout after provider acceptance / dispatch
  // =========================================================================
  describe('Scenario 5: Timeout and Ambiguous Dispatch Handling', () => {
    it('treats network timeout as UNCERTAIN: holds reservation in PROCESSING and does NOT release funds', async () => {
      let balanceUpdatedToFailed = false

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          $queryRaw: jest.fn().mockResolvedValue([]),
          withdrawal: {
            findUnique: jest.fn().mockResolvedValue(null),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockResolvedValue({
              id: 'wd-timeout-1',
              organiserId: 'org-1',
              amount: 1000,
              currency: 'KES',
              status: 'PROCESSING',
              providerRef: 'wd_timeout_ref',
            }),
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
          financialLedgerEntry: {
            findMany: jest.fn().mockResolvedValue([]),
            upsert: jest.fn().mockResolvedValue({}),
          },
          organiserBalance: { upsert: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      ;(prisma.withdrawal.update as jest.Mock).mockImplementation((args) => {
        if (args.data.status === 'FAILED') balanceUpdatedToFailed = true
      })

      // Dispatcher throws a network timeout error
      const timeoutError = new Error('Network timeout after 15000ms: fetch failed')
      const mockDispatcher = jest.fn().mockRejectedValue(timeoutError)

      const res = await requestOrganizerWithdrawal(
        {
          organizerId: 'org-1',
          amount: 1000,
          currency: 'KES',
          method: 'MPESA',
          destination: '0711111111',
          destinationPayload: { phone: '0711111111' },
          clientReference: 'wd_timeout_ref',
        },
        mockDispatcher
      )

      // Withdrawal must remain in PROCESSING so funds are held securely pending verification
      expect(res.status).toBe('PROCESSING')
      expect(res.success).toBe(false)
      expect(res.message).toMatch(/timeout|safely reserved|do not retry/i)
      // Must NOT have marked the withdrawal FAILED or released the reservation!
      expect(balanceUpdatedToFailed).toBe(false)
    })
  })

  // =========================================================================
  // Scenario 6: Delayed, missing, or out-of-order transfer webhooks
  // =========================================================================
  describe('Scenario 6: Delayed, Missing, or Out-of-Order Webhooks', () => {
    it('blocks transfer.failed from mutating or releasing an already COMPLETED withdrawal', async () => {
      const completedWithdrawal = {
        id: 'wd-comp-6',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'COMPLETED',
      }
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue(completedWithdrawal)

      const result = await failAndReleaseOrganizerWithdrawal({
        withdrawalId: 'wd-comp-6',
        reason: 'Late provider rejection',
      })

      expect(result.success).toBe(false)
      expect(result.message).toMatch(/already COMPLETED/i)
      // Must not call transaction to release funds
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // Scenario 7: Invalid webhook signature
  // =========================================================================
  describe('Scenario 7: Webhook Signature Verification', () => {
    it('rejects webhooks with invalid or missing HMAC SHA-512 signature with HTTP 401', async () => {
      const payload = JSON.stringify({ event: 'transfer.success', id: 12345 })
      const invalidSignature = 'invalid_sha512_hash_abcdef'

      const res = await dispatchPaystackWebhook({
        rawBody: payload,
        signature: invalidSignature,
      })

      expect(res.status).toBe(401)
      expect(res.body.error).toMatch(/Invalid signature/i)
      expect(prisma.processedProviderEvent.create).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // Scenario 8: Unknown or mismatched transfer reference
  // =========================================================================
  describe('Scenario 8: Unknown or Mismatched Transfer Reference', () => {
    it('ignores unknown transfer webhook references without mutating financial records', async () => {
      const payload = JSON.stringify({
        event: 'transfer.success',
        id: 7771,
        data: {
          reference: 'unknown_ref_never_seen',
          transfer_code: 'TRF_UNKNOWN',
          amount: 50000,
          currency: 'KES',
        },
      })
      const signature = computePaystackSignature(payload, SECRET_KEY)

      ;(prisma.processedProviderEvent.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.processedProviderEvent.create as jest.Mock).mockResolvedValue({ id: 'rec-unknown' })
      // Withdrawal not found in database
      ;(prisma.withdrawal.findFirst as jest.Mock).mockResolvedValue(null)

      const res = await dispatchPaystackWebhook({ rawBody: payload, signature })
      expect(res.status).toBe(200)
      // Did not attempt to complete any withdrawal
      expect(prisma.withdrawal.update).not.toHaveBeenCalled()
    })

    it('rejects webhook with HTTP 400 when transfer amount mismatches withdrawal amount', async () => {
      const payload = JSON.stringify({
        event: 'transfer.success',
        id: 7772,
        data: {
          reference: 'trf_mismatch_amt',
          transfer_code: 'TRF_AMT_MISMATCH',
          amount: 10000, // 100 KES in webhook
          currency: 'KES',
        },
      })
      const signature = computePaystackSignature(payload, SECRET_KEY)

      ;(prisma.processedProviderEvent.findUnique as jest.Mock).mockResolvedValue(null)
      ;(prisma.processedProviderEvent.create as jest.Mock).mockResolvedValue({ id: 'rec-mismatch' })
      ;(prisma.withdrawal.findFirst as jest.Mock).mockResolvedValue({
        id: 'wd-mismatch-amt',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000), // 500 KES in database
        currency: 'KES',
        status: 'PROCESSING',
      })

      const res = await dispatchPaystackWebhook({ rawBody: payload, signature })
      expect(res.status).toBe(400)
      expect(res.body.error).toMatch(/amount mismatch/i)
      // Withdrawal record was NOT updated to COMPLETED
      expect(prisma.withdrawal.update).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // Scenario 9: Duplicate transfer.success, transfer.failed, and transfer.reversed
  // =========================================================================
  describe('Scenario 9: Webhook Event Idempotency and Duplicates', () => {
    it('idempotently handles duplicate transfer.success without double completing', async () => {
      const alreadyCompletedWd = {
        id: 'wd-comp-9',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'COMPLETED',
      }
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue(alreadyCompletedWd)

      const res = await completeOrganizerWithdrawal({
        withdrawalId: 'wd-comp-9',
        providerReference: 'trf_dup_comp',
      })

      expect(res.success).toBe(true)
      expect(res.duplicate).toBe(true)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('idempotently handles duplicate transfer.failed without double releasing', async () => {
      const alreadyFailedWd = {
        id: 'wd-failed-9',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'FAILED',
      }
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue(alreadyFailedWd)

      const res = await failAndReleaseOrganizerWithdrawal({
        withdrawalId: 'wd-failed-9',
        reason: 'Duplicate fail event',
      })

      expect(res.success).toBe(true)
      expect(res.duplicate).toBe(true)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // Scenario 10: Reversal after a completed payout
  // =========================================================================
  describe('Scenario 10: Reversal After Completed Payout', () => {
    it('restores organizer entitlement via REVERSAL (CREDIT) entry when payout is reversed', async () => {
      const completedWithdrawal = {
        id: 'wd-rev-10',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'COMPLETED',
        providerRef: 'trf_completed_then_reversed',
      }
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue(completedWithdrawal)

      let reversalEntryPosted = false

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          withdrawal: { update: jest.fn() },
          financialLedgerEntry: {
            upsert: jest.fn().mockImplementation((args) => {
              if (args.create.entryType === 'REVERSAL' && args.create.direction === 'CREDIT') {
                reversalEntryPosted = true
              }
            }),
          },
          organiserBalance: { upsert: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      const res = await reverseOrganizerWithdrawal({
        withdrawalId: 'wd-rev-10',
        reason: 'Destination account frozen or closed',
      })

      expect(res.success).toBe(true)
      expect(res.duplicate).toBe(false)
      expect(reversalEntryPosted).toBe(true)
    })
  })

  // =========================================================================
  // Scenario 11: Refund or charge reversal after organizer funds were calculated
  // =========================================================================
  describe('Scenario 11: Deductions and Quarantined Payment Integrity', () => {
    it('excludes DISPUTED and REVERSED payments from settled balance and deducts refunds', async () => {
      // 1. One SETTLED payment (KES 1,000 gross => 950 entitlement)
      // 2. One DISPUTED payment (KES 1,000 gross => 950 entitlement, must be excluded from settled!)
      ;(prisma.payment.findMany as jest.Mock).mockResolvedValue([
        {
          amount: 1000,
          commissionAmount: 50,
          organizerAmount: 950,
          settlementStatus: 'SETTLED',
          paidEventOrder: { currency: 'KES' },
          event: { currency: 'KES' },
        },
        {
          amount: 1000,
          commissionAmount: 50,
          organizerAmount: 950,
          settlementStatus: 'DISPUTED',
          paidEventOrder: { currency: 'KES' },
          event: { currency: 'KES' },
        },
      ])
      ;(prisma.withdrawal.findMany as jest.Mock).mockResolvedValue([])

      // 3. One explicit REFUND (DEBIT) in ledger for KES 200
      ;(prisma.financialLedgerEntry.findMany as jest.Mock).mockResolvedValue([
        { entryType: 'TICKET_PROCEEDS', direction: 'CREDIT', amountMinorUnits: BigInt(200000) },
        { entryType: 'PLATFORM_COMMISSION', direction: 'DEBIT', amountMinorUnits: BigInt(10000) },
        { entryType: 'REFUND', direction: 'DEBIT', amountMinorUnits: BigInt(20000) }, // KES 200 refunded!
      ])

      const balance = await getAuthoritativeOrganizerBalance('org-1', 'KES')

      // Settled entitlement is ONLY from the SETTLED payment (KES 950)
      expect(balance.settledEntitlementMinorUnits).toBe(BigInt(95000))
      // Disputed payment is quarantined
      expect(balance.disputedOrReversedMinorUnits).toBe(BigInt(95000))
      // Refund deduction of KES 200 is subtracted from available
      expect(balance.otherAdjustmentsMinorUnits).toBe(BigInt(20000))
      // Available = 950 - 200 = KES 750 (75,000 minor units)
      expect(balance.availableMinorUnits).toBe(BigInt(75000))
      expect(balance.formatted.available).toBe(750)
    })
  })

  // =========================================================================
  // Scenario 12: Unauthorized access to another organizer's withdrawal or balance
  // =========================================================================
  describe('Scenario 12: Multi-Tenant Organizer Balance Isolation', () => {
    it('calculates balance strictly scoped to the specified organizerId and ignores other organizers', async () => {
      let queriedOrganizerId: string | undefined

      ;(prisma.payment.findMany as jest.Mock).mockImplementation((args) => {
        queriedOrganizerId = args.where.event.organizerId
        return [
          {
            amount: 500,
            commissionAmount: 25,
            organizerAmount: 475,
            settlementStatus: 'SETTLED',
            paidEventOrder: { currency: 'KES' },
            event: { currency: 'KES' },
          },
        ]
      })
      ;(prisma.withdrawal.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.financialLedgerEntry.findMany as jest.Mock).mockResolvedValue([])

      const balance = await getAuthoritativeOrganizerBalance('org-alice', 'KES')

      expect(queriedOrganizerId).toBe('org-alice')
      expect(balance.organizerId).toBe('org-alice')
      expect(balance.settledEntitlementMinorUnits).toBe(BigInt(47500))
    })
  })

  // =========================================================================
  // Scenario 13: Balance reconciliation between legacy snapshot and ledger
  // =========================================================================
  describe('Scenario 13: Ledger and Balance Snapshot Reconciliation', () => {
    it('correctly sets isBalanced = true when ticket proceeds minus 5% commission match ledger', async () => {
      ;(prisma.payment.findMany as jest.Mock).mockResolvedValue([
        {
          amount: 2000,
          commissionAmount: 100,
          organizerAmount: 1900,
          settlementStatus: 'SETTLED',
          paidEventOrder: { currency: 'KES' },
          event: { currency: 'KES' },
        },
      ])
      ;(prisma.withdrawal.findMany as jest.Mock).mockResolvedValue([])
      ;(prisma.financialLedgerEntry.findMany as jest.Mock).mockResolvedValue([
        { entryType: 'TICKET_PROCEEDS', direction: 'CREDIT', amountMinorUnits: BigInt(200000) },
        { entryType: 'PLATFORM_COMMISSION', direction: 'DEBIT', amountMinorUnits: BigInt(10000) },
      ])

      const balance = await getAuthoritativeOrganizerBalance('org-recon', 'KES')
      expect(balance.reconciliation.isBalanced).toBe(true)
      expect(balance.reconciliation.discrepancyMinorUnits).toBe(BigInt(0))
    })

    it('correctly detects discrepancy when ledger entries are missing or mismatched', async () => {
      ;(prisma.payment.findMany as jest.Mock).mockResolvedValue([
        {
          amount: 2000,
          commissionAmount: 100,
          organizerAmount: 1900,
          settlementStatus: 'SETTLED',
          paidEventOrder: { currency: 'KES' },
          event: { currency: 'KES' },
        },
      ])
      ;(prisma.withdrawal.findMany as jest.Mock).mockResolvedValue([])
      // Ledger has only proceeds, commission entry is missing
      ;(prisma.financialLedgerEntry.findMany as jest.Mock).mockResolvedValue([
        { entryType: 'TICKET_PROCEEDS', direction: 'CREDIT', amountMinorUnits: BigInt(200000) },
      ])

      const balance = await getAuthoritativeOrganizerBalance('org-recon-disc', 'KES')
      expect(balance.reconciliation.isBalanced).toBe(false)
      // Discrepancy is 1,900 - 2,000 = -100 (-10,000 minor)
      expect(balance.reconciliation.discrepancyMinorUnits).toBe(BigInt(-10000))
    })
  })

  // =========================================================================
  // Scenario 14: Preservation of the 5% commission and 95% organizer entitlement
  // =========================================================================
  describe('Scenario 14: Invariant Verification: 5% Commission & 95% Entitlement', () => {
    it('strictly preserves 5% platform commission and 95% organizer entitlement across all calculations', async () => {
      const tickets = [
        { price: 100, expComm: 5, expOrg: 95 },
        { price: 500, expComm: 25, expOrg: 475 },
        { price: 1000, expComm: 50, expOrg: 950 },
        { price: 2500, expComm: 125, expOrg: 2375 },
      ]

      for (const t of tickets) {
        ;(prisma.payment.findMany as jest.Mock).mockResolvedValue([
          {
            amount: t.price,
            commissionAmount: t.expComm,
            organizerAmount: t.expOrg,
            settlementStatus: 'SETTLED',
            paidEventOrder: { currency: 'KES' },
            event: { currency: 'KES' },
          },
        ])
        ;(prisma.withdrawal.findMany as jest.Mock).mockResolvedValue([])
        ;(prisma.financialLedgerEntry.findMany as jest.Mock).mockResolvedValue([])

        const balance = await getAuthoritativeOrganizerBalance('org-commission-test', 'KES')
        expect(balance.totalCommissionMinorUnits).toBe(BigInt(t.expComm * 100))
        expect(balance.totalEntitlementMinorUnits).toBe(BigInt(t.expOrg * 100))
        expect(balance.settledEntitlementMinorUnits).toBe(BigInt(t.expOrg * 100))
      }
    })
  })

  // =========================================================================
  // Scenario 15: Error Classification Helper
  // =========================================================================
  describe('Scenario 15: Error Classification for Uncertain Outcomes', () => {
    it('correctly classifies timeouts and network failures as ambiguous', () => {
      expect(isAmbiguousDispatchError(new Error('Network timeout after 15000ms'))).toBe(true)
      expect(isAmbiguousDispatchError(new Error('fetch failed: ECONNRESET'))).toBe(true)
      expect(isAmbiguousDispatchError(new PaystackApiError('Bad Gateway', 502))).toBe(true)
    })

    it('correctly classifies business validation errors as definitive rejections', () => {
      expect(isAmbiguousDispatchError(new Error('Invalid recipient phone number'))).toBe(false)
      expect(isAmbiguousDispatchError(new PaystackValidationError('Missing account'))).toBe(false)
      expect(isAmbiguousDispatchError(new PaystackApiError('Recipient does not exist', 400))).toBe(false)
      expect(isAmbiguousDispatchError(new PaystackApiError('Unprocessable Entity', 422))).toBe(false)
    })
  })
})
