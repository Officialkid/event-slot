import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireMarketingContext } from "@/lib/marketing/rbac"
import type { MarketingChannel, ContentStatus } from "@prisma/client"

export async function GET(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canViewAnalytics")
  if (auth.errorResponse) return auth.errorResponse

  const { searchParams } = new URL(req.url)
  const campaignId = searchParams.get("campaignId")
  const channel = searchParams.get("channel") as MarketingChannel | null
  const status = searchParams.get("status") as ContentStatus | null
  const start = searchParams.get("start")
  const end = searchParams.get("end")

  try {
    const where: any = {}
    if (campaignId) where.campaignId = campaignId
    if (channel) where.channel = channel
    if (status) where.status = status

    // Calendar range filter
    if (start && end) {
      where.scheduledFor = {
        gte: new Date(start),
        lte: new Date(end),
      }
    }

    const contentItems = await prisma.marketingContentItem.findMany({
      where,
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "desc" }],
      include: {
        campaign: {
          select: {
            id: true,
            campaignId: true,
            name: true,
          },
        },
        trackingLink: {
          select: {
            id: true,
            code: true,
            shortUrl: true,
            fullUrl: true,
            clickCount: true,
          },
        },
      },
    })

    return NextResponse.json({ contentItems })
  } catch (error) {
    console.error("[Content GET error]", error)
    return NextResponse.json({ error: "Failed to fetch content assets." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canCreateContent")
  if (auth.errorResponse) return auth.errorResponse

  try {
    const body = await req.json()
    const {
      campaignId,
      channel,
      contentType,
      title,
      caption,
      mediaUrls = [],
      ctaText,
      destinationUrl,
      scheduledFor,
      metadata = {},
    } = body

    if (!campaignId || !channel || !contentType || !title || !caption) {
      return NextResponse.json(
        { error: "Campaign, channel, content type, title, and caption are required." },
        { status: 400 }
      )
    }

    // Verify campaign exists
    const campaign = await prisma.marketingCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, name: true, campaignId: true },
    })

    if (!campaign) {
      return NextResponse.json({ error: "Associated campaign not found." }, { status: 404 })
    }

    // Create content item
    const content = await prisma.marketingContentItem.create({
      data: {
        campaignId,
        channel: channel as MarketingChannel,
        contentType,
        title: title.trim(),
        caption: caption.trim(),
        mediaUrls,
        ctaText: ctaText?.trim() || null,
        destinationUrl: destinationUrl?.trim() || null,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
        status: "DRAFT",
        createdById: auth.context.userId,
        metadata,
      },
    })

    // Create first audit trail record
    await prisma.marketingContentAuditTrail.create({
      data: {
        contentId: content.id,
        actorId: auth.context.userId,
        action: "CREATED",
        newStatus: "DRAFT",
        notes: `Initial draft created for ${channel} (${contentType}).`,
      },
    })

    await prisma.marketingAuditLog.create({
      data: {
        actorId: auth.context.userId,
        actorEmail: auth.context.email,
        action: "CONTENT_CREATED",
        entityType: "CONTENT",
        entityId: content.id,
        metadata: {
          title: content.title,
          channel: content.channel,
          campaignId: campaign.campaignId,
        },
      },
    })

    return NextResponse.json({ content }, { status: 201 })
  } catch (error) {
    console.error("[Content POST error]", error)
    return NextResponse.json({ error: "Failed to create content asset." }, { status: 500 })
  }
}
