import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { checkRecruitmentAccess } from "@/lib/recruitment/permissions"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    const access = await checkRecruitmentAccess(session, { requireAdmin: true })

    if (!access.authorized || !access.isGlobalAdmin) {
      return NextResponse.json({ error: "Only administrators can extend reviewer access" }, { status: 403 })
    }

    const body = await req.json()
    const { newExpiresAt, reason } = body

    if (!newExpiresAt) {
      return NextResponse.json({ error: "New expiration date is required" }, { status: 400 })
    }

    const parsedNew = new Date(newExpiresAt)
    if (isNaN(parsedNew.getTime()) || parsedNew <= new Date()) {
      return NextResponse.json({ error: "New expiration date must be in the future" }, { status: 400 })
    }

    const existing = await prisma.recruitmentReviewerAssignment.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: "Reviewer assignment not found" }, { status: 404 })
    }

    const updated = await prisma.recruitmentReviewerAssignment.update({
      where: { id },
      data: {
        expiresAt: parsedNew,
        // If it was expired but not manually revoked, extending will reactivate it
      },
    })

    // Audit log
    await prisma.recruitmentAuditLog.create({
      data: {
        action: "REVIEWER_EXTENDED",
        targetType: "REVIEWER_ASSIGNMENT",
        targetId: id,
        vacancyId: existing.vacancyId || null,
        actorId: access.userId!,
        actorEmail: access.userEmail || "unknown",
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
        previousValue: { expiresAt: existing.expiresAt.toISOString() },
        newValue: { expiresAt: parsedNew.toISOString() },
        details: `Extended reviewer access for ${existing.user.email} until ${parsedNew.toISOString()}. ${reason ? `Reason: ${reason}` : ""}`,
      },
    })

    return NextResponse.json({ success: true, updated })
  } catch (err: any) {
    console.error("[ADMIN_REVIEWER_EXTEND_ERROR]", err)
    return NextResponse.json(
      { error: "Failed to extend reviewer assignment" },
      { status: 500 }
    )
  }
}
