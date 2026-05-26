import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { hasOrganiserAccess } from '@/lib/adminMode'

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')
    const session = await getServerSession(authOptions)

    const event = await prisma.event.findUnique({
      where: { slug },
      include: { organizer: { select: { plan: true } } },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)
    const hasTeamAccess = !!(session?.user?.id && await hasTeamEventAccess({
      userId: session.user.id,
      organizerId: event.organizerId,
      eventId: event.id,
    }))
    const adminAccess = !!(session && await hasOrganiserAccess(session, event.id))

    if (!isOwner && !hasValidToken && !hasTeamAccess && !adminAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch views and registrations
    const [views, registrations, confirmedCount, checkedInCount, waitlistedCount, promotionLogs, sourceBreakdown, feedbackResponses] = await Promise.all([
      prisma.eventView.findMany({ where: { eventId: event.id }, select: { viewedAt: true } }),
      prisma.registration.findMany({
        where: { eventId: event.id },
        select: { submittedAt: true, status: true },
      }),
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
      prisma.registration.count({
        where: {
          eventId: event.id,
          status: { in: ['waitlist', 'WAITLISTED', 'waitlisted'] },
        },
      }),
      prisma.errorLog.findMany({
        where: { route: `waitlist-promotion-email:${event.id}` },
        select: { message: true },
      }),
      prisma.registration.groupBy({
        by: ['source'],
        where: { eventId: event.id },
        _count: { id: true },
      }),
      prisma.attendeeFeedback.findMany({
        where: { eventId: event.id },
        select: { rating: true },
      }),
    ])

    const totalViews = views.length
    const totalRegistrations = registrations.length
    const waitlistCount = waitlistedCount
    const stillWaitingCount = waitlistedCount
    const promotedCount = promotionLogs.reduce((acc, log) => {
      try {
        const parsed = JSON.parse(log.message) as { promoted?: number }
        return acc + (typeof parsed.promoted === 'number' ? parsed.promoted : 0)
      } catch {
        return acc
      }
    }, 0)
    const checkInRate = confirmedCount > 0
      ? Math.round((checkedInCount / confirmedCount) * 100)
      : 0
    const conversionRate = totalViews > 0
      ? Math.round((totalRegistrations / totalViews) * 1000) / 10
      : 0
    const waitlistConversionRate = confirmedCount > 0 && waitlistCount > 0
      ? Math.round((confirmedCount / (confirmedCount + waitlistCount)) * 1000) / 10
      : confirmedCount > 0 ? 100 : 0
    const avgFeedbackScore = feedbackResponses.length > 0
      ? Math.round((feedbackResponses.reduce((sum, row) => sum + (row.rating ?? 0), 0) / feedbackResponses.length) * 10) / 10
      : null

    // Comparative performance vs organizer average
    let vsAverage: number | null = null
    let avgRegistrations: number | null = null
    if (event.organizerId) {
      const allOrgEvents = await prisma.event.findMany({
        where: { organizerId: event.organizerId, id: { not: event.id } },
        include: { _count: { select: { registrations: true } } },
      })
      if (allOrgEvents.length > 0) {
        avgRegistrations = Math.round(
          allOrgEvents.reduce((s, e) => s + e._count.registrations, 0) / allOrgEvents.length
        )
        if (avgRegistrations > 0) {
          vsAverage = Math.round(((registrations.length - avgRegistrations) / avgRegistrations) * 100)
        }
      }
    }

    // Registrations by day (last 30 days)
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const dayMap = new Map<string, number>()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      dayMap.set(key, 0)
    }
    for (const reg of registrations) {
      if (reg.submittedAt >= thirtyDaysAgo) {
        const key = reg.submittedAt.toISOString().slice(0, 10)
        if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1)
      }
    }
    const registrationsByDay = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }))

    // Registrations by hour (0–23)
    const hourMap = new Map<number, number>()
    for (let h = 0; h < 24; h++) hourMap.set(h, 0)
    for (const reg of registrations) {
      const h = reg.submittedAt.getHours()
      hourMap.set(h, (hourMap.get(h) ?? 0) + 1)
    }
    const registrationsByHour = Array.from(hourMap.entries()).map(([hour, count]) => ({ hour, count }))

    return NextResponse.json({
      totalViews,
      totalRegistrations,
      conversionRate,
      confirmedCount,
      checkedInCount,
      checkInRate,
      waitlistCount,
      waitlistedCount,
      promotedCount,
      stillWaitingCount,
      waitlistConversionRate,
      sourceBreakdown: sourceBreakdown.map((item) => ({
        source: item.source ?? 'unknown',
        count: item._count.id,
      })),
      feedbackScore: avgFeedbackScore,
      feedbackCount: feedbackResponses.length,
      vsAverage,
      avgRegistrations,
      aiInsightsFreeUsed: event.aiInsightsFreeUsed,
      event: { capacity: event.capacity },
      registrationsByDay,
      registrationsByHour,
    })
  } catch (err) {
    console.error('Analytics error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
