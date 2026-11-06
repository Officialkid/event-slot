import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { checkRecruitmentAccess } from "@/lib/recruitment/permissions"
import { isAdminEmail } from "@/lib/isAdmin"
import { Prisma } from "@prisma/client"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const access = await checkRecruitmentAccess(session, { requireAdmin: true })

    if (!access.authorized || !access.isGlobalAdmin) {
      return NextResponse.json({ error: "Only administrators can view reviewer assignments" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const filterStatus = searchParams.get("status") || "all"
    const now = new Date()

    const where: Prisma.RecruitmentReviewerAssignmentWhereInput = {}

    if (filterStatus === "active") {
      where.revokedAt = null
      where.expiresAt = { gt: now }
    } else if (filterStatus === "expired") {
      where.revokedAt = null
      where.expiresAt = { lte: now }
    } else if (filterStatus === "revoked") {
      where.revokedAt = { not: null }
    }

    const assignments = await prisma.recruitmentReviewerAssignment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        vacancy: {
          select: {
            id: true,
            title: true,
            department: true,
          },
        },
        application: {
          select: {
            id: true,
            referenceCode: true,
            fullName: true,
          },
        },
        assignedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        revokedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(assignments)
  } catch (err: any) {
    console.error("[ADMIN_REVIEWERS_GET_ERROR]", err)
    return NextResponse.json(
      { error: "Failed to retrieve recruitment reviewer assignments" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const access = await checkRecruitmentAccess(session, { requireAdmin: true })

    if (!access.authorized || !access.isGlobalAdmin) {
      return NextResponse.json({ error: "Only administrators can assign recruitment reviewers" }, { status: 403 })
    }

    const body = await req.json()
    const { email, role, expiresAt, vacancyId, applicationId } = body

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Reviewer user email is required" }, { status: 400 })
    }

    const validRoles = ["HIRING_MANAGER", "REVIEWER", "HR_CONSULTANT"]
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Valid reviewer role (HIRING_MANAGER, REVIEWER, or HR_CONSULTANT) is required" },
        { status: 400 }
      )
    }

    if (!expiresAt) {
      return NextResponse.json(
        { error: "Mandatory expiration date must be specified for temporary reviewer access" },
        { status: 400 }
      )
    }

    const parsedExpiry = new Date(expiresAt)
    if (isNaN(parsedExpiry.getTime()) || parsedExpiry <= new Date()) {
      return NextResponse.json(
        { error: "Expiration date must be a valid future timestamp" },
        { status: 400 }
      )
    }

    // Lookup user in database
    const targetUser = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    })

    if (!targetUser) {
      return NextResponse.json(
        {
          error: `No EventSlot account found for "${email}". The reviewer must first have an account in the platform before recruitment permissions can be granted.`,
        },
        { status: 404 }
      )
    }

    // Check if target user is already global admin
    if (isAdminEmail(targetUser.email)) {
      return NextResponse.json(
        { error: "This user is already a Global Administrator and has full recruitment access." },
        { status: 400 }
      )
    }

    // Create temporary reviewer assignment
    const assignment = await prisma.recruitmentReviewerAssignment.create({
      data: {
        userId: targetUser.id,
        role,
        vacancyId: vacancyId || null,
        applicationId: applicationId || null,
        assignedById: access.userId!,
        expiresAt: parsedExpiry,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        vacancy: { select: { id: true, title: true } },
      },
    })

    // Audit log
    await prisma.recruitmentAuditLog.create({
      data: {
        action: "REVIEWER_ASSIGNED",
        targetType: "REVIEWER_ASSIGNMENT",
        targetId: assignment.id,
        vacancyId: vacancyId || null,
        actorId: access.userId!,
        actorEmail: access.userEmail || "unknown",
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
        newValue: {
          assignedEmail: targetUser.email,
          role,
          expiresAt: parsedExpiry.toISOString(),
          vacancyId: vacancyId || null,
          applicationId: applicationId || null,
        },
        details: `Assigned temporary ${role} access to ${targetUser.email} until ${parsedExpiry.toISOString()}`,
      },
    })

    return NextResponse.json(assignment, { status: 201 })
  } catch (err: any) {
    console.error("[ADMIN_REVIEWERS_POST_ERROR]", err)
    return NextResponse.json(
      { error: "Failed to create reviewer assignment" },
      { status: 500 }
    )
  }
}
