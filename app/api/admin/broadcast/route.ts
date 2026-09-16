import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasAdminAccess } from '@/lib/isAdmin'
import { sendEmail } from '@/lib/email'
import { env } from '@/lib/env'
import { getConfiguredEmailFrom } from '@/lib/emailProvider'
import { APP_URL } from '@/lib/config'

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
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#FFFFFF;">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em style="color:#E5E5E5;">$1</em>')

  const paragraphs = formatted.split(/\n\s*\n/)
  return paragraphs
    .map((p) => {
      const lineWithLinks = p.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#C8F55A;text-decoration:underline;">$1</a>')
      return `<p style="margin:0 0 16px;line-height:1.6;color:#D4D4D4;">${lineWithLinks.replace(/\n/g, '<br/>')}</p>`
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
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:540px;margin:0 auto;padding:40px 20px;">

    <div style="margin-bottom:32px;">
      <span style="font-size:24px;font-weight:800;color:#FFFFFF;letter-spacing:-0.03em;">Event</span><span style="font-size:24px;font-weight:800;color:#C8F55A;letter-spacing:-0.03em;">Slot</span>
    </div>

    <div style="font-size:15px;line-height:1.6;">
      ${bodyHtml}
    </div>

    <div style="margin-top:40px;padding-top:24px;border-top:1px solid #2A2A2A;">
      <p style="color:#737373;font-size:12px;margin:0 0 8px;">
        Smarter Events. Better Experiences.
      </p>
      <p style="color:#525252;font-size:11px;margin:0;">
        You received this email because you have an EventSlot account.
        <a href="${unsubscribeUrl}"
           style="color:#737373;text-decoration:underline;">
          Unsubscribe
        </a>
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

    const { subject, htmlContent, mode: rawMode, specificUserIds } = await req.json() as {
      subject: string
      htmlContent: string
      mode?: BroadcastMode
      specificUserIds?: string[]
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
      (r): r is { id: string; name: string | null; email: string } => Boolean(r.email && r.email.includes('@'))
    )

    if (validRecipients.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        mode,
        message: 'No recipients with valid email addresses found.',
      })
    }

    let sent = 0
    let failed = 0
    const failedRecipients: { email: string; error: string }[] = []

    // Paced delivery loop: Resend enforces strict 2 req/s rate limits.
    // 550ms delay keeps throughput safely under limits (~1.8 req/sec).
    for (const recipient of validRecipients) {
      const recipientName = sanitizeName(recipient.name)
      const personalizedContent = htmlContent
        .replace(/\{\{\s*name\s*\}\}/gi, recipientName)
        .replace(/\{\{\s*first[_\s-]?name\s*\}\}/gi, recipientName)

      const emailHtml = buildEmailHtml(personalizedContent, recipient.id)

      let attempts = 0
      let success = false
      let lastErrorMsg = ''

      while (attempts < 3 && !success) {
        attempts++
        try {
          await sendEmail({
            from: EMAIL_FROM,
            to: recipient.email,
            subject: subject.trim(),
            html: emailHtml,
          })
          success = true
          sent++
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
      }

      // Throttle delay between sends
      await new Promise((r) => setTimeout(r, 550))
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
