/** @jest-environment node */

import { NextRequest } from 'next/server'

const mockGetServerSession = jest.fn()
const mockHasOrganiserAccess = jest.fn()
const mockPurgeUserCache = jest.fn()
const mockCancelCalendarEvent = jest.fn().mockResolvedValue(undefined)
const mockEventFindUnique = jest.fn()
const mockTransaction = jest.fn()

const tx = {
  groupBooking: {
    findMany: jest.fn().mockResolvedValue([{ id: 'booking-1' }]),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  groupTicketSlot: {
    deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
  },
  attendeeFeedback: {
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  entryLog: {
    deleteMany: jest.fn().mockResolvedValue({ count: 3 }),
  },
  registration: {
    findMany: jest.fn().mockResolvedValue([{ id: 'reg-1' }]),
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  ticket: {
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  payment: {
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  paidEventOrder: {
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  registrationDraft: {
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  ticketTier: {
    deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
  },
  eventPass: {
    findUnique: jest.fn().mockResolvedValue({ id: 'pass-1' }),
    delete: jest.fn().mockResolvedValue({ id: 'pass-1' }),
  },
  eventPassPayment: {
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  walkInCheckin: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  eventView: {
    deleteMany: jest.fn().mockResolvedValue({ count: 10 }),
  },
  eventUnlock: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  eventInsight: {
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
  teamMemberEvent: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  emailCampaign: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  eventFAQ: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  calendarEventSync: {
    deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    findMany: jest.fn().mockResolvedValue([]),
  },
  creditTransaction: {
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  featureAccess: {
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
  event: {
    delete: jest.fn().mockResolvedValue({ id: 'event-123' }),
  },
}

jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/adminMode', () => ({
  hasOrganiserAccess: (...args: unknown[]) => mockHasOrganiserAccess(...args),
}))

jest.mock('@/lib/cache', () => ({
  purgeUserCache: (...args: unknown[]) => mockPurgeUserCache(...args),
}))

jest.mock('@/lib/googleCalendar', () => ({
  cancelCalendarEvent: (...args: unknown[]) => mockCancelCalendarEvent(...args),
  updateCalendarEvent: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
    },
    calendarEventSync: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: (fn: (arg: typeof tx) => unknown) => fn(tx),
  },
}))

function createDeleteRequest(url = 'https://www.eventsslot.com/api/events/worshipers-season-04') {
  return new NextRequest(url, { method: 'DELETE' })
}

describe('DELETE /api/events/[slug] cascade deletion', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-organizer', email: 'organizer@eventsslot.com' },
    })
    mockHasOrganiserAccess.mockResolvedValue(false)
  })

  it('returns 404 when the event is not found', async () => {
    mockEventFindUnique.mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/events/[slug]/route')
    const res = await DELETE(createDeleteRequest(), {
      params: Promise.resolve({ slug: 'worshipers-season-04' }),
    })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toBe('Event not found')
  })

  it('returns 403 when caller is not the owner and not an admin', async () => {
    mockEventFindUnique.mockResolvedValue({
      id: 'event-123',
      slug: 'worshipers-season-04',
      title: 'WORSHIPERS SPIRITUAL MEETING SEASON 04',
      organizerId: 'different-organizer-id',
    })
    mockHasOrganiserAccess.mockResolvedValue(false)

    const { DELETE } = await import('@/app/api/events/[slug]/route')
    const res = await DELETE(createDeleteRequest(), {
      params: Promise.resolve({ slug: 'worshipers-season-04' }),
    })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error).toBe('Forbidden')
  })

  it('atomically cascades deletion of all child records when owner deletes event', async () => {
    mockEventFindUnique.mockResolvedValue({
      id: 'event-123',
      slug: 'worshipers-season-04',
      title: 'WORSHIPERS SPIRITUAL MEETING SEASON 04',
      organizerId: 'user-organizer',
    })

    const { DELETE } = await import('@/app/api/events/[slug]/route')
    const res = await DELETE(createDeleteRequest(), {
      params: Promise.resolve({ slug: 'worshipers-season-04' }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)

    // Verify cascade order
    expect(tx.groupBooking.findMany).toHaveBeenCalledWith({ where: { eventId: 'event-123' }, select: { id: true } })
    expect(tx.groupTicketSlot.deleteMany).toHaveBeenCalledWith({ where: { bookingId: { in: ['booking-1'] } } })
    expect(tx.groupBooking.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ['booking-1'] } } })
    expect(tx.attendeeFeedback.deleteMany).toHaveBeenCalledWith({ where: { eventId: 'event-123' } })
    expect(tx.entryLog.deleteMany).toHaveBeenCalledWith({ where: { eventId: 'event-123' } })
    expect(tx.ticket.deleteMany).toHaveBeenCalledWith({ where: { registrationId: { in: ['reg-1'] } } })
    expect(tx.payment.deleteMany).toHaveBeenCalledWith({ where: { eventId: 'event-123' } })
    expect(tx.paidEventOrder.deleteMany).toHaveBeenCalledWith({ where: { eventId: 'event-123' } })
    expect(tx.registrationDraft.deleteMany).toHaveBeenCalledWith({ where: { eventId: 'event-123' } })
    expect(tx.registration.deleteMany).toHaveBeenCalledWith({ where: { eventId: 'event-123' } })
    expect(tx.ticketTier.deleteMany).toHaveBeenCalledWith({ where: { eventId: 'event-123' } })
    expect(tx.eventPassPayment.deleteMany).toHaveBeenCalledWith({ where: { eventPassId: 'pass-1' } })
    expect(tx.eventPass.delete).toHaveBeenCalledWith({ where: { id: 'pass-1' } })
    expect(tx.event.delete).toHaveBeenCalledWith({ where: { id: 'event-123' } })

    // Verify cache purge
    expect(mockPurgeUserCache).toHaveBeenCalledWith('user-organizer', 'organizer@eventsslot.com')
  })
})
