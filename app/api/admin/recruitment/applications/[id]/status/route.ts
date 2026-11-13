import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { checkRecruitmentAccess } from "@/lib/recruitment/permissions"
import { APPLICATION_STATUSES, type ApplicationStatusValue } from "@/lib/recruitment/types"

const VALID_STATUSES = new Set(APPLICATION_STATUSES.map((s) => s.value))

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const access = await checkRecruitmentAccess(session, { applicationId: id })

    if (!access.authorized) {
      return NextResponse.json({ error: access.error || "Unauthorized" }, { status: 403 })
    }

    // Only Global Admins or Hiring Managers can transition application lifecycle stages
    if (!access.isGlobalAdmin && access.role !== "HIRING_MANAGER") {
      return NextResponse.json(
        { error: "Only Hiring Managers and Global Admins can modify candidate status" },
        { status: 403 }
      )
    }

    const body = await req.json()
    const { status, note } = body

    if (!status || !VALID_STATUSES.has(status)) {
      return NextResponse.json(
        { error: "Invalid recruitment application status" },
        { status: 400 }
      )
    }

    const currentApp = await prisma.jobApplication.findUnique({
      where: { id },
      select: { id: true, status: true, referenceCode: true, vacancyId: true },
    })

    if (!currentApp) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    const previousStatus = currentApp.status

    if (previousStatus === status) {
      return NextResponse.json({ message: "Status unchanged", status })
    }

    // Update status and append to history in a transaction
    const [updatedApp] = await prisma.$transaction([
      prisma.jobApplication.update({
        where: { id },
        data: { status: status as any },
      }),
      prisma.applicationStatusHistory.create({
        data: {
          applicationId: id,
          previousStatus,
          newStatus: status as any,
          changedById: access.userId!,
          publicReason: note ? String(note).trim() : null,
        },
      }),
      prisma.recruitmentAuditLog.create({
        data: {
          action: "APPLICATION_STATUS_UPDATED",
          targetType: "APPLICATION",
          targetId: id,
          vacancyId: currentApp.vacancyId,
          actorId: access.userId!,
          actorEmail: access.userEmail || "unknown",
          ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
          previousValue: { status: previousStatus },
          newValue: { status },
          details: note ? `Status changed to ${status}: ${note}` : `Status changed from ${previousStatus} to ${status}`,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      status: updatedApp.status,
      message: `Status updated to ${status}`,
    })
  } catch (err: any) {
    console.error("[ADMIN_APPLICATION_STATUS_PATCH_ERROR]", err)
    return NextResponse.json(
      { error: "Failed to update application status" },
      { status: 500 }
    )
  }
}
