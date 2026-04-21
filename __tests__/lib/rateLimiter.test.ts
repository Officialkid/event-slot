import { loginRateLimiter } from '@/lib/rateLimiter'

describe('loginRateLimiter', () => {
  it('allows requests under the limit', async () => {
    const consume = () => loginRateLimiter.consume(`test-ip-unique-${Date.now()}`)
    await expect(consume()).resolves.toBeDefined()
  })
})
