import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasAdminAccess } from '@/lib/isAdmin'
import { sendEmail } from '@/lib/email'

const EMAIL_FROM = process.env.RESEND_FROM?.trim() || 'EventSlot <hello@eventsslot.com>'
const BATCH_SIZE = 50
const BATCH_DELAY_MS = 500

type BroadcastMode = 'ALL' | 'SUBSCRIBED' | 'INDIVIDUAL'

function parseMode(value: string | null): BroadcastMode {
  if (value === 'ALL' || value === 'SUBSCRIBED' || value === 'INDIVIDUAL') {
    return value
  }
  return 'SUBSCRIBED'
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function buildEmailHtml(content: string, userId: string): string {
  const unsubscribeUrl = `https://www.eventsslot.com/api/email/unsubscribe?id=${userId}`

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:40px 20px;">

    <div style="margin-bottom:32px;">
      <span style="font-size:22px;font-weight:bold;color:#fff;">Event</span>
      <span style="font-size:22px;font-weight:bold;color:#C8F55A;">Slot</span>
    </div>

    <div style="color:#A3A3A3;font-size:15px;line-height:1.6;">
      ${content}
    </div>

    <div style="margin-top:40px;padding-top:24px;border-top:1px solid #2A2A2A;">
      <p style="color:#525252;font-size:12px;margin:0 0 8px;">
        Smarter Events. Better Experiences.
      </p>
      <p style="color:#525252;font-size:11px;margin:0;">
        You received this email because you have an EventSlot account.
        <a href="${unsubscribeUrl}"
           style="color:#525252;text-decoration:underline;">
          Unsubscribe
        </a>
      </p>
    </div>
  </div>
</body>
</html>
`
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

    if (recipients.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        mode,
        message: 'No recipients found',
      })
    }

    const validRecipients = recipients.filter((u): u is typeof u & { email: string } => Boolean(u.email))
    const batches = chunk(validRecipients, BATCH_SIZE)
    let sent = 0
    let failed = 0
    const failedRecipients: string[] = []

    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i]
      const results = await Promise.allSettled(
        batch.map((user) =>
          sendEmail({
            from: EMAIL_FROM,
            to: user.email,
            replyTo: 'eventslot.co@gmail.com',
            subject: subject.trim(),
            html: buildEmailHtml(
              htmlContent.replace(/\{\{name\}\}/g, user.name ?? 'there'),
              user.id
            ),
          })
        )
      )

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          sent += 1
          return
        }

        failed += 1
        const failedEmail = batch[index]?.email
        if (failedEmail) failedRecipients.push(failedEmail)
        console.error(`Failed to send broadcast to ${failedEmail ?? 'unknown recipient'}:`, result.reason)
      })

      if (i < batches.length - 1) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
      }
    }

    await prisma.message.create({
      data: {
        type: 'ADMIN_BROADCAST',
        authorId: session?.user?.id ?? null,
        subject: subject.trim(),
        content: htmlContent.trim(),
        isPublic: true,
      },
    })

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
