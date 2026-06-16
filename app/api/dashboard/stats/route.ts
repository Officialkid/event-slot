import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { dashboardStatsCache } from "@/lib/cache"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const email = session.user.email
    const cacheKey = `dashboard-stats:${userId}:${email}`
    const cached = dashboardStatsCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // Backfill unclaimed events for this email (non-critical, isolated)
    try {
      await prisma.event.updateMany({
        where: { organizerEmail: email, organizerId: null },
        data: { organizerId: userId },
      })
    } catch (backfillErr) {
      console.warn('[DASHBOARD STATS] backfill skipped:', backfillErr)
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const organizerFilter = {
      OR: [{ organizerId: userId }, { organizerEmail: email }],
    }

    const [
      totalEvents,
      activeEvents,
      totals,
      eventsThisMonth,
      eventsClosingThisWeek,
      waitlistEventCount,
      registrationsThisMonth,
      registrationsLastMonth,
      totalViews,
      nearCapacityCandidates,
      upcomingCandidates,
      expiredEvents,
      recentRegs,
    ] = await Promise.all([
      prisma.event.count({ where: organizerFilter }).catch(() => 0),
      prisma.event.count({
        where: {
          AND: [
            organizerFilter,
            {
              OR: [{ deadline: null }, { deadline: { gt: now } }],
            },
          ],
        },
      }).catch(() => 0),
      prisma.event.aggregate({
        where: organizerFilter,
        _sum: {
          confirmedCount: true,
          waitlistCount: true,
        },
      }).catch(() => ({ _sum: { confirmedCount: 0, waitlistCount: 0 } })),
      prisma.event.count({
        where: {
          AND: [organizerFilter, { createdAt: { gte: monthStart } }],
        },
      }).catch(() => 0),
      prisma.event.count({
        where: {
          AND: [organizerFilter, { deadline: { gt: now, lte: weekAhead } }],
        },
      }).catch(() => 0),
      prisma.event.count({
        where: {
          AND: [organizerFilter, { waitlistCount: { gt: 0 } }],
        },
      }).catch(() => 0),
      prisma.registration.count({
        where: {
          event: { organizerId: userId },
          status: "confirmed",
          submittedAt: { gte: monthStart },
        },
      }).catch(() => 0),
      prisma.registration.count({
        where: {
          event: { organizerId: userId },
          status: "confirmed",
          submittedAt: { gte: lastMonthStart, lt: monthStart },
        },
      }).catch(() => 0),
      prisma.eventView.count({
        where: { event: { organizerId: userId } },
      }).catch(() => 0),
      prisma.event.findMany({
        where: {
          AND: [
            organizerFilter,
            { status: "active" },
            { capacity: { gt: 0 } },
            {
              OR: [{ deadline: null }, { deadline: { gt: now } }],
            },
          ],
        },
        select: {
          title: true,
          slug: true,
          confirmedCount: true,
          capacity: true,
          dashboardToken: true,
        },
        take: 50,
      }).catch(() => []),
      prisma.event.findMany({
        where: {
          AND: [
            organizerFilter,
            {
              OR: [
                { eventDate: { gt: now } },
                {
                  AND: [
                    { eventDate: null },
                    { deadline: { gt: now } },
                  ],
                },
              ],
            },
          ],
        },
        select: {
          title: true,
          slug: true,
          confirmedCount: true,
          capacity: true,
          eventDate: true,
          deadline: true,
        },
        take: 10,
      }).catch(() => []),
      prisma.event.findMany({
        where: {
          AND: [organizerFilter, { deadline: { lt: now } }],
        },
        select: {
          title: true,
          slug: true,
        },
      }).catch(() => []),
      prisma.registration.findMany({
        where: {
          event: {
            organizerId: userId,
            OR: [{ deadline: null }, { deadline: { gt: sevenDaysAgo } }],
          },
        },
        select: {
          id: true,
          answers: true,
          submittedAt: true,
          event: { select: { title: true, slug: true } },
        },
        orderBy: { submittedAt: 'desc' },
        take: 5,
      }).catch(() => []),
    ])

    const totalRegistrations = totals._sum.confirmedCount ?? 0
    const totalWaitlisted = totals._sum.waitlistCount ?? 0

    const conversionRate = totalViews > 0
      ? Math.round((totalRegistrations / totalViews) * 100)
      : 0

    const eventsNearCapacity = nearCapacityCandidates
      .filter((e) => !!e.capacity && e.confirmedCount / (e.capacity as number) >= 0.8)
      .map((e) => ({
        title: e.title,
        slug: e.slug,
        confirmedCount: e.confirmedCount,
        capacity: e.capacity as number,
        dashboardToken: e.dashboardToken,
      }))
      .sort((a, b) => b.confirmedCount / b.capacity - a.confirmedCount / a.capacity)

    const upcomingEvents = upcomingCandidates
      .map((e) => ({
        title: e.title,
        slug: e.slug,
        confirmedCount: e.confirmedCount,
        capacity: e.capacity,
        eventDate: e.eventDate?.toISOString() ?? null,
        deadline: e.deadline?.toISOString() ?? null,
        sortDate: e.eventDate ?? e.deadline,
      }))
      .filter((e): e is typeof e & { sortDate: Date } => !!e.sortDate)
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
      .slice(0, 3)
      .map(({ sortDate, ...event }) => {
        void sortDate
        return event
      })

    // Trigger feedback notifications for events whose deadline has passed (non-critical)
    if (expiredEvents.length > 0) {
      try {
        const existingFeedbackNotifs = await prisma.notification.findMany({
          where: { userId, type: "EVENT", title: "Feedback Request" },
          select: { link: true },
        })
        const alreadyNotified = new Set(existingFeedbackNotifs.map(n => n.link).filter(Boolean))
        const needFeedback = expiredEvents.filter(e => !alreadyNotified.has(`/dashboard/events/${e.slug}`))
        if (needFeedback.length > 0) {
          await prisma.notification.createMany({
            data: needFeedback.map(e => ({
              userId,
              type: "EVENT",
              title: "Feedback Request",
              message: `How did ${e.title} go? Share your experience with EventSlot.`,
              link: `/dashboard/events/${e.slug}`,
            })),
          })
        }
      } catch (notifErr) {
        console.warn('[DASHBOARD STATS] feedback notification skipped:', notifErr)
      }
    }

    const recentActivity = recentRegs.map(r => {
      const answers = Array.isArray(r.answers)
        ? (r.answers as { questionId: string; value: string }[])
        : []
      const name = answers[0]?.value || "Someone"
      return {
        id: r.id,
        name,
        eventTitle: r.event.title,
        eventSlug: r.event.slug,
        submittedAt: r.submittedAt.toISOString(),
      }
    })

    const payload = {
      totalEvents,
      totalRegistrations,
      activeEvents,
      totalWaitlisted,
      eventsNearCapacity,
      upcomingEvents,
      recentActivity,
      eventsThisMonth,
      registrationsThisMonth,
      registrationsLastMonth,
      conversionRate,
      eventsClosingThisWeek,
      waitlistEventCount,
    }

    dashboardStatsCache.set(cacheKey, payload)

    return NextResponse.json(payload)
  } catch (err) {
    console.error('[DASHBOARD STATS ERROR]', err)
    return NextResponse.json({
      error: "Failed to load stats",
      totalEvents: 0,
      totalRegistrations: 0,
      activeEvents: 0,
      totalWaitlisted: 0,
      eventsNearCapacity: [],
      upcomingEvents: [],
      recentActivity: [],
      eventsThisMonth: 0,
      registrationsThisMonth: 0,
      registrationsLastMonth: 0,
      conversionRate: 0,
      eventsClosingThisWeek: 0,
      waitlistEventCount: 0,
    }, { status: 500 })
  }
}
