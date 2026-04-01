import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendFeedbackRequestEmail({
  to,
  eventTitle,
  registrationId,
}: {
  to: string
  eventTitle: string
  registrationId: string
}) {
  const feedbackUrl = `${process.env.NEXTAUTH_URL}/feedback/${registrationId}`

  await resend.emails.send({
    from: 'EventSlot <noreply@eventslot.app>',
    to,
    subject: `How was ${eventTitle}? Share your feedback`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
        <h2 style="color:#0A0A0A">How was the event?</h2>
        <p>Thanks for attending <strong>${eventTitle}</strong>. We'd love to hear what you thought.</p>
        <p>It only takes a minute — your feedback helps organisers improve future events.</p>
        <p style="margin-top:1.5rem">
          <a href="${feedbackUrl}" style="display:inline-block;background:#C8F55A;color:#0A0A0A;text-decoration:none;padding:0.6rem 1.4rem;border-radius:8px;font-weight:600;font-size:0.9rem">
            Leave feedback
          </a>
        </p>
        <p style="margin-top:2rem;color:#888;font-size:0.8rem">You received this because you registered for ${eventTitle} via EventSlot.</p>
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
  const acceptUrl = `${process.env.NEXTAUTH_URL}/team/accept?token=${inviteToken}`

  await resend.emails.send({
    from: 'EventSlot <noreply@eventslot.app>',
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

  await resend.emails.send({
    from: 'EventSlot <noreply@eventslot.app>',
    to,
    subject: `Your slot for ${eventTitle} is confirmed`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
        <h2 style="color:#0A0A0A">You're in!</h2>
        <p>Good news — a slot has opened up and you have been confirmed for <strong>${eventTitle}</strong>.</p>
        <p>Your spot is now secured. We look forward to seeing you there.</p>
        ${communitySection}
        <p style="margin-top:2rem;color:#888;font-size:0.8rem">You received this because you registered for ${eventTitle} via EventSlot.</p>
      </div>
    `,
  })
}
