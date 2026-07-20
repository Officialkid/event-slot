/** @jest-environment node */

const mockEventFindUnique = jest.fn()
const mockHasTeamEventAccess = jest.fn()
const mockCookies = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    event: {
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
    },
  },
}))

jest.mock('@/lib/eventAccess', () => ({
  hasTeamEventAccess: (...args: unknown[]) => mockHasTeamEventAccess(...args),
}))

jest.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}))

describe('admin mode organiser access', () => {
  beforeEach(() => {
    jest.resetModules()
    mockEventFindUnique.mockReset()
    mockHasTeamEventAccess.mockReset()
    mockCookies.mockReset()

    mockEventFindUnique.mockResolvedValue({ organizerId: 'owner-1' })
    mockHasTeamEventAccess.mockResolvedValue(false)
    mockCookies.mockResolvedValue({
      get: jest.fn(() => undefined),
    })
  })

  it('allows a configured super admin to execute organiser-level commands without event admin-mode cookie', async () => {
    const { hasOrganiserAccess } = await import('@/lib/adminMode')

    await expect(
      hasOrganiserAccess(
        {
          user: {
            id: 'super-admin-1',
            email: 'eventslot.co@gmail.com',
            role: 'SUPER_ADMIN',
            isAdmin: true,
          },
        },
        'event-1',
      ),
    ).resolves.toBe(true)

    expect(mockHasTeamEventAccess).not.toHaveBeenCalled()
  })

  it('still denies unrelated non-admin users without ownership, team access, or admin-mode cookie', async () => {
    const { hasOrganiserAccess } = await import('@/lib/adminMode')

    await expect(
      hasOrganiserAccess(
        {
          user: {
            id: 'viewer-1',
            email: 'viewer@example.com',
            role: 'ATTENDEE',
            isAdmin: false,
          },
        },
        'event-1',
      ),
    ).resolves.toBe(false)
  })
})

export {}
