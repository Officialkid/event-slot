import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireMarketingContext } from "@/lib/marketing/rbac"
import type { CampaignStatus, MarketingChannel } from "@prisma/client"

export async function GET(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canViewAnalytics")
  if (auth.errorResponse) return auth.errorResponse

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") as CampaignStatus | null
  const channel = searchParams.get("channel") as MarketingChannel | null

  try {
    const where: any = {}
    if (status) where.status = status
    if (channel) where.channels = { has: channel }

    const campaigns = await prisma.marketingCampaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            contentAssets: true,
            trackingLinks: true,
          },
        },
      },
    })

    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error("[Campaigns GET error]", error)
    return NextResponse.json({ error: "Failed to fetch campaigns." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireMarketingContext(req, "canCreateCampaign")
  if (auth.errorResponse) return auth.errorResponse

  try {
    const body = await req.json()
    const {
      campaignId: rawCampaignId,
      name,
      objective,
      description,
      startDate,
      endDate,
      status = "PLANNED",
      targetAudience,
      channels = [],
      notes,
    } = body

    if (!name || !objective || !startDate) {
      return NextResponse.json(
        { error: "Campaign name, objective, and start date are required." },
        { status: 400 }
      )
    }

    // Generate clean campaign ID if not provided (e.g. CAMP-2026-09-ABC)
    const campaignId = (
      rawCampaignId?.trim() ||
      `CMP-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
    ).toUpperCase()

    // Check uniqueness
    const existing = await prisma.marketingCampaign.findUnique({
      where: { campaignId },
    })
    if (existing) {
      return NextResponse.json(
        { error: `Campaign ID '${campaignId}' already exists. Please pick a unique identifier.` },
        { status: 409 }
      )
    }

    const campaign = await prisma.marketingCampaign.create({
      data: {
        campaignId,
        name: name.trim(),
        objective: objective.trim(),
        description: description?.trim() || null,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status: status as CampaignStatus,
        ownerId: auth.context.userId,
        targetAudience: targetAudience?.trim() || null,
        channels: channels as MarketingChannel[],
        notes: notes?.trim() || null,
      },
    })

    // Audit log
    await prisma.marketingAuditLog.create({
      data: {
        actorId: auth.context.userId,
        actorEmail: auth.context.email,
        action: "CAMPAIGN_CREATED",
        entityType: "CAMPAIGN",
        entityId: campaign.id,
        metadata: { campaignId, name: campaign.name, status: campaign.status },
      },
    })

    return NextResponse.json({ campaign }, { status: 201 })
  } catch (error) {
    console.error("[Campaigns POST error]", error)
    return NextResponse.json({ error: "Failed to create campaign." }, { status: 500 })
  }
}
