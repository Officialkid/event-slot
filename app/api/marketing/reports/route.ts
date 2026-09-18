import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireMarketingContext } from "@/lib/marketing/rbac"
import { generateMarketingInsights } from "@/lib/marketing/gemini"
import type { MarketingReportType, MarketingChannel } from "@prisma/client"

export async function GET(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canViewAnalytics")
  if (auth.errorResponse) return auth.errorResponse

  try {
    const reports = await prisma.marketingReport.findMany({
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ reports })
  } catch (error) {
    console.error("[Reports GET error]", error)
    return NextResponse.json({ error: "Failed to fetch reports." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canGenerateReports")
  if (auth.errorResponse) return auth.errorResponse

  try {
    const body = await req.json()
    const { title, reportType = "WEEKLY", periodStart, periodEnd, campaignId, channel } = body

    if (!periodStart || !periodEnd) {
      return NextResponse.json({ error: "Period start and end dates are required." }, { status: 400 })
    }

    const start = new Date(periodStart)
    const end = new Date(periodEnd)

    // Pull real snapshot data across range
    const [touches, campaignsCount, contentPublished, signupsCount, eventsCreated] = await Promise.all([
      prisma.marketingAttributionTouch.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { utmSource: true, utmCampaign: true, conversionAction: true },
      }),
      prisma.marketingCampaign.count({ where: { status: "ACTIVE" } }),
      prisma.marketingContentItem.count({ where: { status: "PUBLISHED", publishedAt: { gte: start, lte: end } } }),
      prisma.user.count({ where: { createdAt: { gte: start, lte: end } } }),
      prisma.event.count({ where: { createdAt: { gte: start, lte: end } } }),
    ])

    const dataSnapshot = {
      trackedVisits: touches.length,
      signupsAttributed: touches.filter((t) => t.conversionAction === "SIGNUP").length,
      eventsCreatedAttributed: touches.filter((t) => t.conversionAction === "EVENT_CREATED").length,
      activeCampaigns: campaignsCount,
      contentPublished,
      totalSignups: signupsCount,
      totalEventsCreated: eventsCreated,
    }

    // Call Gemini to generate AI summary & recommendations for the frozen report
    const aiAnalysis = await generateMarketingInsights({
      trackedVisits: dataSnapshot.trackedVisits,
      totalClicks: 0,
      signupsAttributed: dataSnapshot.signupsAttributed,
      eventsCreatedAttributed: dataSnapshot.eventsCreatedAttributed,
      topChannels: [],
      topCampaigns: [],
      periodLabel: `${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
    })

    const reportName =
      title?.trim() ||
      `${reportType.charAt(0) + reportType.slice(1).toLowerCase()} Marketing Report (${start.toLocaleDateString()} - ${end.toLocaleDateString()})`

    const report = await prisma.marketingReport.create({
      data: {
        title: reportName,
        reportType: reportType as MarketingReportType,
        periodStart: start,
        periodEnd: end,
        campaignId: campaignId || null,
        channel: channel as MarketingChannel || null,
        dataSnapshot,
        aiSummary: aiAnalysis.summary,
        keyObservations: aiAnalysis.whatPerformedWell,
        recommendedExperiments: aiAnalysis.recommendations,
        generatedById: auth.context.userId,
      },
    })

    await prisma.marketingAuditLog.create({
      data: {
        actorId: auth.context.userId,
        actorEmail: auth.context.email,
        action: "REPORT_GENERATED",
        entityType: "REPORT",
        entityId: report.id,
        metadata: { title: report.title, reportType: report.reportType },
      },
    })

    return NextResponse.json({ report }, { status: 201 })
  } catch (error) {
    console.error("[Reports POST error]", error)
    return NextResponse.json({ error: "Failed to generate report." }, { status: 500 })
  }
}
