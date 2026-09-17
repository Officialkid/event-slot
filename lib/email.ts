import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import { getOrCreateReferralLink } from '@/lib/referral'
import { APP_URL } from '@/lib/config'
import { env } from '@/lib/env'
import { buildGoogleCalendarTemplateUrl } from '@/lib/calendarLinks'
import {
  DEFAULT_RESEND_SENDER,
  getConfiguredEmailFrom,
  getVerifiedSender,
  shouldUseSmtpFromEnv,
  smtpIsConfiguredFromEnv,
} from '@/lib/emailProvider'

function getResendClient() {
  const apiKey = env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }
  return new Resend(apiKey)
}

const BASE_URL = APP_URL
const EMAIL_FROM = getConfiguredEmailFrom(env)

type InternalEmailOptions = {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  replyTo?: string
}

function smtpIsConfigured() {
  return smtpIsConfiguredFromEnv(env)
}

function shouldUseSmtp() {
  return shouldUseSmtpFromEnv(env)
}

let cachedSmtpTransporter: nodemailer.Transporter | null = null

function getSmtpTransporter() {
  if (!smtpIsConfigured()) {
    throw new Error('SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASSWORD must be configured')
  }

  if (cachedSmtpTransporter) {
    return cachedSmtpTransporter
  }

  cachedSmtpTransporter = nodemailer.createTransport({
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: env.SMTP_SECURE === 'true' || Number(env.SMTP_PORT) === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  })

  return cachedSmtpTransporter
}

function extractEmailErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message
    if (typeof maybeMessage === "string" && maybeMessage.trim()) {
      return maybeMessage
    }
  }
  if (typeof error === "string" && error.trim()) return error
  return "Failed to send email"
}

function shouldRetryWithFallbackSender(message: string | null, from: string) {
  return Boolean(message) && /verify|domain|sender/i.test(message ?? "") && from !== DEFAULT_RESEND_SENDER
}

async function sendViaSmtp(options: InternalEmailOptions): Promise<void> {
  const transporter = getSmtpTransporter()
  const verifiedFrom = getVerifiedSender({ runtimeEnv: env, preferredFrom: options.from })

  await transporter.sendMail({
    from: verifiedFrom,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo,
  })
}

async function sendViaResend(options: InternalEmailOptions): Promise<void> {
  const resend = getResendClient()
  const verifiedFrom = getVerifiedSender({ runtimeEnv: env, preferredFrom: options.from })
  const payload = {
    ...options,
    // Always use the verified sender address, even if callers pass a branded alias.
    from: verifiedFrom,
  } as Parameters<Resend['emails']['send']>[0]

  let error: { message?: string } | null = null
  try {
    const result = await resend.emails.send(payload)
    error = result.error ?? null
  } catch (sendError) {
    error = { message: extractEmailErrorMessage(sendError) }
  }

  if (shouldRetryWithFallbackSender(error?.message ?? null, verifiedFrom)) {
    try {
      const retryResult = await resend.emails.send({
        ...payload,
        from: DEFAULT_RESEND_SENDER,
      })
      error = retryResult.error ?? null
    } catch (retryError) {
      error = { message: extractEmailErrorMessage(retryError) }
    }
  }

  if (error) {
    throw new Error(error.message ?? 'Resend delivery failed')
  }
}

export async function sendEmail(options: InternalEmailOptions): Promise<void> {
  const preferSmtp = shouldUseSmtp()

  if (preferSmtp) {
    // 1. Primary delivery: Nodemailer / SMTP
    try {
      await sendViaSmtp(options)
      return
    } catch (smtpError) {
      const smtpMsg = extractEmailErrorMessage(smtpError)
      console.warn(`[email] Primary provider (Nodemailer/SMTP) failed: ${smtpMsg}. Attempting automatic failover to backup provider (Resend)...`)

      // 2. Failover to Resend
      if (env.RESEND_API_KEY) {
        try {
          await sendViaResend(options)
          console.info('[email] Failover to Resend succeeded.')
          return
        } catch (resendError) {
          const resendMsg = extractEmailErrorMessage(resendError)
          console.error('[email] Both primary (SMTP) and backup (Resend) failed to deliver email:', {
            to: options.to,
            smtpError: smtpMsg,
            resendError: resendMsg,
          })
          throw new Error(`Email delivery failed via both primary (SMTP: ${smtpMsg}) and backup (Resend: ${resendMsg})`)
        }
      }

      throw new Error(smtpMsg)
    }
  }

  // Resend configured as primary, or SMTP is not configured
  try {
    await sendViaResend(options)
    return
  } catch (resendError) {
    const resendMsg = extractEmailErrorMessage(resendError)

    // Failover to SMTP if SMTP is configured
    if (smtpIsConfigured()) {
      console.warn(`[email] Primary provider (Resend) failed: ${resendMsg}. Attempting automatic failover to SMTP...`)
      try {
        await sendViaSmtp(options)
        console.info('[email] Failover to SMTP succeeded.')
        return
      } catch (smtpError) {
        const smtpMsg = extractEmailErrorMessage(smtpError)
        console.error('[email] Both Resend and fallback SMTP failed:', {
          to: options.to,
          resendError: resendMsg,
          smtpError: smtpMsg,
        })
        throw new Error(`Email delivery failed via both Resend (${resendMsg}) and SMTP (${smtpMsg})`)
      }
    }

    console.error('[email] Resend send error:', resendError)
    throw new Error(resendMsg)
  }
}

export async function sendCampaignEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  await sendEmail({ from: 'EventSlot <noreply@eventsslot.com>', to, subject, html })
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
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 1rem">Thanks for attending. We'd love to hear what you thought - it only takes a minute and helps organisers improve future events.</p>
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
    from: EMAIL_FROM,
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

export async function sendWaitlistPromotedEmail({
  to,
  eventTitle,
  eventDate,
  eventEndAt,
  eventLocation,
  communityLink,
  ticketUrl,
  eventSlug,
}: {
  to: string
  eventTitle: string
  eventDate?: string | Date | null
  eventEndAt?: string | Date | null
  eventLocation?: string | null
  communityLink?: string | null
  ticketUrl?: string | null
  eventSlug?: string | null
}) {
  const dateSection = eventDate
    ? `<p style="margin:4px 0;color:#555;font-size:0.875rem">&#128197; ${new Date(eventDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>`
    : ''
  const locationSection = eventLocation
    ? `<p style="margin:4px 0;color:#555;font-size:0.875rem">&#128205; ${eventLocation}</p>`
    : ''
  const ticketSection = ticketUrl
    ? `<div style="margin-top:24px;padding:16px;background:#f8f8f8;border-radius:8px;text-align:center">
         <p style="margin:0 0 12px;font-size:0.875rem;color:#555">Your ticket is ready - download it below:</p>
         <a href="${ticketUrl}" style="display:inline-block;background:#0A0A0A;color:#C8F55A;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:0.9rem;font-weight:600">
           View &amp; Download Ticket &rarr;
         </a>
       </div>`
    : `<div style="margin-top:24px;padding:16px;background:#f8f8f8;border-radius:8px">
         <p style="margin:0;font-size:0.875rem;color:#555">Visit the event page to download your ticket.</p>
       </div>`
  const communitySection = communityLink
    ? `<p style="margin-top:16px">Join the event community: <a href="${communityLink}">${communityLink}</a></p>`
    : ''

  let calendarSection = ''
  if (eventDate && eventSlug) {
    const start = new Date(eventDate)
    const details = `Confirmed! You're attending ${eventTitle}.`
    const googleCalUrl = buildGoogleCalendarTemplateUrl({
      title: eventTitle,
      description: details,
      location: eventLocation,
      startDate: start,
      endDate: eventEndAt ? new Date(eventEndAt) : null,
    })
    const icsUrl = `${APP_URL}/api/events/${eventSlug}/calendar.ics`
    calendarSection = `
      <div style="margin-top: 20px; padding: 16px; background: #141414;
                   border: 1px solid rgba(34,197,94,0.3); border-radius: 12px;">
        <p style="color: #22C55E; font-weight: bold; margin: 0 0 8px;">
          &#128197; Update your calendar
        </p>
        <p style="color: #A3A3A3; font-size: 13px; margin: 0 0 12px;">
          If you saved the date when you joined the waitlist, your calendar
          has been updated automatically. If not, add it now:
        </p>
        <a href="${googleCalUrl}"
           style="display: inline-block; background: #4285F4; color: white;
                  font-weight: bold; padding: 10px 20px; border-radius: 8px;
                  text-decoration: none; margin-right: 8px;">
          &#128197; Add to Google Calendar
        </a>
        <a href="${icsUrl}"
           style="display: inline-block; border: 1px solid #2A2A2A; color: #A3A3A3;
                  padding: 10px 20px; border-radius: 8px; text-decoration: none;">
          &#11015; Download .ics
        </a>
      </div>`
  }

  await sendEmail({
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: `Congratulations! You've been promoted from the waitlist for ${eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem">
        <div style="text-align:center;margin-bottom:1.5rem">
          <div style="font-size:2.5rem">&#127881;</div>
          <h2 style="color:#0A0A0A;margin:0.5rem 0">You're off the waitlist!</h2>
        </div>
        <p>Great news &mdash; a spot opened up and you have been <strong>promoted from the waitlist</strong> to confirmed for <strong>${eventTitle}</strong>.</p>
        <p>Your registration is now fully confirmed. We look forward to seeing you there!</p>
        ${dateSection}
        ${locationSection}
        ${ticketSection}
        ${communitySection}
        ${calendarSection}
        <p style="margin-top:2rem;color:#888;font-size:0.8rem">
          You received this because you were on the waitlist for ${eventTitle} via EventSlot.
        </p>
      </div>
    `,
  })
}

export async function sendWaitlistJoinedEmail({
  to,
  eventTitle,
  waitlistPosition,
  eventDate,
  eventEndAt,
  eventSlug,
  eventLocation,
}: {
  to: string
  eventTitle: string
  waitlistPosition?: number | null
  eventDate?: string | Date | null
  eventEndAt?: string | Date | null
  eventSlug?: string | null
  eventLocation?: string | null
}) {
  let calendarSection = ''
  if (eventDate && eventSlug) {
    const start = new Date(eventDate)
    const details = `You are on the waitlist for ${eventTitle}.${waitlistPosition != null ? ` Position: #${waitlistPosition}.` : ''}\n\nYou will be notified if a spot opens up.`
    const googleCalUrl = buildGoogleCalendarTemplateUrl({
      title: `[Waitlisted] ${eventTitle}`,
      description: details,
      location: eventLocation,
      startDate: start,
      endDate: eventEndAt ? new Date(eventEndAt) : null,
    })
    const icsUrl = `${APP_URL}/api/events/${eventSlug}/calendar.ics`
    calendarSection = `
      <div style="margin-top: 20px; padding: 16px; background: #1a1a0a;
                   border: 1px solid rgba(245,158,11,0.3); border-radius: 12px;">
        <p style="color: #F59E0B; font-weight: bold; margin: 0 0 8px;">
          &#128197; Save the date
        </p>
        <p style="color: #A3A3A3; font-size: 13px; margin: 0 0 12px;">
          Add it to your calendar now &mdash; it will update automatically if you&apos;re confirmed.
        </p>
        <a href="${googleCalUrl}"
           style="display: inline-block; background: #4285F4; color: white;
                  font-weight: bold; padding: 10px 20px; border-radius: 8px;
                  text-decoration: none; margin-right: 8px;">
          &#128197; Add to Google Calendar
        </a>
        <a href="${icsUrl}"
           style="display: inline-block; border: 1px solid #2A2A2A; color: #A3A3A3;
                  padding: 10px 20px; border-radius: 8px; text-decoration: none;">
          &#11015; Download .ics
        </a>
      </div>`
  }

  await sendEmail({
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: `You're on the waitlist for ${eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:2rem;background:#0A0A0A;color:#F0EDE6">
        <div style="color:#C8F55A;font-size:1rem;font-weight:600;margin-bottom:1.5rem">EventSlot</div>
        <h2 style="color:#F0EDE6;font-size:1.3rem;font-weight:400;margin:0 0 1rem">You&apos;re on the waitlist</h2>
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 1rem">
          You&apos;ve been added to the waitlist for <strong style="color:#F0EDE6">${eventTitle}</strong>.
          ${waitlistPosition != null ? `You are currently <strong style="color:#F59E0B">position #${waitlistPosition}</strong>.` : ''}
        </p>
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 1rem">
          If a spot opens up, you will be notified automatically and moved to confirmed.
        </p>
        ${calendarSection}
        <p style="margin-top:2rem;color:rgba(240,237,230,0.3);font-size:0.75rem">
          You received this because you joined the waitlist for ${eventTitle} via EventSlot.
        </p>
      </div>
    `,
  })
}

export async function sendPaidWaitlistPromotionEmail({
  to,
  eventTitle,
  tierName,
  priceKes,
  paymentLink,
  expiresAt,
}: {
  to: string
  eventTitle: string
  tierName: string
  priceKes: number
  paymentLink: string
  expiresAt: Date
}) {
  const expiryLabel = expiresAt.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  await sendEmail({
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: `A paid ticket is now available for ${eventTitle}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:2rem;background:#0A0A0A;color:#F0EDE6">
        <div style="color:#C8F55A;font-size:1rem;font-weight:600;margin-bottom:1.5rem">EventSlot</div>
        <h2 style="color:#F0EDE6;font-size:1.25rem;font-weight:400;margin:0 0 1rem">You're next in line</h2>
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 1rem">
          A slot just opened for <strong style="color:#F0EDE6">${eventTitle}</strong>.
        </p>
        <div style="background:#141414;border:1px solid rgba(255,184,77,0.2);border-radius:12px;padding:16px;margin-bottom:1rem">
          <p style="margin:0 0 6px;color:#FFB84D;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em">Ticket tier</p>
          <p style="margin:0 0 6px;color:#F0EDE6;font-size:1rem;font-weight:600">${tierName}</p>
          <p style="margin:0;color:rgba(240,237,230,0.6);font-size:0.88rem">Price: KES ${priceKes.toLocaleString('en-KE')}</p>
        </div>
        <p style="color:rgba(240,237,230,0.65);font-size:0.9rem;line-height:1.6;margin:0 0 1rem">
          Complete payment before <strong style="color:#C8F55A">${expiryLabel}</strong> or the offer will move to the next person on the waitlist.
        </p>
        <a href="${paymentLink}" style="display:inline-block;background:#C8F55A;color:#0A0A0A;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:0.9rem">
          Pay for this ticket
        </a>
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
  eventDate,
  eventEndAt,
  eventSlug,
  eventLocation,
}: {
  to: string
  name: string
  eventTitle: string
  confirmationNumber: string
  userId?: string | null
  eventDate?: string | Date | null
  eventEndAt?: string | Date | null
  eventSlug?: string | null
  eventLocation?: string | null
}) {
  const referralUrl = userId
    ? await getOrCreateReferralLink(userId).catch(() => null)
    : null

  // Build inline Google Calendar URL if date is available
  let calendarSection = ''
  if (eventDate && eventSlug) {
    const start = new Date(eventDate)
    const details = `You're registered for ${eventTitle}!\n\nConfirmation: ${confirmationNumber}`
    const googleCalUrl = buildGoogleCalendarTemplateUrl({
      title: eventTitle,
      description: details,
      location: eventLocation,
      startDate: start,
      endDate: eventEndAt ? new Date(eventEndAt) : null,
    })
    const icsUrl = `${APP_URL}/api/events/${eventSlug}/calendar.ics`
    calendarSection = `
    <div style="border-top:1px solid #2A2A2A;padding-top:16px;margin-top:16px;">
      <p style="color:#525252;font-size:12px;margin:0 0 8px;">Add to your calendar</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <a href="${googleCalUrl}"
           style="background:#C8F55A;color:#000;padding:8px 16px;text-decoration:none;
                  border-radius:8px;font-weight:bold;font-size:13px;display:inline-block;">
          Google Calendar
        </a>
        <a href="${icsUrl}"
           style="background:transparent;color:#C8F55A;padding:8px 16px;text-decoration:none;
                  border-radius:8px;font-weight:bold;font-size:13px;display:inline-block;
                  border:1px solid #C8F55A;">
          Download .ics
        </a>
      </div>
    </div>`
  }


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
                    padding:20px;margin-bottom:24px;text-align:center;">
          <p style="color:#737373;font-size:12px;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.06em;">
            Confirmation Number
          </p>
          <p style="color:#C8F55A;font-size:24px;font-weight:bold;
                    font-family:monospace;letter-spacing:0.08em;margin:0 0 16px;">
            ${confirmationNumber}
          </p>
          <a href="${BASE_URL}/register/success/${confirmationNumber}"
             style="background:#C8F55A;color:#0A0A0A;padding:12px 24px;text-decoration:none;
                    border-radius:8px;font-weight:bold;font-size:14px;display:inline-block;">
            🎫 View &amp; Download Ticket Pass
          </a>
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

        ${calendarSection}

        <p style="color:#525252;font-size:11px;margin-top:32px;">
          Smarter Events. Better Experiences. -
          <a href="https://www.eventsslot.com" style="color:#525252;">eventsslot.com</a>
        </p>
      </div>
    `,
  })
}

export async function sendRegistrationResponseCopyEmail({
  to,
  eventTitle,
  attendeeName,
  status,
  answers,
  confirmationCode,
  registrationId,
}: {
  to: string
  eventTitle: string
  attendeeName?: string | null
  status: 'confirmed' | 'waitlist'
  answers: Array<{ label: string; value: string }>
  confirmationCode?: string | null
  registrationId: string
}) {
  const answerRows = answers
    .map(
      (answer) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid rgba(240,237,230,0.08);color:#A3A3A3;font-size:13px;vertical-align:top;">${answer.label}</td>
          <td style="padding:10px 12px;border-bottom:1px solid rgba(240,237,230,0.08);color:#F0EDE6;font-size:13px;vertical-align:top;">${answer.value || '-'}</td>
        </tr>
      `
    )
    .join('')

  const statusLabel = status === 'confirmed' ? 'Confirmed' : 'On the waitlist'
  const primaryLink = confirmationCode
    ? `${APP_URL}/register/success/${confirmationCode}`
    : `${APP_URL}/registration/${registrationId}`

  await sendEmail({
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: `Your responses for ${eventTitle}`,
    html: `
      <div style="background:#0A0A0A;padding:32px;font-family:sans-serif;max-width:560px;">
        <div style="margin-bottom:24px;">
          <span style="font-size:20px;font-weight:bold;color:#fff;">Event</span>
          <span style="font-size:20px;font-weight:bold;color:#C8F55A;">Slot</span>
        </div>
        <h2 style="color:#fff;margin:0 0 8px;">Your response copy</h2>
        <p style="color:#A3A3A3;font-size:14px;line-height:1.6;margin:0 0 20px;">
          ${attendeeName ? `Hi ${attendeeName}, ` : ''}here is a copy of the responses you submitted for <strong style="color:#fff;">${eventTitle}</strong>.
        </p>
        <div style="background:#141414;border:1px solid #2A2A2A;border-radius:12px;padding:16px;margin-bottom:20px;">
          <p style="margin:0 0 6px;color:#525252;font-size:12px;text-transform:uppercase;letter-spacing:0.08em;">Registration status</p>
          <p style="margin:0;color:${status === 'confirmed' ? '#C8F55A' : '#FFB84D'};font-size:15px;font-weight:700;">${statusLabel}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#141414;border:1px solid #2A2A2A;border-radius:12px;overflow:hidden;">
          <tbody>${answerRows}</tbody>
        </table>
        <div style="margin-top:20px;">
          <a href="${primaryLink}" style="display:inline-block;background:#C8F55A;color:#0A0A0A;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:14px;">
            ${confirmationCode ? 'View ticket' : 'View registration status'}
          </a>
        </div>
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
  let firstName = (name || '').trim().split(/\s+/)[0] || 'there'
  if (/^kid$/i.test(firstName) || /^officialkid$/i.test(firstName) || firstName.length < 2 || firstName.includes('@')) {
    firstName = 'there'
  }

  await sendEmail({
    from: 'EventSlot <hello@eventsslot.com>',
    to,
    subject: `You're officially in! Welcome to EventSlot`,
    html: `
      <div style="background:#0A0A0A;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#FAFAF7;line-height:1.6;">
        <div style="max-width:520px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:16px;padding:36px 32px;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- Logo -->
          <div style="margin-bottom:28px;">
            <span style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.03em;">Event</span><span style="font-size:22px;font-weight:800;color:#C8F55A;letter-spacing:-0.03em;">Slot</span>
          </div>

          <!-- Greeting -->
          <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:0 0 14px;line-height:1.3;">
            Hey ${firstName},
          </h1>

          <p style="color:#C8F55A;font-size:18px;font-weight:700;margin:0 0 16px;">
            You’re officially in! 🎉
          </p>

          <p style="color:#D4D4D4;font-size:15px;margin:0 0 16px;line-height:1.6;">
            Welcome to <strong style="color:#FFFFFF;">EventSlot</strong> — where events are easier to find, register for, and experience.
          </p>

          <p style="color:#D4D4D4;font-size:15px;margin:0 0 16px;line-height:1.6;">
            No stress. No endless forms. Just <strong style="color:#FFFFFF;">better events, better experiences.</strong>
          </p>

          <p style="color:#D4D4D4;font-size:15px;margin:0 0 24px;line-height:1.6;">
            Glad to have you on board. 💚
          </p>

          <div style="margin:28px 0;">
            <a href="${BASE_URL}/my-events"
               style="display:inline-block;background:#C8F55A;color:#0A0A0A;font-weight:700;font-size:15px;padding:12px 28px;border-radius:10px;text-decoration:none;box-shadow:0 4px 16px rgba(200,245,90,0.35);">
              Explore Events &amp; Dashboard →
            </a>
          </div>

          <div style="border-top:1px solid #262626;padding-top:20px;margin-top:24px;">
            <p style="color:#FFFFFF;font-size:15px;font-weight:700;margin:0 0 4px;">
              See you at the next event!
            </p>
            <p style="color:#8C8C8C;font-size:13px;margin:0;">
              — Team EventSlot
            </p>
          </div>

        </div>

        <div style="text-align:center;max-width:520px;margin:20px auto 0;">
          <p style="color:#525252;font-size:11px;margin:0;">
            Smarter Events. Better Experiences. · <a href="${BASE_URL}" style="color:#737373;text-decoration:none;">eventsslot.com</a>
          </p>
        </div>
      </div>
    `,
  })
}

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
          People have started joining the waitlist for <strong style="color:#F0EDE6">${eventTitle}</strong>. If you'd like to let them in, increase your event capacity from the dashboard - waitlisted attendees will be confirmed automatically.
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

export async function sendEmailOtp({
  to,
  otp,
}: {
  to: string
  otp: string
}) {
  await sendEmail({
    from: 'EventSlot <noreply@eventsslot.com>',
    to,
    subject: `${otp} - Your EventSlot verification code`,
    html: `
      <div style="background:#0A0A0A;padding:40px;font-family:sans-serif;max-width:400px;">
        <div style="margin-bottom:24px;">
          <span style="font-size:20px;font-weight:bold;color:#fff;">Event</span>
          <span style="font-size:20px;font-weight:bold;color:#C8F55A;">Slot</span>
        </div>
        <h2 style="color:#fff;margin-bottom:8px;">Verify your email</h2>
        <p style="color:#A3A3A3;font-size:14px;margin-bottom:24px;">
          Enter this code to verify your email address.
          It expires in 10 minutes.
        </p>
        <div style="background:#141414;border:2px solid #C8F55A;border-radius:12px;
                    padding:20px;text-align:center;margin-bottom:24px;">
          <span style="font-size:36px;font-weight:bold;color:#C8F55A;
                       letter-spacing:8px;">${otp}</span>
        </div>
        <p style="color:#525252;font-size:12px;">
          If you did not request this, ignore this email.
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

export async function sendAppTesterSignupEmail({
  to,
  optInUrl,
}: {
  to: string
  optInUrl?: string | null
}) {
  const hasOptInUrl = Boolean(optInUrl)

  await sendEmail({
    from: 'EventSlot <hello@eventsslot.com>',
    to,
    subject: hasOptInUrl ? 'Your EventSlot app testing invite is ready' : 'You are on the EventSlot early tester list',
    html: `
      <div style="background:#0A0A0A;color:#F0EDE6;padding:40px;font-family:sans-serif;max-width:560px;margin:0 auto;">
        <div style="color:#C8F55A;font-size:14px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:20px;">EventSlot early testing</div>
        <h2 style="color:#FFFFFF;font-size:26px;line-height:1.2;margin:0 0 16px;">Thank you for helping us test the app</h2>
        <p style="color:rgba(240,237,230,0.72);font-size:15px;line-height:1.7;margin:0 0 16px;">
          ${
            hasOptInUrl
              ? "Your email has been saved for the EventSlot mobile app tester group. Use the button below to open the Play Store testing invite."
              : "We have saved your email for the EventSlot mobile app tester group. When the Play Store testing track is ready, we will use this email to send access instructions."
          }
        </p>
        <p style="color:rgba(240,237,230,0.72);font-size:15px;line-height:1.7;margin:0 0 24px;">
          As an early tester, the biggest help is to open the app regularly, create or join test events, verify that registration and tickets work, and share any issue you notice.
        </p>
        <a href="${hasOptInUrl ? optInUrl : BASE_URL}"
          style="display:inline-block;background:#C8F55A;color:#0A0A0A;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:800;">
          ${hasOptInUrl ? "Open Play Store testing invite" : "Visit EventSlot"}
        </a>
        <p style="color:rgba(240,237,230,0.45);font-size:12px;line-height:1.6;margin:28px 0 0;">
          You are receiving this because you asked to join EventSlot early app testing.
        </p>
      </div>
    `,
  })
}

export async function sendPostEventSummaryEmail({
  to,
  organizerName,
  eventTitle,
  eventSlug,
  totalRegistrations,
  confirmedCount,
  checkInRate,
  avgFeedbackScore,
}: {
  to: string
  organizerName: string | null
  eventTitle: string
  eventSlug: string
  totalRegistrations: number
  confirmedCount: number
  checkInRate: number
  avgFeedbackScore: string | null
}) {
  await sendEmail({
    from: 'EventSlot <hello@eventsslot.com>',
    to,
    subject: `Post-event summary: ${eventTitle}`,
    html: `
      <div style="background:#0A0A0A;color:#F0EDE6;padding:40px;font-family:sans-serif;max-width:520px;">
        <h2 style="color:#C8F55A;margin-bottom:8px;">Your event has ended 🎉</h2>
        <p style="color:#A3A3A3;margin-bottom:24px;">
          ${organizerName ? `Hi ${organizerName}, here` : 'Here'}'s how <strong style="color:#F0EDE6;">${eventTitle}</strong> went:
        </p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(240,237,230,0.08);color:#A3A3A3;font-size:14px;">Total registrations</td>
            <td style="padding:10px 0;border-bottom:1px solid rgba(240,237,230,0.08);color:#F0EDE6;font-size:14px;font-weight:bold;text-align:right;">${totalRegistrations}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(240,237,230,0.08);color:#A3A3A3;font-size:14px;">Confirmed attendees</td>
            <td style="padding:10px 0;border-bottom:1px solid rgba(240,237,230,0.08);color:#F0EDE6;font-size:14px;font-weight:bold;text-align:right;">${confirmedCount}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid rgba(240,237,230,0.08);color:#A3A3A3;font-size:14px;">Check-in rate</td>
            <td style="padding:10px 0;border-bottom:1px solid rgba(240,237,230,0.08);color:#C8F55A;font-size:14px;font-weight:bold;text-align:right;">${checkInRate}%</td>
          </tr>
          ${avgFeedbackScore ? `
          <tr>
            <td style="padding:10px 0;color:#A3A3A3;font-size:14px;">Feedback score</td>
            <td style="padding:10px 0;color:#C8F55A;font-size:14px;font-weight:bold;text-align:right;">${avgFeedbackScore} / 5</td>
          </tr>` : ''}
        </table>
        <a href="${BASE_URL}/dashboard/events/${eventSlug}"
          style="background:#C8F55A;color:#0A0A0A;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
          View Full Analytics ->
        </a>
        <p style="color:#525252;font-size:12px;margin-top:32px;">
          Smarter Events. Better Experiences. - EventSlot
        </p>
      </div>
    `,
  })
}

export async function sendGroupBookingConfirmationEmail({
  to,
  contactName,
  orgName,
  orgType,
  totalSlots,
  eventTitle,
  eventDate,
  eventLocation,
  managerUrl,
  claimUrl,
}: {
  to: string
  contactName: string
  orgName: string
  orgType?: string
  totalSlots: number
  eventTitle: string
  eventDate?: string | null
  eventLocation?: string | null
  managerUrl: string
  claimUrl: string
}) {
  const firstName = (contactName || '').trim().split(' ')[0] || 'there'

  await sendEmail({
    from: 'EventSlot <hello@eventsslot.com>',
    to,
    subject: `Group Reservation Confirmed: ${orgName} — ${eventTitle}`,
    html: `
      <div style="background:#0A0A0A;padding:40px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#FAFAF7;line-height:1.6;">
        <div style="max-width:560px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:16px;padding:36px 32px;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
          
          <!-- Brand Badge -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;">
            <div>
              <span style="font-size:22px;font-weight:800;color:#FFFFFF;letter-spacing:-0.03em;">Event</span><span style="font-size:22px;font-weight:800;color:#C8F55A;letter-spacing:-0.03em;">Slot</span>
            </div>
            <span style="background:rgba(200,245,90,0.12);border:1px solid rgba(200,245,90,0.3);color:#C8F55A;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-radius:999px;padding:4px 12px;">
              Group Reservation
            </span>
          </div>

          <!-- Headline -->
          <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:0 0 12px;line-height:1.3;">
            Reservation Confirmed! 🎉
          </h1>
          <p style="color:#D4D4D4;font-size:15px;margin:0 0 20px;line-height:1.6;">
            Hi ${firstName}, your group allocation for <strong style="color:#FFFFFF;">${orgName}</strong> has been successfully reserved for <strong style="color:#C8F55A;">${eventTitle}</strong>.
          </p>

          <!-- Reservation Details Box -->
          <div style="background:#1A1A1A;border:1px solid #2E2E2E;border-radius:12px;padding:20px;margin-bottom:24px;">
            <table style="width:100%;border-collapse:collapse;font-size:14px;">
              <tr>
                <td style="padding:6px 0;color:#8C8C8C;width:40%;">Event:</td>
                <td style="padding:6px 0;color:#FFFFFF;font-weight:600;">${eventTitle}</td>
              </tr>
              ${eventDate ? `
              <tr>
                <td style="padding:6px 0;color:#8C8C8C;">Date &amp; Time:</td>
                <td style="padding:6px 0;color:#FFFFFF;font-weight:500;">${eventDate}</td>
              </tr>
              ` : ''}
              ${eventLocation ? `
              <tr>
                <td style="padding:6px 0;color:#8C8C8C;">Location:</td>
                <td style="padding:6px 0;color:#FFFFFF;font-weight:500;">${eventLocation}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding:6px 0;color:#8C8C8C;">Organization:</td>
                <td style="padding:6px 0;color:#FFFFFF;font-weight:600;">${orgName}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#8C8C8C;">Total Reserved Slots:</td>
                <td style="padding:6px 0;color:#C8F55A;font-weight:800;font-size:16px;">${totalSlots} Seats</td>
              </tr>
              <tr>
                <td style="padding:6px 0;color:#8C8C8C;">Contact Person:</td>
                <td style="padding:6px 0;color:#FFFFFF;">${contactName}</td>
              </tr>
            </table>
          </div>

          <!-- Primary CTA: Manager Portal -->
          <div style="margin:28px 0;text-align:center;">
            <a href="${managerUrl}"
               style="display:inline-block;background:#C8F55A;color:#0A0A0A;font-weight:800;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;box-shadow:0 4px 16px rgba(200,245,90,0.35);">
              Open Delegation Manager Portal →
            </a>
            <p style="color:#8C8C8C;font-size:12px;margin:8px 0 0;">
              Assign delegate names, edit contact info, or bulk-import rosters via CSV.
            </p>
          </div>

          <!-- Self-Claim Link Box -->
          <div style="background:#171717;border:1px dashed #333333;border-radius:12px;padding:16px 18px;margin-bottom:24px;">
            <p style="color:#C8F55A;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 6px;">
              Member Self-Claim Link
            </p>
            <p style="color:#A3A3A3;font-size:13px;margin:0 0 10px;line-height:1.5;">
              Share this link with your members so they can claim their individual ticket passes directly:
            </p>
            <div style="background:#0D0D0D;border:1px solid #262626;border-radius:8px;padding:10px 12px;word-break:break-all;">
              <a href="${claimUrl}" style="color:#C8F55A;font-size:13px;font-family:monospace;text-decoration:none;">
                ${claimUrl}
              </a>
            </div>
          </div>

          <!-- How It Works Section -->
          <div style="border-top:1px solid #262626;padding-top:20px;margin-top:24px;">
            <p style="color:#FFFFFF;font-size:14px;font-weight:700;margin:0 0 12px;">
              How to manage your delegation:
            </p>
            <ul style="color:#A3A3A3;font-size:13px;padding-left:18px;margin:0 0 16px;line-height:1.7;">
              <li><strong style="color:#E5E5E5;">Option 1 (Self-Claim):</strong> Send the link above to your group chat or email list. Members fill in their own name and receive their QR ticket instantly.</li>
              <li><strong style="color:#E5E5E5;">Option 2 (Direct Assignment):</strong> Open the Manager Portal to type in names or upload a spreadsheet (CSV). Tickets are immediately issued to your delegates.</li>
              <li><strong style="color:#E5E5E5;">Live Check-in:</strong> Use your portal on event day to view real-time check-in counts as your members arrive.</li>
            </ul>
          </div>

          <div style="border-top:1px solid #262626;padding-top:16px;margin-top:20px;">
            <p style="color:#8C8C8C;font-size:12px;margin:0;">
              💡 <em>Keep this email safe. You can access and update your group registration at any time using your Manager Portal link.</em>
            </p>
          </div>

        </div>

        <div style="text-align:center;max-width:560px;margin:20px auto 0;">
          <p style="color:#525252;font-size:11px;margin:0;">
            Smarter Events. Better Experiences. · <a href="${BASE_URL}" style="color:#737373;text-decoration:none;">eventsslot.com</a>
          </p>
        </div>
      </div>
    `,
  })
}
