// Simple in-memory rate limiter — no external dependencies.
// Uses a sliding window counter per key stored in a Map.
// Note: resets on server restart / cold starts. Sufficient for abuse prevention
// at current scale. Replace with a persistent store if stricter limits are needed.

interface Window {
  count: number
  resetAt: number
}

const store = new Map<string, Window>()

function makeRatelimit(maxRequests: number, windowMs: number) {
  return {
    limit: async (key: string) => {
      const now = Date.now()
      const entry = store.get(key)

      if (!entry || now >= entry.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs })
        return { success: true as const, limit: maxRequests, remaining: maxRequests - 1, reset: now + windowMs }
      }

      entry.count++
      const remaining = Math.max(0, maxRequests - entry.count)
      const success = entry.count <= maxRequests
      return { success, limit: maxRequests, remaining, reset: entry.resetAt }
    },
  }
}

// 10 requests per minute
export const ratelimit = makeRatelimit(10, 60_000)

// 5 signup attempts per hour
export const signupRatelimit = makeRatelimit(5, 60 * 60_000)

// 5 attendance lookups per 10 minutes
export const attendanceLookupRatelimit = makeRatelimit(5, 10 * 60_000)
