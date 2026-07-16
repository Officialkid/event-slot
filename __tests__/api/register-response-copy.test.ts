/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/register/route'

const mockRateLimit = jest.fn()
const mockEventFindUnique = jest.fn()
const mockUserFindUnique = jest.fn()
const mockRegistrationFindMany = jest.fn()
const mockRegistrationDraftDeleteMany = jest.fn()
const mockTransaction = jest.fn()
const mockGenerateTicket = jest.fn()
const mockSendConfirmationEmail = jest.fn()
const mockSendWaitlistJoinedEmail = jest.fn()
const mockSendOrganizerFirstWaitlistEmail = jest.fn()
const mockSendResponseCopyEmail = jest.fn()

jest.mock('@/lib/ratelimit', () => ({
  ratelimit: {
    limit: (...args: unknown[]) => mockRateLimit(...args),
  },
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
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
  sendConfirmationEmail: (...args: unknown[]) => mockSendConfirmationEmail(...args),
  sendWaitlistJoinedEmail: (...args: unknown[]) => mockSendWaitlistJoinedEmail(...args),
  sendOrganizerFirstWaitlistEmail: (...args: unknown[]) => mockSendOrganizerFirstWaitlistEmail(...args),
  sendRegistrationResponseCopyEmail: (...args: unknown[]) => mockSendResponseCopyEmail(...args),
}))

jest.mock('@/lib/tickets', () => ({
  generateTicketForRegistration: (...args: unknown[]) => mockGenerateTicket(...args),
}))

jest.mock('@/lib/geoip', () => ({
  detectCountry: jest.fn().mockResolvedValue('KE'),
}))

jest.mock('@/lib/googleCalendar', () => ({
  createCalendarEvent: jest.fn(),
  isCalendarConnected: jest.fn().mockResolvedValue(false),
}))

jest.mock('@/lib/planEnforcement', () => ({
  canUseEventFeature: jest.fn().mockResolvedValue({ allowed: true }),
}))

jest.mock('@/lib/effectivePlanPolicy', () => ({
  getEffectivePlanPolicy: jest.fn(() => ({ maxAttendeesPerEvent: -1 })),
}))

jest.mock('@/lib/pricingRollout', () => ({
  isPricingRolloutActive: jest.fn(() => false),
}))

jest.mock('@/lib/capacityNotifications', () => ({
  sendEventCapacityMilestones: jest.fn(),
}))

jest.mock('@/lib/eventPasses', () => ({
  getEffectiveEventPlan: jest.fn().mockResolvedValue({ planKey: 'free' }),
}))

describe('POST /api/register response copy', () => {
  beforeEach(() => {
    mockRateLimit.mockReset()
    mockEventFindUnique.mockReset()
    mockUserFindUnique.mockReset()
    mockRegistrationFindMany.mockReset()
    mockRegistrationDraftDeleteMany.mockReset()
    mockTransaction.mockReset()
    mockGenerateTicket.mockReset()
    mockSendConfirmationEmail.mockReset()
    mockSendWaitlistJoinedEmail.mockReset()
    mockSendOrganizerFirstWaitlistEmail.mockReset()
    mockSendResponseCopyEmail.mockReset()

    mockRateLimit.mockResolvedValue({ success: true })
    mockUserFindUnique.mockResolvedValue(null)
    mockRegistrationFindMany.mockResolvedValue([])
    mockGenerateTicket.mockResolvedValue({ id: 'ticket-1' })
    mockSendConfirmationEmail.mockResolvedValue(undefined)
    mockSendWaitlistJoinedEmail.mockResolvedValue(undefined)
    mockSendOrganizerFirstWaitlistEmail.mockResolvedValue(undefined)
    mockSendResponseCopyEmail.mockResolvedValue(undefined)
    mockRegistrationDraftDeleteMany.mockResolvedValue({ count: 1 })
  })

  it('sends an attendee response-copy email when requested', async () => {
    mockEventFindUnique.mockResolvedValue({
      id: 'event-1',
      slug: 'sample-event',
      title: 'Sample Event',
      organizerId: null,
      organizer: null,
      status: 'active',
      deadline: null,
      eventEndAt: null,
      eventDate: null,
      eventType: 'PHYSICAL',
      location: 'Nairobi',
      capacity: null,
      confirmedCount: 0,
      waitlistCount: 0,
      questions: [
        { id: 'fullName', label: 'Full Name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'email', required: true },
      ],
    })

    mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        event: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'event-1',
            capacity: null,
            confirmedCount: 0,
          }),
          update: jest.fn().mockResolvedValue(null),
        },
        registration: {
          count: jest.fn().mockResolvedValue(0),
          create: jest.fn().mockResolvedValue({
            id: 'reg-1',
          }),
        },
      }
      return callback(tx)
    })

    const response = await POST(
      new NextRequest('http://localhost/api/register', {
        method: 'POST',
        body: JSON.stringify({
          eventSlug: 'sample-event',
          attendees: [
            {
              answers: [
                { questionId: 'fullName', value: 'Jane Doe' },
                { questionId: 'email', value: 'jane@example.com' },
              ],
            },
          ],
          consentDataProcessing: true,
          sendResponseCopy: true,
        }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.success).toBe(true)
    expect(mockSendResponseCopyEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        eventTitle: 'Sample Event',
        attendeeName: 'Jane Doe',
        status: 'confirmed',
      })
    )
  })
})
