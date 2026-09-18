import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireMarketingContext } from "@/lib/marketing/rbac"
import { generateMarketingInsights } from "@/lib/marketing/gemini"

export async function GET(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canViewAnalytics")
  if (auth.errorResponse) return auth.errorResponse

  const { searchParams } = new URL(req.url)
  const range = searchParams.get("range") || "last_30_days"

  try {
    const now = new Date()
    let startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    let periodLabel = "the Last 30 Days"

    if (range === "today") {
      startDate = new Date(now.setHours(0, 0, 0, 0))
      periodLabel = "Today"
    } else if (range === "last_7_days") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      periodLabel = "the Last 7 Days"
    }

    // 1. Total touches / visits
    const touches = await prisma.marketingAttributionTouch.findMany({
      where: { createdAt: { gte: startDate } },
      select: {
        utmSource: true,
        utmCampaign: true,
        conversionAction: true,
      },
    })

    const trackedVisits = touches.length
    const signupsAttributed = touches.filter((t) => t.conversionAction === "SIGNUP").length
    const eventsCreatedAttributed = touches.filter((t) => t.conversionAction === "EVENT_CREATED").length

    // 2. Total clicks from tracking links
    const trackingLinks = await prisma.marketingTrackingLink.findMany({
      select: {
        clickCount: true,
        utmSource: true,
        utmCampaign: true,
        campaign: { select: { name: true } },
      },
    })
    const totalClicks = trackingLinks.reduce((acc, l) => acc + l.clickCount, 0)

    // 3. Top channels breakdown
    const channelMap: Record<string, { visits: number; conversions: number }> = {}
    for (const t of touches) {
      const src = t.utmSource || "direct"
      if (!channelMap[src]) channelMap[src] = { visits: 0, conversions: 0 }
      channelMap[src].visits += 1
      if (t.conversionAction === "SIGNUP" || t.conversionAction === "EVENT_CREATED") {
        channelMap[src].conversions += 1
      }
    }

    const topChannels = Object.entries(channelMap).map(([channel, stats]) => ({
      channel,
      visits: stats.visits,
      conversions: stats.conversions,
    }))

    // 4. Top campaigns
    const topCampaigns = trackingLinks.slice(0, 5).map((l) => ({
      name: l.campaign?.name || l.utmCampaign,
      clicks: l.clickCount,
      signups: 0,
    }))

    const insights = await generateMarketingInsights({
      trackedVisits,
      totalClicks,
      signupsAttributed,
      eventsCreatedAttributed,
      topChannels,
      topCampaigns,
      periodLabel,
    })

    return NextResponse.json({
      periodLabel,
      metrics: {
        trackedVisits,
        totalClicks,
        signupsAttributed,
        eventsCreatedAttributed,
      },
      insights,
    })
  } catch (error) {
    console.error("[Marketing Insights error]", error)
    return NextResponse.json({ error: "Failed to generate AI insights." }, { status: 500 })
  }
}
