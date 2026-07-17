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
      email: 'invitee@example.com',
      status: 'pending',
      createdAt: new Date('2026-07-16T10:00:00.000Z'),
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

  it('blocks accepting an invite with the wrong signed-in email', async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: 'user-1', email: 'wrong@example.com' },
    })

    const TeamAcceptPage = (await import('@/app/team/accept/page')).default
    const element = await TeamAcceptPage({ searchParams: Promise.resolve({ token: 'invite-token' }) })
    render(element)

    expect(screen.getByText('This invite belongs to a different email')).toBeInTheDocument()
    expect(screen.getByText(/invitee@example\.com/)).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockPurgeUserCache).not.toHaveBeenCalled()
  })
})
