/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST } from '@/app/api/register/route'

const mockRateLimit = jest.fn()
const mockEventFindUnique = jest.fn()
const mockUserFindUnique = jest.fn()
const mockRegistrationFindMany = jest.fn()

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
  },
}))

jest.mock('@/lib/notifications', () => ({
  createNotification: jest.fn(),
}))

jest.mock('@/lib/email', () => ({
  sendConfirmationEmail: jest.fn(),
  sendWaitlistJoinedEmail: jest.fn(),
  sendOrganizerFirstWaitlistEmail: jest.fn(),
  sendRegistrationResponseCopyEmail: jest.fn(),
}))

jest.mock('@/lib/tickets', () => ({
  generateTicketForRegistration: jest.fn(),
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

describe('POST /api/register option limits', () => {
  beforeEach(() => {
    mockRateLimit.mockReset()
    mockEventFindUnique.mockReset()
    mockUserFindUnique.mockReset()
    mockRegistrationFindMany.mockReset()

    mockRateLimit.mockResolvedValue({ success: true })
    mockUserFindUnique.mockResolvedValue(null)
  })

  it('rejects a registration when a limited option is already full', async () => {
    mockEventFindUnique.mockResolvedValue({
      id: 'event-1',
      slug: 'volunteer-day',
      title: 'Volunteer Day',
      organizerId: null,
      organizer: null,
      status: 'active',
      deadline: null,
      eventEndAt: null,
      confirmedCount: 0,
      waitlistCount: 0,
      capacity: null,
      questions: [
        {
          id: 'fullName',
          label: 'Full Name',
          type: 'text',
          required: true,
        },
        {
          id: 'role',
          label: 'Select Preferred Service Position',
          type: 'select',
          options: ['Media', 'Protocol'],
          optionLimits: { Media: 1 },
          required: true,
        },
      ],
    })

    mockRegistrationFindMany.mockResolvedValue([
      {
        answers: [
          { questionId: 'fullName', value: 'Existing Person' },
          { questionId: 'role', value: 'Media' },
        ],
      },
    ])

    const response = await POST(
      new NextRequest('http://localhost/api/register', {
        method: 'POST',
        body: JSON.stringify({
          eventSlug: 'volunteer-day',
          attendees: [
            {
              answers: [
                { questionId: 'fullName', value: 'New Person' },
                { questionId: 'role', value: 'Media' },
              ],
            },
          ],
          consentDataProcessing: true,
        }),
      })
    )
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('QUESTION_OPTION_FULL')
    expect(body.option).toBe('Media')
  })
})
