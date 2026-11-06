import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import crypto from "crypto"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const token = searchParams.get("token")

    if (!token) {
      return NextResponse.json({ error: "Missing invitation token" }, { status: 400 })
    }

    const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex")

    const invitation = await prisma.recruitmentReviewerInvitation.findUnique({
      where: { tokenHash },
      include: {
        vacancy: { select: { id: true, title: true, department: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    })

    if (!invitation) {
      return NextResponse.json(
        { error: "Invalid invitation link. Please request a new invitation." },
        { status: 404 }
      )
    }

    if (invitation.revokedAt) {
      return NextResponse.json(
        {
          error: `This invitation was revoked by an administrator on ${new Date(invitation.revokedAt).toLocaleDateString()}. Reason: ${invitation.revocationReason || "No reason specified."}`,
        },
        { status: 410 }
      )
    }

    if (invitation.acceptedAt) {
      return NextResponse.json(
        { error: "This invitation has already been accepted. You may sign in to access your recruitment workspace." },
        { status: 409 }
      )
    }

    if (new Date(invitation.expiresAt) <= new Date()) {
      return NextResponse.json(
        { error: "This invitation link has expired. Please contact the administrator for a renewed invitation." },
        { status: 410 }
      )
    }

    const session = await getServerSession(authOptions)

    return NextResponse.json({
      valid: true,
      email: invitation.email,
      role: invitation.role,
      vacancy: invitation.vacancy,
      expiresAt: invitation.expiresAt.toISOString(),
      invitedBy: invitation.invitedBy?.name || invitation.invitedBy?.email || "Super Admin",
      currentUser: session?.user ? { id: session.user.id, email: session.user.email } : null,
    })
  } catch (err: any) {
    console.error("[INVITE_VERIFY_GET_ERROR]", err)
    return NextResponse.json({ error: "Failed to verify invitation" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "You must be signed in to your EventSlot account to accept a reviewer assignment." },
        { status: 401 }
      )
    }

    const body = await req.json()
    const token = body.token

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing invitation token" }, { status: 400 })
    }

    const tokenHash = crypto.createHash("sha256").update(token.trim()).digest("hex")

    const invitation = await prisma.recruitmentReviewerInvitation.findUnique({
      where: { tokenHash },
      include: {
        vacancy: { select: { id: true, title: true } },
      },
    })

    if (!invitation) {
      return NextResponse.json({ error: "Invalid invitation token." }, { status: 404 })
    }

    if (invitation.revokedAt) {
      return NextResponse.json({ error: "This invitation was revoked by an administrator." }, { status: 410 })
    }

    if (invitation.acceptedAt) {
      return NextResponse.json({ error: "This invitation was already accepted." }, { status: 409 })
    }

    if (new Date(invitation.expiresAt) <= new Date()) {
      return NextResponse.json({ error: "This invitation has expired." }, { status: 410 })
    }

    // Process acceptance transaction
    await prisma.$transaction(async (tx) => {
      // 1. Create or extend reviewer assignment
      await tx.recruitmentReviewerAssignment.create({
        data: {
          userId: session.user.id,
          role: invitation.role,
          vacancyId: invitation.vacancyId,
          applicationId: invitation.applicationId,
          assignedById: invitation.invitedById,
          expiresAt: invitation.expiresAt,
        },
      })

      // 2. Mark invitation as accepted
      await tx.recruitmentReviewerInvitation.update({
        where: { id: invitation.id },
        data: {
          acceptedAt: new Date(),
          acceptedById: session.user.id,
        },
      })

      // 3. Record in Audit Trail
      await tx.recruitmentAuditLog.create({
        data: {
          action: "REVIEWER_INVITATION_ACCEPTED",
          targetType: "REVIEWER_INVITATION",
          targetId: invitation.id,
          vacancyId: invitation.vacancyId,
          actorId: session.user.id,
          actorEmail: session.user.email || "unknown",
          ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
          details: `Guest invitation accepted by ${session.user.email} (role: ${invitation.role}, invited for: ${invitation.email})`,
        },
      })
    })

    return NextResponse.json({
      success: true,
      redirectUrl: "/admin/recruitment",
      message: "Invitation accepted. Redirecting to your recruitment workspace...",
    })
  } catch (err: any) {
    console.error("[INVITE_ACCEPT_POST_ERROR]", err)
    return NextResponse.json({ error: "Failed to accept reviewer invitation" }, { status: 500 })
  }
}
