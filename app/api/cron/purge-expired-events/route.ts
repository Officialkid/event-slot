import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { sendExpiryWarningEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const now = new Date()
    const warningDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

    // --- Send 7-day warnings ---
    const eventsNearingExpiry = await prisma.event.findMany({
      where: {
        expiresAt: {
          gte: now,
          lte: warningDate,
        },
        status: "COMPLETED",
        organizer: {
          plan: "free",
        },
      },
      include: {
        organizer: { select: { email: true, name: true, plan: true } },
      },
    })

    const warningsSent: string[] = []
    for (const event of eventsNearingExpiry) {
      try {
        await sendExpiryWarningEmail({
          to: event.organizer?.email ?? "",
          organizerName: event.organizer?.name ?? "Organiser",
          eventTitle: event.title,
          expiresAt: event.expiresAt!,
        })
        warningsSent.push(event.id)
      } catch (error) {
        console.error(
          `[cron:purge-expired-events] Failed to send warning for event ${event.id}:`,
          error
        )
      }
    }

    // --- Delete expired events ---
    const expiredEvents = await prisma.event.findMany({
      where: {
        expiresAt: { lte: now },
        status: "COMPLETED",
      },
      select: { id: true, title: true },
    })

    const expiredIds = expiredEvents.map((e) => e.id)

    if (expiredIds.length > 0) {
      // Delete registrations first (foreign key constraint)
      await prisma.registration.deleteMany({
        where: { eventId: { in: expiredIds } },
      })

      // Delete event views
      await prisma.eventView.deleteMany({
        where: { eventId: { in: expiredIds } },
      })

      // Delete event feedback
      await prisma.attendeeFeedback.deleteMany({
        where: { eventId: { in: expiredIds } },
      })

      // Delete event unlocks
      await prisma.eventUnlock.deleteMany({
        where: { eventId: { in: expiredIds } },
      })

      // Delete event insights
      await prisma.eventInsight.deleteMany({
        where: { eventId: { in: expiredIds } },
      })

      // Delete team member event access
      await prisma.teamMemberEvent.deleteMany({
        where: { eventId: { in: expiredIds } },
      })

      // Delete events
      await prisma.event.deleteMany({
        where: { id: { in: expiredIds } },
      })
    }

    return NextResponse.json({
      success: true,
      warned: warningsSent.length,
      warningsSent,
      deleted: expiredIds.length,
      deletedEvents: expiredEvents.map((e) => ({ id: e.id, title: e.title })),
      timestamp: now.toISOString(),
    })
  } catch (error) {
    console.error("[cron:purge-expired-events] Error:", error)
    return NextResponse.json(
      { error: "Internal server error", details: String(error) },
      { status: 500 }
    )
  }
}
