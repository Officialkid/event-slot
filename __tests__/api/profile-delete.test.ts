/** @jest-environment node */

const mockGetServerSession = jest.fn()
const mockUserFindUnique = jest.fn()
const mockTransaction = jest.fn()

const tx = {
  event: { deleteMany: jest.fn() },
  organizerFeedback: { deleteMany: jest.fn() },
  eventUnlock: { deleteMany: jest.fn() },
  referral: { deleteMany: jest.fn() },
  message: { updateMany: jest.fn() },
  user: { delete: jest.fn() },
}

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
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

describe('DELETE /api/profile', () => {
  beforeEach(() => {
    jest.resetModules()
    mockGetServerSession.mockReset()
    mockUserFindUnique.mockReset()
    mockTransaction.mockReset()
    Object.values(tx).forEach((model) => {
      Object.values(model).forEach((fn) => (fn as jest.Mock).mockReset())
    })

    mockTransaction.mockImplementation(async (callback: (txArg: typeof tx) => Promise<void>) => {
      await callback(tx)
    })
  })

  it('deletes the signed-in user and cleans non-cascading data first', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user-1' } })
    mockUserFindUnique.mockResolvedValue({ id: 'user-1', email: 'owner@example.com' })

    const { DELETE } = await import('@/app/api/profile/route')
    const response = await DELETE()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({ success: true })
    expect(tx.event.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ organizerId: 'user-1' }, { organizerEmail: 'owner@example.com' }],
      },
    })
    expect(tx.organizerFeedback.deleteMany).toHaveBeenCalledWith({ where: { organizerId: 'user-1' } })
    expect(tx.eventUnlock.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    expect(tx.referral.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ referrerId: 'user-1' }, { referredUserId: 'user-1' }],
      },
    })
    expect(tx.message.updateMany).toHaveBeenCalledWith({
      where: { authorId: 'user-1' },
      data: { authorId: null },
    })
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } })
  })

  it('rejects unauthenticated account deletion', async () => {
    mockGetServerSession.mockResolvedValue(null)

    const { DELETE } = await import('@/app/api/profile/route')
    const response = await DELETE()

    expect(response.status).toBe(401)
    expect(mockTransaction).not.toHaveBeenCalled()
  })
})

export {}
