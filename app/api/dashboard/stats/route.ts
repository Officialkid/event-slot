import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id
    const email = session.user.email

    // Backfill unclaimed events for this email
    await prisma.event.updateMany({
      where: { organizerEmail: email, organizerId: null },
      data: { organizerId: userId },
    })

    const now = new Date()

    // All events owned by this organizer
    const events = await prisma.event.findMany({
      where: {
        OR: [{ organizerId: userId }, { organizerEmail: email }],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        capacity: true,
        deadline: true,
        confirmedCount: true,
        waitlistCount: true,
        dashboardToken: true,
        createdAt: true,
      },
    })

    const totalEvents = events.length

    const totalRegistrations = events.reduce((sum, e) => sum + e.confirmedCount, 0)

    // Active: no deadline OR deadline in future
    const activeEvents = events.filter(
      e => e.deadline === null || e.deadline > now
    ).length

    const totalWaitlisted = events.reduce((sum, e) => sum + e.waitlistCount, 0)

    // Events created this calendar month
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const eventsThisMonth = events.filter(e => e.createdAt >= monthStart).length

    // Registrations this month vs last month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const eventIds = events.map(e => e.id)
    const [registrationsThisMonth, registrationsLastMonth] = await Promise.all([
      eventIds.length ? prisma.registration.count({
        where: { eventId: { in: eventIds }, status: "confirmed", submittedAt: { gte: monthStart } },
      }) : Promise.resolve(0),
      eventIds.length ? prisma.registration.count({
        where: { eventId: { in: eventIds }, status: "confirmed", submittedAt: { gte: lastMonthStart, lt: monthStart } },
      }) : Promise.resolve(0),
    ])

    // Events closing within 7 days (active, deadline between now and +7d)
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const eventsClosingThisWeek = events.filter(
      e => e.deadline !== null && e.deadline > now && e.deadline <= weekAhead
    ).length

    // Events that have waitlisted attendees
    const waitlistEventCount = events.filter(e => e.waitlistCount > 0).length

    // Conversion rate: total confirmed / total views
    const totalViews = eventIds.length ? await prisma.eventView.count({
      where: { eventId: { in: eventIds } },
    }) : 0
    const conversionRate = totalViews > 0
      ? Math.round((totalRegistrations / totalViews) * 100)
      : 0

    // Near capacity: active events only, not ended, confirmedCount / capacity >= 0.8
    const eventsNearCapacity = events
      .filter(e => {
        if (e.status !== "active") return false
        if (!e.capacity || e.capacity === 0) return false
        if (e.deadline && e.deadline <= now) return false
        return e.confirmedCount / e.capacity >= 0.8
      })
      .map(e => ({
        title: e.title,
        slug: e.slug,
        confirmedCount: e.confirmedCount,
        capacity: e.capacity as number,
        dashboardToken: e.dashboardToken,
      }))
      .sort((a, b) => b.confirmedCount / b.capacity - a.confirmedCount / a.capacity)

    // Trigger feedback_request notifications for events whose deadline has passed
    const expiredEvents = events.filter(e => e.deadline && e.deadline < now)
    if (expiredEvents.length > 0) {
      const expiredEventIds = expiredEvents.map(e => e.id)
      const existingFeedbackNotifs = await prisma.notification.findMany({
        where: { userId, type: "feedback_request", eventId: { in: expiredEventIds } },
        select: { eventId: true },
      })
      const alreadyNotified = new Set(existingFeedbackNotifs.map(n => n.eventId))
      const needFeedback = expiredEvents.filter(e => !alreadyNotified.has(e.id))
      if (needFeedback.length > 0) {
        await prisma.notification.createMany({
          data: needFeedback.map(e => ({
            userId,
            type: "feedback_request",
            eventId: e.id,
            message: `How did ${e.title} go? Share your experience with EventSlot.`,
          })),
        })
      }
    }

    // Recent activity: last 10 registrations across all organizer events
    const recentRegs = await prisma.registration.findMany({
      where: {
        eventId: { in: eventIds },
        status: "confirmed",
      },
      orderBy: { submittedAt: "desc" },
      take: 10,
      select: {
        id: true,
        answers: true,
        submittedAt: true,
        eventId: true,
        event: {
          select: { title: true, slug: true },
        },
      },
    })

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

    // Upcoming: events with deadline in the future, soonest first, limit 3
    const upcomingEvents = events
      .filter(e => e.deadline !== null && e.deadline > now)
      .sort((a, b) => a.deadline!.getTime() - b.deadline!.getTime())
      .slice(0, 3)
      .map(e => ({
        title: e.title,
        slug: e.slug,
        confirmedCount: e.confirmedCount,
        capacity: e.capacity,
        deadline: e.deadline!.toISOString(),
      }))

    return NextResponse.json({
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
    })
  } catch {
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 })
  }
}
