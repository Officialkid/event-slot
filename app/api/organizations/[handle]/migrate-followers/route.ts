import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { checkOrgPermission } from "@/lib/organizationPermissions"
import { hasAdminAccess } from "@/lib/isAdmin"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { handle } = await params
  const org = await prisma.organization.findUnique({
    where: { handle: handle.toLowerCase() },
    select: { id: true, name: true, handle: true },
  })

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 })
  }

  const isSuper = hasAdminAccess(session)
  const orgPermission = await checkOrgPermission({
    userId: session.user.id,
    organizationId: org.id,
    permission: "edit_org_profile",
  })
  const canManage = isSuper || orgPermission.allowed

  if (!canManage) {
    return NextResponse.json(
      { error: "Forbidden: You must be an organization owner, admin, or platform administrator to migrate followers" },
      { status: 403 }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const sourceIdentifier = body.sourceUserId || body.sourceUsername || session.user.id

    // Find the source organizer
    const sourceUser = await prisma.user.findFirst({
      where: {
        OR: [
          { id: sourceIdentifier },
          { username: sourceIdentifier.toLowerCase() },
          { email: sourceIdentifier.toLowerCase() },
        ],
      },
      select: { id: true, name: true, username: true, email: true },
    })

    if (!sourceUser) {
      return NextResponse.json({ error: "Source organizer account not found" }, { status: 404 })
    }

    // Retrieve all followers of this organizer
    const existingFollowers = await prisma.organiserFollower.findMany({
      where: { organiserId: sourceUser.id },
      select: { followerId: true, notifyNewEvents: true },
    })

    if (existingFollowers.length === 0) {
      return NextResponse.json({
        success: true,
        migratedCount: 0,
        message: `No existing followers found for organizer ${sourceUser.name || sourceUser.username || sourceUser.email}.`,
      })
    }

    let migratedCount = 0

    // Upsert into OrganizationFollower
    for (const f of existingFollowers) {
      try {
        await prisma.organizationFollower.upsert({
          where: {
            followerId_organizationId: {
              followerId: f.followerId,
              organizationId: org.id,
            },
          },
          update: {
            notifyNewEvents: f.notifyNewEvents,
          },
          create: {
            followerId: f.followerId,
            organizationId: org.id,
            notifyNewEvents: f.notifyNewEvents,
          },
        })
        migratedCount++
      } catch (err) {
        console.error(`Failed to migrate follower ${f.followerId}:`, err)
      }
    }

    // Write audit log
    await prisma.organizationAuditLog.create({
      data: {
        organizationId: org.id,
        actorId: session.user.id,
        action: "FOLLOWERS_MIGRATED",
        targetType: "ORGANIZATION",
        targetId: org.id,
        metadata: {
          sourceUserId: sourceUser.id,
          sourceUserName: sourceUser.name || sourceUser.username,
          migratedCount,
          totalSourceFollowers: existingFollowers.length,
        },
      },
    })

    return NextResponse.json({
      success: true,
      migratedCount,
      totalSourceFollowers: existingFollowers.length,
      message: `Successfully migrated ${migratedCount} followers from ${sourceUser.name || sourceUser.username} to ${org.name}!`,
    })
  } catch (error) {
    console.error("Follower migration error:", error)
    return NextResponse.json({ error: "Internal server error during follower migration" }, { status: 500 })
  }
}
