import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireMarketingContext } from "@/lib/marketing/rbac"
import type { ContentStatus } from "@prisma/client"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMarketingContext(req, "canViewAnalytics")
  if (auth.errorResponse) return auth.errorResponse

  const { id } = await params
  try {
    const content = await prisma.marketingContentItem.findUnique({
      where: { id },
      include: {
        campaign: true,
        trackingLink: true,
        auditTrail: {
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!content) {
      return NextResponse.json({ error: "Content asset not found." }, { status: 404 })
    }

    return NextResponse.json({ content })
  } catch (error) {
    console.error("[Content GET error]", error)
    return NextResponse.json({ error: "Failed to fetch content." }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMarketingContext(req, "canEditContent")
  if (auth.errorResponse) return auth.errorResponse

  const { id } = await params
  try {
    const existing = await prisma.marketingContentItem.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Content asset not found." }, { status: 404 })
    }

    const body = await req.json()
    const {
      workflowAction, // "submit_for_review" | "approve" | "reject" | "schedule" | "publish" | "cancel"
      notes,
      title,
      caption,
      mediaUrls,
      ctaText,
      destinationUrl,
      scheduledFor,
      metadata,
    } = body

    let newStatus = existing.status
    let approverData: { approvedById?: string; approvedAt?: Date; publishedAt?: Date } = {}

    if (workflowAction) {
      switch (workflowAction) {
        case "submit_for_review":
          if (existing.status !== "DRAFT") {
            return NextResponse.json({ error: "Only draft content can be submitted for review." }, { status: 400 })
          }
          newStatus = "IN_REVIEW"
          break

        case "approve":
          if (!auth.context.permissions.canApproveContent) {
            return NextResponse.json({ error: "Forbidden. You lack permission to approve content." }, { status: 403 })
          }
          if (existing.status !== "IN_REVIEW" && existing.status !== "DRAFT") {
            return NextResponse.json({ error: "Content must be in review to approve." }, { status: 400 })
          }
          newStatus = "APPROVED"
          approverData = {
            approvedById: auth.context.userId,
            approvedAt: new Date(),
          }
          break

        case "reject":
          if (!auth.context.permissions.canApproveContent) {
            return NextResponse.json({ error: "Forbidden. You lack permission to review content." }, { status: 403 })
          }
          newStatus = "DRAFT"
          break

        case "schedule":
          const targetDate = scheduledFor ? new Date(scheduledFor) : existing.scheduledFor
          if (!targetDate) {
            return NextResponse.json({ error: "A scheduled timestamp is required to schedule content." }, { status: 400 })
          }
          if (existing.status !== "APPROVED" && !auth.context.permissions.canApproveContent) {
            return NextResponse.json({ error: "Content must be approved before scheduling." }, { status: 400 })
          }
          newStatus = "SCHEDULED"
          break

        case "publish":
          if (!auth.context.permissions.canPublishContent) {
            return NextResponse.json({ error: "Forbidden. You lack permission to publish content directly." }, { status: 403 })
          }
          newStatus = "PUBLISHED"
          approverData = {
            ...approverData,
            publishedAt: new Date(),
          }
          break

        case "cancel":
          newStatus = "CANCELLED"
          break

        default:
          return NextResponse.json({ error: `Unknown workflow action '${workflowAction}'` }, { status: 400 })
      }
    }

    const updatePayload: any = {
      status: newStatus,
      ...approverData,
    }

    if (title !== undefined) updatePayload.title = title.trim()
    if (caption !== undefined) updatePayload.caption = caption.trim()
    if (mediaUrls !== undefined) updatePayload.mediaUrls = mediaUrls
    if (ctaText !== undefined) updatePayload.ctaText = ctaText?.trim() || null
    if (destinationUrl !== undefined) updatePayload.destinationUrl = destinationUrl?.trim() || null
    if (scheduledFor !== undefined) updatePayload.scheduledFor = scheduledFor ? new Date(scheduledFor) : null
    if (metadata !== undefined) updatePayload.metadata = metadata

    const updated = await prisma.marketingContentItem.update({
      where: { id },
      data: updatePayload,
    })

    // Record audit trail if state changed or workflow action taken
    if (workflowAction || newStatus !== existing.status) {
      await prisma.marketingContentAuditTrail.create({
        data: {
          contentId: id,
          actorId: auth.context.userId,
          action: workflowAction ? workflowAction.toUpperCase() : "EDITED",
          previousStatus: existing.status,
          newStatus: updated.status,
          notes: notes?.trim() || `Status changed to ${updated.status}`,
        },
      })
    }

    return NextResponse.json({ content: updated })
  } catch (error) {
    console.error("[Content PATCH error]", error)
    return NextResponse.json({ error: "Failed to update content." }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMarketingContext(req, "canEditContent")
  if (auth.errorResponse) return auth.errorResponse

  const { id } = await params
  try {
    await prisma.marketingContentItem.delete({
      where: { id },
    })

    return NextResponse.json({ success: true, deletedId: id })
  } catch (error) {
    console.error("[Content DELETE error]", error)
    return NextResponse.json({ error: "Failed to delete content." }, { status: 500 })
  }
}
