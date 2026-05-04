import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Find events that have passed and have not been processed yet.
    const events = await prisma.event.findMany({
      where: {
        feedbackSent: false,
        status: 'active',
        eventDate: { lt: now },
      },
    })

    let totalEvents = 0

    for (const event of events) {
      // Feedback emails to attendees are disabled per privacy policy.
      // Attendees only receive waitlist-to-confirmed emails.
      // Still mark feedbackSent = true so this event is not reprocessed.

      await prisma.event.update({
        where: { id: event.id },
        data: { feedbackSent: true },
      })

      totalEvents++
    }

    return NextResponse.json({ ok: true, eventsProcessed: totalEvents, emailsSent: 0 })
  } catch (err) {
    console.error('[cron/send-feedback] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
