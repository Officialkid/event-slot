import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET?.trim()

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const now = new Date()

    // Find due scheduled content assets
    const dueItems = await prisma.marketingContentItem.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: { lte: now },
      },
      take: 10,
    })

    if (dueItems.length === 0) {
      return NextResponse.json({ message: "No scheduled marketing content due.", processed: 0 })
    }

    const processed = []

    for (const item of dueItems) {
      // Mark publishing
      await prisma.marketingContentItem.update({
        where: { id: item.id },
        data: { status: "PUBLISHING" },
      })

      // In V1: For social channels where manual posting / future API is supported, mark as PUBLISHED
      // and record execution timestamp
      const published = await prisma.marketingContentItem.update({
        where: { id: item.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      })

      // Add to audit trail
      await prisma.marketingContentAuditTrail.create({
        data: {
          contentId: item.id,
          actorId: "system-cron-scheduler",
          action: "PUBLISHED",
          previousStatus: "SCHEDULED",
          newStatus: "PUBLISHED",
          notes: `Automatically published at scheduled time (${item.scheduledFor?.toISOString()}).`,
        },
      })

      await prisma.marketingAuditLog.create({
        data: {
          actorId: "system-cron-scheduler",
          actorEmail: "scheduler@eventsslot.com",
          action: "CONTENT_AUTO_PUBLISHED",
          entityType: "CONTENT",
          entityId: item.id,
          metadata: { title: item.title, channel: item.channel },
        },
      })

      processed.push({ id: item.id, title: item.title, channel: item.channel })
    }

    return NextResponse.json({
      success: true,
      processed: processed.length,
      items: processed,
    })
  } catch (error) {
    console.error("[Marketing scheduler cron error]", error)
    return NextResponse.json({ error: "Scheduler cron failed." }, { status: 500 })
  }
}
