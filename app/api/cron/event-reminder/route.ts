import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendOrganizerEventReminderEmail } from '@/lib/email'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    // Window: events happening between 24 h and 48 h from now
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000)

    const events = await prisma.event.findMany({
      where: {
        reminderSent: false,
        status: 'active',
        archived: false,
        eventDate: { gte: in24h, lte: in48h },
        organizerId: { not: null },
      },
      select: {
        id: true,
        title: true,
        eventDate: true,
        organizer: { select: { email: true, consentSystemEmails: true } },
      },
    })

    let sent = 0

    for (const event of events) {
      // Always mark reminderSent to avoid duplicate runs
      await prisma.event.update({ where: { id: event.id }, data: { reminderSent: true } })

      const organizer = event.organizer
      if (!organizer?.email || !organizer.consentSystemEmails || !event.eventDate) continue

      try {
        await sendOrganizerEventReminderEmail({
          to: organizer.email,
          eventTitle: event.title,
          eventDate: event.eventDate,
        })
        sent++
      } catch {
        // Non-critical — reminder is best-effort
      }
    }

    return NextResponse.json({ ok: true, eventsProcessed: events.length, remindersSent: sent })
  } catch (err) {
    console.error('[cron/event-reminder] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
