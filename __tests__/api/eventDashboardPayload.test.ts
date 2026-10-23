/** @jest-environment node */

import { NextRequest } from 'next/server'

const mockGetServerSession = jest.fn()
const mockEventFindUnique = jest.fn()
const mockRegistrationFindMany = jest.fn()
const mockCalendarFindUnique = jest.fn()
const mockUserFindUnique = jest.fn()

jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/adminMode', () => ({
  hasOrganiserAccess: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
    },
    registration: {
      findMany: (...args: unknown[]) => mockRegistrationFindMany(...args),
    },
    calendarEventSync: {
      findUnique: (...args: unknown[]) => mockCalendarFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

jest.mock('@/lib/eventPasses', () => ({
  getEffectiveEventPlan: jest.fn().mockResolvedValue('free'),
  syncEventPassStatusForEvent: jest.fn().mockResolvedValue(null),
}))

describe('GET /api/events/[slug] dashboard payload contract & backwards compatibility', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1', email: 'organizer@example.com' } })
    mockEventFindUnique.mockResolvedValue({
      id: 'event-1',
      slug: 'tech-meetup',
      title: 'Tech Meetup',
      organizerId: 'user-1',
      dashboardToken: 'token-123',
      confirmedCount: 1,
      waitlistCount: 0,
      isPaid: false,
      whatsappNumber: null,
      ticketsEnabled: true,
      ticketTiers: [],
      questions: [],
    })
    mockCalendarFindUnique.mockResolvedValue(null)
    mockUserFindUnique.mockResolvedValue({ googleCalendarConnected: false })
  })

  it('preserves the backward-compatible array contract and includes answers in the selection', async () => {
    mockRegistrationFindMany.mockResolvedValue([
      {
        id: 'reg-1',
        answers: [{ questionId: 'q-name', value: 'Alice' }],
        submittedAt: new Date('2026-10-23T00:00:00Z'),
        source: 'web',
        status: 'confirmed',
        waitlistPosition: null,
        occurrenceDate: null,
        attendeeEmail: 'alice@example.com',
        registrationNumber: 1,
        checkedIn: false,
        checkedInAt: null,
      },
    ])

    const { GET } = await import('@/app/api/events/[slug]/route')
    const req = new NextRequest('https://www.eventsslot.com/api/events/tech-meetup?token=token-123')
    const response = await GET(req, { params: Promise.resolve({ slug: 'tech-meetup' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(Array.isArray(body.confirmed)).toBe(true)
    expect(body.confirmed).toHaveLength(1)
    expect(body.confirmed[0]).toMatchObject({
      id: 'reg-1',
      answers: [{ questionId: 'q-name', value: 'Alice' }],
      attendeeEmail: 'alice@example.com',
      checkedIn: false,
    })
    expect(Array.isArray(body.waitlist)).toBe(true)

    // Verify findMany was called with answers: true and NO take by default
    expect(mockRegistrationFindMany).toHaveBeenCalledWith({
      where: { eventId: 'event-1' },
      select: expect.objectContaining({
        id: true,
        answers: true,
        status: true,
        attendeeEmail: true,
      }),
      orderBy: [{ submittedAt: 'asc' }, { waitlistPosition: 'asc' }],
    })
  })

  it('honors optional take parameter when supplied', async () => {
    mockRegistrationFindMany.mockResolvedValue([])

    const { GET } = await import('@/app/api/events/[slug]/route')
    const req = new NextRequest('https://www.eventsslot.com/api/events/tech-meetup?token=token-123&take=25')
    const response = await GET(req, { params: Promise.resolve({ slug: 'tech-meetup' }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mockRegistrationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'event-1' },
        take: 25,
      })
    )
  })
})
