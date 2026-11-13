import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { checkRecruitmentAccess } from "@/lib/recruitment/permissions"
import crypto from "crypto"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const access = await checkRecruitmentAccess(session, { requireAdmin: true })

    if (!access.authorized || !access.isGlobalAdmin) {
      return NextResponse.json({ error: "Only administrators can view reviewer invitations" }, { status: 403 })
    }

    const invitations = await prisma.recruitmentReviewerInvitation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        vacancy: { select: { id: true, title: true, department: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
        acceptedBy: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json(invitations)
  } catch (err: any) {
    console.error("[ADMIN_INVITATIONS_GET_ERROR]", err)
    return NextResponse.json({ error: "Failed to load reviewer invitations" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const access = await checkRecruitmentAccess(session, { requireAdmin: true })

    if (!access.authorized || !access.isGlobalAdmin) {
      return NextResponse.json({ error: "Only administrators can invite recruitment reviewers" }, { status: 403 })
    }

    const body = await req.json()
    const { email, role, expiresAt, vacancyId, applicationId } = body

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Recipient guest email is required" }, { status: 400 })
    }

    const cleanEmail = email.trim().toLowerCase()
    const validRoles = ["HIRING_MANAGER", "REVIEWER", "HR_CONSULTANT"]
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: "Valid reviewer role is required" }, { status: 400 })
    }

    if (!expiresAt) {
      return NextResponse.json({ error: "Mandatory expiration date must be specified" }, { status: 400 })
    }

    const parsedExpiry = new Date(expiresAt)
    if (isNaN(parsedExpiry.getTime()) || parsedExpiry <= new Date()) {
      return NextResponse.json({ error: "Expiration date must be a valid future timestamp" }, { status: 400 })
    }

    // Generate cryptographically random token (32 bytes = 64 hex chars)
    const rawToken = crypto.randomBytes(32).toString("hex")
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")

    const invitation = await prisma.recruitmentReviewerInvitation.create({
      data: {
        email: cleanEmail,
        role,
        vacancyId: vacancyId || null,
        applicationId: applicationId || null,
        tokenHash,
        invitedById: access.userId!,
        expiresAt: parsedExpiry,
      },
      include: {
        vacancy: { select: { id: true, title: true } },
      },
    })

    // Audit log
    await prisma.recruitmentAuditLog.create({
      data: {
        action: "REVIEWER_INVITATION_CREATED",
        targetType: "REVIEWER_INVITATION",
        targetId: invitation.id,
        vacancyId: vacancyId || null,
        actorId: access.userId!,
        actorEmail: access.userEmail || "unknown",
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
        newValue: {
          recipientEmail: cleanEmail,
          role,
          expiresAt: parsedExpiry.toISOString(),
          vacancyId: vacancyId || null,
        },
        details: `Created single-use reviewer invitation for guest ${cleanEmail} (role: ${role}, expires: ${parsedExpiry.toISOString()})`,
      },
    })

    const baseUrl = req.headers.get("origin") || req.nextUrl.origin || ""
    const inviteUrl = `${baseUrl}/admin/recruitment/invite/accept?token=${rawToken}`

    return NextResponse.json(
      {
        success: true,
        invitation,
        rawToken,
        inviteUrl,
        message:
          "Reviewer invitation generated successfully. Share this link directly with the guest reviewer.",
      },
      { status: 201 }
    )
  } catch (err: any) {
    console.error("[ADMIN_INVITATIONS_POST_ERROR]", err)
    return NextResponse.json({ error: "Failed to create reviewer invitation" }, { status: 500 })
  }
}
