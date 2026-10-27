/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET } from '@/app/api/events/recommended/route'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    event: {
      findMany: jest.fn(),
    },
  },
}))

describe('GET /api/events/recommended', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetches moreFromOrganiser and eventsYouMayLike excluding current slug', async () => {
    ;(prisma.event.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'evt_1',
          title: 'Organiser Next Event',
          slug: 'organiser-next-event',
          imageUrl: null,
          eventDate: new Date('2026-11-01T10:00:00Z'),
          location: 'Nairobi',
          isPaid: false,
          ticketPrice: null,
          category: 'Technology',
          organizerName: 'Dev Organiser',
          status: 'active',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'evt_2',
          title: 'Related Event',
          slug: 'related-event',
          imageUrl: null,
          eventDate: new Date('2026-11-05T10:00:00Z'),
          location: 'Mombasa',
          isPaid: true,
          ticketPrice: 1500,
          category: 'Technology',
          organizerName: 'Another Org',
          status: 'active',
          organizer: {
            username: 'anotherorg',
            name: 'Another Org',
            image: null,
          },
        },
      ])
      .mockResolvedValueOnce([])

    const req = new NextRequest('http://localhost:3000/api/events/recommended?excludeSlug=current-event&organizerId=org_123&category=Technology')
    const res = await GET(req)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.moreFromOrganiser).toHaveLength(1)
    expect(data.moreFromOrganiser[0].slug).toBe('organiser-next-event')
    expect(data.eventsYouMayLike).toHaveLength(1)
    expect(data.eventsYouMayLike[0].slug).toBe('related-event')
    expect(data.eventsYouMayLike[0].organizerUsername).toBe('anotherorg')
  })
})
