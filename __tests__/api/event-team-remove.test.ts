/** @jest-environment node */

import { NextRequest } from 'next/server'

const mockGetServerSession = jest.fn()
const mockEventFindUnique = jest.fn()
const mockTeamMemberFindUnique = jest.fn()
const mockTeamMemberEventDeleteMany = jest.fn()
const mockTeamMemberEventCount = jest.fn()
const mockTeamMemberDelete = jest.fn()
const mockPurgeUserCache = jest.fn()

jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/cache', () => ({
  purgeUserCache: (...args: unknown[]) => mockPurgeUserCache(...args),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
    },
    teamMember: {
      findUnique: (...args: unknown[]) => mockTeamMemberFindUnique(...args),
      delete: (...args: unknown[]) => mockTeamMemberDelete(...args),
    },
    teamMemberEvent: {
      deleteMany: (...args: unknown[]) => mockTeamMemberEventDeleteMany(...args),
      count: (...args: unknown[]) => mockTeamMemberEventCount(...args),
    },
  },
}))

describe('DELETE /api/events/[slug]/team', () => {
  beforeEach(() => {
    jest.resetModules()
    mockGetServerSession.mockReset()
    mockEventFindUnique.mockReset()
    mockTeamMemberFindUnique.mockReset()
    mockTeamMemberEventDeleteMany.mockReset()
    mockTeamMemberEventCount.mockReset()
    mockTeamMemberDelete.mockReset()
    mockPurgeUserCache.mockReset()
  })

  it('rejects unauthorized users with 401', async () => {
    mockGetServerSession.mockResolvedValue(null)
    const { DELETE } = await import('@/app/api/events/[slug]/team/route')

    const req = new NextRequest('https://www.eventsslot.com/api/events/my-event/team?memberId=tm-1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ slug: 'my-event' }) })

    expect(res.status).toBe(401)
  })

  it('forbids collaborators who are not the event owner or superadmin with 403', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'collaborator-1', role: 'USER' },
    })
    mockEventFindUnique.mockResolvedValue({
      id: 'event-1',
      organizerId: 'real-organizer-id',
    })

    const { DELETE } = await import('@/app/api/events/[slug]/team/route')
    const req = new NextRequest('https://www.eventsslot.com/api/events/my-event/team?memberId=tm-1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ slug: 'my-event' }) })

    expect(res.status).toBe(403)
    const data = await res.json()
    expect(data.error).toContain('Only the event organizer or super admin can remove team members')
    expect(mockTeamMemberEventDeleteMany).not.toHaveBeenCalled()
  })

  it('allows the event owner to remove a team member and purges cache', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'real-organizer-id', role: 'USER' },
    })
    mockEventFindUnique.mockResolvedValue({
      id: 'event-1',
      organizerId: 'real-organizer-id',
    })
    mockTeamMemberFindUnique.mockResolvedValue({
      memberId: 'user-to-remove',
      member: { email: 'staff@example.com' },
    })
    mockTeamMemberEventDeleteMany.mockResolvedValue({ count: 1 })
    mockTeamMemberEventCount.mockResolvedValue(0)
    mockTeamMemberDelete.mockResolvedValue({})

    const { DELETE } = await import('@/app/api/events/[slug]/team/route')
    const req = new NextRequest('https://www.eventsslot.com/api/events/my-event/team?memberId=tm-1', { method: 'DELETE' })
    const res = await DELETE(req, { params: Promise.resolve({ slug: 'my-event' }) })

    expect(res.status).toBe(200)
    expect(mockTeamMemberEventDeleteMany).toHaveBeenCalledWith({
      where: { teamMemberId: 'tm-1', eventId: 'event-1' },
    })
    expect(mockTeamMemberDelete).toHaveBeenCalledWith({
      where: { id: 'tm-1' },
    })
    expect(mockPurgeUserCache).toHaveBeenCalledWith('user-to-remove', 'staff@example.com')
  })
})
