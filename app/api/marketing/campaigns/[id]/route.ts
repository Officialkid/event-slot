import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireMarketingContext } from "@/lib/marketing/rbac"
import type { CampaignStatus, MarketingChannel } from "@prisma/client"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMarketingContext(req, "canViewAnalytics")
  if (auth.errorResponse) return auth.errorResponse

  const { id } = await params
  try {
    const campaign = await prisma.marketingCampaign.findFirst({
      where: {
        OR: [{ id }, { campaignId: id }],
      },
      include: {
        contentAssets: {
          orderBy: { createdAt: "desc" },
          include: {
            trackingLink: true,
          },
        },
        trackingLinks: {
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 })
    }

    return NextResponse.json({ campaign })
  } catch (error) {
    console.error("[Campaign GET error]", error)
    return NextResponse.json({ error: "Failed to fetch campaign." }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMarketingContext(req, "canEditCampaign")
  if (auth.errorResponse) return auth.errorResponse

  const { id } = await params
  try {
    const body = await req.json()
    const { name, objective, description, startDate, endDate, status, targetAudience, channels, notes } = body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name.trim()
    if (objective !== undefined) updateData.objective = objective.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (startDate) updateData.startDate = new Date(startDate)
    if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null
    if (status) updateData.status = status as CampaignStatus
    if (targetAudience !== undefined) updateData.targetAudience = targetAudience?.trim() || null
    if (channels) updateData.channels = channels as MarketingChannel[]
    if (notes !== undefined) updateData.notes = notes?.trim() || null

    const updated = await prisma.marketingCampaign.update({
      where: { id },
      data: updateData,
    })

    await prisma.marketingAuditLog.create({
      data: {
        actorId: auth.context.userId,
        actorEmail: auth.context.email,
        action: "CAMPAIGN_UPDATED",
        entityType: "CAMPAIGN",
        entityId: id,
        metadata: updateData,
      },
    })

    return NextResponse.json({ campaign: updated })
  } catch (error) {
    console.error("[Campaign PATCH error]", error)
    return NextResponse.json({ error: "Failed to update campaign." }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMarketingContext(req, "canDeleteCampaign")
  if (auth.errorResponse) return auth.errorResponse

  const { id } = await params
  try {
    await prisma.marketingCampaign.delete({
      where: { id },
    })

    await prisma.marketingAuditLog.create({
      data: {
        actorId: auth.context.userId,
        actorEmail: auth.context.email,
        action: "CAMPAIGN_DELETED",
        entityType: "CAMPAIGN",
        entityId: id,
      },
    })

    return NextResponse.json({ success: true, deletedId: id })
  } catch (error) {
    console.error("[Campaign DELETE error]", error)
    return NextResponse.json({ error: "Failed to delete campaign." }, { status: 500 })
  }
}
