/** @jest-environment node */

import fs from 'node:fs'
import path from 'node:path'
import { NextRequest } from 'next/server'

const mockGetServerSession = jest.fn()
const mockPurgeUserCache = jest.fn()
const mockEventFindUnique = jest.fn()
const mockEventUpdate = jest.fn()
const mockRegistrationFindMany = jest.fn()
const mockWithdrawalFindMany = jest.fn()
const mockPaidEventOrderFindUnique = jest.fn()
const mockCreditTransactionFindMany = jest.fn()

jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/cache', () => ({
  purgeUserCache: (...args: unknown[]) => mockPurgeUserCache(...args),
  eventListCache: {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
  },
  dashboardStatsCache: {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
  },
}))

jest.mock('@/lib/adminMode', () => ({
  hasOrganiserAccess: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/isAdmin', () => ({
  hasAdminAccess: jest.fn().mockReturnValue(true),
  isAdminEmail: jest.fn().mockReturnValue(true),
}))

jest.mock('@/lib/organizerPayments', () => ({
  getOrganizerPaymentsSidebarSummary: jest.fn().mockResolvedValue({
    visible: true,
    hasWithdrawableBalance: true,
    badgeCount: 1,
  }),
}))

jest.mock('@/lib/eventPasses', () => ({
  getEffectiveEventPlan: jest.fn().mockResolvedValue('free'),
  syncEventPassStatusForEvent: jest.fn().mockResolvedValue(null),
}))

jest.mock('@/lib/googleCalendar', () => ({
  cancelCalendarEvent: jest.fn().mockResolvedValue(undefined),
  updateCalendarEvent: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
      update: (...args: unknown[]) => mockEventUpdate(...args),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(5),
    },
    registration: {
      findMany: (...args: unknown[]) => mockRegistrationFindMany(...args),
      count: jest.fn().mockResolvedValue(10),
    },
    withdrawal: {
      findMany: (...args: unknown[]) => mockWithdrawalFindMany(...args),
    },
    paidEventOrder: {
      findUnique: (...args: unknown[]) => mockPaidEventOrderFindUnique(...args),
    },
    creditTransaction: {
      findMany: (...args: unknown[]) => mockCreditTransactionFindMany(...args),
    },
    tokenPurchase: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { tokens: 100 } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    tokenTransaction: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 50 } }),
    },
    userTokenBalance: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { balance: 50 } }),
    },
    calendarEventSync: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn().mockImplementation((callback) => {
      if (typeof callback === 'function') {
        return callback({
          event: {
            update: (...args: unknown[]) => mockEventUpdate(...args),
          },
          registration: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
        })
      }
      return Promise.resolve([])
    }),
  },
  prisma: {
    event: {
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
      update: (...args: unknown[]) => mockEventUpdate(...args),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      count: jest.fn().mockResolvedValue(5),
    },
    registration: {
      findMany: (...args: unknown[]) => mockRegistrationFindMany(...args),
      count: jest.fn().mockResolvedValue(10),
    },
    withdrawal: {
      findMany: (...args: unknown[]) => mockWithdrawalFindMany(...args),
    },
    paidEventOrder: {
      findUnique: (...args: unknown[]) => mockPaidEventOrderFindUnique(...args),
    },
    creditTransaction: {
      findMany: (...args: unknown[]) => mockCreditTransactionFindMany(...args),
    },
    tokenPurchase: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { tokens: 100 } }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    tokenTransaction: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 50 } }),
    },
    userTokenBalance: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { balance: 50 } }),
    },
    calendarEventSync: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn().mockImplementation((callback) => {
      if (typeof callback === 'function') {
        return callback({
          event: {
            update: (...args: unknown[]) => mockEventUpdate(...args),
          },
          registration: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
          },
        })
      }
      return Promise.resolve([])
    }),
  },
}))

describe('Phase 06A — Controlled Cache-Safety Remediation Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-organizer-1', email: 'organizer@eventsslot.com' },
    })
    mockEventFindUnique.mockResolvedValue({
      id: 'event-1',
      slug: 'sample-summit',
      title: 'Sample Summit',
      organizerId: 'user-organizer-1',
      organizerEmail: 'organizer@eventsslot.com',
      confirmedCount: 5,
      waitlistCount: 2,
      ticketTiers: [],
      whatsappNumber: null,
      groupRegistrationEnabled: false,
      allowGroupSelfClaim: true,
      organizer: { plan: 'pro' },
    })
    mockRegistrationFindMany.mockResolvedValue([])
    mockWithdrawalFindMany.mockResolvedValue([])
    mockCreditTransactionFindMany.mockResolvedValue([])
  })

  describe('1. Static Asset Caching in next.config.mjs', () => {
    it('configures long-lived immutable caching for /_next/static/:path*', () => {
      const configPath = path.resolve(__dirname, '../../next.config.mjs')
      const content = fs.readFileSync(configPath, 'utf8')

      expect(content).toContain('source: "/_next/static/:path*"')
      expect(content).toContain('value: "public, max-age=31536000, immutable"')
      expect(content).not.toContain('value: "no-store, must-revalidate"')
    })
  })

  describe('2. Sensitive API Response Headers (Cache-Control: private, no-store)', () => {
    it('sets private, no-store on GET /api/dashboard/stats', async () => {
      const { dashboardStatsCache } = await import('@/lib/cache')
      ;(dashboardStatsCache.get as jest.Mock).mockReturnValue({ totalEvents: 5, activeEvents: 2 })
      const { GET } = await import('@/app/api/dashboard/stats/route')
      const res = await GET()
      expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    })

    it('sets private, no-store on GET /api/organizer/payments/summary', async () => {
      const { GET } = await import('@/app/api/organizer/payments/summary/route')
      const res = await GET()
      expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    })

    it('sets private, no-store on GET /api/organizer/payments/withdrawals', async () => {
      const { GET } = await import('@/app/api/organizer/payments/withdrawals/route')
      const res = await GET()
      expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    })

    it('sets private, no-store on GET /api/admin/revenue', async () => {
      const { GET } = await import('@/app/api/admin/revenue/route')
      const res = await GET()
      expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    })

    it('sets private, no-store on GET /api/events/[slug]', async () => {
      const { GET } = await import('@/app/api/events/[slug]/route')
      const req = new NextRequest('http://localhost:3000/api/events/sample-summit')
      const res = await GET(req, { params: Promise.resolve({ slug: 'sample-summit' }) })
      expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    })

    it('sets private, no-store on GET /api/paid-events/orders/[orderId]', async () => {
      mockPaidEventOrderFindUnique.mockResolvedValue({
        id: 'order-123',
        status: 'PAID',
        fulfillmentStatus: 'COMPLETED',
        providerReference: 'pay_ref_123',
        holdExpiresAt: new Date(Date.now() + 600000),
        promotionRegistrationId: null,
        attendeeEmail: 'buyer@example.com',
        amountKes: 1500,
        event: { id: 'evt-1', title: 'Sample Summit', slug: 'sample-summit' },
        ticketTier: { id: 'tier-1', name: 'VIP Pass' },
        registrations: [{ id: 'reg-1', confirmationCode: 'EVT-CONF-123' }],
      })

      const { GET } = await import('@/app/api/paid-events/orders/[orderId]/route')
      const req = new NextRequest('http://localhost:3000/api/paid-events/orders/order-123')
      const res = await GET(req, { params: Promise.resolve({ orderId: 'order-123' }) })
      expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    })
  })

  describe('3. Cache Invalidation on Event Mutations (purgeUserCache)', () => {
    it('purges organizer cache upon PATCH event rename', async () => {
      const { PATCH } = await import('@/app/api/events/[slug]/route')
      mockEventUpdate.mockResolvedValue({ id: 'event-1', title: 'Renamed Summit' })

      const req = new NextRequest('http://localhost:3000/api/events/sample-summit', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'rename', title: 'Renamed Summit' }),
      })

      const res = await PATCH(req, { params: Promise.resolve({ slug: 'sample-summit' }) })
      const data = await res.json()

      expect(data.success).toBe(true)
      expect(mockPurgeUserCache).toHaveBeenCalledWith('user-organizer-1', 'organizer@eventsslot.com')
    })

    it('purges organizer cache upon full PATCH event update', async () => {
      const { PATCH } = await import('@/app/api/events/[slug]/route')
      mockEventUpdate.mockResolvedValue({
        id: 'event-1',
        slug: 'sample-summit',
        title: 'Updated Title',
        confirmedCount: 5,
        waitlistCount: 2,
      })

      const req = new NextRequest('http://localhost:3000/api/events/sample-summit', {
        method: 'PATCH',
        body: JSON.stringify({
          title: 'Updated Title',
          description: 'Updated Description',
          visibility: 'PUBLIC',
          questions: [{ id: 'q1', type: 'text', label: 'Full Name' }],
          imageUrl: 'https://example.com/poster.png',
        }),
      })

      const res = await PATCH(req, { params: Promise.resolve({ slug: 'sample-summit' }) })
      const data = await res.json()

      expect(data.success).toBe(true)
      expect(mockPurgeUserCache).toHaveBeenCalledWith('user-organizer-1', 'organizer@eventsslot.com')
    })
  })

  describe('4. Upstash Redis Documentation in .env.example', () => {
    it('documents UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN', () => {
      const envExamplePath = path.resolve(__dirname, '../../.env.example')
      const content = fs.readFileSync(envExamplePath, 'utf8')

      expect(content).toContain('UPSTASH_REDIS_REST_URL=')
      expect(content).toContain('UPSTASH_REDIS_REST_TOKEN=')
    })
  })
})
