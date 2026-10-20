/** @jest-environment node */

import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import {
  verifyPaymentPinDurable,
  checkAndReservePinAttempt,
  checkPinLockout,
  clearPinLockout,
  pruneExpiredPinRateLimitLogs,
  MAX_PIN_FAILURES,
  PIN_LOCKOUT_WINDOW_SECONDS,
  PIN_LOCKOUT_WINDOW_MS,
  SecurityStorageError,
} from '@/lib/paymentPinSecurity'

jest.mock('@/lib/prisma', () => {
  const mockClient: any = {
    rateLimitLog: {
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(async (cb: any): Promise<any> => {
      if (typeof cb === 'function') return cb(mockClient)
      return Promise.all(cb)
    }),
  }
  return {
    __esModule: true,
    default: mockClient,
    prisma: mockClient,
  }
})

describe('Phase 5.6: Adversarial PIN Lockout & Concurrency Closure Suite', () => {
  const userId = 'adversary_target_org_1'
  let correctHash: string

  beforeAll(async () => {
    correctHash = await bcrypt.hash('1234', 8)
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.rateLimitLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' })
    ;(prisma.rateLimitLog.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })
    ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
      if (typeof cb === 'function') return cb(prisma)
      return Promise.all(cb)
    })
  })

  describe('1. Concurrent Burst TOCTOU Defeat', () => {
    it('strictly serializes attempt reservations and prevents concurrent bursts from exceeding 5 attempts', async () => {
      // Simulate stateful in-memory tracking within the mock to simulate real database concurrency
      let inMemoryLogCount = 0
      ;(prisma.rateLimitLog.count as jest.Mock).mockImplementation(async () => inMemoryLogCount)
      ;(prisma.rateLimitLog.create as jest.Mock).mockImplementation(async () => {
        inMemoryLogCount++
        return { id: `log-${inMemoryLogCount}` }
      })

      const bcryptSpy = jest.spyOn(bcrypt, 'compare')

      // Launch 20 concurrent requests simultaneously with incorrect PIN
      const totalRequests = 20
      const requests = Array.from({ length: totalRequests }).map((_, i) =>
        verifyPaymentPinDurable({
          userId,
          pin: `999${i}`, // wrong PIN
          paymentPinHash: correctHash,
        })
      )

      const results = await Promise.all(requests)

      // Count outcomes
      const rejectedAttempts = results.filter((r) => !r.success && (r.status === 403 || r.status === 429))
      const lockedOutResponses = results.filter((r) => !r.success && r.status === 429)

      expect(rejectedAttempts).toHaveLength(totalRequests)
      // At most MAX_PIN_FAILURES attempts were allowed to reach bcrypt
      expect(bcryptSpy).toHaveBeenCalledTimes(MAX_PIN_FAILURES)
      // The remaining 15 requests were immediately short-circuited with 429 without invoking bcrypt
      expect(lockedOutResponses.length).toBeGreaterThanOrEqual(totalRequests - MAX_PIN_FAILURES)
    })

    it('strictly serializes attempt reservations across independent workers bypassing the in-process mutex', async () => {
      let inMemoryLogCount = 0
      let dbLockAcquired = false

      ;(prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        // Simulate database engine row lock queue across independent worker processes
        while (dbLockAcquired) {
          await new Promise((resolve) => setTimeout(resolve, 5))
        }
        dbLockAcquired = true
        try {
          const tx = {
            $queryRaw: jest.fn().mockResolvedValue([]),
            rateLimitLog: {
              count: jest.fn().mockImplementation(async () => inMemoryLogCount),
              findFirst: jest.fn().mockResolvedValue({ createdAt: new Date() }),
              create: jest.fn().mockImplementation(async () => {
                inMemoryLogCount++
                return { id: `log-${inMemoryLogCount}` }
              }),
              deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            },
          }
          return await cb(tx)
        } finally {
          dbLockAcquired = false
        }
      })

      // Launch 20 concurrent requests across independent workers (bypassing in-process mutex)
      const workerRequests = Array.from({ length: 20 }).map(() =>
        checkAndReservePinAttempt(userId, { skipProcessMutex: true })
      )

      const results = await Promise.all(workerRequests)

      const permitted = results.filter((r) => !r.isLocked)
      const rejected = results.filter((r) => r.isLocked)

      // Exactly MAX_PIN_FAILURES attempts reserved
      expect(permitted).toHaveLength(MAX_PIN_FAILURES)
      // Exactly 15 rejected
      expect(rejected).toHaveLength(15)
      // Final count in database store is 5
      expect(inMemoryLogCount).toBe(MAX_PIN_FAILURES)
    })
  })

  describe('2. Sliding Window Expiry & Lockout Semantics', () => {
    it('restores verification access after the 10-minute lockout window elapses', async () => {
      // Failures that occurred 11 minutes ago (outside active sliding window)
      ;(prisma.rateLimitLog.count as jest.Mock).mockResolvedValue(0)

      const status = await checkPinLockout(userId)
      expect(status.isLocked).toBe(false)
      expect(status.remainingAttempts).toBe(MAX_PIN_FAILURES)
    })

    it('calculates accurate retryAfterSeconds countdown from oldest failure in window', async () => {
      const eightMinutesAgo = new Date(Date.now() - 8 * 60 * 1000)
      ;(prisma.rateLimitLog.count as jest.Mock).mockResolvedValue(5)
      ;(prisma.rateLimitLog.findFirst as jest.Mock).mockResolvedValue({
        createdAt: eightMinutesAgo,
      })

      const status = await checkPinLockout(userId)
      expect(status.isLocked).toBe(true)
      expect(status.remainingAttempts).toBe(0)
      // ~2 minutes (120s) remaining
      expect(status.retryAfterSeconds).toBeLessThanOrEqual(125)
      expect(status.retryAfterSeconds).toBeGreaterThanOrEqual(115)
    })
  })

  describe('3. RateLimitLog Growth Protection & Opportunistic Pruning', () => {
    it('prunes expired records for the user during attempt reservation', async () => {
      ;(prisma.rateLimitLog.count as jest.Mock).mockResolvedValue(0)

      await checkAndReservePinAttempt(userId)

      expect(prisma.rateLimitLog.deleteMany).toHaveBeenCalledWith({
        where: {
          key: `pin:${userId}`,
          action: 'PAYMENT_PIN_FAILED',
          createdAt: { lt: expect.any(Date) },
        },
      })
    })

    it('provides global table cleanup via pruneExpiredPinRateLimitLogs', async () => {
      ;(prisma.rateLimitLog.deleteMany as jest.Mock).mockResolvedValue({ count: 42 })

      const pruned = await pruneExpiredPinRateLimitLogs()
      expect(pruned).toBe(42)
      expect(prisma.rateLimitLog.deleteMany).toHaveBeenCalledWith({
        where: {
          action: 'PAYMENT_PIN_FAILED',
          createdAt: { lt: expect.any(Date) },
        },
      })
    })
  })

  describe('4. Fail-Closed Security Storage Robustness', () => {
    it('returns HTTP 503 and blocks verification if storage errors occur during reservation', async () => {
      ;(prisma.rateLimitLog.count as jest.Mock).mockRejectedValue(new Error('Connection Pool Exhausted'))

      const res = await verifyPaymentPinDurable({
        userId,
        pin: '1234',
        paymentPinHash: correctHash,
      })

      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.status).toBe(503)
        expect(res.error).toMatch(/temporarily unavailable/i)
      }
    })
  })

  describe('5. Zero Plaintext PIN Leakage Audit', () => {
    it('never emits plaintext PINs or bcrypt hashes to console logs under error conditions', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
      const secretPin = '7391'

      ;(prisma.rateLimitLog.count as jest.Mock).mockRejectedValue(new Error('DB Timeout'))

      await verifyPaymentPinDurable({
        userId,
        pin: secretPin,
        paymentPinHash: correctHash,
      })

      const loggedMessages = consoleErrorSpy.mock.calls.flat().join(' ')
      expect(loggedMessages).not.toContain(secretPin)
      expect(loggedMessages).not.toContain(correctHash)

      consoleErrorSpy.mockRestore()
    })
  })

  describe('6. Counter Reset Integrity', () => {
    it('only clears lockout upon valid PIN verification and never on incorrect attempts', async () => {
      ;(prisma.rateLimitLog.count as jest.Mock).mockResolvedValue(0)

      // 1. Wrong PIN attempt
      await verifyPaymentPinDurable({
        userId,
        pin: '0000',
        paymentPinHash: correctHash,
      })

      expect(prisma.rateLimitLog.deleteMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            key: `pin:${userId}`,
            action: 'PAYMENT_PIN_FAILED',
          },
        })
      )

      // 2. Correct PIN attempt
      await verifyPaymentPinDurable({
        userId,
        pin: '1234',
        paymentPinHash: correctHash,
      })

      expect(prisma.rateLimitLog.deleteMany).toHaveBeenCalledWith({
        where: {
          key: `pin:${userId}`,
          action: 'PAYMENT_PIN_FAILED',
        },
      })
    })
  })
})
