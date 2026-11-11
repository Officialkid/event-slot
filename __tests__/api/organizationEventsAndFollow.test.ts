/** @jest-environment node */

import { GET as getOrgEvents } from '@/app/api/organizations/[handle]/events/route'
import { POST as transferEvent } from '@/app/api/events/[slug]/transfer/route'
import { GET as getFollow, POST as followOrg, DELETE as unfollowOrg } from '@/app/api/organizations/[handle]/follow/route'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { NextRequest } from 'next/server'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/prisma', () => ({
  organization: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  organizationMember: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  organizationFollower: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
  organizationAuditLog: {
    create: jest.fn(),
  },
  event: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  eventTransferRequest: {
    create: jest.fn(),
  },
  withdrawal: {
    count: jest.fn(),
  },
  $transaction: jest.fn((callback) => callback(prisma)),
}))

describe('Organization Events & Following API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('GET /api/organizations/[handle]/events', () => {
    it('returns 401 when unauthenticated', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce(null)
      const req = new NextRequest('http://localhost:3000/api/organizations/ispeaksociety/events')
      const res = await getOrgEvents(req, { params: Promise.resolve({ handle: 'ispeaksociety' }) })
      expect(res.status).toBe(401)
    })

    it('returns organization events to active Event Manager with creator attribution', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user_em', email: 'em@example.com' },
      })
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'org_society',
        name: 'I Speak Society',
        handle: 'ispeaksociety',
      })
      ;(prisma.organizationMember.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'mem_1',
        role: 'EVENT_MANAGER',
        status: 'ACTIVE',
      })
      ;(prisma.event.findMany as jest.Mock).mockResolvedValueOnce([
        {
          id: 'ev_1',
          title: 'Speech and Pitch',
          slug: 'speech-and-pitch-7a8b',
          status: 'active',
          visibility: 'PUBLIC',
          accessType: 'REGISTRATION',
          eventType: 'PHYSICAL',
          capacity: 100,
          confirmedCount: 42,
          waitlistCount: 0,
          isPaid: false,
          createdAt: new Date(),
          creator: {
            id: 'user_em',
            name: 'Sarah Connor',
            email: 'sarah@example.com',
          },
        },
      ])

      const req = new NextRequest('http://localhost:3000/api/organizations/ispeaksociety/events')
      const res = await getOrgEvents(req, { params: Promise.resolve({ handle: 'ispeaksociety' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.events).toHaveLength(1)
      expect(data.events[0].title).toBe('Speech and Pitch')
      expect(data.events[0].creatorName).toBe('Sarah Connor')
    })
  })

  describe('POST /api/events/[slug]/transfer', () => {
    it('transfers personal event to organization workspace and preserves creatorId', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user_personal_owner', email: 'owner@example.com' },
      })
      ;(prisma.event.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'ev_pers',
        slug: 'my-personal-event',
        title: 'Navigating Corridors of Power',
        organizerId: 'user_personal_owner',
        organizationId: null,
        creatorId: 'user_personal_owner',
        status: 'active',
        archived: false,
        isPaid: false,
        paymentsLive: false,
      })
      ;(prisma.organization.findFirst as jest.Mock).mockResolvedValueOnce({
        id: 'org_society',
        name: 'I Speak Society',
        handle: 'ispeaksociety',
        contactEmail: 'contact@ispeaksociety.com',
      })
      ;(prisma.organizationMember.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'mem_owner',
        role: 'OWNER',
        status: 'ACTIVE',
      })
      ;(prisma.eventTransferRequest.create as jest.Mock).mockResolvedValueOnce({
        id: 'tr_1',
      })
      ;(prisma.event.update as jest.Mock).mockResolvedValueOnce({
        id: 'ev_pers',
        slug: 'my-personal-event',
        title: 'Navigating Corridors of Power',
        organizationId: 'org_society',
        creatorId: 'user_personal_owner',
        organizerName: 'I Speak Society',
      })

      const req = new NextRequest('http://localhost:3000/api/events/my-personal-event/transfer', {
        method: 'POST',
        body: JSON.stringify({
          targetOrganizationHandle: 'ispeaksociety',
          notes: 'Transferring to official society account',
        }),
      })

      const res = await transferEvent(req, { params: Promise.resolve({ slug: 'my-personal-event' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.event.organizationId).toBe('org_society')
      expect(data.event.creatorId).toBe('user_personal_owner')
    })
  })

  describe('Organization Following API', () => {
    it('GET /api/organizations/[handle]/follow returns follow state', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user_fan', email: 'fan@example.com' },
      })
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'org_society',
        name: 'I Speak Society',
        handle: 'ispeaksociety',
        createdById: 'user_founder',
        _count: { followers: 58 },
      })
      ;(prisma.organizationFollower.findUnique as jest.Mock).mockResolvedValueOnce({
        followerId: 'user_fan',
        organizationId: 'org_society',
        notifyNewEvents: true,
      })

      const req = new NextRequest('http://localhost:3000/api/organizations/ispeaksociety/follow')
      const res = await getFollow(req, { params: Promise.resolve({ handle: 'ispeaksociety' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.isFollowing).toBe(true)
      expect(data.followerCount).toBe(58)
    })

    it('POST /api/organizations/[handle]/follow upserts follow and increments count', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user_fan', email: 'fan@example.com' },
      })
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'org_society',
        name: 'I Speak Society',
        handle: 'ispeaksociety',
        createdById: 'user_founder',
      })
      ;(prisma.organizationFollower.count as jest.Mock).mockResolvedValueOnce(59)

      const req = new NextRequest('http://localhost:3000/api/organizations/ispeaksociety/follow', {
        method: 'POST',
        body: JSON.stringify({ notifyNewEvents: true }),
      })

      const res = await followOrg(req, { params: Promise.resolve({ handle: 'ispeaksociety' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.isFollowing).toBe(true)
      expect(data.followerCount).toBe(59)
      expect(prisma.organizationFollower.upsert).toHaveBeenCalled()
    })

    it('DELETE /api/organizations/[handle]/follow removes follow', async () => {
      ;(getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user_fan', email: 'fan@example.com' },
      })
      ;(prisma.organization.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'org_society',
        name: 'I Speak Society',
        handle: 'ispeaksociety',
      })
      ;(prisma.organizationFollower.count as jest.Mock).mockResolvedValueOnce(58)

      const req = new NextRequest('http://localhost:3000/api/organizations/ispeaksociety/follow', {
        method: 'DELETE',
      })

      const res = await unfollowOrg(req, { params: Promise.resolve({ handle: 'ispeaksociety' }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.isFollowing).toBe(false)
      expect(data.followerCount).toBe(58)
      expect(prisma.organizationFollower.deleteMany).toHaveBeenCalled()
    })
  })
})
