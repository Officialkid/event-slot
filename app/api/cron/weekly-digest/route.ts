import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { Resend } from 'resend'

const DIGEST_FROM =
  process.env.RESEND_DIGEST_FROM?.trim() ||
  process.env.RESEND_FROM?.trim() ||
  'EventSlot Digest <digest@eventsslot.com>'

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
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
        <ul style="margin:0;padding:0 0 0 1.25rem;color:#F0EDE6;font-family:sans-serif;line-height:1.6;">
          ${weeklyHighlights
            .map(
              (item) => `<li style="margin-bottom:0.65rem;"><strong style="color:#C8F55A;">${item.subject}</strong><br><span style="color:#bbb;">${item.content.length > 180 ? `${item.content.slice(0, 180).trim()}…` : item.content}</span></li>`
            )
            .join('')}
        </ul>
      `
      : `<p style="margin:0;color:#bbb;font-family:sans-serif;">No public platform announcements were posted this week.</p>`

    const html = `
      <h2 style="color:#C8F55A;font-family:sans-serif;">EventSlot Weekly Digest</h2>
      <p style="color:#666;font-family:sans-serif;">Week ending ${weekStr}</p>

      <h3 style="color:#F0EDE6;font-family:sans-serif;margin-top:24px;margin-bottom:12px;">What shipped this week</h3>
      ${highlightsHtml}

      <h3 style="color:#F0EDE6;font-family:sans-serif;margin-top:28px;margin-bottom:12px;">Metrics</h3>
      <table style="border-collapse:collapse;width:100%;max-width:500px;font-family:sans-serif;">
        <tr style="background:#141414;">
          <th style="padding:12px;text-align:left;color:#888;">Metric</th>
          <th style="padding:12px;text-align:right;color:#888;">This Week</th>
          <th style="padding:12px;text-align:right;color:#888;">All Time</th>
        </tr>
        ${[
          ['New Signups', newUsers, totalUsers],
          ['Events Created', newEvents, totalEvents],
          ['Registrations', newRegistrations, totalRegistrations],
          ['Waitlist Promotions', waitlistPromotions, '-'],
        ]
          .map(
            ([label, week, total], i) => `
          <tr style="background:${i % 2 === 0 ? '#0A0A0A' : '#141414'};">
            <td style="padding:12px;color:#fff;">${label}</td>
            <td style="padding:12px;text-align:right;color:#C8F55A;font-weight:bold;">${week}</td>
            <td style="padding:12px;text-align:right;color:#888;">${total}</td>
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
    `

    const resend = getResendClient()
    const sendResult = await resend.emails.send({
      from: DIGEST_FROM,
      to: process.env.SUPER_ADMIN_EMAIL ?? 'eventslot.co@gmail.com',
      subject: `EventSlot Weekly Digest - ${weekStr}`,
      html,
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