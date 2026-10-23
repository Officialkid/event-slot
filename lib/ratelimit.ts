/**
 * lib/ratelimit.ts
 *
 * Distributed rate limiting backed by Upstash Redis when env vars are present,
 * with a bounded, namespaced in-memory sliding-window fallback for local development
 * and Redis failover.
 *
 * All exported limiters share the same `.limit(key)` API:
 *   const { success } = await ratelimit.limit(ip)
 *   if (!success) return 429
 */

import { LRUCache } from 'lru-cache'

// ─── Upstash path ─────────────────────────────────────────────────────────────

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN
const useUpstash = !!(upstashUrl && upstashToken)

export type LimitResult = { success: boolean; limit: number; remaining: number; reset: number }
export type Limiter = { limit: (key: string) => Promise<LimitResult> }

// ─── In-memory bounded fallback ───────────────────────────────────────────────

export interface MemWindow {
  count: number
  resetAt: number
}

// Bounded in-memory LRU store to prevent memory leaks during Redis degradation.
// Maximum 10,000 active key-windows; entries automatically expire after their TTL.
export const fallbackStore = new LRUCache<string, MemWindow>({
  max: 10000,
})

export function makeMemoryLimiter(maxRequests: number, windowMs: number, namespace: string): Limiter {
  return {
    limit: async (key: string): Promise<LimitResult> => {
      const namespacedKey = `${namespace}:${key}`
      const now = Date.now()
      const entry = fallbackStore.get(namespacedKey)

      if (!entry || now >= entry.resetAt) {
        const resetAt = now + windowMs
        fallbackStore.set(namespacedKey, { count: 1, resetAt }, { ttl: windowMs })
        return { success: true, limit: maxRequests, remaining: maxRequests - 1, reset: resetAt }
      }

      entry.count++
      const remaining = Math.max(0, maxRequests - entry.count)
      const success = entry.count <= maxRequests
      return { success, limit: maxRequests, remaining, reset: entry.resetAt }
    },
  }
}

export function makeUpstashLimiter(maxRequests: number, windowSeconds: number, namespace: string): Limiter {
  // Dynamic import keeps the build from failing when env vars are absent
  const memoryFallback = makeMemoryLimiter(maxRequests, windowSeconds * 1000, namespace)
  const limiterPromise = import('@upstash/ratelimit').then(({ Ratelimit }) =>
    import('@upstash/redis').then(({ Redis }) => {
      const redis = new Redis({ url: upstashUrl!, token: upstashToken! })
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
        prefix: `eventslot:${namespace}`,
        analytics: false,
      })
    })
  )

  return {
    limit: async (key: string): Promise<LimitResult> => {
      try {
        const rl = await limiterPromise
        const result = await rl.limit(key)
        return {
          success: result.success,
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset,
        }
      } catch {
        // If Redis is unavailable or times out, fall back safely to the namespaced in-memory limiter
        return memoryFallback.limit(key)
      }
    },
  }
}

export function makeLimiter(maxRequests: number, windowSeconds: number, namespace: string): Limiter {
  return useUpstash
    ? makeUpstashLimiter(maxRequests, windowSeconds, namespace)
    : makeMemoryLimiter(maxRequests, windowSeconds * 1000, namespace)
}

// ─── Exported limiters with explicit namespacing ──────────────────────────────

/** General API: 20 req / min per IP */
export const ratelimit = makeLimiter(20, 60, 'general')

/** Signup: 5 attempts / hr per IP */
export const signupRatelimit = makeLimiter(5, 3600, 'signup')

/** Login: 5 attempts / min per IP */
export const loginRatelimit = makeLimiter(5, 60, 'login')

/** Attendance lookup: 5 req / 10 min per IP */
export const attendanceLookupRatelimit = makeLimiter(5, 600, 'attendance')

/** Walk-in check-in: 5 req / min per IP */
export const walkInCheckinRatelimit = makeLimiter(5, 60, 'walkin')

/** AI endpoints (ask, insights, predict-capacity): 10 req / min per user/IP */
export const aiRatelimit = makeLimiter(10, 60, 'ai')

/** Report download: 5 req / min per user */
export const reportDownloadRatelimit = makeLimiter(5, 60, 'reports')

/** Billing / payment initiation: 10 req / min per user */
export const billingRatelimit = makeLimiter(10, 60, 'billing')
