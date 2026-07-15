/**
 * lib/ratelimit.ts
 *
 * Distributed rate limiting backed by Upstash Redis when env vars are present,
 * with an in-memory sliding-window fallback for local development.
 *
 * All exported limiters share the same `.limit(key)` API:
 *   const { success } = await ratelimit.limit(ip)
 *   if (!success) return 429
 */

// ─── Upstash path ─────────────────────────────────────────────────────────────

const upstashUrl = process.env.UPSTASH_REDIS_REST_URL
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN
const useUpstash = !!(upstashUrl && upstashToken)

type LimitResult = { success: boolean; limit: number; remaining: number; reset: number }
type Limiter = { limit: (key: string) => Promise<LimitResult> }

function makeUpstashLimiter(maxRequests: number, windowSeconds: number): Limiter {
  // Dynamic import keeps the build from failing when env vars are absent
  const memoryFallback = makeMemoryLimiter(maxRequests, windowSeconds * 1000)
  const limiterPromise = import('@upstash/ratelimit').then(({ Ratelimit }) =>
    import('@upstash/redis').then(({ Redis }) => {
      const redis = new Redis({ url: upstashUrl!, token: upstashToken! })
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(maxRequests, `${windowSeconds} s`),
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
        // If Redis is unavailable, fall back to an in-memory limiter instead of
        // allowing unlimited traffic through sensitive endpoints.
        return memoryFallback.limit(key)
      }
    },
  }
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

interface MemWindow { count: number; resetAt: number }
const memStore = new Map<string, MemWindow>()

function makeMemoryLimiter(maxRequests: number, windowMs: number): Limiter {
  return {
    limit: async (key: string): Promise<LimitResult> => {
      const now = Date.now()
      const entry = memStore.get(key)

      if (!entry || now >= entry.resetAt) {
        memStore.set(key, { count: 1, resetAt: now + windowMs })
        return { success: true, limit: maxRequests, remaining: maxRequests - 1, reset: now + windowMs }
      }

      entry.count++
      const remaining = Math.max(0, maxRequests - entry.count)
      return { success: entry.count <= maxRequests, limit: maxRequests, remaining, reset: entry.resetAt }
    },
  }
}

function makeLimiter(maxRequests: number, windowSeconds: number): Limiter {
  return useUpstash
    ? makeUpstashLimiter(maxRequests, windowSeconds)
    : makeMemoryLimiter(maxRequests, windowSeconds * 1000)
}

// ─── Exported limiters ────────────────────────────────────────────────────────

/** General API: 20 req / min per IP */
export const ratelimit = makeLimiter(20, 60)

/** Signup: 5 attempts / hr per IP */
export const signupRatelimit = makeLimiter(5, 3600)

/** Login: 5 attempts / min per IP */
export const loginRatelimit = makeLimiter(5, 60)

/** Attendance lookup: 5 req / 10 min per IP */
export const attendanceLookupRatelimit = makeLimiter(5, 600)

/** Walk-in check-in: 5 req / min per IP */
export const walkInCheckinRatelimit = makeLimiter(5, 60)

/** AI endpoints (ask, insights, predict-capacity): 10 req / min per user/IP */
export const aiRatelimit = makeLimiter(10, 60)

/** Report download: 5 req / min per user */
export const reportDownloadRatelimit = makeLimiter(5, 60)

/** Billing / payment initiation: 10 req / min per user */
export const billingRatelimit = makeLimiter(10, 60)

