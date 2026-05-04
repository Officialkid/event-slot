const sendMock = jest.fn()

jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: sendMock,
      },
    })),
  }
})

describe('lib/email resend integration', () => {
  beforeEach(() => {
    jest.resetModules()
    sendMock.mockReset()
    process.env.RESEND_API_KEY = 'test_resend_key'
    process.env.RESEND_FROM = 'EventSlot <noreply@eventsslot.com>'
    process.env.NEXTAUTH_URL = 'https://www.eventsslot.com'
  })

  it('sends welcome email through Resend with configured sender', async () => {
    sendMock.mockResolvedValue({ error: null })

    const emailLib = await import('@/lib/email')
    await emailLib.sendWelcomeEmail({ to: 'user@example.com', name: 'Daniel' })

    expect(sendMock).toHaveBeenCalledTimes(1)
    const payload = sendMock.mock.calls[0][0]
    expect(payload.to).toBe('user@example.com')
    expect(payload.from).toBe('EventSlot <noreply@eventsslot.com>')
    expect(payload.subject).toContain('Welcome to EventSlot')
  })

  it('builds feedback request email with feedback link and sends via Resend', async () => {
    sendMock.mockResolvedValue({ error: null })

    const emailLib = await import('@/lib/email')
    await emailLib.sendFeedbackRequestEmail({
      to: 'attendee@example.com',
      eventTitle: 'Virtual Demo',
      registrationId: 'reg_123',
    })

    expect(sendMock).toHaveBeenCalledTimes(1)
    const payload = sendMock.mock.calls[0][0]
    expect(payload.to).toBe('attendee@example.com')
    expect(payload.subject).toContain('How was Virtual Demo?')
    expect(payload.html).toContain('/feedback/reg_123')
  })
})
