/** @jest-environment node */

import prisma from '@/lib/prisma'
import {
  completeOrganizerWithdrawal,
  failAndReleaseOrganizerWithdrawal,
  reverseOrganizerWithdrawal,
  reconcileOrganizerWithdrawal,
  requestOrganizerWithdrawal,
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
      create: jest.fn().mockResolvedValue({ id: 'audit-55' }),
    },
    user: {
      findUnique: jest.fn(),
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

describe('Phase 5.5: Withdrawal State Machine & Transition Matrix Suite', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.SUPER_ADMIN_EMAIL = 'admin@eventslot.com'
  })

  // =========================================================================
  // 1. Valid Forward State Transitions
  // =========================================================================
  describe('1. Valid State Transitions', () => {
    it('transitions PROCESSING -> COMPLETED with WITHDRAWAL_COMPLETION zero adjustment', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-val-1',
        organiserId: 'org-1',
        amount: 1000,
        amountMinorUnits: BigInt(100000),
        currency: 'KES',
        status: 'PROCESSING',
      })

      let completionPosted = false
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          withdrawal: { update: jest.fn() },
          financialLedgerEntry: {
            upsert: jest.fn().mockImplementation((args) => {
              if (args.create.entryType === 'WITHDRAWAL_COMPLETION') {
                expect(args.create.amountMinorUnits).toBe(BigInt(0)) // Zero adjustment: reservation was already debited!
                completionPosted = true
              }
            }),
          },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      const res = await completeOrganizerWithdrawal({
        withdrawalId: 'wd-val-1',
        providerReference: 'trf_prov_123',
      })

      expect(res.success).toBe(true)
      expect(res.duplicate).toBe(false)
      expect(completionPosted).toBe(true)
    })

    it('transitions PROCESSING -> FAILED and credits back available balance via WITHDRAWAL_RELEASE', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-val-2',
        organiserId: 'org-1',
        amount: 1000,
        amountMinorUnits: BigInt(100000),
        currency: 'KES',
        status: 'PROCESSING',
      })

      let releasePosted = false
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          withdrawal: { update: jest.fn() },
          financialLedgerEntry: {
            upsert: jest.fn().mockImplementation((args) => {
              if (args.create.entryType === 'WITHDRAWAL_RELEASE') {
                expect(args.create.amountMinorUnits).toBe(BigInt(100000))
                expect(args.create.direction).toBe('CREDIT')
                releasePosted = true
              }
            }),
          },
          organiserBalance: { upsert: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      const res = await failAndReleaseOrganizerWithdrawal({
        withdrawalId: 'wd-val-2',
        reason: 'Beneficiary account blocked',
      })

      expect(res.success).toBe(true)
      expect(res.duplicate).toBe(false)
      expect(releasePosted).toBe(true)
    })

    it('transitions COMPLETED -> REVERSED and restores organizer entitlement via REVERSAL credit', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-val-3',
        organiserId: 'org-1',
        amount: 1000,
        amountMinorUnits: BigInt(100000),
        currency: 'KES',
        status: 'COMPLETED',
      })

      let reversalPosted = false
      ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        const tx = {
          withdrawal: { update: jest.fn() },
          financialLedgerEntry: {
            upsert: jest.fn().mockImplementation((args) => {
              if (args.create.entryType === 'REVERSAL') {
                expect(args.create.amountMinorUnits).toBe(BigInt(100000))
                expect(args.create.direction).toBe('CREDIT')
                reversalPosted = true
              }
            }),
          },
          organiserBalance: { upsert: jest.fn().mockResolvedValue({}) },
          auditLog: { create: jest.fn().mockResolvedValue({}) },
        }
        return cb(tx)
      })

      const res = await reverseOrganizerWithdrawal({
        withdrawalId: 'wd-val-3',
        reason: 'Bank reversed funds to merchant',
      })

      expect(res.success).toBe(true)
      expect(res.duplicate).toBe(false)
      expect(reversalPosted).toBe(true)
    })
  })

  // =========================================================================
  // 2. Forbidden State Transitions (Matrix Enforcement)
  // =========================================================================
  describe('2. Forbidden State Transitions', () => {
    it('blocks FAILED -> COMPLETED (prevents paying out a released withdrawal)', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-forbid-1',
        status: 'FAILED',
      })

      const res = await completeOrganizerWithdrawal({ withdrawalId: 'wd-forbid-1' })
      expect(res.success).toBe(false)
      expect(res.message).toMatch(/already FAILED and reservation was released/i)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('blocks COMPLETED -> FAILED (prevents releasing funds already sent)', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-forbid-2',
        status: 'COMPLETED',
      })

      const res = await failAndReleaseOrganizerWithdrawal({
        withdrawalId: 'wd-forbid-2',
        reason: 'Spurious fail event',
      })
      expect(res.success).toBe(false)
      expect(res.message).toMatch(/already COMPLETED/i)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('blocks REVERSED -> FAILED (prevents double releasing reversed funds)', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-forbid-3',
        status: 'REVERSED',
      })

      const res = await failAndReleaseOrganizerWithdrawal({
        withdrawalId: 'wd-forbid-3',
        reason: 'Spurious fail event after reversal',
      })
      expect(res.success).toBe(false)
      expect(res.message).toMatch(/already REVERSED and funds were restored/i)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('blocks FAILED -> REVERSED (prevents double crediting failed withdrawal)', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-forbid-4',
        status: 'FAILED',
      })

      const res = await reverseOrganizerWithdrawal({
        withdrawalId: 'wd-forbid-4',
        reason: 'Spurious reversal after failure',
      })
      expect(res.success).toBe(false)
      expect(res.message).toMatch(/already FAILED and reservation was released/i)
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('blocks CANCELLED -> COMPLETED, FAILED, or REVERSED', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-forbid-5',
        status: 'CANCELLED',
      })

      const compRes = await completeOrganizerWithdrawal({ withdrawalId: 'wd-forbid-5' })
      expect(compRes.success).toBe(false)
      expect(compRes.message).toMatch(/already CANCELLED/i)

      const failRes = await failAndReleaseOrganizerWithdrawal({ withdrawalId: 'wd-forbid-5', reason: 'fail' })
      expect(failRes.success).toBe(false)
      expect(failRes.message).toMatch(/already CANCELLED/i)

      const revRes = await reverseOrganizerWithdrawal({ withdrawalId: 'wd-forbid-5', reason: 'rev' })
      expect(revRes.success).toBe(false)
      expect(revRes.message).toMatch(/already CANCELLED/i)
    })
  })

  // =========================================================================
  // 3. Duplicate and Out-of-Order Events
  // =========================================================================
  describe('3. Duplicate and Out-of-Order Events', () => {
    it('idempotently returns duplicate = true for repeat completions, failures, and reversals', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'w1', status: 'COMPLETED' })
        .mockResolvedValueOnce({ id: 'w2', status: 'FAILED' })
        .mockResolvedValueOnce({ id: 'w3', status: 'REVERSED' })

      const c = await completeOrganizerWithdrawal({ withdrawalId: 'w1' })
      expect(c.success).toBe(true)
      expect(c.duplicate).toBe(true)

      const f = await failAndReleaseOrganizerWithdrawal({ withdrawalId: 'w2', reason: 'already failed' })
      expect(f.success).toBe(true)
      expect(f.duplicate).toBe(true)

      const r = await reverseOrganizerWithdrawal({ withdrawalId: 'w3', reason: 'already reversed' })
      expect(r.success).toBe(true)
      expect(r.duplicate).toBe(true)
    })
  })

  // =========================================================================
  // 4. Inconclusive Timeouts & Non-Releasing Safeguards
  // =========================================================================
  describe('4. Ambiguous Dispatch and Timeout Handling', () => {
    it('keeps withdrawal in PROCESSING status when dispatch encounters timeout or gateway 5xx', () => {
      expect(isAmbiguousDispatchError(new Error('ETIMEDOUT'))).toBe(true)
      expect(isAmbiguousDispatchError(new Error('Gateway timeout 504'))).toBe(true)
      expect(isAmbiguousDispatchError(new PaystackApiError('Internal Server Error', 500))).toBe(true)
      expect(isAmbiguousDispatchError(new PaystackApiError('Bad Gateway', 502))).toBe(true)
    })

    it('identifies definitive provider rejections and does not mark them ambiguous', () => {
      expect(isAmbiguousDispatchError(new PaystackValidationError('Invalid phone'))).toBe(false)
      expect(isAmbiguousDispatchError(new PaystackApiError('Account does not exist', 400))).toBe(false)
      expect(isAmbiguousDispatchError(new PaystackApiError('Insufficient merchant balance', 422))).toBe(false)
    })
  })

  // =========================================================================
  // 5. Server-Side Authorization for Manual Force Release
  // =========================================================================
  describe('5. Manual Reconciliation & Override Authorization', () => {
    it('rejects manual force release when forceReason is missing', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-force-1',
        status: 'PROCESSING',
      })

      await expect(
        reconcileOrganizerWithdrawal({
          withdrawalId: 'wd-force-1',
          forceRelease: true,
          forceReason: '',
          actorId: 'admin-1',
        })
      ).rejects.toThrow(/forceReason is strictly required/i)
    })

    it('rejects manual force release when actorId is a generic system worker', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-force-2',
        status: 'PROCESSING',
      })

      await expect(
        reconcileOrganizerWithdrawal({
          withdrawalId: 'wd-force-2',
          forceRelease: true,
          forceReason: 'System auto cleanup',
          actorId: 'SYSTEM_RECONCILIATION',
        })
      ).rejects.toThrow(/requires a valid, authenticated administrator actorId/i)
    })

    it('rejects manual force release when actor is not an administrator', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-force-3',
        status: 'PROCESSING',
      })

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-regular',
        role: 'USER',
        email: 'regular@user.com',
      })

      await expect(
        reconcileOrganizerWithdrawal({
          withdrawalId: 'wd-force-3',
          forceRelease: true,
          forceReason: 'User tried to self release',
          actorId: 'user-regular',
        })
      ).rejects.toThrow(/lacks administrator privileges/i)
    })

    it('permits manual force release when actor is an authorized administrator', async () => {
      ;(prisma.withdrawal.findUnique as jest.Mock).mockResolvedValue({
        id: 'wd-force-4',
        organiserId: 'org-1',
        amount: 500,
        amountMinorUnits: BigInt(50000),
        currency: 'KES',
        status: 'PROCESSING',
      })

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'admin-super',
        email: 'admin@eventslot.com',
      })

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
        withdrawalId: 'wd-force-4',
        forceRelease: true,
        forceReason: 'Verified terminal failure on provider via offline bank statement',
        actorId: 'admin-super',
      })

      expect(res.reconciled).toBe(true)
      expect(res.status).toBe('FAILED')
      expect(res.message).toMatch(/manually released by authorized operator/i)
    })
  })
})
