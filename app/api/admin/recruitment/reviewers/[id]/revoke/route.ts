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
      return NextResponse.json({ error: "Only administrators can revoke reviewer access" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const reason = body.reason?.trim() || "Administrative revocation"

    const existing = await prisma.recruitmentReviewerAssignment.findUnique({
      where: { id },
      include: { user: { select: { email: true } } },
    })

    if (!existing) {
      return NextResponse.json({ error: "Reviewer assignment not found" }, { status: 404 })
    }

    if (existing.revokedAt) {
      return NextResponse.json({ message: "Assignment was already revoked" })
    }

    const updated = await prisma.recruitmentReviewerAssignment.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        revokedById: access.userId!,
        revocationReason: reason,
      },
    })

    // Audit log
    await prisma.recruitmentAuditLog.create({
      data: {
        action: "REVIEWER_REVOKED",
        targetType: "REVIEWER_ASSIGNMENT",
        targetId: id,
        vacancyId: existing.vacancyId || null,
        actorId: access.userId!,
        actorEmail: access.userEmail || "unknown",
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
        details: `Revoked ${existing.role} access for ${existing.user.email}. Reason: ${reason}`,
      },
    })

    return NextResponse.json({ success: true, updated })
  } catch (err: any) {
    console.error("[ADMIN_REVIEWER_REVOKE_ERROR]", err)
    return NextResponse.json(
      { error: "Failed to revoke reviewer assignment" },
      { status: 500 }
    )
  }
}
