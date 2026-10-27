import { sendCampaignEmail } from '@/lib/email'
import prisma from '@/lib/prisma'

/**
 * Personalise a plain-text body with attendee name and event title,
 * auto-link URLs, and wrap it in a clean HTML email shell matching the EventSlot style.
 */
export function buildEmailHtml(body: string, name: string, eventTitle: string): string {
  const personalised = body
    .replace(/\{\{name\}\}/g, name || 'there')
    .replace(/\{\{event\}\}/g, eventTitle)

  // Escape raw HTML entities before auto-linking and converting newlines
  const escaped = personalised
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Auto-link https:// and http:// URLs so links in plain-text campaigns are clickable
  const withLinks = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#C8F55A;text-decoration:underline;word-break:break-all">${url}</a>`
  )

  // Convert line breaks to <br> for HTML
  const html = withLinks.replace(/\n/g, '<br/>')

  return `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:2rem;background:#0A0A0A;color:#F0EDE6">
      <div style="color:#C8F55A;font-size:0.9rem;font-weight:600;margin-bottom:1.75rem;letter-spacing:0.04em">EventSlot</div>
      <div style="font-size:0.93rem;line-height:1.75;color:rgba(240,237,230,0.88)">${html}</div>
      <div style="border-top:0.5px solid rgba(240,237,230,0.1);margin-top:2rem;padding-top:1rem;font-size:0.75rem;color:rgba(240,237,230,0.3)">
        You are receiving this email because you registered for <strong style="color:rgba(240,237,230,0.6)">${eventTitle}</strong> via EventSlot.
      </div>
    </div>
  `.trim()
}

export interface BulkEmailSendResult {
  status: 'SENT' | 'FAILED'
  sentCount: number
  failedCount: number
  failureReason: string | null
}

export async function sendBulkEmails(
  campaignId: string,
  recipients: { email: string; name: string }[],
  subject: string,
  body: string,
  eventTitle: string
): Promise<BulkEmailSendResult> {
  let successCount = 0
  let failedCount = 0
  let firstFailureReason: string | null = null

  if (!recipients || recipients.length === 0) {
    const failureReason = 'No confirmed recipients found for this event.'
    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: 'FAILED',
        sentAt: new Date(),
        recipientCount: 0,
        failureReason,
      },
    })
    return { status: 'FAILED', sentCount: 0, failedCount: 0, failureReason }
  }

  try {
    // Process in concurrent batches of 10 with 150ms pacing so 300+ recipients
    // complete reliably within a single Cloud Run request lifecycle.
    const CHUNK_SIZE = 10
    for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
      const batch = recipients.slice(i, i + CHUNK_SIZE)
      const results = await Promise.allSettled(
        batch.map((r) =>
          sendCampaignEmail({
            to: r.email,
            subject: subject
              .replace(/\{\{name\}\}/g, r.name || 'there')
              .replace(/\{\{event\}\}/g, eventTitle),
            html: buildEmailHtml(body, r.name, eventTitle),
          })
        )
      )
      const batchSucceeded = results.filter((r) => r.status === 'fulfilled').length
      successCount += batchSucceeded
      const failures = results.filter((r) => r.status === 'rejected')
      failedCount += failures.length

      if (failures.length > 0) {
        failures.forEach((f, index) => {
          const reason = (f as PromiseRejectedResult).reason
          const message = reason instanceof Error ? reason.message : String(reason)
          const failedRecipient = batch[index]?.email ?? 'unknown recipient'
          console.error(`[emailCampaigns] Failed to send to ${failedRecipient}:`, message)
          if (!firstFailureReason) firstFailureReason = message
        })
      }

      // Periodically persist progress every 50 emails so the dashboard reflects live count
      if ((i + CHUNK_SIZE) % 50 === 0 && i + CHUNK_SIZE < recipients.length) {
        await prisma.emailCampaign.update({
          where: { id: campaignId },
          data: { recipientCount: successCount },
        }).catch(() => {})
      }

      if (i + CHUNK_SIZE < recipients.length) {
        await new Promise((res) => setTimeout(res, 150))
      }
    }

    const finalStatus = successCount === 0 ? 'FAILED' : 'SENT'
    const finalFailureReason = finalStatus === 'FAILED' ? (firstFailureReason ?? 'Unknown error') : null

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: finalStatus,
        sentAt: new Date(),
        recipientCount: successCount,
        failureReason: finalFailureReason,
      },
    })

    return {
      status: finalStatus,
      sentCount: successCount,
      failedCount,
      failureReason: finalFailureReason,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[emailCampaigns] Bulk send failed:', err)
    const finalStatus = successCount > 0 ? 'SENT' : 'FAILED'
    const finalFailureReason = successCount > 0 ? null : message

    await prisma.emailCampaign.update({
      where: { id: campaignId },
      data: {
        status: finalStatus,
        sentAt: new Date(),
        recipientCount: successCount,
        failureReason: finalFailureReason,
      },
    })

    return {
      status: finalStatus,
      sentCount: successCount,
      failedCount,
      failureReason: finalFailureReason,
    }
  }
}
