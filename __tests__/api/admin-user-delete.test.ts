/** @jest-environment node */

import { NextRequest } from 'next/server'

const mockGetServerSession = jest.fn()
const mockHasAdminAccess = jest.fn()
const mockIsAdminEmail = jest.fn()
const mockUserFindUnique = jest.fn()
const mockEventFindMany = jest.fn()
const mockTransaction = jest.fn()

const tx = {
  event: {
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  eventPass: {
    updateMany: jest.fn(),
  },
  referral: { deleteMany: jest.fn() },
  organizerFeedback: { deleteMany: jest.fn() },
  eventUnlock: { deleteMany: jest.fn() },
  message: { updateMany: jest.fn() },
  user: { delete: jest.fn() },
}

jest.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock('@/lib/auth', () => ({
  authOptions: {},
}))

jest.mock('@/lib/isAdmin', () => ({
  hasAdminAccess: (...args: unknown[]) => mockHasAdminAccess(...args),
  isAdminEmail: (...args: unknown[]) => mockIsAdminEmail(...args),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    event: {
      findMany: (...args: unknown[]) => mockEventFindMany(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

function deleteRequest(body?: unknown) {
  return new NextRequest('https://www.eventsslot.com/api/admin/users/user-1', {
    method: 'DELETE',
    body: body ? JSON.stringify(body) : undefined,
  })
}

describe('DELETE /api/admin/users/[id]', () => {
  beforeEach(() => {
    jest.resetModules()
    mockGetServerSession.mockReset()
    mockHasAdminAccess.mockReset()
    mockIsAdminEmail.mockReset()
    mockUserFindUnique.mockReset()
    mockEventFindMany.mockReset()
    mockTransaction.mockReset()
    Object.values(tx).forEach((model) => {
      Object.values(model).forEach((fn) => (fn as jest.Mock).mockReset())
    })

    mockGetServerSession.mockResolvedValue({ user: { id: 'admin-1', email: 'admin@eventsslot.com' } })
    mockHasAdminAccess.mockReturnValue(true)
    mockIsAdminEmail.mockReturnValue(false)
    mockEventFindMany.mockResolvedValue([])
    mockTransaction.mockImplementation(async (callback: (txArg: typeof tx) => Promise<void>) => {
      await callback(tx)
    })
  })

  it('blocks deleting users with owned events until an event handling choice is provided', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Owner',
      _count: { events: 2 },
    })

    const { DELETE } = await import('@/app/api/admin/users/[id]/route')
    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: 'user-1' }) })
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.code).toBe('OWNED_EVENTS_BLOCK_DELETE')
    expect(mockTransaction).not.toHaveBeenCalled()
  })

  it('deletes owned events and cleanup records when admin chooses delete handling', async () => {
    mockUserFindUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      name: 'Owner',
      _count: { events: 1 },
    })

    const { DELETE } = await import('@/app/api/admin/users/[id]/route')
    const response = await DELETE(deleteRequest({ eventHandling: 'delete' }), {
      params: Promise.resolve({ id: 'user-1' }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true, eventHandling: 'delete', ownedEventCount: 1 })
    expect(tx.event.deleteMany).toHaveBeenCalledWith({ where: { organizerId: 'user-1' } })
    expect(tx.referral.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ referrerId: 'user-1' }, { referredUserId: 'user-1' }],
      },
    })
    expect(tx.organizerFeedback.deleteMany).toHaveBeenCalledWith({ where: { organizerId: 'user-1' } })
    expect(tx.eventUnlock.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    expect(tx.message.updateMany).toHaveBeenCalledWith({
      where: { authorId: 'user-1' },
      data: { authorId: null },
    })
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } })
  })

  it('prevents deleting a super admin account', async () => {
    mockIsAdminEmail.mockReturnValue(true)
    mockUserFindUnique.mockResolvedValue({
      id: 'super-1',
      email: 'admin@eventsslot.com',
      name: 'Admin',
      _count: { events: 0 },
    })

    const { DELETE } = await import('@/app/api/admin/users/[id]/route')
    const response = await DELETE(deleteRequest(), { params: Promise.resolve({ id: 'super-1' }) })

    expect(response.status).toBe(400)
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})

export {}
