/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/register/route'

const mockRateLimit = jest.fn()
const mockEventFindUnique = jest.fn()
const mockUserFindUnique = jest.fn()
const mockRegistrationFindMany = jest.fn()
const mockRegistrationDraftDeleteMany = jest.fn()
const mockTransaction = jest.fn()
const mockCanUseEventFeature = jest.fn()

jest.mock('@/lib/ratelimit', () => ({
  ratelimit: {
    limit: (...args: unknown[]) => mockRateLimit(...args),
  },
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    event: {
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    registration: {
      findMany: (...args: unknown[]) => mockRegistrationFindMany(...args),
    },
    registrationDraft: {
      deleteMany: (...args: unknown[]) => mockRegistrationDraftDeleteMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
  default: {
    event: {
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    registration: {
      findMany: (...args: unknown[]) => mockRegistrationFindMany(...args),
    },
    registrationDraft: {
      deleteMany: (...args: unknown[]) => mockRegistrationDraftDeleteMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

jest.mock('@/lib/notifications', () => ({
  createNotification: jest.fn(),
}))

jest.mock('@/lib/email', () => ({
  sendConfirmationEmail: jest.fn().mockResolvedValue(true),
  sendWaitlistJoinedEmail: jest.fn().mockResolvedValue(true),
  sendOrganizerFirstWaitlistEmail: jest.fn().mockResolvedValue(true),
  sendRegistrationResponseCopyEmail: jest.fn().mockResolvedValue(true),
}))

jest.mock('@/lib/tickets', () => ({
  generateTicketForRegistration: jest.fn().mockResolvedValue({ id: 'ticket_1', barcode: '123' }),
}))

jest.mock('@/lib/geoip', () => ({
  detectCountry: jest.fn().mockResolvedValue('KE'),
}))

jest.mock('@/lib/googleCalendar', () => ({
  createCalendarEvent: jest.fn(),
  isCalendarConnected: jest.fn().mockResolvedValue(false),
}))

jest.mock('@/lib/planEnforcement', () => ({
  canUseEventFeature: (...args: unknown[]) => mockCanUseEventFeature(...args),
}))

jest.mock('@/lib/effectivePlanPolicy', () => ({
  getEffectivePlanPolicy: jest.fn(() => ({ maxAttendeesPerEvent: -1, hasWaitlist: true })),
  isPricingRolloutActive: jest.fn(() => false),
}))

describe('Timed Ticket Drop Registration Rules', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRateLimit.mockResolvedValue({ success: true })
    mockRegistrationFindMany.mockResolvedValue([])
    mockRegistrationDraftDeleteMany.mockResolvedValue({ count: 0 })
    mockCanUseEventFeature.mockResolvedValue({ allowed: true })
  })

  function createReq(body: Record<string, unknown>) {
    return new NextRequest('http://localhost:3000/api/register', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '127.0.0.1',
      },
      body: JSON.stringify(body),
    })
  }

  it('rejects registration when drop window is upcoming (DROP_NOT_OPEN)', async () => {
    const futureOpen = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
    const futureClose = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()

    mockEventFindUnique.mockResolvedValueOnce({
      id: 'evt_drop_1',
      slug: 'timed-drop-event',
      title: 'Timed Drop Event',
      status: 'active',
      capacity: 100,
      confirmedCount: 0,
      waitlistCount: 0,
      isRecurring: false,
      deadline: null,
      timedDropEnabled: true,
      ticketDropOpensAt: new Date(futureOpen),
      ticketDropClosesAt: new Date(futureClose),
      dropWaitlistOnExpire: true,
      organizerId: 'org_1',
      organizerEmail: 'org@example.com',
      questions: [],
      attendeeConsentEnabled: false,
      attendeeConsentText: null,
      isPaid: false,
    })

    const req = createReq({
      eventSlug: 'timed-drop-event',
      attendees: [
        {
          answers: [
            { questionId: 'fullName', value: 'Alice Doe' },
            { questionId: 'email', value: 'alice@example.com' },
          ],
        },
      ],
      consentDataProcessing: true,
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe('DROP_NOT_OPEN')
    expect(json.error).toMatch(/Ticket drop has not opened yet/i)
  })

  it('rejects registration when drop window has ended and waitlist is disabled (DROP_CLOSED)', async () => {
    const pastOpen = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const pastClose = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    mockEventFindUnique.mockResolvedValueOnce({
      id: 'evt_drop_2',
      slug: 'timed-drop-event-closed',
      title: 'Timed Drop Closed',
      status: 'active',
      capacity: 100,
      confirmedCount: 0,
      waitlistCount: 0,
      isRecurring: false,
      deadline: null,
      timedDropEnabled: true,
      ticketDropOpensAt: new Date(pastOpen),
      ticketDropClosesAt: new Date(pastClose),
      dropWaitlistOnExpire: false,
      organizerId: 'org_1',
      organizerEmail: 'org@example.com',
      questions: [],
      attendeeConsentEnabled: false,
      attendeeConsentText: null,
      isPaid: false,
    })

    const req = createReq({
      eventSlug: 'timed-drop-event-closed',
      attendees: [
        {
          answers: [
            { questionId: 'fullName', value: 'Bob Doe' },
            { questionId: 'email', value: 'bob@example.com' },
          ],
        },
      ],
      consentDataProcessing: true,
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.code).toBe('DROP_CLOSED')
  })

  it('routes to waitlist when drop window has ended and waitlist is enabled', async () => {
    const pastOpen = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    const pastClose = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    const eventRecord = {
      id: 'evt_drop_3',
      slug: 'timed-drop-event-waitlist',
      title: 'Timed Drop Waitlist Event',
      status: 'active',
      capacity: 100,
      confirmedCount: 10,
      waitlistCount: 5,
      isRecurring: false,
      deadline: null,
      timedDropEnabled: true,
      ticketDropOpensAt: new Date(pastOpen),
      ticketDropClosesAt: new Date(pastClose),
      dropWaitlistOnExpire: true,
      organizerId: 'org_1',
      organizerEmail: 'org@example.com',
      questions: [],
      attendeeConsentEnabled: false,
      attendeeConsentText: null,
      isPaid: false,
    }

    mockEventFindUnique.mockResolvedValueOnce(eventRecord)
    mockUserFindUnique.mockResolvedValueOnce({ id: 'org_1', plan: 'free' })

    mockTransaction.mockImplementationOnce(async (callback: (tx: any) => Promise<unknown>) => {
      const tx = {
        event: {
          findUnique: jest.fn().mockResolvedValue(eventRecord),
          update: jest.fn().mockResolvedValue({
            ...eventRecord,
            waitlistCount: 6,
          }),
        },
        registration: {
          count: jest.fn().mockResolvedValue(10),
          create: jest.fn().mockResolvedValue({
            id: 'reg_waitlist_1',
            status: 'waitlist',
            waitlistPosition: 6,
            registrationNumber: 0,
            confirmationCode: 'WL-12345',
            answers: [
              { questionId: 'fullName', value: 'Charlie Doe' },
              { questionId: 'email', value: 'charlie@example.com' },
            ],
          }),
        },
        auditLog: { create: jest.fn() },
      }
      return callback(tx)
    })

    const req = createReq({
      eventSlug: 'timed-drop-event-waitlist',
      attendees: [
        {
          answers: [
            { questionId: 'fullName', value: 'Charlie Doe' },
            { questionId: 'email', value: 'charlie@example.com' },
          ],
        },
      ],
      consentDataProcessing: true,
    })

    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.results[0].status).toBe('waitlist')
  })
})
