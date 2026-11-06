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
      return NextResponse.json({ error: "Only administrators can revoke reviewer invitations" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const reason = body.reason?.trim() || "Administrator cancelled invitation"

    const existing = await prisma.recruitmentReviewerInvitation.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 })
    }

    if (existing.revokedAt) {
      return NextResponse.json({ message: "Invitation was already revoked" })
    }

    if (existing.acceptedAt) {
      return NextResponse.json(
        { error: "Cannot revoke invitation: it has already been accepted. Please revoke the reviewer assignment directly." },
        { status: 400 }
      )
    }

    const updated = await prisma.recruitmentReviewerInvitation.update({
      where: { id },
      data: {
        revokedAt: new Date(),
        revocationReason: reason,
      },
    })

    // Audit log
    await prisma.recruitmentAuditLog.create({
      data: {
        action: "REVIEWER_INVITATION_REVOKED",
        targetType: "REVIEWER_INVITATION",
        targetId: id,
        vacancyId: existing.vacancyId || null,
        actorId: access.userId!,
        actorEmail: access.userEmail || "unknown",
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
        details: `Revoked pending invitation for ${existing.email}. Reason: ${reason}`,
      },
    })

    return NextResponse.json({ success: true, updated })
  } catch (err: any) {
    console.error("[ADMIN_INVITATION_REVOKE_ERROR]", err)
    return NextResponse.json({ error: "Failed to revoke invitation" }, { status: 500 })
  }
}
