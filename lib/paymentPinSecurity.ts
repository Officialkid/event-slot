/**
 * Durable Payments PIN Security & Anti-Brute-Force Lockout Service
 *
 * Implements durable, distributed, atomic PIN verification and lockout protections:
 * 1. Survives application restarts, worker restarts, and serverless lifecycle resets.
 * 2. Shared across multiple concurrent Next.js / container instances.
 * 3. Atomic attempt counting using indexed RateLimitLog and optional Upstash Redis.
 * 4. Strictly fails closed if security-control storage encounters unexpected outages.
 * 5. Never logs or persists plaintext PINs.
 */

import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'

export const MAX_PIN_FAILURES = 5
export const PIN_LOCKOUT_WINDOW_SECONDS = 600 // 10 minutes
export const PIN_LOCKOUT_WINDOW_MS = PIN_LOCKOUT_WINDOW_SECONDS * 1000

export class SecurityStorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecurityStorageError'
  }
}

export type PinLockoutStatus = {
  isLocked: boolean
  failedCount: number
  remainingAttempts: number
  retryAfterSeconds?: number
}

// Optional Upstash Redis client resolution (shared with ratelimit.ts)
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN
const hasUpstash = Boolean(upstashUrl && upstashToken)

let redisClientPromise: Promise<any> | null = null
function getRedisClient() {
  if (!hasUpstash) return null
  if (!redisClientPromise) {
    redisClientPromise = import('@upstash/redis')
      .then(({ Redis }) => new Redis({ url: upstashUrl!, token: upstashToken! }))
      .catch(() => null)
  }
  return redisClientPromise
}

// Helper for non-fatal opportunistic pruning
async function safePruneExpired(cleanId: string, cutoff: Date): Promise<void> {
  try {
    if (typeof prisma?.rateLimitLog?.deleteMany === 'function') {
      await prisma.rateLimitLog.deleteMany({
        where: {
          key: `pin:${cleanId}`,
          action: 'PAYMENT_PIN_FAILED',
          createdAt: { lt: cutoff },
        },
      })
    }
  } catch {
    // Best-effort pruning
  }
}

/**
 * Checks whether an organizer is currently locked out from PIN verification.
 * Fails closed if persistent storage is unavailable.
 */
export async function checkPinLockout(userId: string): Promise<PinLockoutStatus> {
  const cleanId = userId.trim()
  const cutoff = new Date(Date.now() - PIN_LOCKOUT_WINDOW_MS)

  try {
    // 1. Check Redis if configured
    const redisPromise = getRedisClient()
    if (redisPromise) {
      const redis = await redisPromise
      if (redis) {
        const val = await redis.get(`pin_fail:${cleanId}`).catch(() => null)
        const redisCount = typeof val === 'number' ? val : parseInt(val || '0', 10)
        if (redisCount >= MAX_PIN_FAILURES) {
          const ttl = await redis.ttl(`pin_fail:${cleanId}`).catch(() => PIN_LOCKOUT_WINDOW_SECONDS)
          return {
            isLocked: true,
            failedCount: redisCount,
            remainingAttempts: 0,
            retryAfterSeconds: ttl > 0 ? ttl : PIN_LOCKOUT_WINDOW_SECONDS,
          }
        }
      }
    }

    // 2. Authoritative check in durable database RateLimitLog
    await safePruneExpired(cleanId, cutoff)

    const count = await prisma.rateLimitLog.count({
      where: {
        key: `pin:${cleanId}`,
        action: 'PAYMENT_PIN_FAILED',
        createdAt: { gte: cutoff },
      },
    })

    if (count >= MAX_PIN_FAILURES) {
      // Find oldest failure in current window to calculate accurate retryAfterSeconds
      const oldestInWindow = await prisma.rateLimitLog.findFirst({
        where: {
          key: `pin:${cleanId}`,
          action: 'PAYMENT_PIN_FAILED',
          createdAt: { gte: cutoff },
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      })

      const elapsedMs = oldestInWindow ? Date.now() - oldestInWindow.createdAt.getTime() : 0
      const remainingMs = Math.max(0, PIN_LOCKOUT_WINDOW_MS - elapsedMs)
      const retryAfterSeconds = Math.ceil(remainingMs / 1000) || PIN_LOCKOUT_WINDOW_SECONDS

      return {
        isLocked: true,
        failedCount: count,
        remainingAttempts: 0,
        retryAfterSeconds,
      }
    }

    return {
      isLocked: false,
      failedCount: count,
      remainingAttempts: Math.max(0, MAX_PIN_FAILURES - count),
    }
  } catch (err: any) {
    console.error(`[PaymentPinSecurity] Storage failure checking lockout for ${cleanId}:`, err?.message || err)
    throw new SecurityStorageError('Security verification store is temporarily unavailable.')
  }
}

/**
 * Atomically records an invalid PIN attempt in durable storage.
 * Fails closed if storage is unavailable.
 */
export async function recordFailedPinAttempt(userId: string): Promise<PinLockoutStatus> {
  const cleanId = userId.trim()
  const cutoff = new Date(Date.now() - PIN_LOCKOUT_WINDOW_MS)

  try {
    // 0. Opportunistically prune expired records for this user
    await safePruneExpired(cleanId, cutoff)

    // 1. Record in database RateLimitLog
    await prisma.rateLimitLog.create({
      data: {
        key: `pin:${cleanId}`,
        action: 'PAYMENT_PIN_FAILED',
      },
    })

    // 2. Increment in Redis if configured
    const redisPromise = getRedisClient()
    if (redisPromise) {
      const redis = await redisPromise
      if (redis) {
        const count = await redis.incr(`pin_fail:${cleanId}`).catch(() => null)
        if (count === 1) {
          await redis.expire(`pin_fail:${cleanId}`, PIN_LOCKOUT_WINDOW_SECONDS).catch(() => null)
        }
      }
    }

    // 3. Re-calculate count
    const totalInWindow = await prisma.rateLimitLog.count({
      where: {
        key: `pin:${cleanId}`,
        action: 'PAYMENT_PIN_FAILED',
        createdAt: { gte: cutoff },
      },
    })

    const isLocked = totalInWindow >= MAX_PIN_FAILURES
    const remainingAttempts = Math.max(0, MAX_PIN_FAILURES - totalInWindow)

    return {
      isLocked,
      failedCount: totalInWindow,
      remainingAttempts,
      retryAfterSeconds: isLocked ? PIN_LOCKOUT_WINDOW_SECONDS : undefined,
    }
  } catch (err: any) {
    console.error(`[PaymentPinSecurity] Storage failure recording failed attempt for ${cleanId}:`, err?.message || err)
    throw new SecurityStorageError('Security verification store is temporarily unavailable.')
  }
}

/**
 * Clears failed PIN records for an organizer upon successful authentication.
 */
export async function clearPinLockout(userId: string): Promise<void> {
  const cleanId = userId.trim()

  try {
    await prisma.rateLimitLog.deleteMany({
      where: {
        key: `pin:${cleanId}`,
        action: 'PAYMENT_PIN_FAILED',
      },
    }).catch(() => {})

    const redisPromise = getRedisClient()
    if (redisPromise) {
      const redis = await redisPromise
      if (redis) {
        await redis.del(`pin_fail:${cleanId}`).catch(() => {})
      }
    }
  } catch (err: any) {
    // Non-fatal: clearing is best-effort upon success
    console.warn(`[PaymentPinSecurity] Warning: could not clear PIN failure logs for ${cleanId}:`, err?.message || err)
  }
}

// In-process per-user async mutex to strictly serialize concurrent reservations for the same organizer
const userMutexMap = new Map<string, Promise<void>>()

async function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const currentLock = userMutexMap.get(userId) || Promise.resolve()
  let resolveNextLock: () => void

  const nextLock = new Promise<void>((resolve) => {
    resolveNextLock = resolve
  })

  userMutexMap.set(userId, nextLock)

  try {
    await currentLock
    return await fn()
  } finally {
    resolveNextLock!()
    if (userMutexMap.get(userId) === nextLock) {
      userMutexMap.delete(userId)
    }
  }
}

/**
 * Atomically checks whether an organizer is locked out and, if not, reserves an attempt slot.
 * Serializes attempt consumption to ensure concurrent requests CANNOT exceed MAX_PIN_FAILURES.
 * Also opportunistically prunes expired records for this organizer to prevent unbounded table growth.
 */
export async function checkAndReservePinAttempt(userId: string): Promise<PinLockoutStatus> {
  const cleanId = userId.trim()
  return withUserLock(cleanId, async () => {
    const cutoff = new Date(Date.now() - PIN_LOCKOUT_WINDOW_MS)

    try {
      // 1. Check Redis if configured
      const redisPromise = getRedisClient()
      if (redisPromise) {
        const redis = await redisPromise
        if (redis) {
          const val = await redis.get(`pin_fail:${cleanId}`).catch(() => null)
          const redisCount = typeof val === 'number' ? val : parseInt(val || '0', 10)
          if (redisCount >= MAX_PIN_FAILURES) {
            const ttl = await redis.ttl(`pin_fail:${cleanId}`).catch(() => PIN_LOCKOUT_WINDOW_SECONDS)
            return {
              isLocked: true,
              failedCount: redisCount,
              remainingAttempts: 0,
              retryAfterSeconds: ttl > 0 ? ttl : PIN_LOCKOUT_WINDOW_SECONDS,
            }
          }
        }
      }

      // 2. Opportunistic pruning of expired records for this user
      await safePruneExpired(cleanId, cutoff)

      // 3. Count existing failures in window
      const currentCount = await prisma.rateLimitLog.count({
        where: {
          key: `pin:${cleanId}`,
          action: 'PAYMENT_PIN_FAILED',
          createdAt: { gte: cutoff },
        },
      })

      if (currentCount >= MAX_PIN_FAILURES) {
        const oldestInWindow = await prisma.rateLimitLog.findFirst({
          where: {
            key: `pin:${cleanId}`,
            action: 'PAYMENT_PIN_FAILED',
            createdAt: { gte: cutoff },
          },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        })
        const elapsedMs = oldestInWindow ? Date.now() - oldestInWindow.createdAt.getTime() : 0
        const remainingMs = Math.max(0, PIN_LOCKOUT_WINDOW_MS - elapsedMs)
        const retryAfterSeconds = Math.ceil(remainingMs / 1000) || PIN_LOCKOUT_WINDOW_SECONDS

        return {
          isLocked: true,
          failedCount: currentCount,
          remainingAttempts: 0,
          retryAfterSeconds,
        }
      }

      // 4. Atomically record this attempt reservation
      await prisma.rateLimitLog.create({
        data: {
          key: `pin:${cleanId}`,
          action: 'PAYMENT_PIN_FAILED',
        },
      })

      // Also update Redis if configured
      if (redisPromise) {
        const redis = await redisPromise
        if (redis) {
          const c = await redis.incr(`pin_fail:${cleanId}`).catch(() => null)
          if (c === 1) {
            await redis.expire(`pin_fail:${cleanId}`, PIN_LOCKOUT_WINDOW_SECONDS).catch(() => null)
          }
        }
      }

      const newCount = currentCount + 1
      return {
        isLocked: false,
        failedCount: newCount,
        remainingAttempts: Math.max(0, MAX_PIN_FAILURES - newCount),
        retryAfterSeconds: newCount >= MAX_PIN_FAILURES ? PIN_LOCKOUT_WINDOW_SECONDS : undefined,
      }
    } catch (err: any) {
      console.error(`[PaymentPinSecurity] Storage failure reserving attempt for ${cleanId}:`, err?.message || err)
      throw new SecurityStorageError('Security verification store is temporarily unavailable.')
    }
  })
}

/**
 * Periodically prunes expired PIN failure logs across all users to prevent unbounded table growth.
 */
export async function pruneExpiredPinRateLimitLogs(olderThanMs: number = PIN_LOCKOUT_WINDOW_MS): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs)
  const result = await prisma.rateLimitLog.deleteMany({
    where: {
      action: 'PAYMENT_PIN_FAILED',
      createdAt: { lt: cutoff },
    },
  }).catch((err) => {
    console.warn('[PaymentPinSecurity] Error pruning expired PIN rate limit logs:', err?.message || err)
    return { count: 0 }
  })
  return result.count
}

export type VerifyPinResult =
  | { success: true }
  | { success: false; status: 400 | 403 | 429 | 503; error: string; remainingAttempts?: number }

/**
 * Durably verifies an organizer's payments PIN against their hash with anti-brute-force lockout.
 * Uses atomic attempt reservation so concurrent requests CANNOT exceed MAX_PIN_FAILURES.
 */
export async function verifyPaymentPinDurable(params: {
  userId: string
  pin: string
  paymentPinHash: string | null | undefined
}): Promise<VerifyPinResult> {
  const { userId, pin, paymentPinHash } = params

  if (!paymentPinHash) {
    return {
      success: false,
      status: 400,
      error: 'Set your payments PIN before requesting withdrawals.',
    }
  }

  // 1. Atomically check lockout and reserve an attempt slot
  // Prevents concurrent requests from exceeding MAX_PIN_FAILURES before lockout takes effect.
  let status: PinLockoutStatus
  try {
    status = await checkAndReservePinAttempt(userId)
  } catch (err) {
    if (err instanceof SecurityStorageError) {
      return {
        success: false,
        status: 503,
        error: 'Security verification temporarily unavailable. Please try again shortly.',
      }
    }
    throw err
  }

  if (status.isLocked) {
    const mins = Math.ceil((status.retryAfterSeconds ?? PIN_LOCKOUT_WINDOW_SECONDS) / 60)
    return {
      success: false,
      status: 429,
      error: `Too many failed PIN attempts. Withdrawals temporarily locked for ${mins} minute${mins === 1 ? '' : 's'}.`,
    }
  }

  // 2. Perform Timing-Safe Bcrypt Verification
  const valid = await bcrypt.compare(pin, paymentPinHash)

  if (!valid) {
    // Attempt failed. The attempt was already atomically recorded in status.failedCount.
    if (status.failedCount >= MAX_PIN_FAILURES) {
      return {
        success: false,
        status: 429,
        error: 'The payments PIN you entered is incorrect. Account withdrawal locked for 10 minutes.',
        remainingAttempts: 0,
      }
    }
    return {
      success: false,
      status: 403,
      error: `The payments PIN you entered is incorrect. (${status.remainingAttempts} attempt${status.remainingAttempts === 1 ? '' : 's'} remaining before lockout)`,
      remainingAttempts: status.remainingAttempts,
    }
  }

  // 3. Success: Clear failure counters and stored attempt records
  await clearPinLockout(userId)
  return { success: true }
}
