import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://www.eventsslot.com'

async function sendEmail(options: Parameters<typeof resend.emails.send>[0]) {
  const { error } = await resend.emails.send(options)
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
}: {
  to: string
  eventTitle: string
  communityLink?: string | null
  consentTransactional: boolean
}) {
  if (!consentTransactional) return

  const communitySection = communityLink
    ? `<p style="margin-top:16px">You can now join the event community here: <a href="${communityLink}">${communityLink}</a></p>`
    : ''

  await sendEmail({
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: `Your slot for ${eventTitle} is confirmed`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
        <h2 style="color:#0A0A0A">You're in!</h2>
        <p>Good news â€” a slot has opened up and you have been confirmed for <strong>${eventTitle}</strong>.</p>
        <p>Your spot is now secured. We look forward to seeing you there.</p>
        ${communitySection}
        <p style="margin-top:2rem;color:#888;font-size:0.8rem">You received this because you registered for ${eventTitle} via EventSlot.</p>
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
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: `"${eventTitle}" is 90% full`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#0A0A0A;color:#F0EDE6">
        <div style="color:#C8F55A;font-size:1rem;font-weight:600;margin-bottom:1.5rem">EventSlot</div>
        <h2 style="color:#F0EDE6;font-size:1.2rem;font-weight:400;margin:0 0 1rem">Your event is almost full</h2>
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 0.75rem">
          <strong style="color:#F0EDE6">${eventTitle}</strong> now has <strong style="color:#C8F55A">${confirmedCount} of ${capacity}</strong> spots filled (90%).
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

