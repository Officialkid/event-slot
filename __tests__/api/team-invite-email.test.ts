/** @jest-environment node */

import { NextRequest } from 'next/server'

const mockGetServerSession = jest.fn()
const mockUserFindUnique = jest.fn()
const mockTeamMemberCount = jest.fn()
const mockTeamMemberFindFirst = jest.fn()
const mockTeamMemberCreate = jest.fn()
const mockTeamMemberEventCreate = jest.fn()
const mockEventFindFirst = jest.fn()
const mockSendTeamInviteEmail = jest.fn()

jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    teamMember: {
      count: (...args: unknown[]) => mockTeamMemberCount(...args),
      findFirst: (...args: unknown[]) => mockTeamMemberFindFirst(...args),
      create: (...args: unknown[]) => mockTeamMemberCreate(...args),
    },
    teamMemberEvent: {
      create: (...args: unknown[]) => mockTeamMemberEventCreate(...args),
    },
    event: {
      findFirst: (...args: unknown[]) => mockEventFindFirst(...args),
    },
  },
}))

jest.mock('@/lib/email', () => ({
  sendTeamInviteEmail: (...args: unknown[]) => mockSendTeamInviteEmail(...args),
}))

jest.mock('uuid', () => ({
  v4: () => 'invite-token-123',
}))

function inviteRequest(body: unknown) {
  return new NextRequest('https://www.eventsslot.com/api/team/invite', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/team/invite email delivery', () => {
  beforeEach(() => {
    jest.resetModules()
    mockGetServerSession.mockReset()
    mockUserFindUnique.mockReset()
    mockTeamMemberCount.mockReset()
    mockTeamMemberFindFirst.mockReset()
    mockTeamMemberCreate.mockReset()
    mockTeamMemberEventCreate.mockReset()
    mockEventFindFirst.mockReset()
    mockSendTeamInviteEmail.mockReset()

    mockGetServerSession.mockResolvedValue({
      user: { id: 'owner-1', email: 'owner@example.com' },
    })
    mockUserFindUnique.mockResolvedValue({
      name: 'EventSlot Owner',
      email: 'owner@example.com',
      plan: 'free',
    })
    mockTeamMemberCount.mockResolvedValue(0)
    mockTeamMemberFindFirst.mockResolvedValue(null)
    mockTeamMemberCreate.mockResolvedValue({ id: 'member-1' })
    mockTeamMemberEventCreate.mockResolvedValue({ id: 'member-event-1' })
    mockEventFindFirst.mockResolvedValue({ id: 'event-1' })
    mockSendTeamInviteEmail.mockResolvedValue(undefined)
  })

  it('sends a team invite email with the generated invite token', async () => {
    const { POST } = await import('@/app/api/team/invite/route')
    const response = await POST(inviteRequest({ emails: ['helper@example.com'] }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.sent).toBe(1)
    expect(body.emailFailed).toBe(false)
    expect(mockTeamMemberCreate).toHaveBeenCalledWith({
      data: { ownerId: 'owner-1', email: 'helper@example.com', status: 'pending', inviteToken: 'invite-token-123' },
    })
    expect(mockSendTeamInviteEmail).toHaveBeenCalledWith({
      to: 'helper@example.com',
      inviterName: 'EventSlot Owner',
      inviteToken: 'invite-token-123',
    })
  })

  it('keeps the invite link available when email delivery fails', async () => {
    mockSendTeamInviteEmail.mockRejectedValue(new Error('Resend temporarily unavailable'))

    const { POST } = await import('@/app/api/team/invite/route')
    const response = await POST(inviteRequest({ emails: ['helper@example.com'] }))
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body.sent).toBe(0)
    expect(body.emailFailed).toBe(true)
    expect(body.results[0]).toMatchObject({
      email: 'helper@example.com',
      ok: true,
      emailFailed: true,
      acceptUrl: expect.stringContaining('/team/accept?token=invite-token-123'),
    })
  })
})

export {}
