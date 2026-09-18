import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasAdminAccess } from "@/lib/isAdmin"
import { v4 as uuidv4 } from "uuid"
import type { MarketingRole } from "@prisma/client"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !hasAdminAccess(session)) {
    return NextResponse.json({ error: "Forbidden. Super Admin access required." }, { status: 403 })
  }

  try {
    const members = await prisma.marketingTeamMember.findMany({
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
      },
    })

    return NextResponse.json({ members })
  } catch (error) {
    console.error("[MarketingTeam GET error]", error)
    return NextResponse.json({ error: "Failed to fetch marketing team members." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || !hasAdminAccess(session)) {
    return NextResponse.json({ error: "Forbidden. Super Admin access required." }, { status: 403 })
  }

  try {
    const body = await req.json()
    const rawEmail = (body.email || "").trim().toLowerCase()
    const name = (body.name || "").trim()
    const role = (body.role || "MARKETING_MEMBER") as MarketingRole

    if (!rawEmail || !rawEmail.includes("@")) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 })
    }

    const validRoles: MarketingRole[] = [
      "MARKETING_ADMIN",
      "MARKETING_MEMBER",
      "CONTENT_MANAGER",
      "ANALYST",
    ]

    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid marketing role provided." }, { status: 400 })
    }

    // Check if member already exists
    const existing = await prisma.marketingTeamMember.findUnique({
      where: { email: rawEmail },
    })

    if (existing) {
      if (existing.status === "REVOKED" || existing.status === "INACTIVE") {
        // Re-activate member with new role
        const updated = await prisma.marketingTeamMember.update({
          where: { id: existing.id },
          data: {
            status: "ACTIVE",
            role,
            name: name || existing.name,
            lastActiveAt: new Date(),
          },
        })
        return NextResponse.json({ member: updated, reactivated: true })
      }
      return NextResponse.json(
        { error: "This email is already part of the Marketing Team." },
        { status: 409 }
      )
    }

    // Check if user account already exists in EventSlot
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: rawEmail, mode: "insensitive" } },
      select: { id: true, name: true },
    })

    const member = await prisma.marketingTeamMember.create({
      data: {
        email: rawEmail,
        name: name || existingUser?.name || null,
        role,
        status: existingUser ? "ACTIVE" : "INVITED",
        inviteToken: uuidv4(),
        invitedBy: session.user.id,
        userId: existingUser?.id || null,
        joinedAt: existingUser ? new Date() : null,
      },
    })

    // Log in marketing audit
    await prisma.marketingAuditLog.create({
      data: {
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "TEAM_MEMBER_INVITED",
        entityType: "TEAM",
        entityId: member.id,
        metadata: {
          email: rawEmail,
          role,
          status: member.status,
        },
      },
    })

    return NextResponse.json({ member }, { status: 201 })
  } catch (error) {
    console.error("[MarketingTeam POST error]", error)
    return NextResponse.json({ error: "Failed to invite marketing team member." }, { status: 500 })
  }
}
