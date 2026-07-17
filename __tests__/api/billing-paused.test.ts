/** @jest-environment node */

import { NextRequest } from 'next/server'

const mockGetServerSession = jest.fn()
const mockPaystackFetch = jest.fn()
const mockBillingLimit = jest.fn()

jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/paystack', () => ({
  paystackFetch: (...args: unknown[]) => mockPaystackFetch(...args),
}))

jest.mock('@/lib/ratelimit', () => ({
  billingRatelimit: {
    limit: (...args: unknown[]) => mockBillingLimit(...args),
  },
}))

function postRequest(path: string) {
  return new NextRequest(`https://www.eventsslot.com${path}`, {
    method: 'POST',
    body: JSON.stringify({ bundleId: 'starter', bundleKey: 'starter' }),
    headers: { 'content-type': 'application/json' },
  })
}

describe('billing purchase endpoints while rollout is paused', () => {
  beforeEach(() => {
    jest.resetModules()
    mockGetServerSession.mockReset()
    mockPaystackFetch.mockReset()
    mockBillingLimit.mockReset()
  })

  it('blocks credit purchases before auth, rate limiting, or Paystack checkout', async () => {
    const { POST } = await import('@/app/api/billing/credits/route')
    const response = await POST(postRequest('/api/billing/credits'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toContain('coming soon')
    expect(mockGetServerSession).not.toHaveBeenCalled()
    expect(mockBillingLimit).not.toHaveBeenCalled()
    expect(mockPaystackFetch).not.toHaveBeenCalled()
  })

  it('blocks report-download purchases before auth or Paystack checkout', async () => {
    const { POST } = await import('@/app/api/billing/report-downloads/route')
    const response = await POST(postRequest('/api/billing/report-downloads'))
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toContain('coming soon')
    expect(body.error).toContain('currently free')
    expect(mockGetServerSession).not.toHaveBeenCalled()
    expect(mockPaystackFetch).not.toHaveBeenCalled()
  })
})

export {}
