import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendFeedbackRequestEmail } from '@/lib/email'
import { getPlanLimits } from '@/lib/plans'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()

    // Find events that have passed, haven't had feedback sent, and belong to business-plan organizers
    const events = await prisma.event.findMany({
      where: {
        feedbackSent: false,
        status: 'active',
        eventDate: { lt: now },
      },
      include: {
        organizer: { select: { plan: true } },
        registrations: {
          where: { status: 'confirmed', attendeeEmail: { not: null }, consentTransactional: true },
          select: { id: true, attendeeEmail: true },
        },
      },
    })

    let totalEmails = 0
    let totalEvents = 0

    for (const event of events) {
      const plan = event.organizer?.plan ?? 'free'
      const limits = getPlanLimits(plan)
      if (!limits.canSendFeedbackForm) continue

      const recipients = event.registrations.filter(
        (r): r is typeof r & { attendeeEmail: string } => !!r.attendeeEmail
      )

      for (const reg of recipients) {
        try {
          await sendFeedbackRequestEmail({
            to: reg.attendeeEmail,
            eventTitle: event.title,
            registrationId: reg.id,
          })
          totalEmails++
        } catch {
          // Log but continue — don't block other sends
        }
      }

      await prisma.event.update({
        where: { id: event.id },
        data: { feedbackSent: true },
      })

      totalEvents++
    }

    return NextResponse.json({ ok: true, eventsProcessed: totalEvents, emailsSent: totalEmails })
  } catch (err) {
    console.error('[cron/send-feedback] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
