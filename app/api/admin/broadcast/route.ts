import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasAdminAccess } from '@/lib/isAdmin'
import { sendEmail } from '@/lib/email'
import { env } from '@/lib/env'
import { getConfiguredEmailFrom } from '@/lib/emailProvider'
import { APP_URL } from '@/lib/config'
import { renderBroadcastEmail, type BroadcastLayoutType } from '@/lib/emailTemplates'
import { isDeliverableEmail } from '@/lib/email/disposableDomains'

const EMAIL_FROM = getConfiguredEmailFrom(env, 'EventSlot <hello@eventsslot.com>')

type BroadcastMode = 'ALL' | 'SUBSCRIBED' | 'INDIVIDUAL'

function parseMode(value: string | null): BroadcastMode {
  if (value === 'ALL' || value === 'SUBSCRIBED' || value === 'INDIVIDUAL') {
    return value
  }
  return 'SUBSCRIBED'
}

function formatBroadcastBody(content: string): string {
  if (/<[a-z][\s\S]*>/i.test(content)) {
    return content
  }
  let formatted = content
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#111827;font-weight:700;">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em style="color:#4B5563;">$1</em>')

  const paragraphs = formatted.split(/\n\s*\n/)
  return paragraphs
    .map((p) => {
      const lineWithLinks = p.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#15803d;text-decoration:underline;font-weight:600;">$1</a>')
      return `<p style="margin:0 0 16px;line-height:1.68;color:#374151;font-size:15px;">${lineWithLinks.replace(/\n/g, '<br/>')}</p>`
    })
    .join('')
}

function buildEmailHtml(content: string, userId: string): string {
  const unsubscribeUrl = `${APP_URL}/api/email/unsubscribe?id=${userId}`
  const bodyHtml = formatBroadcastBody(content)

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:580px;margin:0 auto;padding:36px 16px;">

    <!-- Brand Header -->
    <div style="margin-bottom:28px;">
      <a href="https://www.eventsslot.com" target="_blank" rel="noopener noreferrer" style="text-decoration:none;display:inline-block;">
        <span style="font-size:26px;font-weight:800;color:#111827;letter-spacing:-0.03em;">Event<span style="color:#15803d;">Slot</span></span>
      </a>
    </div>

    <!-- Main White Card -->
    <div style="background:#FFFFFF;border:1px solid #E5E7EB;border-radius:16px;padding:32px 28px;box-shadow:0 4px 20px rgba(0,0,0,0.03);font-size:15px;line-height:1.68;color:#374151;">
      ${bodyHtml}
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid #F3F4F6;color:#111827;font-size:15px;line-height:1.6;">
        <p style="margin:0;">Warm regards,<br/><strong>Daniel and the EventSlot Team</strong> 💙</p>
      </div>
    </div>

    <!-- Paystack-Inspired Compliance & Branding Footer -->
    <div style="margin-top:36px;padding-top:24px;border-top:1px solid #E5E7EB;text-align:left;font-size:12px;line-height:1.6;color:#6B7280;">
      <p style="margin:0 0 10px;">
        To make sure you keep getting these emails, please add <a href="mailto:hello@eventsslot.com" style="color:#15803d;text-decoration:none;font-weight:600;">hello@eventsslot.com</a> to your address book or allow list.
      </p>
      <p style="margin:0 0 14px;">
        Want to control the kind of emails you receive from EventSlot? <a href="${APP_URL}/settings/notifications" style="color:#15803d;text-decoration:underline;">Update your email preferences</a>. Want out of the loop? <a href="${unsubscribeUrl}" style="color:#6B7280;text-decoration:underline;">Unsubscribe</a>.
      </p>
      <p style="margin:0 0 8px;color:#9CA3AF;font-size:11px;">
        The Pavilion, Westlands, Nairobi, Kenya
      </p>
      <p style="margin:0;color:#6B7280;font-size:11px;font-weight:600;">
        Powered by <a href="https://www.eventsslot.com" target="_blank" rel="noopener noreferrer" style="color:#15803d;font-weight:700;text-decoration:none;">EventSlot</a> &bull; <a href="https://www.eventsslot.com" target="_blank" rel="noopener noreferrer" style="color:#15803d;text-decoration:underline;">www.eventsslot.com</a>
      </p>
    </div>

  </div>
</body>
</html>
`
}

function sanitizeName(rawName: string | null | undefined): string {
  if (!rawName) return 'there'
  const trimmed = rawName.trim()
  if (!trimmed) return 'there'
  if (trimmed.includes('@') || (/^[a-z0-9._%+-]+$/i.test(trimmed) && trimmed.length > 15)) {
    return 'there'
  }
  const first = trimmed.split(/\s+/)[0]
  if (!first || first.length < 2) return 'there'
  if (/^kid$/i.test(first) || /^officialkid$/i.test(first)) return 'there'
  return first.charAt(0).toUpperCase() + first.slice(1)
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const mode = parseMode(req.nextUrl.searchParams.get('mode'))

    if (mode === 'INDIVIDUAL') {
      return NextResponse.json({
        recipientCount: 0,
        sampleRecipients: [],
        mode,
      })
    }

    const where = mode === 'SUBSCRIBED'
      ? { marketingConsent: true, email: { not: null }, suspended: false }
      : { email: { not: null }, suspended: false }

    const [recipientCount, sampleRecipients] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true, marketingConsent: true },
        take: 5,
      }),
    ])

    return NextResponse.json({
      recipientCount,
      sampleRecipients,
      mode,
    })
  } catch (error) {
    console.error('Error fetching broadcast preview:', error)
    return NextResponse.json(
      { error: 'Failed to fetch preview' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const {
      subject,
      htmlContent,
      mode: rawMode,
      specificUserIds,
      layoutType = 'PROMOTIONAL_HERO',
      preheader,
      bannerUrl,
      ctaText,
      ctaUrl,
      eventDateLabel,
      eventLocation,
      eventBadge,
    } = (await req.json()) as {
      subject: string
      htmlContent: string
      mode?: BroadcastMode
      specificUserIds?: string[]
      layoutType?: BroadcastLayoutType
      preheader?: string
      bannerUrl?: string
      ctaText?: string
      ctaUrl?: string
      eventDateLabel?: string
      eventLocation?: string
      eventBadge?: string
    }

    const mode = parseMode(rawMode ?? null)

    if (!subject?.trim() || !htmlContent?.trim()) {
      return NextResponse.json({ error: 'Subject and content required' }, { status: 400 })
    }

    let recipients: { id: string; name: string | null; email: string | null }[] = []

    if (mode === 'INDIVIDUAL') {
      if (!specificUserIds?.length) {
        return NextResponse.json({ error: 'No users selected' }, { status: 400 })
      }
      recipients = await prisma.user.findMany({
        where: { id: { in: specificUserIds }, suspended: false, email: { not: null } },
        select: { id: true, name: true, email: true },
      })
    } else {
      const where = mode === 'SUBSCRIBED'
        ? { suspended: false, email: { not: null }, marketingConsent: true }
        : { suspended: false, email: { not: null } }
      recipients = await prisma.user.findMany({
        where,
        select: { id: true, name: true, email: true },
      })
    }

    const validRecipients = recipients.filter(
      (r): r is { id: string; name: string | null; email: string } => Boolean(r.email && isDeliverableEmail(r.email))
    )

    if (validRecipients.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        mode,
        message: 'No deliverable recipients found (disposable/invalid domains filtered).',
      })
    }

    let sent = 0
    let failed = 0
    const failedRecipients: { email: string; error: string }[] = []

    // Paced delivery loop using Nodemailer Primary with Resend Backup
    for (const recipient of validRecipients) {
      const emailHtml = renderBroadcastEmail({
        layoutType,
        subject: subject.trim(),
        preheader,
        bannerUrl,
        content: htmlContent,
        ctaText,
        ctaUrl,
        eventDateLabel,
        eventLocation,
        eventBadge,
        recipientName: recipient.name,
        userId: recipient.id,
      })

      let attempts = 0
      let success = false
      let lastErrorMsg = ''

      while (attempts < 3 && !success) {
        attempts++
        try {
          await sendEmail({
            from: EMAIL_FROM,
            category: 'marketing',
            unsubscribeUrl: `${APP_URL}/unsubscribe?email=${encodeURIComponent(recipient.email)}`,
            to: recipient.email,
            subject: subject.trim(),
            html: emailHtml,
          })
          success = true
          sent++

          // Reset bounce count on successful delivery
          await prisma.user.updateMany({
            where: { id: recipient.id, emailBounceCount: { gt: 0 } },
            data: { emailBounceCount: 0, bounceReason: null },
          })
        } catch (err) {
          lastErrorMsg = err instanceof Error ? err.message : String(err)
          if (/429|too many|rate/i.test(lastErrorMsg) && attempts < 3) {
            await new Promise((r) => setTimeout(r, 1200 * attempts))
          } else {
            break
          }
        }
      }

      if (!success) {
        failed++
        failedRecipients.push({ email: recipient.email, error: lastErrorMsg })
        console.error(`[admin/broadcast] Delivery failed for ${recipient.email}:`, lastErrorMsg)

        // Bounce Shield: Auto-unsubscribe after 3 bounces or on permanent relay rejection
        try {
          const user = await prisma.user.findUnique({
            where: { id: recipient.id },
            select: { id: true, emailBounceCount: true },
          })
          if (user) {
            const nextBounceCount = (user.emailBounceCount ?? 0) + 1
            const isHardFailure = /relay access denied|mailbox unavailable|550|554|user unknown|recipient rejected/i.test(lastErrorMsg)
            const shouldUnsubscribe = nextBounceCount >= 3 || isHardFailure

            await prisma.user.update({
              where: { id: user.id },
              data: {
                emailBounceCount: nextBounceCount,
                lastBouncedAt: new Date(),
                bounceReason: lastErrorMsg.slice(0, 255),
                ...(shouldUnsubscribe ? { marketingConsent: false } : {}),
              },
            })

            if (shouldUnsubscribe) {
              console.warn(`[Bounce Shield] Auto-unsubscribed ${recipient.email} after ${nextBounceCount} failure(s): ${lastErrorMsg}`)
            }
          }
        } catch (updateErr) {
          console.error('[Bounce Shield] Failed to record bounce for user:', updateErr)
        }
      }

      // 250ms pacing between recipients (safe for SMTP & Resend backup)
      await new Promise((r) => setTimeout(r, 250))
    }

    if (session?.user?.id) {
      await prisma.auditLog.create({
        data: {
          actorId: session.user.id,
          action: 'BROADCAST_EMAIL',
          metadata: {
            subject,
            mode,
            recipientCount: validRecipients.length,
            sentCount: sent,
            failedCount: failed,
            failedRecipients,
          },
        },
      })
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      mode,
      message: failed > 0
        ? `Broadcast sent to ${sent} recipients. ${failed} failed.`
        : `Broadcast sent to ${sent} recipients.`,
    })
  } catch (err) {
    console.error('[admin/broadcast] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
