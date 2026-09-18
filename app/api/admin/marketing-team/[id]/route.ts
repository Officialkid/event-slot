import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasAdminAccess } from "@/lib/isAdmin"
import type { MarketingRole, MarketingMemberStatus } from "@prisma/client"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || !hasAdminAccess(session)) {
    return NextResponse.json({ error: "Forbidden. Super Admin access required." }, { status: 403 })
  }

  const { id } = await params
  try {
    const body = await req.json()
    const { role, status } = body

    const updateData: { role?: MarketingRole; status?: MarketingMemberStatus } = {}

    if (role) {
      const validRoles: MarketingRole[] = [
        "MARKETING_ADMIN",
        "MARKETING_MEMBER",
        "CONTENT_MANAGER",
        "ANALYST",
      ]
      if (validRoles.includes(role)) {
        updateData.role = role
      }
    }

    if (status) {
      const validStatuses: MarketingMemberStatus[] = [
        "ACTIVE",
        "INACTIVE",
        "INVITED",
        "REVOKED",
      ]
      if (validStatuses.includes(status)) {
        updateData.status = status
      }
    }

    const member = await prisma.marketingTeamMember.update({
      where: { id },
      data: updateData,
    })

    await prisma.marketingAuditLog.create({
      data: {
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "TEAM_MEMBER_UPDATED",
        entityType: "TEAM",
        entityId: member.id,
        metadata: updateData,
      },
    })

    return NextResponse.json({ member })
  } catch (error) {
    console.error("[MarketingTeam PATCH error]", error)
    return NextResponse.json({ error: "Failed to update team member." }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session || !hasAdminAccess(session)) {
    return NextResponse.json({ error: "Forbidden. Super Admin access required." }, { status: 403 })
  }

  const { id } = await params
  try {
    const member = await prisma.marketingTeamMember.findUnique({
      where: { id },
    })

    if (!member) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 })
    }

    // Set status to REVOKED
    await prisma.marketingTeamMember.update({
      where: { id },
      data: { status: "REVOKED" },
    })

    await prisma.marketingAuditLog.create({
      data: {
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: "TEAM_MEMBER_REVOKED",
        entityType: "TEAM",
        entityId: id,
        metadata: { email: member.email },
      },
    })

    return NextResponse.json({ success: true, revokedId: id })
  } catch (error) {
    console.error("[MarketingTeam DELETE error]", error)
    return NextResponse.json({ error: "Failed to revoke team member." }, { status: 500 })
  }
}
