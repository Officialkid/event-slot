/** @jest-environment node */

import prisma from '@/lib/prisma'
import { dispatchNewEventAnnouncements } from '@/services/notifications/followerAnnouncements'
import * as emailModule from '@/lib/email'

jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn(),
}))

const mockedSendEmail = emailModule.sendEmail as jest.MockedFunction<typeof emailModule.sendEmail>

describe('Follower Announcements Dispatcher Service', () => {
  const eventId = 'event_abc_123'
  const organiserId = 'org_xyz_999'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('dispatches emails to eligible opted-in followers on first publication', async () => {
    const mockEvent = {
      id: eventId,
      title: 'DevOps Summit Nairobi 2026',
      slug: 'devops-summit-2026',
      visibility: 'PUBLIC',
      status: 'active',
      archived: false,
      announcementSentAt: null,
      firstPublishedAt: null,
      eventDate: new Date('2026-11-15T09:00:00Z'),
      location: 'Sarit Expo Centre, Westlands',
      eventType: 'PHYSICAL',
      entryFeeLabel: 'Free Admission',
      imageUrl: 'https://example.com/poster.jpg',
      organizerId: organiserId,
      organizerName: 'DevOps Africa',
      organizer: {
        id: organiserId,
        name: 'DevOps Africa',
        username: 'devops-africa',
      },
    }

    jest.spyOn(prisma.event, 'findUnique').mockResolvedValueOnce(mockEvent as any)
    const updateSpy = jest.spyOn(prisma.event, 'update').mockResolvedValueOnce({
      ...mockEvent,
      announcementSentAt: new Date(),
    } as any)

    jest.spyOn(prisma.organiserFollower, 'findMany').mockResolvedValueOnce([
      {
        id: 'rel_1',
        notifyNewEvents: true,
        follower: {
          id: 'user_1',
          name: 'Jane Doe',
          email: 'jane@example.com',
          emailBounceCount: 0,
          marketingConsent: true,
        },
      },
      {
        id: 'rel_2',
        notifyNewEvents: true,
        follower: {
          id: 'user_2',
          name: 'Bounced User',
          email: 'bounced@example.com',
          emailBounceCount: 2, // Must be skipped
          marketingConsent: true,
        },
      },
    ] as any)

    mockedSendEmail.mockResolvedValueOnce(undefined)

    const result = await dispatchNewEventAnnouncements(eventId)

    expect(result.sent).toBe(1)
    expect(result.skipped).toBe(1) // Bounced user skipped
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: eventId },
      data: {
        announcementSentAt: expect.any(Date),
        firstPublishedAt: expect.any(Date),
      },
    })
    expect(mockedSendEmail).toHaveBeenCalledTimes(1)
    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        subject: 'New Event: DevOps Summit Nairobi 2026 by DevOps Africa',
        category: 'marketing',
        unsubscribeUrl: expect.stringContaining('/api/notifications/unsubscribe?token='),
      })
    )
  })

  it('strictly excludes draft, unlisted, or private events from announcements', async () => {
    jest.spyOn(prisma.event, 'findUnique').mockResolvedValueOnce({
      id: eventId,
      visibility: 'PRIVATE',
      status: 'active',
      announcementSentAt: null,
    } as any)

    const result = await dispatchNewEventAnnouncements(eventId)

    expect(result.sent).toBe(0)
    expect(result.reason).toBe('EVENT_NOT_ELIGIBLE_FOR_ANNOUNCEMENT')
    expect(mockedSendEmail).not.toHaveBeenCalled()
  })

  it('guarantees idempotency and rejects duplicate announcements for already announced events', async () => {
    jest.spyOn(prisma.event, 'findUnique').mockResolvedValueOnce({
      id: eventId,
      visibility: 'PUBLIC',
      status: 'active',
      announcementSentAt: new Date('2026-10-20'), // Already sent
    } as any)

    const result = await dispatchNewEventAnnouncements(eventId)

    expect(result.sent).toBe(0)
    expect(result.reason).toBe('ALREADY_ANNOUNCED')
    expect(mockedSendEmail).not.toHaveBeenCalled()
  })
})
