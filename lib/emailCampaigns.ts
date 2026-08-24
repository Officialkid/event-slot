import { sendCampaignEmail } from '@/lib/email'
import prisma from '@/lib/prisma'

const BATCH_SIZE = 50

/**
 * Personalise a plain-text body with attendee name and event title,
 * then wrap it in a minimal HTML email shell matching the EventSlot style.
 */
function buildEmailHtml(body: string, name: string, eventTitle: string): string {
  const personalised = body
    .replace(/\{\{name\}\}/g, name || 'there')
    .replace(/\{\{event\}\}/g, eventTitle)

  // Convert line breaks to <br> for HTML
  const html = personalised.replace(/\n/g, '<br/>')

  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:2rem;background:#0A0A0A;color:#F0EDE6">
      <div style="color:#C8F55A;font-size:0.9rem;font-weight:600;margin-bottom:1.75rem;letter-spacing:0.04em">EventSlot</div>
      <div style="font-size:0.93rem;line-height:1.75;color:rgba(240,237,230,0.8)">${html}</div>
      <div style="border-top:0.5px solid rgba(240,237,230,0.1);margin-top:2rem;padding-top:1rem;font-size:0.75rem;color:rgba(240,237,230,0.3)">
        You are receiving this email because you registered for <strong style="color:rgba(240,237,230,0.6)">${eventTitle}</strong> via EventSlot.
      </div>
    </div>
  `.trim()
}

export async function sendBulkEmails(
  campaignId: string,
  recipients: { email: string; name: string }[],
  subject: string,
  body: string,
  eventTitle: string
): Promise<void> {
  let successCount = 0
  let firstFailureReason: string | null = null

  if (!recipients || recipients.length === 0) {
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'FAILED',
        sentAt: new Date(),
        recipientCount: 0,
        failureReason: 'No confirmed recipients found for this event.',
      },
    })
    return
  }

  try {
    // Process in controlled rate-safe sub-batches (2 emails per second)
    const CHUNK_SIZE = 2
    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      const batch = recipients.slice(i, i + CHUNK_SIZE)
      const results = await Promise.allSettled(
        batch.map((r) =>
          sendCampaignEmail({
            to: r.email,
            subject,
            html: buildEmailHtml(body, r.name, eventTitle),
          })
        )
      )
      successCount += results.filter((r) => r.status === 'fulfilled').length
      const failures = results.filter((r) => r.status === 'rejected')
      if (failures.length > 0) {
        failures.forEach((f, index) => {
          const reason = (f as PromiseRejectedResult).reason
          const message = reason instanceof Error ? reason.message : String(reason)
          const failedRecipient = batch[index]?.email ?? 'unknown recipient'
          console.error(`[emailCampaigns] Failed to send to ${failedRecipient}:`, message)
          if (!firstFailureReason) firstFailureReason = message
        })
      }
      // 550ms delay between pairs to strictly comply with Resend rate limits
      if (i + CHUNK_SIZE < recipients.length) {
        await new Promise((res) => setTimeout(res, 550))
      }
    }

    const finalStatus = successCount === 0 ? 'FAILED' : 'SENT'
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: finalStatus,
        sentAt: new Date(),
        recipientCount: successCount,
        failureReason: finalStatus === 'FAILED' ? (firstFailureReason ?? 'Unknown error') : null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[emailCampaigns] Bulk send failed:', err)
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: successCount > 0 ? 'SENT' : 'FAILED',
        sentAt: new Date(),
        recipientCount: successCount,
        failureReason: successCount > 0 ? null : message,
      },
    })
  }
}
