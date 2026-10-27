import prisma from '@/lib/prisma'
import { sendEmail } from '@/lib/email'
import { APP_URL } from '@/lib/config'
import { generateFollowerUnsubscribeToken } from '@/lib/followerSecurity'

interface DispatchResult {
  sent: number
  skipped: number
  reason?: string
}

function formatAnnouncementDate(eventDate: Date | null | undefined): string {
  if (!eventDate) return 'Date to be announced'
  try {
    return new Date(eventDate).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return 'Date to be announced'
  }
}

/**
 * Dispatches new-event email announcements to eligible followers when an event
 * is publicly published for the first time.
 * Strictly idempotent: prevents duplicate blasts on retries or subsequent edits.
 */
export async function dispatchNewEventAnnouncements(eventId: string): Promise<DispatchResult> {
  try {
    // 1. Fetch event with organizer details
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        organizer: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    })

    if (!event) {
      return { sent: 0, skipped: 0, reason: 'EVENT_NOT_FOUND' }
    }

    // 2. Strict eligibility checks: must be PUBLIC, active, not archived, and not previously sent
    if (event.visibility !== 'PUBLIC' || event.status !== 'active' || event.archived) {
      return { sent: 0, skipped: 0, reason: 'EVENT_NOT_ELIGIBLE_FOR_ANNOUNCEMENT' }
    }

    if (event.announcementSentAt) {
      return { sent: 0, skipped: 0, reason: 'ALREADY_ANNOUNCED' }
    }

    if (!event.organizerId || !event.organizer) {
      return { sent: 0, skipped: 0, reason: 'NO_ORGANIZER' }
    }

    // 3. Atomically record announcement timestamp to guarantee idempotency
    await prisma.event.update({
      where: { id: event.id },
      data: {
        announcementSentAt: new Date(),
        firstPublishedAt: event.firstPublishedAt || new Date(),
      },
    })

    // 4. Query followers who opted into new-event emails
    const followers = await prisma.organiserFollower.findMany({
      where: {
        organiserId: event.organizerId,
        notifyNewEvents: true,
      },
      include: {
        follower: {
          select: {
            id: true,
            email: true,
            name: true,
            emailBounceCount: true,
            marketingConsent: true,
          },
        },
      },
    })

    const organiserName = event.organizerName || event.organizer.name || event.organizer.username || 'Organiser'
    const eventUrl = `${APP_URL}/${event.slug}`
    const dateLabel = formatAnnouncementDate(event.eventDate)
    const formatBadge = event.eventType === 'VIRTUAL' ? '💻 Virtual Event (Online)' : `📍 ${event.location || 'Venue details on page'}`

    let sentCount = 0
    let skippedCount = 0

    for (const record of followers) {
      const recipient = record.follower
      if (!recipient.email || recipient.emailBounceCount > 0) {
        skippedCount++
        continue
      }

      // Generate 1-click signed unsubscribe token
      const token = generateFollowerUnsubscribeToken(recipient.id, event.organizerId)
      const unsubscribeUrl = `${APP_URL}/api/notifications/unsubscribe?token=${token}`
      const firstName = recipient.name ? recipient.name.trim().split(/\s+/)[0] : 'there'
      const priceLabel = event.entryFeeLabel || (event.isPaid ? 'Paid Ticket' : 'FREE Entry')

      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0A0A0A; color: #FFFFFF; margin: 0; padding: 24px 16px; }
    .container { max-width: 560px; margin: 0 auto; background: #141414; border: 1px solid #282828; border-radius: 16px; overflow: hidden; }
    .header { padding: 28px 24px 18px; text-align: left; }
    .badge { display: inline-block; background: rgba(200, 245, 90, 0.14); color: #C8F55A; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; padding: 5px 12px; border-radius: 100px; margin-bottom: 14px; border: 1px solid rgba(200, 245, 90, 0.28); }
    .intro { font-size: 14px; color: #D4D4D4; line-height: 1.6; margin: 0 0 14px; }
    h1 { font-size: 24px; font-weight: 700; margin: 0 0 6px; color: #FFFFFF; line-height: 1.25; }
    .host { font-size: 13px; color: #A0A0A0; margin: 0 0 16px; }
    .card { background: #1E1E1E; border-radius: 12px; padding: 16px; margin: 0 24px 24px; border: 1px solid #2F2F2F; }
    .detail { font-size: 14px; color: #E0E0E0; margin: 7px 0; }
    .cta-container { padding: 0 24px 28px; text-align: center; }
    .cta-btn { display: inline-block; width: 100%; box-sizing: border-box; background: #C8F55A; color: #0A0A0A; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 24px; border-radius: 12px; text-align: center; }
    .footer { border-top: 1px solid #262626; padding: 20px 24px; font-size: 12px; color: #737373; text-align: center; line-height: 1.5; }
    .footer a { color: #A0A0A0; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="badge">⚡ Follower First Access · Just Dropped</span>
      <p class="intro">Hey ${firstName}, <strong>${organiserName}</strong> just published a new event on EventSlot — and because you follow them, you're getting first access to check it out and claim your spot!</p>
      <h1>${event.title}</h1>
      <p class="host">Hosted by <strong>${organiserName}</strong></p>
    </div>

    ${event.imageUrl ? `<div style="padding: 0 24px 20px;"><img src="${event.imageUrl}" alt="${event.title}" style="width: 100%; max-height: 320px; object-fit: cover; border-radius: 12px;" /></div>` : ''}

    <div class="card">
      <div class="detail"><strong>🗓️ Date:</strong> ${dateLabel}</div>
      <div class="detail"><strong>${formatBadge}</strong></div>
      <div class="detail"><strong>🎟️ Entry:</strong> ${priceLabel}</div>
    </div>

    <div class="cta-container">
      <a href="${eventUrl}" class="cta-btn">Claim Your Spot Now →</a>
    </div>

    <div class="footer">
      You received this first-look alert because you follow <strong>${organiserName}</strong> on EventSlot.<br>
      <a href="${unsubscribeUrl}">Unsubscribe from ${organiserName}'s event alerts</a> • <a href="${APP_URL}/events">Discover more events</a>
    </div>
  </div>
</body>
</html>
      `.trim()

      try {
        await sendEmail({
          to: recipient.email,
          subject: `🎟️ Just Dropped: ${organiserName} just announced "${event.title}"`,
          html: htmlBody,
          category: 'marketing',
          unsubscribeUrl,
        })
        sentCount++
      } catch (err) {
        console.warn(`[followerAnnouncements] Failed to send email to ${recipient.email}:`, err)
        skippedCount++
      }
    }

    return { sent: sentCount, skipped: skippedCount }
  } catch (error) {
    console.error('[followerAnnouncements Error]', error)
    return { sent: 0, skipped: 0, reason: 'INTERNAL_ERROR' }
  }
}
