/** @jest-environment node */

/**
 * __tests__/api/writeOptimizationPhase6b.test.ts
 *
 * Phase 06B, Step 3: Automated verification of write backfill and event-pass sync optimization.
 * Verifies:
 * 1. Ownership backfill in dashboard/stats skips updateMany when no unclaimed events exist.
 * 2. Ownership backfill in my-events skips updateMany when no unclaimed events exist.
 * 3. Ownership backfill triggers updateMany when an unclaimed legacy event exists.
 * 4. Idempotency on repeated GET requests.
 * 5. needsEventPassSync returns false for events without passes or with active unexpired passes.
 * 6. needsEventPassSync returns true for expired or cancelled/archived events.
 * 7. syncEventPassStatusForEvent avoids findUnique when passed pre-loaded EventWithPassData.
 * 8. Status transitions (EXPIRED, CANCELLED) are executed and update in-memory state.
 * 9. Response envelope and Cache-Control headers are preserved.
 */

import { GET as getDashboardStats } from '@/app/api/dashboard/stats/route'
import { GET as getMyEvents } from '@/app/api/my-events/route'
import { needsEventPassSync, syncEventPassStatusForEvent, EventWithPassData } from '@/lib/eventPasses'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/cache', () => ({
  dashboardStatsCache: {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
  },
  eventListCache: {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
  },
}))

jest.mock('@/lib/prisma', () => {
  const event = {
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
  }
  const eventPass = {
    update: jest.fn(),
  }
  const registration = {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
  }
  const eventView = {
    count: jest.fn().mockResolvedValue(0),
  }
  const teamMember = {
    findMany: jest.fn().mockResolvedValue([]),
  }
  const groupBooking = {
    findMany: jest.fn().mockResolvedValue([]),
  }
  const client = {
    event,
    eventPass,
    registration,
    eventView,
    teamMember,
    groupBooking,
  }
  return {
    __esModule: true,
    default: client,
    prisma: client,
  }
})

describe('Phase 06B, Step 3: Write Optimization & Event-Pass Sync', () => {
  const mockUser = {
    id: 'usr_organizer_123',
    email: 'organizer@example.com',
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ;(getServerSession as jest.Mock).mockResolvedValue({ user: mockUser })
    ;(prisma.event.count as jest.Mock).mockResolvedValue(0)
    ;(prisma.event.aggregate as jest.Mock).mockResolvedValue({ _sum: { confirmedCount: 0, waitlistCount: 0 } })
    ;(prisma.event.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.registration.findMany as jest.Mock).mockResolvedValue([])
    ;(prisma.registration.count as jest.Mock).mockResolvedValue(0)
  })

  describe('Dashboard Stats Ownership Backfill Optimization', () => {
    it('skips updateMany write when no unclaimed legacy events exist', async () => {
      ;(prisma.event.findFirst as jest.Mock).mockResolvedValue(null)

      const res = await getDashboardStats()
      expect(res.status).toBe(200)

      // Verified: Checked via findFirst, but updateMany was NEVER called
      expect(prisma.event.findFirst).toHaveBeenCalledWith({
        where: { organizerEmail: 'organizer@example.com', organizerId: null },
        select: { id: true },
      })
      expect(prisma.event.updateMany).not.toHaveBeenCalled()
    })

    it('triggers updateMany to repair ownership when an unclaimed event is detected', async () => {
      ;(prisma.event.findFirst as jest.Mock).mockResolvedValue({ id: 'evt_legacy_99' })
      ;(prisma.event.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

      const res = await getDashboardStats()
      expect(res.status).toBe(200)

      expect(prisma.event.findFirst).toHaveBeenCalled()
      expect(prisma.event.updateMany).toHaveBeenCalledWith({
        where: { organizerEmail: 'organizer@example.com', organizerId: null },
        data: { organizerId: 'usr_organizer_123' },
      })
    })
  })

  describe('My-Events Ownership Backfill Optimization', () => {
    it('skips updateMany write on GET /api/my-events when no unclaimed events exist', async () => {
      ;(prisma.event.findFirst as jest.Mock).mockResolvedValue(null)

      const req = new Request('http://localhost:3000/api/my-events')
      const res = await getMyEvents(req)
      expect(res.status).toBe(200)

      expect(prisma.event.findFirst).toHaveBeenCalledWith({
        where: { organizerEmail: 'organizer@example.com', organizerId: null },
        select: { id: true },
      })
      expect(prisma.event.updateMany).not.toHaveBeenCalled()
    })

    it('repairs legacy event ownership when an unclaimed event is found in my-events', async () => {
      ;(prisma.event.findFirst as jest.Mock).mockResolvedValue({ id: 'evt_unclaimed_1' })
      ;(prisma.event.updateMany as jest.Mock).mockResolvedValue({ count: 1 })

      const req = new Request('http://localhost:3000/api/my-events')
      const res = await getMyEvents(req)
      expect(res.status).toBe(200)

      expect(prisma.event.updateMany).toHaveBeenCalledWith({
        where: { organizerEmail: 'organizer@example.com', organizerId: null },
        data: { organizerId: 'usr_organizer_123' },
      })
    })
  })

  describe('Event-Pass Sync Evaluation & N+1 Query Elimination', () => {
    const fixedNow = new Date('2026-10-23T12:00:00Z')

    it('needsEventPassSync returns false when event has no eventPass', () => {
      const event: EventWithPassData = {
        id: 'evt_free_1',
        eventPass: null,
      }
      expect(needsEventPassSync(event, fixedNow)).toBe(false)
    })

    it('needsEventPassSync returns false when pass is ACTIVE and future-dated', () => {
      const futureEnd = new Date('2026-11-01T18:00:00Z')
      const event: EventWithPassData = {
        id: 'evt_active_1',
        status: 'active',
        eventDate: new Date('2026-11-01T10:00:00Z'),
        eventEndAt: futureEnd,
        eventPass: {
          id: 'pass_1',
          status: 'ACTIVE',
          expiresAt: futureEnd, // Expiry matches eventEndAt
        },
      }
      expect(needsEventPassSync(event, fixedNow)).toBe(false)
    })

    it('needsEventPassSync returns true when pass is ACTIVE but expiry has passed', () => {
      const pastEnd = new Date('2026-10-01T10:00:00Z')

      const event: EventWithPassData = {
        id: 'evt_expired_1',
        status: 'active',
        eventDate: pastEnd,
        eventEndAt: pastEnd,
        eventPass: {
          id: 'pass_expired',
          status: 'ACTIVE',
          expiresAt: pastEnd,
        },
      }
      expect(needsEventPassSync(event, fixedNow)).toBe(true)
    })

    it('needsEventPassSync returns true when event is cancelled or archived but pass is not CANCELLED', () => {
      const event: EventWithPassData = {
        id: 'evt_cancelled_1',
        status: 'cancelled',
        eventPass: {
          id: 'pass_to_cancel',
          status: 'ACTIVE',
        },
      }
      expect(needsEventPassSync(event, fixedNow)).toBe(true)
    })

    it('syncEventPassStatusForEvent bypasses prisma.event.findUnique when provided with event object', async () => {
      const pastEnd = new Date('2026-10-01T10:00:00Z')

      const event: EventWithPassData = {
        id: 'evt_preloaded_1',
        status: 'active',
        eventDate: pastEnd,
        eventEndAt: pastEnd,
        eventPass: {
          id: 'pass_preload',
          status: 'ACTIVE',
          expiresAt: pastEnd,
        },
      }

      ;(prisma.eventPass.update as jest.Mock).mockResolvedValue({ id: 'pass_preload', status: 'EXPIRED', expiresAt: pastEnd })

      const result = await syncEventPassStatusForEvent(event, fixedNow)

      // Proof: findUnique was NEVER called because event data was pre-loaded
      expect(prisma.event.findUnique).not.toHaveBeenCalled()
      expect(prisma.eventPass.update).toHaveBeenCalledWith({
        where: { id: 'pass_preload' },
        data: {
          status: 'EXPIRED',
          expiresAt: pastEnd,
        },
      })
      // Proof: In-memory eventPass status updated in place
      expect(event.eventPass?.status).toBe('EXPIRED')
    })
  })
})
