/** @jest-environment node */

const mockTeamMemberFindFirst = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    teamMember: {
      findFirst: (...args: unknown[]) => mockTeamMemberFindFirst(...args),
    },
  },
}))

describe('hasTeamEventAccess', () => {
  beforeEach(() => {
    jest.resetModules()
    mockTeamMemberFindFirst.mockReset()
  })

  it('does not grant owner access through the team-member helper', async () => {
    const { hasTeamEventAccess } = await import('@/lib/eventAccess')

    await expect(
      hasTeamEventAccess({
        userId: 'owner-1',
        organizerId: 'owner-1',
        eventId: 'event-1',
      })
    ).resolves.toBe(false)

    expect(mockTeamMemberFindFirst).not.toHaveBeenCalled()
  })

  it('does not grant accepted team members access without an explicit event assignment', async () => {
    mockTeamMemberFindFirst.mockResolvedValue({
      id: 'member-1',
      _count: { eventAccess: 0 },
      eventAccess: [],
    })

    const { hasTeamEventAccess } = await import('@/lib/eventAccess')

    await expect(
      hasTeamEventAccess({
        userId: 'member-user-1',
        organizerId: 'owner-1',
        eventId: 'event-1',
      })
    ).resolves.toBe(false)

    expect(mockTeamMemberFindFirst).toHaveBeenCalledWith({
      where: {
        ownerId: 'owner-1',
        memberId: 'member-user-1',
        status: 'accepted',
      },
      select: {
        id: true,
        _count: { select: { eventAccess: true } },
        eventAccess: {
          where: { eventId: 'event-1' },
          select: { id: true },
          take: 1,
        },
      },
    })
  })

  it('grants accepted team members access only when the event is explicitly assigned', async () => {
    mockTeamMemberFindFirst.mockResolvedValue({
      id: 'member-1',
      _count: { eventAccess: 1 },
      eventAccess: [{ id: 'access-1' }],
    })

    const { hasTeamEventAccess } = await import('@/lib/eventAccess')

    await expect(
      hasTeamEventAccess({
        userId: 'member-user-1',
        organizerId: 'owner-1',
        eventId: 'event-1',
      })
    ).resolves.toBe(true)
  })
})
