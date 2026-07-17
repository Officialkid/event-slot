/** @jest-environment node */

import { NextRequest } from 'next/server'

const mockGetServerSession = jest.fn()
const mockEventFindUnique = jest.fn()
const mockTransaction = jest.fn()
const mockErrorLogCreate = jest.fn()
const mockSendWaitlistPromotedEmail = jest.fn()
const mockCreateNotification = jest.fn()
const mockGenerateConfirmationCode = jest.fn()
const mockIsAdminEmail = jest.fn()
const mockHasTeamEventAccess = jest.fn()

const tx = {
  registration: {
    findMany: jest.fn(),
    update: jest.fn(),
  },
  event: {
    update: jest.fn(),
  },
}

jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
    },
    errorLog: {
      create: (...args: unknown[]) => mockErrorLogCreate(...args),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

jest.mock('@/lib/email', () => ({
  sendWaitlistPromotedEmail: (...args: unknown[]) => mockSendWaitlistPromotedEmail(...args),
}))

jest.mock('@/lib/notifications', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}))

jest.mock('@/lib/confirmationCode', () => ({
  generateConfirmationCode: (...args: unknown[]) => mockGenerateConfirmationCode(...args),
}))

jest.mock('@/lib/isAdmin', () => ({
  isAdminEmail: (...args: unknown[]) => mockIsAdminEmail(...args),
}))

jest.mock('@/lib/eventAccess', () => ({
  hasTeamEventAccess: (...args: unknown[]) => mockHasTeamEventAccess(...args),
}))

jest.mock('@/lib/googleCalendar', () => ({
  isCalendarConnected: jest.fn(),
  updateCalendarEvent: jest.fn(),
}))

jest.mock('@/lib/encrypt', () => ({
  decrypt: jest.fn(),
}))

function patchRequest(body: unknown) {
  return new NextRequest('https://www.eventsslot.com/api/events/potluck/capacity', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

const event = {
  id: 'event-1',
  slug: 'potluck',
  title: 'Potluck',
  organizerId: 'owner-1',
  dashboardToken: 'dash-token',
  capacity: 1,
  confirmedCount: 1,
  waitlistCount: 1,
  isPaid: false,
  eventDate: null,
  eventEndAt: null,
  location: 'Nairobi',
  communityLink: null,
  eventType: 'PHYSICAL',
  virtualLink: null,
  virtualLinkIv: null,
}

describe('PATCH /api/events/[slug]/capacity waitlist promotion emails', () => {
  beforeEach(() => {
    jest.resetModules()
    mockGetServerSession.mockReset()
    mockEventFindUnique.mockReset()
    mockTransaction.mockReset()
    mockErrorLogCreate.mockReset()
    mockSendWaitlistPromotedEmail.mockReset()
    mockCreateNotification.mockReset()
    mockGenerateConfirmationCode.mockReset()
    mockIsAdminEmail.mockReset()
    mockHasTeamEventAccess.mockReset()
    tx.registration.findMany.mockReset()
    tx.registration.update.mockReset()
    tx.event.update.mockReset()

    mockGetServerSession.mockResolvedValue({ user: { id: 'owner-1', email: 'owner@example.com' } })
    mockEventFindUnique.mockResolvedValue(event)
    mockIsAdminEmail.mockReturnValue(false)
    mockHasTeamEventAccess.mockResolvedValue(false)
    mockGenerateConfirmationCode.mockReturnValue('CONFIRM-123')
    mockErrorLogCreate.mockResolvedValue({ id: 'log-1' })
    mockCreateNotification.mockResolvedValue(null)
    mockSendWaitlistPromotedEmail.mockResolvedValue(null)
    mockTransaction.mockImplementation(async (callback: (txArg: typeof tx) => Promise<unknown>) => callback(tx))
  })

  it('promotes the first waitlisted attendee, sends the promotion email, and records diagnostics', async () => {
    tx.registration.findMany.mockResolvedValue([
      { id: 'reg-wait-1', attendeeEmail: 'attendee@example.com', consentTransactional: true },
    ])
    tx.registration.update.mockResolvedValue({
      id: 'reg-wait-1',
      attendeeEmail: 'attendee@example.com',
      consentTransactional: true,
      confirmationCode: 'CONFIRM-123',
    })
    tx.event.update.mockResolvedValue({
      confirmedCount: 2,
      waitlistCount: 0,
    })

    const { PATCH } = await import('@/app/api/events/[slug]/capacity/route')
    const response = await PATCH(patchRequest({ newCapacity: 2 }), {
      params: Promise.resolve({ slug: 'potluck' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.emailDiagnostics).toEqual({ attempted: 1, sent: 1, failed: 0, skippedNoEmail: 0 })
    expect(mockSendWaitlistPromotedEmail).toHaveBeenCalledWith({
      to: 'attendee@example.com',
      eventTitle: 'Potluck',
      eventDate: null,
      eventEndAt: null,
      eventLocation: 'Nairobi',
      communityLink: null,
      ticketUrl: 'https://www.eventsslot.com/register/success/CONFIRM-123',
      eventSlug: 'potluck',
    })
    expect(mockErrorLogCreate).toHaveBeenCalledTimes(1)
    const diagnosticMessage = JSON.parse(mockErrorLogCreate.mock.calls[0][0].data.message)
    expect(diagnosticMessage.summary).toEqual({ attempted: 1, sent: 1, failed: 0, skippedNoEmail: 0 })
    expect(diagnosticMessage.attempts[0]).toMatchObject({
      registrationId: 'reg-wait-1',
      attendeeEmail: 'attendee@example.com',
      status: 'sent',
    })
    expect(mockCreateNotification).toHaveBeenCalledWith({
      userId: 'owner-1',
      type: 'EVENT',
      title: 'Waitlist Promotion',
      message: '1 person was moved from the waitlist to confirmed for "Potluck".',
      link: '/dashboard/events/potluck',
    })
  })

  it('records skipped diagnostics when a promoted waitlisted attendee has no email', async () => {
    tx.registration.findMany.mockResolvedValue([
      { id: 'reg-wait-2', attendeeEmail: null, consentTransactional: true },
    ])
    tx.registration.update.mockResolvedValue({
      id: 'reg-wait-2',
      attendeeEmail: null,
      consentTransactional: true,
      confirmationCode: 'CONFIRM-456',
    })
    tx.event.update.mockResolvedValue({
      confirmedCount: 2,
      waitlistCount: 0,
    })

    const { PATCH } = await import('@/app/api/events/[slug]/capacity/route')
    const response = await PATCH(patchRequest({ newCapacity: 2 }), {
      params: Promise.resolve({ slug: 'potluck' }),
    })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.emailDiagnostics).toEqual({ attempted: 1, sent: 0, failed: 0, skippedNoEmail: 1 })
    expect(mockSendWaitlistPromotedEmail).not.toHaveBeenCalled()
    const diagnosticMessage = JSON.parse(mockErrorLogCreate.mock.calls[0][0].data.message)
    expect(diagnosticMessage.attempts[0]).toMatchObject({
      registrationId: 'reg-wait-2',
      attendeeEmail: null,
      status: 'skipped_no_email',
    })
  })
})

export {}
