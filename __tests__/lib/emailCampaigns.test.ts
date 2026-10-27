import { buildEmailHtml, sendBulkEmails } from '@/lib/emailCampaigns'
import { sendCampaignEmail } from '@/lib/email'
import prisma from '@/lib/prisma'

jest.mock('@/lib/email', () => ({
  sendCampaignEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    emailCampaign: {
      update: jest.fn().mockResolvedValue({}),
    },
  },
}))

describe('lib/emailCampaigns', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('personalises placeholders and auto-links URLs in buildEmailHtml', () => {
    const html = buildEmailHtml(
      'Hello {{name}},\nJoin {{event}} at:\nhttps://www.eventsslot.com/disruptors-convention-fykf',
      'Daniel',
      'Disruptors Convention'
    )
    expect(html).toContain('Hello Daniel,')
    expect(html).toContain('Join Disruptors Convention at:')
    expect(html).toContain(
      '<a href="https://www.eventsslot.com/disruptors-convention-fykf" target="_blank" rel="noopener noreferrer"'
    )
  })

  it('sends bulk emails and marks campaign as SENT with recipientCount', async () => {
    const result = await sendBulkEmails(
      'camp-123',
      [
        { email: 'alice@example.com', name: 'Alice' },
        { email: 'bob@example.com', name: 'Bob' },
      ],
      'Welcome to {{event}}',
      'Hi {{name}}!',
      'Disruptors Convention'
    )

    expect(sendCampaignEmail).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      status: 'SENT',
      sentCount: 2,
      failedCount: 0,
      failureReason: null,
    })
    expect(prisma.emailCampaign.update).toHaveBeenLastCalledWith({
      where: { id: 'camp-123' },
      data: expect.objectContaining({
        status: 'SENT',
        recipientCount: 2,
        failureReason: null,
      }),
    })
  })
})
