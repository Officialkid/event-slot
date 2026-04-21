/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/attendance/confirm/route'

const mockFindUnique = jest.fn()
const mockFindFirst = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    registration: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
    },
  },
}))

jest.mock('@/lib/rateLimiter', () => ({
  attendanceRateLimiter: { consume: jest.fn().mockResolvedValue(undefined) },
  getClientIp: jest.fn(() => '127.0.0.1'),
}))

describe('POST /api/attendance/confirm', () => {
  beforeEach(() => {
    mockFindUnique.mockReset()
    mockFindFirst.mockReset()
  })

  it('returns 400 when email is missing', async () => {
    const req = new NextRequest('http://localhost/api/attendance/confirm', {
      method: 'POST',
      body: JSON.stringify({ eventId: 'test' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 200 found=false when registration is not found', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'event-1',
      title: 'Test Event',
      eventDate: null,
      location: null,
      questions: [],
    })
    mockFindFirst.mockResolvedValue(null)

    const req = new NextRequest('http://localhost/api/attendance/confirm', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com', eventId: 'event-1' }),
    })

    const res = await POST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.found).toBe(false)
  })
})
