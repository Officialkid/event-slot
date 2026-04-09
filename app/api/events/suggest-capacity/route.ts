import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Fetch last 5 completed events (deadline passed) with a capacity set
    const events = await prisma.event.findMany({
      where: {
        organizerId: userId,
        deadline: { lt: new Date() },
        capacity: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        capacity: true,
        confirmedCount: true,
        registrations: {
          where: { status: "confirmed" },
          orderBy: { submittedAt: "asc" },
          select: { submittedAt: true },
        },
      },
    })

    if (events.length < 3) {
      return NextResponse.json({ suggestion: null })
    }

    // Per-event metrics
    const metrics = events.map(ev => {
      const cap = ev.capacity as number
      const confirmed = ev.confirmedCount
      const fillRate = confirmed / cap

      // Approximate fill time: time from first registration to registration at the capacity index
      let fillDays: number | null = null
      if (ev.registrations.length >= cap && ev.registrations.length >= 2) {
        const first = new Date(ev.registrations[0].submittedAt).getTime()
        const atCapacity = new Date(ev.registrations[cap - 1].submittedAt).getTime()
        const diffMs = atCapacity - first
        fillDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)))
      }

      return { cap, confirmed, fillRate, fillDays }
    })

    const count = metrics.length
    const avgFillRate = metrics.reduce((s, m) => s + m.fillRate, 0) / count
    const avgConfirmed = metrics.reduce((s, m) => s + m.confirmed, 0) / count
    const suggestedCapacity = Math.round(avgConfirmed * 1.2)

    // Fastest fill time across events that fully filled
    const fillTimes = metrics.map(m => m.fillDays).filter((d): d is number => d !== null)
    const fastestFillDays = fillTimes.length > 0 ? Math.min(...fillTimes) : null

    // Build a human-readable message
    const avgPct = Math.round(avgFillRate * 100)
    let message =
      `Your last ${count} event${count > 1 ? "s" : ""} averaged ${Math.round(avgConfirmed)} attendees` +
      (fastestFillDays !== null
        ? ` and filled within ${fastestFillDays} day${fastestFillDays !== 1 ? "s" : ""}`
        : "")

    if (avgPct >= 85) {
      message += `. Your events fill up fast — we suggest starting with ${suggestedCapacity}.`
    } else if (avgPct >= 50) {
      message += `. We suggest starting with ${suggestedCapacity} to give a little room to grow.`
    } else {
      message += `. Your fill rate is around ${avgPct}% — we suggest ${suggestedCapacity} based on past attendance.`
    }

    return NextResponse.json({
      suggestion: {
        suggestedCapacity,
        averageFillRate: avgPct,
        basedOnEvents: count,
        message,
      },
    })
  } catch (err) {
    console.error("[events/suggest-capacity] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
