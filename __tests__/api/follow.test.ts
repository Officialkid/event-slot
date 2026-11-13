/**
 * @jest-environment node
 *
 * Tests for /api/organizers/[username]/follow
 * Covers GET (status check), POST (follow), DELETE (unfollow)
 * No real database connections — all Prisma calls are mocked.
 */

import { GET, POST, DELETE } from '@/app/api/organizers/[username]/follow/route'
import { NextRequest } from 'next/server'

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findFirst: jest.fn(),
    },
    organiserFollower: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
  },
}))

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'

const mockPrisma = prisma as jest.Mocked<typeof prisma>
const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(method: string, body?: object): NextRequest {
  return new NextRequest(`http://localhost/api/organizers/testorg/follow`, {
    method,
    ...(body ? { body: JSON.stringify(body), headers: { 'content-type': 'application/json' } } : {}),
  })
}

function makeProps(username = 'testorg') {
  return { params: Promise.resolve({ username }) }
}

const ORGANISER = { id: 'org-1', username: 'testorg', name: 'Test Organiser', showFollowerCountPublicly: true, _count: { followers: 42 } }
const FOLLOWER_SESSION = { user: { id: 'user-1', email: 'user@test.com' } } as never

// ─── GET /api/organizers/[username]/follow ────────────────────────────────────

describe('GET /api/organizers/[username]/follow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(ORGANISER)
    ;(mockPrisma.organiserFollower.findUnique as jest.Mock).mockResolvedValue(null)
    mockGetServerSession.mockResolvedValue(null)
  })

  it('returns organiser status for unauthenticated visitor', async () => {
    const res = await GET(makeRequest('GET'), makeProps())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.organiserUsername).toBe('testorg')
    expect(json.followerCount).toBe(42)
    expect(json.isFollowing).toBe(false)
    expect(json.isSelf).toBe(false)
  })

  it('returns isFollowing=true when authenticated user follows the organiser', async () => {
    mockGetServerSession.mockResolvedValue(FOLLOWER_SESSION)
    ;(mockPrisma.organiserFollower.findUnique as jest.Mock).mockResolvedValue({
      followerId: 'user-1',
      organiserId: 'org-1',
      notifyNewEvents: true,
    })

    const res = await GET(makeRequest('GET'), makeProps())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.isFollowing).toBe(true)
    expect(json.notifyNewEvents).toBe(true)
  })

  it('returns isSelf=true when the authenticated user IS the organiser', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'org-1', email: 'org@test.com' } } as never)

    const res = await GET(makeRequest('GET'), makeProps())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.isSelf).toBe(true)
  })

  it('returns 404 when organiser username does not exist', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await GET(makeRequest('GET'), makeProps('nonexistent'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.success).toBe(false)
  })
})

// ─── POST /api/organizers/[username]/follow ───────────────────────────────────

describe('POST /api/organizers/[username]/follow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'org-1', username: 'testorg' })
    ;(mockPrisma.organiserFollower.upsert as jest.Mock).mockResolvedValue({})
    ;(mockPrisma.organiserFollower.count as jest.Mock).mockResolvedValue(43)
    mockGetServerSession.mockResolvedValue(FOLLOWER_SESSION)
  })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const res = await POST(makeRequest('POST'), makeProps())
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.code).toBe('AUTH_REQUIRED')
  })

  it('follows an organiser and returns updated follower count', async () => {
    const res = await POST(makeRequest('POST', { notifyNewEvents: true }), makeProps())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.isFollowing).toBe(true)
    expect(json.followerCount).toBe(43)
    expect(mockPrisma.organiserFollower.upsert).toHaveBeenCalledTimes(1)
  })

  it('is idempotent — calling follow twice does not error', async () => {
    await POST(makeRequest('POST'), makeProps())
    const res = await POST(makeRequest('POST'), makeProps())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    // upsert is called for each POST (idempotency is handled by upsert semantics)
    expect(mockPrisma.organiserFollower.upsert).toHaveBeenCalledTimes(2)
  })

  it('returns 400 when user tries to follow themselves', async () => {
    // Session user id matches organiser id
    mockGetServerSession.mockResolvedValue({ user: { id: 'org-1', email: 'org@test.com' } } as never)

    const res = await POST(makeRequest('POST'), makeProps())
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error).toMatch(/cannot follow yourself/i)
  })

  it('returns 404 when organiser does not exist', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await POST(makeRequest('POST'), makeProps('nobody'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.success).toBe(false)
  })

  it('respects notifyNewEvents=false preference', async () => {
    await POST(makeRequest('POST', { notifyNewEvents: false }), makeProps())

    expect(mockPrisma.organiserFollower.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ notifyNewEvents: false }),
        update: expect.objectContaining({ notifyNewEvents: false }),
      })
    )
  })
})

// ─── DELETE /api/organizers/[username]/follow ─────────────────────────────────

describe('DELETE /api/organizers/[username]/follow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue({ id: 'org-1', username: 'testorg' })
    ;(mockPrisma.organiserFollower.deleteMany as jest.Mock).mockResolvedValue({ count: 1 })
    ;(mockPrisma.organiserFollower.count as jest.Mock).mockResolvedValue(41)
    mockGetServerSession.mockResolvedValue(FOLLOWER_SESSION)
  })

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const res = await DELETE(makeRequest('DELETE'), makeProps())
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.success).toBe(false)
  })

  it('unfollows an organiser and returns updated follower count', async () => {
    const res = await DELETE(makeRequest('DELETE'), makeProps())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.isFollowing).toBe(false)
    expect(json.followerCount).toBe(41)
    expect(mockPrisma.organiserFollower.deleteMany).toHaveBeenCalledTimes(1)
  })

  it('is idempotent — unfollowing when not following does not error', async () => {
    ;(mockPrisma.organiserFollower.deleteMany as jest.Mock).mockResolvedValue({ count: 0 })

    const res = await DELETE(makeRequest('DELETE'), makeProps())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.isFollowing).toBe(false)
  })

  it('returns 404 when organiser does not exist', async () => {
    ;(mockPrisma.user.findFirst as jest.Mock).mockResolvedValue(null)

    const res = await DELETE(makeRequest('DELETE'), makeProps('nobody'))
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.success).toBe(false)
  })
})
