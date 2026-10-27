/** @jest-environment node */

import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { GET as getFollowStatus, POST as followOrganiser, DELETE as unfollowOrganiser } from '@/app/api/organizers/[username]/follow/route'
import { GET as getFollowingList } from '@/app/api/me/following/route'
import { PATCH as updateFollowingPref } from '@/app/api/me/following/[organiserId]/route'
import { getServerSession } from 'next-auth'

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

const mockedGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

describe('Organiser Following & Account Growth API Suite', () => {
  const organiserId = 'org_user_100'
  const organiserUsername = 'superhost'
  const attendeeId = 'attendee_user_200'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Unauthenticated Guest Access', () => {
    it('allows guest to view public organiser follow status and follower count', async () => {
      mockedGetServerSession.mockResolvedValueOnce(null)

      jest.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce({
        id: organiserId,
        username: organiserUsername,
        name: 'Super Host',
        showFollowerCountPublicly: true,
        _count: { followers: 42 },
      } as any)

      const req = new NextRequest(`http://localhost:3000/api/organizers/${organiserUsername}/follow`)
      const res = await getFollowStatus(req, { params: Promise.resolve({ username: organiserUsername }) })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.isFollowing).toBe(false)
      expect(json.followerCount).toBe(42)
      expect(json.showFollowerCountPublicly).toBe(true)
    })

    it('rejects guest follow attempts with 401 AUTH_REQUIRED', async () => {
      mockedGetServerSession.mockResolvedValueOnce(null)

      const req = new NextRequest(`http://localhost:3000/api/organizers/${organiserUsername}/follow`, {
        method: 'POST',
      })
      const res = await followOrganiser(req, { params: Promise.resolve({ username: organiserUsername }) })
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.success).toBe(false)
      expect(json.code).toBe('AUTH_REQUIRED')
      expect(json.error).toContain('sign in or create a free account')
    })
  })

  describe('Authenticated Follow & Unfollow Lifecycle', () => {
    it('prevents an organiser from following their own account', async () => {
      mockedGetServerSession.mockResolvedValueOnce({
        user: { id: organiserId, email: 'host@eventslot.com' },
      } as any)

      jest.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce({
        id: organiserId,
        username: organiserUsername,
      } as any)

      const req = new NextRequest(`http://localhost:3000/api/organizers/${organiserUsername}/follow`, {
        method: 'POST',
      })
      const res = await followOrganiser(req, { params: Promise.resolve({ username: organiserUsername }) })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.success).toBe(false)
      expect(json.error).toBe('You cannot follow yourself.')
    })

    it('allows authenticated attendee to follow an organiser with idempotent upsert', async () => {
      mockedGetServerSession.mockResolvedValueOnce({
        user: { id: attendeeId, email: 'attendee@example.com' },
      } as any)

      jest.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce({
        id: organiserId,
        username: organiserUsername,
      } as any)

      const upsertSpy = jest.spyOn(prisma.organiserFollower, 'upsert').mockResolvedValueOnce({
        id: 'rel_1',
        followerId: attendeeId,
        organiserId,
        notifyNewEvents: true,
        createdAt: new Date(),
      } as any)

      jest.spyOn(prisma.organiserFollower, 'count').mockResolvedValueOnce(43)

      const req = new NextRequest(`http://localhost:3000/api/organizers/${organiserUsername}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyNewEvents: true }),
      })
      const res = await followOrganiser(req, { params: Promise.resolve({ username: organiserUsername }) })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.isFollowing).toBe(true)
      expect(json.followerCount).toBe(43)
      expect(upsertSpy).toHaveBeenCalledWith({
        where: {
          followerId_organiserId: {
            followerId: attendeeId,
            organiserId,
          },
        },
        create: {
          followerId: attendeeId,
          organiserId,
          notifyNewEvents: true,
        },
        update: {
          notifyNewEvents: true,
        },
      })
    })

    it('allows authenticated attendee to unfollow an organiser', async () => {
      mockedGetServerSession.mockResolvedValueOnce({
        user: { id: attendeeId, email: 'attendee@example.com' },
      } as any)

      jest.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce({
        id: organiserId,
      } as any)

      const deleteManySpy = jest.spyOn(prisma.organiserFollower, 'deleteMany').mockResolvedValueOnce({
        count: 1,
      })

      jest.spyOn(prisma.organiserFollower, 'count').mockResolvedValueOnce(42)

      const req = new NextRequest(`http://localhost:3000/api/organizers/${organiserUsername}/follow`, {
        method: 'DELETE',
      })
      const res = await unfollowOrganiser(req, { params: Promise.resolve({ username: organiserUsername }) })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.isFollowing).toBe(false)
      expect(json.followerCount).toBe(42)
      expect(deleteManySpy).toHaveBeenCalledWith({
        where: {
          followerId: attendeeId,
          organiserId,
        },
      })
    })
  })

  describe('Attendee Account Following Management', () => {
    it('returns the list of followed organisers for the logged-in user', async () => {
      mockedGetServerSession.mockResolvedValueOnce({
        user: { id: attendeeId },
      } as any)

      jest.spyOn(prisma.organiserFollower, 'findMany').mockResolvedValueOnce([
        {
          id: 'rel_1',
          followerId: attendeeId,
          organiserId,
          notifyNewEvents: true,
          createdAt: new Date('2026-10-01'),
          organiser: {
            id: organiserId,
            name: 'Super Host',
            username: organiserUsername,
            image: null,
            showFollowerCountPublicly: true,
            _count: { followers: 42, events: 5 },
          },
        },
      ] as any)

      const res = await getFollowingList()
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.totalCount).toBe(1)
      expect(json.following[0].username).toBe(organiserUsername)
      expect(json.following[0].notifyNewEvents).toBe(true)
      expect(json.following[0].followerCount).toBe(42)
    })

    it('allows an attendee to mute new event notifications independently of following', async () => {
      mockedGetServerSession.mockResolvedValueOnce({
        user: { id: attendeeId },
      } as any)

      const updateSpy = jest.spyOn(prisma.organiserFollower, 'updateMany').mockResolvedValueOnce({
        count: 1,
      })

      const req = new NextRequest(`http://localhost:3000/api/me/following/${organiserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyNewEvents: false }),
      })

      const res = await updateFollowingPref(req, { params: Promise.resolve({ organiserId }) })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.notifyNewEvents).toBe(false)
      expect(updateSpy).toHaveBeenCalledWith({
        where: { followerId: attendeeId, organiserId },
        data: { notifyNewEvents: false },
      })
    })
  })
})
