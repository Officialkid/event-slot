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
        capacity: true,
        deadline: true,
        confirmedCount: true,
        waitlistCount: true,
        dashboardToken: true,
      },
    })

    const totalEvents = events.length

    const totalRegistrations = events.reduce((sum, e) => sum + e.confirmedCount, 0)

    // Active: no deadline OR deadline in future
    const activeEvents = events.filter(
      e => e.deadline === null || e.deadline > now
    ).length

    const totalWaitlisted = events.reduce((sum, e) => sum + e.waitlistCount, 0)

    // Near capacity: confirmedCount / capacity >= 0.8, and has a capacity set
    const eventsNearCapacity = events
      .filter(e => {
        if (!e.capacity || e.capacity === 0) return false
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
    const eventIds = events.map(e => e.id)
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

    return NextResponse.json({
      totalEvents,
      totalRegistrations,
      activeEvents,
      totalWaitlisted,
      eventsNearCapacity,
      recentActivity,
    })
  } catch {
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 })
  }
}
