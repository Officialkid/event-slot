import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendPostEventSummaryEmail } from '@/lib/email'

// GET /api/cron/post-event-summary
// Cloud Scheduler: every hour  (0 * * * *)
// Checks for events that ended in the last hour and sends summary to organiser.
export async function GET() {
  try {
    const oneHourAgo = new Date(Date.now() - 3_600_000)
    const twoHoursAgo = new Date(Date.now() - 7_200_000)

    // Events that ended between 1-2 hours ago (window avoids duplicates)
    const endedEvents = await prisma.event.findMany({
      where: {
        eventDate: { gte: twoHoursAgo, lt: oneHourAgo },
        summaryEmailSent: false,
        organizerId: { not: null },
      },
      include: {
        organizer: { select: { email: true, name: true } },
        _count: { select: { registrations: true } },
      },
    })

    let processed = 0

    for (const event of endedEvents) {
      if (!event.organizer?.email) continue

      const [confirmedCount, checkedIn, feedbackResponses] = await Promise.all([
        prisma.registration.count({
          where: {
            eventId: event.id,
            status: { in: ['confirmed', 'CONFIRMED'] },
          },
        }),
        prisma.ticket.count({
          where: {
            registration: { eventId: event.id },
            scannedAt: { not: null },
          },
        }),
        prisma.attendeeFeedback.findMany({
          where: { eventId: event.id },
          select: { rating: true },
        }),
      ])

      const checkInRate = confirmedCount > 0
        ? Math.round((checkedIn / confirmedCount) * 100)
        : 0

      const avgFeedbackScore = feedbackResponses.length > 0
        ? (feedbackResponses.reduce((s, r) => s + (r.rating ?? 0), 0) / feedbackResponses.length).toFixed(1)
        : null

      await sendPostEventSummaryEmail({
        to: event.organizer.email,
        organizerName: event.organizer.name,
        eventTitle: event.title,
        eventSlug: event.slug,
        totalRegistrations: event._count.registrations,
        confirmedCount,
        checkInRate,
        avgFeedbackScore,
      })

      await prisma.event.update({
        where: { id: event.id },
        data: { summaryEmailSent: true },
      })

      processed++
    }

    return NextResponse.json({ processed })
  } catch (err) {
    console.error('Post-event summary cron error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
