import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const DIGEST_FROM =
  process.env.RESEND_DIGEST_FROM?.trim() ||
  process.env.RESEND_FROM?.trim() ||
  'EventSlot <onboarding@resend.dev>'

function parseDigestRecipients(): string[] {
  const configured = [
    process.env.SUPER_ADMIN_EMAIL?.trim(),
    process.env.SUPER_ADMIN_EMAIL_2?.trim(),
  ]
    .filter(Boolean)
    .join(',')

  if (!configured) {
    return ['eventslot.co@gmail.com']
  }

  return configured
    .split(/[;,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean)
}

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured')
  }
  return new Resend(apiKey)
}

async function getWaitlistPromotionsThisWeek(oneWeekAgo: Date): Promise<number> {
  const promotionLogs = await prisma.errorLog.findMany({
    where: {
      route: { startsWith: 'waitlist-promotion-email:' },
      createdAt: { gte: oneWeekAgo },
    },
    select: { message: true },
  })

  let promoted = 0

  for (const log of promotionLogs) {
    try {
      const parsed = JSON.parse(log.message) as {
        promoted?: number
        summary?: { promoted?: number }
      }
      const value =
        typeof parsed.promoted === 'number'
          ? parsed.promoted
          : typeof parsed.summary?.promoted === 'number'
          ? parsed.summary.promoted
          : 0
      promoted += value
    } catch {
      // Ignore malformed diagnostics logs.
    }
  }

  return promoted
}

async function getWeeklyHighlights(oneWeekAgo: Date): Promise<Array<{ subject: string; content: string }>> {
  const updates = await prisma.$queryRaw<Array<{ subject: string; content: string }>>(Prisma.sql`
    SELECT "subject", "content"
    FROM "Message"
    WHERE "type" = 'ADMIN_BROADCAST'
      AND "isPublic" = true
      AND "createdAt" >= ${oneWeekAgo}
    ORDER BY "createdAt" DESC
    LIMIT 3
  `)

  return updates
}

export async function POST(req: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET?.trim()
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 })
    }

    const authHeader = req.headers.get('authorization')
    const providedToken = authHeader?.toLowerCase().startsWith('bearer ')
      ? authHeader.slice(7).trim()
      : ''
    const expectedToken = cronSecret

    if (!expectedToken || providedToken !== expectedToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const [
      newUsers,
      totalUsers,
      newEvents,
      totalEvents,
      newRegistrations,
      totalRegistrations,
      waitlistPromotions,
      weeklyHighlights,
    ] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.user.count(),
      prisma.event.count({ where: { createdAt: { gte: oneWeekAgo } } }),
      prisma.event.count(),
      prisma.registration.count({ where: { submittedAt: { gte: oneWeekAgo } } }),
      prisma.registration.count(),
      getWaitlistPromotionsThisWeek(oneWeekAgo),
      getWeeklyHighlights(oneWeekAgo),
    ])

    const weekStr = new Date().toLocaleDateString('en-KE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const highlightsHtml = weeklyHighlights.length > 0
      ? `
        <ul style="margin:0;padding:0 0 0 1.25rem;color:#111827;font-family:Arial,sans-serif;line-height:1.7;">
          ${weeklyHighlights
            .map(
              (item) => `<li style="margin-bottom:0.85rem;"><strong style="color:#0F172A;">${item.subject}</strong><br><span style="color:#374151;">${item.content.length > 180 ? `${item.content.slice(0, 180).trim()}...` : item.content}</span></li>`
            )
            .join('')}
        </ul>
      `
      : `<p style="margin:0;color:#4B5563;font-family:Arial,sans-serif;">No public platform announcements were posted this week.</p>`

    const text = [
      'EventSlot Weekly Digest',
      `Week ending ${weekStr}`,
      '',
      'What shipped this week',
      ...(weeklyHighlights.length > 0
        ? weeklyHighlights.map((item) => `- ${item.subject}: ${item.content.length > 180 ? `${item.content.slice(0, 180).trim()}...` : item.content}`)
        : ['- No public platform announcements were posted this week.']),
      '',
      'Metrics',
      `- New Signups: ${newUsers} (all time: ${totalUsers})`,
      `- Events Created: ${newEvents} (all time: ${totalEvents})`,
      `- Registrations: ${newRegistrations} (all time: ${totalRegistrations})`,
      `- Waitlist Promotions: ${waitlistPromotions}`,
      '',
      'Admin: https://www.eventsslot.com/admin',
    ].join('\n')

    const html = `
      <div style="font-family:Arial,sans-serif;color:#111827;background:#FFFFFF;max-width:620px;margin:0 auto;padding:20px;line-height:1.6;">
      <h2 style="color:#84CC16;font-family:Arial,sans-serif;margin:0 0 6px 0;">EventSlot Weekly Digest</h2>
      <p style="color:#4B5563;font-family:Arial,sans-serif;margin:0 0 18px 0;">Week ending ${weekStr}</p>

      <h3 style="color:#111827;font-family:Arial,sans-serif;margin-top:18px;margin-bottom:10px;">What shipped this week</h3>
      ${highlightsHtml}

      <h3 style="color:#111827;font-family:Arial,sans-serif;margin-top:22px;margin-bottom:10px;">Metrics</h3>
      <table style="border-collapse:collapse;width:100%;max-width:560px;font-family:Arial,sans-serif;border:1px solid #E5E7EB;">
        <tr style="background:#F3F4F6;">
          <th style="padding:10px;text-align:left;color:#111827;border-bottom:1px solid #E5E7EB;">Metric</th>
          <th style="padding:10px;text-align:right;color:#111827;border-bottom:1px solid #E5E7EB;">This Week</th>
          <th style="padding:10px;text-align:right;color:#111827;border-bottom:1px solid #E5E7EB;">All Time</th>
        </tr>
        ${[
          ['New Signups', newUsers, totalUsers],
          ['Events Created', newEvents, totalEvents],
          ['Registrations', newRegistrations, totalRegistrations],
          ['Waitlist Promotions', waitlistPromotions, '-'],
        ]
          .map(
            ([label, week, total], i) => `
          <tr style="background:${i % 2 === 0 ? '#FFFFFF' : '#F9FAFB'};">
            <td style="padding:10px;color:#111827;border-bottom:1px solid #E5E7EB;">${label}</td>
            <td style="padding:10px;text-align:right;color:#111827;font-weight:bold;border-bottom:1px solid #E5E7EB;">${week}</td>
            <td style="padding:10px;text-align:right;color:#374151;border-bottom:1px solid #E5E7EB;">${total}</td>
          </tr>
        `
          )
          .join('')}
      </table>

      <p style="margin-top:24px;">
        <a href="https://www.eventsslot.com/admin"
           style="background:#C8F55A;color:#000;padding:10px 20px;text-decoration:none;border-radius:6px;font-weight:bold;">
          Open Admin Dashboard ->
        </a>
      </p>
      </div>
    `

    const resend = getResendClient()
    const recipients = parseDigestRecipients()

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No digest recipients configured' }, { status: 500 })
    }

    const sendResult = await resend.emails.send({
      from: DIGEST_FROM.trim(),
      to: recipients,
      subject: `EventSlot Weekly Digest - ${weekStr}`,
      html,
      text,
    })

    if (sendResult.error) {
      console.error('[cron/weekly-digest] Resend error:', sendResult.error)
      return NextResponse.json({ error: 'Failed to send digest email' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      sentAt: new Date().toISOString(),
      metrics: {
        newUsers,
        totalUsers,
        newEvents,
        totalEvents,
        newRegistrations,
        totalRegistrations,
        waitlistPromotions,
      },
      weeklyHighlights,
    })
  } catch (err) {
    console.error('[cron/weekly-digest] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}