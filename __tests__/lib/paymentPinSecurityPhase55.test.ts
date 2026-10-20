/** @jest-environment node */

import prisma from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import {
  checkPinLockout,
  recordFailedPinAttempt,
  clearPinLockout,
  verifyPaymentPinDurable,
  MAX_PIN_FAILURES,
  SecurityStorageError,
} from '@/lib/paymentPinSecurity'

jest.mock('@/lib/prisma', () => {
  const mockClient = {
    rateLimitLog: {
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
  }
  return {
    __esModule: true,
    default: mockClient,
    prisma: mockClient,
  }
})

describe('Phase 5.5: Durable Payments PIN Security & Anti-Brute-Force Suite', () => {
  const userId = 'org_sec_user_1'

  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.rateLimitLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' })
  })

  describe('1. checkPinLockout', () => {
    it('returns isLocked: false when no failed attempts exist', async () => {
      ;(prisma.rateLimitLog.count as jest.Mock).mockResolvedValue(0)

      const status = await checkPinLockout(userId)
      expect(status.isLocked).toBe(false)
      expect(status.failedCount).toBe(0)
      expect(status.remainingAttempts).toBe(MAX_PIN_FAILURES)
    })

    it('returns isLocked: true and calculates retryAfterSeconds when failures reach threshold', async () => {
      const nineMinutesAgo = new Date(Date.now() - 9 * 60 * 1000)
      ;(prisma.rateLimitLog.count as jest.Mock).mockResolvedValue(5)
      ;(prisma.rateLimitLog.findFirst as jest.Mock).mockResolvedValue({
        createdAt: nineMinutesAgo,
      })

      const status = await checkPinLockout(userId)
      expect(status.isLocked).toBe(true)
      expect(status.remainingAttempts).toBe(0)
      expect(status.retryAfterSeconds).toBeLessThanOrEqual(60) // Around 1 minute remaining
    })

    it('fails closed and throws SecurityStorageError if storage fails', async () => {
      ;(prisma.rateLimitLog.count as jest.Mock).mockRejectedValue(new Error('DB Connection Refused'))

      await expect(checkPinLockout(userId)).rejects.toThrow(SecurityStorageError)
    })
  })

  describe('2. recordFailedPinAttempt', () => {
    it('records failed attempt in RateLimitLog and returns updated status', async () => {
      ;(prisma.rateLimitLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' })
      ;(prisma.rateLimitLog.count as jest.Mock).mockResolvedValue(3)

      const status = await recordFailedPinAttempt(userId)
      expect(prisma.rateLimitLog.create).toHaveBeenCalledWith({
        data: {
          key: `pin:${userId}`,
          action: 'PAYMENT_PIN_FAILED',
        },
      })
      expect(status.failedCount).toBe(3)
      expect(status.remainingAttempts).toBe(2)
      expect(status.isLocked).toBe(false)
    })

    it('fails closed if storage fails during recording', async () => {
      ;(prisma.rateLimitLog.create as jest.Mock).mockRejectedValueOnce(new Error('Disk Full'))

      await expect(recordFailedPinAttempt(userId)).rejects.toThrow(SecurityStorageError)
    })
  })

  describe('3. clearPinLockout', () => {
    it('deletes failed PIN records for the user', async () => {
      ;(prisma.rateLimitLog.deleteMany as jest.Mock).mockResolvedValue({ count: 4 })

      await clearPinLockout(userId)
      expect(prisma.rateLimitLog.deleteMany).toHaveBeenCalledWith({
        where: {
          key: `pin:${userId}`,
          action: 'PAYMENT_PIN_FAILED',
        },
      })
    })
  })

  describe('4. verifyPaymentPinDurable', () => {
    it('returns error 400 if user does not have paymentPinHash configured', async () => {
      const res = await verifyPaymentPinDurable({
        userId,
        pin: '1234',
        paymentPinHash: null,
      })
      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.status).toBe(400)
      }
    })

    it('returns error 429 if already locked out without invoking bcrypt', async () => {
      ;(prisma.rateLimitLog.count as jest.Mock).mockResolvedValue(5)
      ;(prisma.rateLimitLog.findFirst as jest.Mock).mockResolvedValue({
        createdAt: new Date(),
      })

      const compareSpy = jest.spyOn(bcrypt, 'compare')

      const res = await verifyPaymentPinDurable({
        userId,
        pin: '1234',
        paymentPinHash: '$2a$10$fakehashfortesting1234567890',
      })

      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.status).toBe(429)
      }
      expect(compareSpy).not.toHaveBeenCalled()
    })

    it('verifies valid PIN, clears failure counter, and returns success: true', async () => {
      ;(prisma.rateLimitLog.count as jest.Mock).mockResolvedValue(0)
      const correctPin = '4321'
      const hash = await bcrypt.hash(correctPin, 8)

      const res = await verifyPaymentPinDurable({
        userId,
        pin: correctPin,
        paymentPinHash: hash,
      })

      expect(res.success).toBe(true)
      expect(prisma.rateLimitLog.deleteMany).toHaveBeenCalled()
    })

    it('records failure and returns warning with remaining attempts on incorrect PIN', async () => {
      ;(prisma.rateLimitLog.count as jest.Mock)
        .mockResolvedValueOnce(2) // Initial check
        .mockResolvedValueOnce(3) // After recording

      const hash = await bcrypt.hash('9999', 8)

      const res = await verifyPaymentPinDurable({
        userId,
        pin: '0000', // Incorrect PIN
        paymentPinHash: hash,
      })

      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.status).toBe(403)
        expect(res.remainingAttempts).toBe(2)
        expect(res.error).toMatch(/2 attempts remaining/i)
      }
    })

    it('locks out user with status 429 when attempt reaches 5', async () => {
      ;(prisma.rateLimitLog.count as jest.Mock)
        .mockResolvedValueOnce(4) // Initial check
        .mockResolvedValueOnce(5) // After recording 5th failure

      const hash = await bcrypt.hash('8888', 8)

      const res = await verifyPaymentPinDurable({
        userId,
        pin: '0000',
        paymentPinHash: hash,
      })

      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.status).toBe(429)
        expect(res.error).toMatch(/locked for 10 minutes/i)
      }
    })

    it('fails safely with HTTP 503 if storage is unavailable', async () => {
      ;(prisma.rateLimitLog.count as jest.Mock).mockRejectedValue(new Error('Storage Outage'))

      const res = await verifyPaymentPinDurable({
        userId,
        pin: '1234',
        paymentPinHash: '$2a$10$somehash',
      })

      expect(res.success).toBe(false)
      if (!res.success) {
        expect(res.status).toBe(503)
        expect(res.error).toMatch(/temporarily unavailable/i)
      }
    })
  })
})
