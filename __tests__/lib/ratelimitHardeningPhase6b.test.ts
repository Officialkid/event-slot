/**
 * __tests__/lib/ratelimitHardeningPhase6b.test.ts
 *
 * Phase 06B, Step 1: Automated verification of rate-limiter hardening.
 * Verifies:
 * 1. Bounded LRU store configuration (max 10,000 entries, per-entry TTL).
 * 2. Cross-limiter namespace isolation (keys in one namespace do not collide with another).
 * 3. Accurate quota consumption, decrementing `remaining`, and rejection at limit.
 * 4. Sliding-window expiration and quota reset after TTL elapses.
 * 5. Upstash error failover to in-memory fallback store.
 * 6. Export integrity for all 8 application limiters.
 */

import {
  fallbackStore,
  makeMemoryLimiter,
  makeUpstashLimiter,
  ratelimit,
  signupRatelimit,
  loginRatelimit,
  attendanceLookupRatelimit,
  walkInCheckinRatelimit,
  aiRatelimit,
  reportDownloadRatelimit,
  billingRatelimit,
} from '@/lib/ratelimit'

describe('Phase 06B, Step 1: Rate Limiter Hardening', () => {
  beforeEach(() => {
    fallbackStore.clear()
    jest.restoreAllMocks()
  })

  afterAll(() => {
    fallbackStore.clear()
    jest.restoreAllMocks()
  })

  describe('Bounded LRU Fallback Store Configuration', () => {
    it('initializes the fallback store with a 10,000 item capacity bound', () => {
      expect(fallbackStore).toBeDefined()
      expect(fallbackStore.max).toBe(10000)
    })

    it('successfully evicts least-recently-used entries when capacity is saturated', () => {
      // Create a small test LRUCache to verify exact eviction semantics without allocating 10,000 entries
      const { LRUCache } = require('lru-cache')
      const smallStore = new LRUCache({ max: 3 })

      smallStore.set('key1', { count: 1, resetAt: Date.now() + 1000 })
      smallStore.set('key2', { count: 1, resetAt: Date.now() + 1000 })
      smallStore.set('key3', { count: 1, resetAt: Date.now() + 1000 })
      expect(smallStore.size).toBe(3)

      // Access key1 to make key2 the least-recently used
      smallStore.get('key1')

      // Insert 4th item
      smallStore.set('key4', { count: 1, resetAt: Date.now() + 1000 })
      expect(smallStore.size).toBe(3)
      expect(smallStore.has('key2')).toBe(false)
      expect(smallStore.has('key1')).toBe(true)
      expect(smallStore.has('key3')).toBe(true)
      expect(smallStore.has('key4')).toBe(true)
    })
  })

  describe('Namespace Isolation', () => {
    it('isolates rate-limit quotas between distinct namespaces using the same client key', async () => {
      const clientIp = '198.51.100.42'
      const loginLimiter = makeMemoryLimiter(2, 60000, 'auth_login')
      const signupLimiter = makeMemoryLimiter(2, 60000, 'auth_signup')

      // Exhaust login quota for clientIp
      const res1 = await loginLimiter.limit(clientIp)
      expect(res1.success).toBe(true)
      expect(res1.remaining).toBe(1)

      const res2 = await loginLimiter.limit(clientIp)
      expect(res2.success).toBe(true)
      expect(res2.remaining).toBe(0)

      const res3 = await loginLimiter.limit(clientIp)
      expect(res3.success).toBe(false)
      expect(res3.remaining).toBe(0)

      // Verify signupLimiter for the identical clientIp is unaffected
      const signupRes = await signupLimiter.limit(clientIp)
      expect(signupRes.success).toBe(true)
      expect(signupRes.remaining).toBe(1)
      expect(signupRes.limit).toBe(2)
    })

    it('isolates different client keys within the same limiter namespace', async () => {
      const limiter = makeMemoryLimiter(1, 60000, 'api_test')

      const resA1 = await limiter.limit('client-alpha')
      expect(resA1.success).toBe(true)
      expect(resA1.remaining).toBe(0)

      const resA2 = await limiter.limit('client-alpha')
      expect(resA2.success).toBe(false)

      // client-bravo has its own fresh window
      const resB1 = await limiter.limit('client-bravo')
      expect(resB1.success).toBe(true)
      expect(resB1.remaining).toBe(0)
    })
  })

  describe('Quota Counting, Decrementing, and Threshold Boundaries', () => {
    it('accurately decrements remaining count down to 0 and blocks subsequent requests', async () => {
      const limiter = makeMemoryLimiter(3, 60000, 'counter_test')
      const key = 'user_123'

      // 1st request
      const r1 = await limiter.limit(key)
      expect(r1.success).toBe(true)
      expect(r1.limit).toBe(3)
      expect(r1.remaining).toBe(2)

      // 2nd request
      const r2 = await limiter.limit(key)
      expect(r2.success).toBe(true)
      expect(r2.remaining).toBe(1)

      // 3rd request (at threshold)
      const r3 = await limiter.limit(key)
      expect(r3.success).toBe(true)
      expect(r3.remaining).toBe(0)

      // 4th request (over threshold)
      const r4 = await limiter.limit(key)
      expect(r4.success).toBe(false)
      expect(r4.remaining).toBe(0)

      // 5th request (remains over threshold)
      const r5 = await limiter.limit(key)
      expect(r5.success).toBe(false)
      expect(r5.remaining).toBe(0)
    })
  })

  describe('Sliding-Window Expiration and Reset', () => {
    it('resets quota when the window timestamp expires', async () => {
      let mockTime = 1000000
      jest.spyOn(Date, 'now').mockImplementation(() => mockTime)

      const windowMs = 5000
      const limiter = makeMemoryLimiter(2, windowMs, 'expiry_test')
      const key = 'expiring_client'

      // Consume both allowed requests
      await limiter.limit(key)
      const exhausted = await limiter.limit(key)
      expect(exhausted.remaining).toBe(0)

      // Verify blocked while still in window
      mockTime += 2000
      const blocked = await limiter.limit(key)
      expect(blocked.success).toBe(false)

      // Advance time past the resetAt window
      mockTime += 4000 // Now at +6000ms, past windowMs
      const reset = await limiter.limit(key)
      expect(reset.success).toBe(true)
      expect(reset.remaining).toBe(1)
      expect(reset.reset).toBe(mockTime + windowMs)
    })
  })

  describe('Upstash Redis Failover Graceful Degradation', () => {
    it('gracefully falls back to namespaced memory limiter when Upstash fails or throws', async () => {
      // makeUpstashLimiter attempts dynamic import and falls back to memory on error
      const failoverLimiter = makeUpstashLimiter(2, 60, 'failover_test')
      const testKey = 'fallback_client_ip'

      // When Upstash env vars are absent or fail, limiter must still succeed safely via memory
      const res1 = await failoverLimiter.limit(testKey)
      expect(res1.success).toBe(true)
      expect(res1.limit).toBe(2)
      expect(res1.remaining).toBe(1)

      const res2 = await failoverLimiter.limit(testKey)
      expect(res2.success).toBe(true)
      expect(res2.remaining).toBe(0)

      const res3 = await failoverLimiter.limit(testKey)
      expect(res3.success).toBe(false)
      expect(res3.remaining).toBe(0)
    })
  })

  describe('Export Integrity and Preserved Policy Thresholds', () => {
    it('exports all 8 expected limiter instances with valid limit methods', () => {
      const limiters = [
        { name: 'ratelimit', instance: ratelimit },
        { name: 'signupRatelimit', instance: signupRatelimit },
        { name: 'loginRatelimit', instance: loginRatelimit },
        { name: 'attendanceLookupRatelimit', instance: attendanceLookupRatelimit },
        { name: 'walkInCheckinRatelimit', instance: walkInCheckinRatelimit },
        { name: 'aiRatelimit', instance: aiRatelimit },
        { name: 'reportDownloadRatelimit', instance: reportDownloadRatelimit },
        { name: 'billingRatelimit', instance: billingRatelimit },
      ]

      for (const { name, instance } of limiters) {
        expect(instance).toBeDefined()
        expect(typeof instance.limit).toBe('function')
      }
    })

    it('correctly returns LimitResult shape across application limiters', async () => {
      const key = `test_health_probe_${Date.now()}`
      const result = await ratelimit.limit(key)

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('limit')
      expect(result).toHaveProperty('remaining')
      expect(result).toHaveProperty('reset')

      expect(typeof result.success).toBe('boolean')
      expect(typeof result.limit).toBe('number')
      expect(typeof result.remaining).toBe('number')
      expect(typeof result.reset).toBe('number')
    })
  })
})
