/** @jest-environment node */

const mockGetServerSession = jest.fn()
const mockEventUpdateMany = jest.fn()
const mockTeamMemberFindMany = jest.fn()
const mockEventFindMany = jest.fn()
const mockEventCount = jest.fn()
const mockSyncEventPassStatusForEvent = jest.fn()

jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/cache', () => ({
  eventListCache: {
    get: jest.fn(() => undefined),
    set: jest.fn(),
  },
}))

jest.mock('@/lib/eventPasses', () => ({
  syncEventPassStatusForEvent: (...args: unknown[]) => mockSyncEventPassStatusForEvent(...args),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    event: {
      updateMany: (...args: unknown[]) => mockEventUpdateMany(...args),
      findMany: (...args: unknown[]) => mockEventFindMany(...args),
      count: (...args: unknown[]) => mockEventCount(...args),
    },
    teamMember: {
      findMany: (...args: unknown[]) => mockTeamMemberFindMany(...args),
    },
  },
}))

function makeRequest(url = 'https://www.eventsslot.com/api/my-events') {
  return new Request(url)
}

describe('GET /api/my-events team access', () => {
  beforeEach(() => {
    jest.resetModules()
    mockGetServerSession.mockReset()
    mockEventUpdateMany.mockReset()
    mockTeamMemberFindMany.mockReset()
    mockEventFindMany.mockReset()
    mockEventCount.mockReset()
    mockSyncEventPassStatusForEvent.mockReset()

    mockGetServerSession.mockResolvedValue({
      user: {
        id: 'member-user-1',
        email: 'member@example.com',
      },
    })
    mockEventUpdateMany.mockResolvedValue({ count: 0 })
    mockEventFindMany.mockResolvedValue([])
    mockEventCount.mockResolvedValue(0)
    mockSyncEventPassStatusForEvent.mockResolvedValue(null)
  })

  it('includes explicitly assigned team event IDs and no unassigned owner-wide access', async () => {
    mockTeamMemberFindMany.mockResolvedValue([
      {
        eventAccess: [{ eventId: 'event-assigned-1' }],
      },
    ])

    const { GET } = await import('@/app/api/my-events/route')
    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    expect(mockEventFindMany).toHaveBeenCalledTimes(1)
    const query = mockEventFindMany.mock.calls[0][0]
    expect(query.where.OR).toEqual([
      { organizerId: 'member-user-1' },
      { organizerEmail: 'member@example.com' },
      { id: { in: ['event-assigned-1'] } },
    ])
    expect(query.where.OR).not.toContainEqual({ organizerId: 'owner-1' })
  })

  it('does not add a broad team-event filter when a membership has no event assignments', async () => {
    mockTeamMemberFindMany.mockResolvedValue([{ eventAccess: [] }])

    const { GET } = await import('@/app/api/my-events/route')
    const response = await GET(makeRequest())

    expect(response.status).toBe(200)
    const query = mockEventFindMany.mock.calls[0][0]
    expect(query.where.OR).toEqual([
      { organizerId: 'member-user-1' },
      { organizerEmail: 'member@example.com' },
    ])
  })
})

export {}
