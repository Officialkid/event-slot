import { Resend } from 'resend'
import { getOrCreateReferralLink } from '@/lib/referral'

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }
  return new Resend(apiKey)
}

const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://www.eventsslot.com'
const EMAIL_FROM = process.env.RESEND_FROM?.trim() || 'EventSlot <onboarding@resend.dev>'

async function sendEmail(options: Parameters<Resend['emails']['send']>[0]) {
  const resend = getResendClient()
  const { error } = await resend.emails.send({
    ...options,
    // Always use configured sender to avoid delivery failures from unverified hardcoded domains.
    from: EMAIL_FROM,
  })
  if (error) {
    console.error('[email] Resend send error:', error)
    throw new Error(error.message ?? 'Failed to send email')
  }
}

export async function sendFeedbackRequestEmail({
  to,
  eventTitle,
  registrationId,
}: {
  to: string
  eventTitle: string
  registrationId: string
}) {
  const feedbackUrl = `${BASE_URL}/feedback/${registrationId}`

  await sendEmail({
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: `How was ${eventTitle}? Share your feedback`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#0A0A0A;color:#F0EDE6">
        <div style="color:#C8F55A;font-size:1rem;font-weight:600;margin-bottom:1.5rem">EventSlot</div>
        <h2 style="color:#F0EDE6;font-size:1.3rem;font-weight:400;margin:0 0 1rem">How was ${eventTitle}?</h2>
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 1rem">Thanks for attending. We'd love to hear what you thought â€” it only takes a minute and helps organisers improve future events.</p>
        <p style="margin-top:1.5rem">
          <a href="${feedbackUrl}" style="display:inline-block;background:#C8F55A;color:#0A0A0A;text-decoration:none;padding:0.65rem 1.5rem;border-radius:8px;font-weight:600;font-size:0.9rem">
            Leave feedback
          </a>
        </p>
        <p style="margin-top:2.5rem;color:rgba(240,237,230,0.3);font-size:0.75rem">You received this because you registered for ${eventTitle} via EventSlot.</p>
      </div>
    `,
  })
}

export async function sendTeamInviteEmail({
  to,
  inviterName,
  inviteToken,
}: {
  to: string
  inviterName: string
  inviteToken: string
}) {
  const acceptUrl = `${BASE_URL}/team/accept?token=${inviteToken}`

  await sendEmail({
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: `${inviterName} invited you to join their EventSlot team`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
        <h2 style="color:#0A0A0A">You have been invited</h2>
        <p>${inviterName} has invited you to collaborate on their events in EventSlot.</p>
        <p style="margin-top:1.5rem">
          <a href="${acceptUrl}"
             style="display:inline-block;background:#C8F55A;color:#0A0A0A;
                    padding:12px 24px;border-radius:100px;text-decoration:none;font-weight:500">
            Accept invitation
          </a>
        </p>
        <p style="margin-top:1rem;color:#888;font-size:0.8rem">
          This invite expires in 7 days. If you did not expect this, ignore this email.
        </p>
      </div>
    `,
  })
}

export async function sendSlotConfirmedEmail({
  to,
  eventTitle,
  communityLink,
  consentTransactional,
  ticketUrl,
}: {
  to: string
  eventTitle: string
  communityLink?: string | null
  consentTransactional: boolean
  ticketUrl?: string | null
}) {
  void consentTransactional

  const communitySection = communityLink
    ? `<p style="margin-top:16px">You can now join the event community here: <a href="${communityLink}">${communityLink}</a></p>`
    : ''

  const ticketSection = ticketUrl
    ? `<div style="margin-top:20px;padding:16px;background:#f8f8f8;border-radius:8px;text-align:center"><a href="${ticketUrl}" style="display:inline-block;background:#0A0A0A;color:#C8F55A;text-decoration:none;padding:10px 24px;border-radius:6px;font-size:0.9rem;font-weight:600">View &amp; Download Your Ticket &rarr;</a></div>`
    : ''

  await sendEmail({
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: `Your slot for ${eventTitle} is confirmed`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
        <h2 style="color:#0A0A0A">You're in!</h2>
        <p>Good news &mdash; a slot has opened up and you have been confirmed for <strong>${eventTitle}</strong>.</p>
        <p>Your spot is now secured. We look forward to seeing you there.</p>
        ${ticketSection}
        ${communitySection}
        <p style="margin-top:2rem;color:#888;font-size:0.8rem">You received this because you registered for ${eventTitle} via EventSlot.</p>
      </div>
    `,
  })
}

export async function sendConfirmationEmail({
  to,
  name,
  eventTitle,
  confirmationNumber,
  userId,
}: {
  to: string
  name: string
  eventTitle: string
  confirmationNumber: string
  userId?: string | null
}) {
  const referralUrl = userId
    ? await getOrCreateReferralLink(userId).catch(() => null)
    : null

  await sendEmail({
    from: 'EventSlot <hello@eventsslot.com>',
    to,
    subject: `You're registered - ${eventTitle}`,
    html: `
      <div style="background:#0A0A0A;padding:40px;font-family:sans-serif;max-width:520px;">
        <div style="margin-bottom:24px;">
          <span style="font-size:20px;font-weight:bold;color:#fff;">Event</span>
          <span style="font-size:20px;font-weight:bold;color:#C8F55A;">Slot</span>
        </div>

        <h2 style="color:#fff;margin-bottom:8px;">You're registered! &#127881;</h2>
        <p style="color:#A3A3A3;font-size:14px;margin-bottom:16px;">
          Hi ${name || 'there'}, your spot at <strong style="color:#fff;">${eventTitle}</strong>
          is confirmed.
        </p>

        <div style="background:#141414;border:1px solid #2A2A2A;border-radius:12px;
                    padding:16px;margin-bottom:24px;">
          <p style="color:#525252;font-size:12px;margin:0 0 4px;">
            Confirmation number
          </p>
          <p style="color:#C8F55A;font-size:18px;font-weight:bold;
                    font-family:monospace;margin:0;">
            ${confirmationNumber}
          </p>
        </div>

        ${referralUrl ? `
        <div style="border-top:1px solid #2A2A2A;padding-top:20px;margin-top:4px;">
          <p style="color:#525252;font-size:12px;margin:0 0 8px;">
            Know someone who organises events?
          </p>
          <p style="color:#A3A3A3;font-size:13px;margin:0 0 12px;">
            Share EventSlot with them and earn tokens toward your next free report.
          </p>
          <a href="${referralUrl}"
             style="background:#C8F55A;color:#000;padding:10px 20px;
                    text-decoration:none;border-radius:8px;font-weight:bold;
                    font-size:13px;display:inline-block;">
            Share EventSlot ->
          </a>
        </div>
        ` : ''}

        <p style="color:#525252;font-size:11px;margin-top:32px;">
          Smarter Events. Better Experiences. -
          <a href="https://www.eventsslot.com" style="color:#525252;">eventsslot.com</a>
        </p>
      </div>
    `,
  })
}


export async function sendWelcomeEmail({
  to,
  name,
}: {
  to: string
  name: string
}) {
  await sendEmail({
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: `Welcome to EventSlot, ${name}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;
                  margin:0 auto;padding:2rem;background:#0A0A0A;color:#F0EDE6">
        <div style="color:#C8F55A;font-size:1.2rem;margin-bottom:1rem">EventSlot</div>
        <h2 style="color:#F0EDE6">Welcome, ${name}</h2>
        <p style="color:rgba(240,237,230,0.6)">
          You are all set. Create your first event and share the link â€”
          registrations and waitlists are handled automatically from here.
        </p>
        <a href="${BASE_URL}/create"
           style="display:inline-block;background:#C8F55A;color:#0A0A0A;
                  padding:12px 28px;border-radius:100px;text-decoration:none;
                  font-weight:500;margin-top:1.5rem">
          Create your first event
        </a>
        <p style="margin-top:2rem;color:rgba(240,237,230,0.25);font-size:0.75rem">
          Questions? Reply to this email â€” we read everything.
        </p>
      </div>
    `,
  })
}

// ────────────────────────────────────────────────────────────
// Organizer system emails — only sent if consentSystemEmails = true
// ────────────────────────────────────────────────────────────

export async function sendOrganizerCapacity90Email({
  to,
  eventTitle,
  confirmedCount,
  capacity,
}: {
  to: string
  eventTitle: string
  confirmedCount: number
  capacity: number
}) {
  const dashUrl = `${BASE_URL}/dashboard`
  await sendEmail({
    from: EMAIL_FROM,
    to,
    subject: `"${eventTitle}" is 80% full`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#0A0A0A;color:#F0EDE6">
        <div style="color:#C8F55A;font-size:1rem;font-weight:600;margin-bottom:1.5rem">EventSlot</div>
        <h2 style="color:#F0EDE6;font-size:1.2rem;font-weight:400;margin:0 0 1rem">Your event is almost full</h2>
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 0.75rem">
          <strong style="color:#F0EDE6">${eventTitle}</strong> now has <strong style="color:#C8F55A">${confirmedCount} of ${capacity}</strong> spots filled (80%).
        </p>
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 1.5rem">
          If you want to accommodate more people, you can increase the capacity from your dashboard.
        </p>
        <a href="${dashUrl}" style="display:inline-block;background:#C8F55A;color:#0A0A0A;text-decoration:none;padding:0.65rem 1.5rem;border-radius:8px;font-weight:600;font-size:0.9rem">
          Go to dashboard
        </a>
        <p style="margin-top:2.5rem;color:rgba(240,237,230,0.25);font-size:0.75rem">You opted in to event notifications. You can update this preference in your account settings.</p>
      </div>
    `,
  })
}

export async function sendOrganizerCapacityFullEmail({
  to,
  eventTitle,
  waitlistCount,
}: {
  to: string
  eventTitle: string
  waitlistCount: number
}) {
  const dashUrl = `${BASE_URL}/dashboard`
  const waitlistNote = waitlistCount > 0
    ? `<p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 1.5rem">
        <strong style="color:#C8F55A">${waitlistCount} ${waitlistCount === 1 ? 'person is' : 'people are'}</strong> on the waitlist. Increasing capacity will confirm them immediately.
       </p>`
    : `<p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 1.5rem">You can still increase capacity from the dashboard if needed.</p>`

  await sendEmail({
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: `"${eventTitle}" is now full`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#0A0A0A;color:#F0EDE6">
        <div style="color:#C8F55A;font-size:1rem;font-weight:600;margin-bottom:1.5rem">EventSlot</div>
        <h2 style="color:#F0EDE6;font-size:1.2rem;font-weight:400;margin:0 0 1rem">Your event is full</h2>
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 0.75rem">
          All spots for <strong style="color:#F0EDE6">${eventTitle}</strong> have been filled.
        </p>
        ${waitlistNote}
        <a href="${dashUrl}" style="display:inline-block;background:#C8F55A;color:#0A0A0A;text-decoration:none;padding:0.65rem 1.5rem;border-radius:8px;font-weight:600;font-size:0.9rem">
          Go to dashboard
        </a>
        <p style="margin-top:2.5rem;color:rgba(240,237,230,0.25);font-size:0.75rem">You opted in to event notifications. You can update this preference in your account settings.</p>
      </div>
    `,
  })
}

export async function sendOrganizerFirstWaitlistEmail({
  to,
  eventTitle,
}: {
  to: string
  eventTitle: string
}) {
  const dashUrl = `${BASE_URL}/dashboard`
  await sendEmail({
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: `People are joining the waitlist for "${eventTitle}"`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#0A0A0A;color:#F0EDE6">
        <div style="color:#C8F55A;font-size:1rem;font-weight:600;margin-bottom:1.5rem">EventSlot</div>
        <h2 style="color:#F0EDE6;font-size:1.2rem;font-weight:400;margin:0 0 1rem">Your waitlist has started</h2>
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 1.5rem">
          People have started joining the waitlist for <strong style="color:#F0EDE6">${eventTitle}</strong>. If you'd like to let them in, increase your event capacity from the dashboard — waitlisted attendees will be confirmed automatically.
        </p>
        <a href="${dashUrl}" style="display:inline-block;background:#C8F55A;color:#0A0A0A;text-decoration:none;padding:0.65rem 1.5rem;border-radius:8px;font-weight:600;font-size:0.9rem">
          Add more slots
        </a>
        <p style="margin-top:2.5rem;color:rgba(240,237,230,0.25);font-size:0.75rem">You opted in to event notifications. You can update this preference in your account settings.</p>
      </div>
    `,
  })
}

export async function sendOrganizerEventReminderEmail({
  to,
  eventTitle,
  eventDate,
}: {
  to: string
  eventTitle: string
  eventDate: Date
}) {
  const dashUrl = `${BASE_URL}/dashboard`
  const dateStr = eventDate.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  await sendEmail({
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: `Reminder: "${eventTitle}" is in 2 days`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#0A0A0A;color:#F0EDE6">
        <div style="color:#C8F55A;font-size:1rem;font-weight:600;margin-bottom:1.5rem">EventSlot</div>
        <h2 style="color:#F0EDE6;font-size:1.2rem;font-weight:400;margin:0 0 1rem">Your event is coming up</h2>
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 0.75rem">
          <strong style="color:#F0EDE6">${eventTitle}</strong> is happening on <strong style="color:#C8F55A">${dateStr}</strong>.
        </p>
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 1.5rem">
          Head to your dashboard to check registrations, manage the waitlist, or make any last-minute changes.
        </p>
        <a href="${dashUrl}" style="display:inline-block;background:#C8F55A;color:#0A0A0A;text-decoration:none;padding:0.65rem 1.5rem;border-radius:8px;font-weight:600;font-size:0.9rem">
          View dashboard
        </a>
        <p style="margin-top:2.5rem;color:rgba(240,237,230,0.25);font-size:0.75rem">You opted in to event notifications. You can update this preference in your account settings.</p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail({
  to,
  token,
}: {
  to: string
  token: string
}) {
  const resetUrl = `${BASE_URL}/reset-password?token=${token}`

  await sendEmail({
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: 'Reset your EventSlot password',
    html: `
      <div style="font-family:sans-serif;max-width:480px;
                  margin:0 auto;padding:2rem;background:#0A0A0A;color:#F0EDE6">
        <div style="color:#C8F55A;font-size:1.2rem;margin-bottom:1rem">EventSlot</div>
        <h2 style="color:#F0EDE6">Reset your password</h2>
        <p style="color:rgba(240,237,230,0.6)">
          We received a request to reset your password. Click the button below
          to choose a new one. This link expires in 1 hour.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#C8F55A;color:#0A0A0A;
                  padding:12px 28px;border-radius:100px;text-decoration:none;
                  font-weight:500;margin-top:1.5rem">
          Reset password
        </a>
        <p style="margin-top:2rem;color:rgba(240,237,230,0.25);font-size:0.75rem">
          If you did not request this, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}

export async function sendExpiryWarningEmail({
  to,
  organizerName,
  eventTitle,
  expiresAt,
}: {
  to: string
  organizerName: string
  eventTitle: string
  expiresAt: Date
}) {
  const daysLeft = Math.ceil(
    (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  )
  const expiryDateStr = expiresAt.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const upgradeUrl = `${BASE_URL}/upgrade`

  await sendEmail({
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: `Your event data deletes in ${daysLeft} days - upgrade to keep it`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#0A0A0A;color:#F0EDE6">
        <div style="color:#C8F55A;font-size:1rem;font-weight:600;margin-bottom:1.5rem">EventSlot</div>
        <h2 style="color:#F0EDE6;font-size:1.2rem;font-weight:400;margin:0 0 1rem">Your event data expires soon</h2>
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 1rem">Hi ${organizerName},</p>
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 1rem">
          Your event <strong style="color:#F0EDE6">${eventTitle}</strong> has ended. As a Free plan user, your event data - registrations, attendee details, and analytics - will be permanently deleted in <strong style="color:#C8F55A">${daysLeft} days</strong>.
        </p>
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 1.5rem">
          Upgrade to Pro to keep your data indefinitely, access full analytics, and unlock advanced features.
        </p>
        <a href="${upgradeUrl}"
           style="display:inline-block;background:#C8F55A;color:#0A0A0A;
                  text-decoration:none;padding:0.65rem 1.5rem;border-radius:8px;
                  font-weight:600;font-size:0.9rem;margin-bottom:1.5rem">
          Upgrade to Pro ->
        </a>
        <p style="color:rgba(240,237,230,0.5);font-size:0.85rem;line-height:1.5;margin:0;border-top:1px solid rgba(200,245,90,0.2);padding-top:1rem">
          <strong style="color:#F0EDE6">Important:</strong> Your data will be deleted on <strong>${expiryDateStr}</strong>. This action cannot be undone. If you don't take action, you'll lose access to registrations, attendee information, and event analytics.
        </p>
      </div>
    `,
  })
}

export async function sendPioneerBadgeAnnouncementEmail({
  to,
}: {
  to: string
}) {
  await sendEmail({
    from: 'EventSlot <hello@eventsslot.com>',
    to,
    subject: "You're an EventSlot Pioneer",
    html: `
      <div style="background:#0A0A0A;color:#fff;padding:40px;font-family:sans-serif;max-width:520px;">
        <h2 style="color:#C8F55A;margin-bottom:8px;">EventSlot Pioneer</h2>
        <p style="color:#A3A3A3;margin-bottom:24px;">
          You signed up for EventSlot early - before most people knew it existed.
          That means something to us.
        </p>
        <p style="color:#fff;margin-bottom:24px;">
          We've awarded you the <strong>Pioneer Badge</strong> - a limited badge
          given to EventSlot's founding community. A small group will ever have it.
          You're in it.
        </p>
        <a href="${BASE_URL}/dashboard/community"
          style="background:#C8F55A;color:#000;padding:14px 28px;text-decoration:none;
                  border-radius:8px;font-weight:bold;display:inline-block;">
          View Your Badge ->
        </a>
        <p style="color:#525252;font-size:12px;margin-top:32px;">
          Smarter Events. Better Experiences. - EventSlot
        </p>
      </div>
    `,
  })
}

