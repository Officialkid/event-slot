import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasAdminAccess } from "@/lib/isAdmin"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scheduled = await prisma.scheduledBroadcast.findMany({
      orderBy: { scheduledFor: "asc" },
      take: 50,
    })

    return NextResponse.json({ scheduled })
  } catch (error) {
    console.error("[schedule/broadcast GET] Error:", error)
    return NextResponse.json({ error: "Failed to fetch scheduled broadcasts" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      title,
      subject,
      layoutType = "PROMOTIONAL_HERO",
      preheader,
      bannerUrl,
      content,
      ctaText,
      ctaUrl,
      eventDateLabel,
      eventLocation,
      eventBadge,
      mode = "SUBSCRIBED",
      specificUserIds,
      scheduledFor: rawScheduledFor,
    } = body

    if (!subject?.trim()) {
      return NextResponse.json({ error: "Subject is required" }, { status: 400 })
    }

    if (!content?.trim()) {
      return NextResponse.json({ error: "Email content is required" }, { status: 400 })
    }

    if (!rawScheduledFor) {
      return NextResponse.json({ error: "Scheduled date and time are required" }, { status: 400 })
    }

    const scheduledFor = new Date(rawScheduledFor)
    if (isNaN(scheduledFor.getTime())) {
      return NextResponse.json({ error: "Invalid scheduled date/time format" }, { status: 400 })
    }

    const now = new Date()
    // Must be at least 1 minute in the future
    if (scheduledFor.getTime() <= now.getTime() - 60000) {
      return NextResponse.json({ error: "Scheduled time must be in the future" }, { status: 400 })
    }

    // Must be within 90 days (approx 3 months)
    const maxFuture = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    if (scheduledFor.getTime() > maxFuture.getTime()) {
      return NextResponse.json({ error: "Cannot schedule more than 3 months in advance" }, { status: 400 })
    }

    const broadcast = await prisma.scheduledBroadcast.create({
      data: {
        title: title?.trim() || subject.trim(),
        subject: subject.trim(),
        layoutType: layoutType === "TEXT_MINIMAL" ? "TEXT_MINIMAL" : "PROMOTIONAL_HERO",
        preheader: preheader?.trim() || null,
        bannerUrl: bannerUrl?.trim() || null,
        content: content.trim(),
        ctaText: ctaText?.trim() || null,
        ctaUrl: ctaUrl?.trim() || null,
        eventDateLabel: eventDateLabel?.trim() || null,
        eventLocation: eventLocation?.trim() || null,
        eventBadge: eventBadge?.trim() || null,
        mode: mode === "ALL" || mode === "INDIVIDUAL" ? mode : "SUBSCRIBED",
        specificUserIds: specificUserIds || null,
        scheduledFor,
        status: "SCHEDULED",
        createdById: session?.user?.id || null,
      },
    })

    return NextResponse.json({ success: true, broadcast })
  } catch (error) {
    console.error("[schedule/broadcast POST] Error:", error)
    return NextResponse.json({ error: "Failed to schedule broadcast" }, { status: 500 })
  }
}
