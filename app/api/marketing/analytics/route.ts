import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireMarketingContext } from "@/lib/marketing/rbac"

export async function GET(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canViewAnalytics")
  if (auth.errorResponse) return auth.errorResponse

  const { searchParams } = new URL(req.url)
  const range = searchParams.get("range") || "last_30_days"

  try {
    const now = new Date()
    let startDate: Date

    switch (range) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case "yesterday":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        break
      case "last_7_days":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case "this_month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case "last_month":
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        break
      case "last_30_days":
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
    }

    // 1. Campaign counts
    const [activeCampaigns, totalCampaigns] = await Promise.all([
      prisma.marketingCampaign.count({ where: { status: "ACTIVE" } }),
      prisma.marketingCampaign.count(),
    ])

    // 2. Content counts
    const [scheduledContent, publishedContent, pendingApprovals, upcomingScheduled] = await Promise.all([
      prisma.marketingContentItem.count({ where: { status: "SCHEDULED" } }),
      prisma.marketingContentItem.count({ where: { status: "PUBLISHED" } }),
      prisma.marketingContentItem.count({ where: { status: "IN_REVIEW" } }),
      prisma.marketingContentItem.findMany({
        where: { status: "SCHEDULED", scheduledFor: { gte: now } },
        orderBy: { scheduledFor: "asc" },
        take: 5,
        include: {
          campaign: { select: { name: true, campaignId: true } },
        },
      }),
    ])

    // 3. Platform conversions & activity in range
    const [signupsCount, eventsCreatedCount, eventsPublishedCount] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: startDate } } }),
      prisma.event.count({ where: { createdAt: { gte: startDate } } }),
      prisma.event.count({ where: { createdAt: { gte: startDate }, status: "active" } }),
    ])

    // 4. Marketing touches & attribution breakdown
    const touches = await prisma.marketingAttributionTouch.findMany({
      where: { createdAt: { gte: startDate } },
      select: {
        visitorId: true,
        utmSource: true,
        utmCampaign: true,
        conversionAction: true,
        touchType: true,
      },
    })

    const trackedVisits = touches.length
    const uniqueVisitors = new Set(touches.map((t) => t.visitorId)).size

    let trackedCount = 0
    let attributedCount = 0
    let directCount = 0
    let unknownCount = 0

    const channelStats: Record<string, { visits: number; clicks: number; signups: number; events: number }> = {
      instagram: { visits: 0, clicks: 0, signups: 0, events: 0 },
      linkedin: { visits: 0, clicks: 0, signups: 0, events: 0 },
      email: { visits: 0, clicks: 0, signups: 0, events: 0 },
      whatsapp: { visits: 0, clicks: 0, signups: 0, events: 0 },
      direct: { visits: 0, clicks: 0, signups: 0, events: 0 },
      other: { visits: 0, clicks: 0, signups: 0, events: 0 },
    }

    for (const t of touches) {
      const src = (t.utmSource || "").toLowerCase()
      const hasCampaign = Boolean(t.utmCampaign)

      if (src && hasCampaign) {
        attributedCount++
      } else if (src) {
        trackedCount++
      } else if (t.touchType === "SESSION_TOUCH" && !src) {
        directCount++
      } else {
        unknownCount++
      }

      const channelKey = channelStats[src] ? src : src ? "other" : "direct"
      channelStats[channelKey].visits++
      if (t.conversionAction === "CLICK") channelStats[channelKey].clicks++
      if (t.conversionAction === "SIGNUP") channelStats[channelKey].signups++
      if (t.conversionAction === "EVENT_CREATED" || t.conversionAction === "EVENT_PUBLISHED") {
        channelStats[channelKey].events++
      }
    }

    // Tracking links click total
    const links = await prisma.marketingTrackingLink.findMany({
      select: { clickCount: true, utmSource: true },
    })
    const totalTrackingClicks = links.reduce((acc, l) => acc + l.clickCount, 0)

    const conversionRate = trackedVisits > 0 ? ((signupsCount / trackedVisits) * 100).toFixed(1) : "0.0"

    return NextResponse.json({
      range,
      kpis: {
        activeCampaigns,
        totalCampaigns,
        scheduledContent,
        publishedContent,
        pendingApprovals,
        websiteVisits: trackedVisits,
        trackedVisitors: uniqueVisitors,
        totalTrackingClicks,
        signups: signupsCount,
        eventsCreated: eventsCreatedCount,
        eventsPublished: eventsPublishedCount,
        conversionRate: `${conversionRate}%`,
      },
      attributionBreakdown: {
        tracked: trackedCount,
        attributed: attributedCount,
        direct: directCount,
        unknown: unknownCount,
      },
      channelPerformance: channelStats,
      upcomingScheduled,
    })
  } catch (error) {
    console.error("[Marketing Analytics error]", error)
    return NextResponse.json({ error: "Failed to fetch marketing analytics." }, { status: 500 })
  }
}
