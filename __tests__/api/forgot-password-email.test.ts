/** @jest-environment node */

const mockUserFindFirst = jest.fn()
const mockUserUpdate = jest.fn()
const mockSendPasswordResetEmail = jest.fn()

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  prisma: {
    user: {
      findFirst: (...args: unknown[]) => mockUserFindFirst(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}))

jest.mock('@/lib/email', () => ({
  sendPasswordResetEmail: (...args: unknown[]) => mockSendPasswordResetEmail(...args),
}))

jest.mock('uuid', () => ({
  v4: () => 'raw-reset-token-123',
}))

function forgotPasswordRequest(email: string) {
  return new Request('https://www.eventsslot.com/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/auth/forgot-password email dispatch', () => {
  beforeEach(() => {
    jest.resetModules()
    mockUserFindFirst.mockReset()
    mockUserUpdate.mockReset()
    mockSendPasswordResetEmail.mockReset()

    mockUserFindFirst.mockResolvedValue({ id: 'user-1', email: 'user@example.com' })
    mockUserUpdate.mockResolvedValue({ id: 'user-1' })
    mockSendPasswordResetEmail.mockResolvedValue(undefined)
  })

  it('stores a hashed reset token and sends the raw token by email for existing users', async () => {
    const { POST } = await import('@/app/api/auth/forgot-password/route')
    const response = await POST(forgotPasswordRequest('User@Example.com '))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(mockUserFindFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'User@Example.com', mode: 'insensitive' } },
    })
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        resetToken: expect.not.stringContaining('raw-reset-token-123'),
        resetTokenExpiry: expect.any(Date),
      },
    })
    expect(mockSendPasswordResetEmail).toHaveBeenCalledWith({
      to: 'User@Example.com',
      token: 'raw-reset-token-123',
    })
  })

  it('does not send a reset email when the account does not exist', async () => {
    mockUserFindFirst.mockResolvedValue(null)

    const { POST } = await import('@/app/api/auth/forgot-password/route')
    const response = await POST(forgotPasswordRequest('missing@example.com'))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ ok: true })
    expect(mockUserUpdate).not.toHaveBeenCalled()
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled()
  })
})

export {}
