/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react'

const mockGetServerSession = jest.fn()
const mockFindUnique = jest.fn()
const mockUpdate = jest.fn()
const mockRedirect = jest.fn((value: string) => {
  throw new Error(`REDIRECT:${value}`)
})
const mockNotFound = jest.fn(() => {
  throw new Error('NOT_FOUND')
})
const mockPurgeUserCache = jest.fn()

jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock('next/navigation', () => ({
  redirect: (value: string) => mockRedirect(value),
  notFound: () => mockNotFound(),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/cache', () => ({
  purgeUserCache: (...args: unknown[]) => mockPurgeUserCache(...args),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    teamMember: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

jest.mock('next/link', () => {
  return function MockLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    return <a href={href} {...props}>{children}</a>
  }
})

describe('TeamAcceptPage', () => {
  beforeEach(() => {
    jest.resetModules()
    mockGetServerSession.mockReset()
    mockFindUnique.mockReset()
    mockUpdate.mockReset()
    mockRedirect.mockClear()
    mockNotFound.mockClear()
    mockPurgeUserCache.mockReset()

    mockFindUnique.mockResolvedValue({
      ownerId: 'organizer-1',
      email: 'invitee@example.com',
      status: 'pending',
      createdAt: new Date(),
      owner: { name: 'Owner Name', email: 'owner@example.com' },
      eventAccess: [],
    })
  })

  it('redirects unauthenticated users with an encoded callback URL', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const TeamAcceptPage = (await import('@/app/team/accept/page')).default

    await expect(
      TeamAcceptPage({ searchParams: Promise.resolve({ token: 'abc123==' }) })
    ).rejects.toThrow('REDIRECT:/signin?callbackUrl=%2Fteam%2Faccept%3Ftoken%3Dabc123%253D%253D')
  })

  it('displays a claim option when signed in with a different email', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', email: 'wrong@example.com' },
    })

    const TeamAcceptPage = (await import('@/app/team/accept/page')).default
    const element = await TeamAcceptPage({ searchParams: Promise.resolve({ token: 'invite-token' }) })
    render(element)

    expect(screen.getByText("Join Owner Name's Event Team")).toBeInTheDocument()
    expect(screen.getByText(/invitee@example\.com/)).toBeInTheDocument()
    expect(screen.getByText(/Claim & join team as wrong@example\.com/)).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockPurgeUserCache).not.toHaveBeenCalled()
  })

  it('allows claiming the invite with claim=true when signed in with a different email', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', email: 'claimed@example.com' },
    })
    mockUpdate.mockResolvedValue({})

    const TeamAcceptPage = (await import('@/app/team/accept/page')).default
    const element = await TeamAcceptPage({ searchParams: Promise.resolve({ token: 'invite-token', claim: 'true' }) })
    render(element)

    expect(screen.getByText('Invite accepted!')).toBeInTheDocument()
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { inviteToken: 'invite-token' },
      data: {
        memberId: 'user-1',
        email: 'claimed@example.com',
        status: 'accepted',
      },
    })
    expect(mockPurgeUserCache).toHaveBeenCalledWith('user-1', 'claimed@example.com')
  })

  it('informs the organizer if they open their own invite link', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'organizer-1', email: 'owner@example.com' },
    })

    const TeamAcceptPage = (await import('@/app/team/accept/page')).default
    const element = await TeamAcceptPage({ searchParams: Promise.resolve({ token: 'invite-token' }) })
    render(element)

    expect(screen.getByText('You are the event organizer')).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
