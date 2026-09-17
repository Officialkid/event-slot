const resendSendMock = jest.fn()
const nodemailerSendMailMock = jest.fn()
const createTransportMock = jest.fn()

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: resendSendMock,
    },
  })),
}))

jest.mock('nodemailer', () => ({
  createTransport: (...args: unknown[]) => createTransportMock(...args),
}))

describe('lib/email Nodemailer primary with Resend failover', () => {
  beforeEach(() => {
    jest.resetModules()
    resendSendMock.mockReset()
    nodemailerSendMailMock.mockReset()
    createTransportMock.mockReset()

    createTransportMock.mockReturnValue({
      sendMail: nodemailerSendMailMock,
    })

    // Configure both SMTP and Resend in env
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_PORT = '587'
    process.env.SMTP_USER = 'smtp-user'
    process.env.SMTP_PASSWORD = 'smtp-password'
    process.env.SMTP_FROM = 'EventSlot <hello@eventsslot.com>'
    process.env.RESEND_API_KEY = 'test-resend-key'
    delete process.env.EMAIL_PROVIDER
  })

  afterEach(() => {
    delete process.env.SMTP_HOST
    delete process.env.SMTP_PORT
    delete process.env.SMTP_USER
    delete process.env.SMTP_PASSWORD
    delete process.env.SMTP_FROM
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_PROVIDER
  })

  it('sends via Nodemailer (SMTP) as primary when SMTP is configured', async () => {
    nodemailerSendMailMock.mockResolvedValueOnce({ messageId: 'msg-123' })

    const { sendEmail } = await import('@/lib/email')
    await sendEmail({
      to: 'attendee@example.com',
      subject: 'Test Subject',
      html: '<p>Hello</p>',
    })

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pool: true,
        host: 'smtp.example.com',
        port: 587,
      })
    )
    expect(nodemailerSendMailMock).toHaveBeenCalledTimes(1)
    expect(resendSendMock).not.toHaveBeenCalled()
  })

  it('fails over to Resend when Nodemailer throws an error', async () => {
    nodemailerSendMailMock.mockRejectedValueOnce(new Error('Connection timeout'))
    resendSendMock.mockResolvedValueOnce({ error: null })

    const { sendEmail } = await import('@/lib/email')
    await sendEmail({
      to: 'attendee@example.com',
      subject: 'Test Failover',
      html: '<p>Hello Failover</p>',
    })

    expect(nodemailerSendMailMock).toHaveBeenCalledTimes(1)
    expect(resendSendMock).toHaveBeenCalledTimes(1)
    const resendPayload = resendSendMock.mock.calls[0][0]
    expect(resendPayload.to).toBe('attendee@example.com')
    expect(resendPayload.subject).toBe('Test Failover')
  })

  it('throws an error if both Nodemailer and Resend fail', async () => {
    nodemailerSendMailMock.mockRejectedValueOnce(new Error('SMTP Auth Error'))
    resendSendMock.mockResolvedValueOnce({ error: { message: 'Resend rate limit 429' } })

    const { sendEmail } = await import('@/lib/email')
    await expect(
      sendEmail({
        to: 'attendee@example.com',
        subject: 'Double Fail',
        html: '<p>Double Fail</p>',
      })
    ).rejects.toThrow(/both primary.*SMTP.*backup.*Resend/i)

    expect(nodemailerSendMailMock).toHaveBeenCalledTimes(1)
    expect(resendSendMock).toHaveBeenCalledTimes(1)
  })

  it('sends directly via Resend if SMTP is not configured', async () => {
    delete process.env.SMTP_HOST
    resendSendMock.mockResolvedValueOnce({ error: null })

    const { sendEmail } = await import('@/lib/email')
    await sendEmail({
      to: 'attendee@example.com',
      subject: 'Direct Resend',
      html: '<p>Direct Resend</p>',
    })

    expect(nodemailerSendMailMock).not.toHaveBeenCalled()
    expect(resendSendMock).toHaveBeenCalledTimes(1)
  })
})
