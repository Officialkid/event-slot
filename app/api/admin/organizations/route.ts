import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasAdminAccess } from "@/lib/isAdmin"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!hasAdminAccess(session)) {
    return NextResponse.json({ error: "Forbidden: Superadmin access required" }, { status: 403 })
  }

  try {
    const orgs = await prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        members: {
          where: { role: "OWNER", status: "ACTIVE" },
          take: 1,
          include: {
            user: {
              select: { id: true, name: true, email: true, username: true },
            },
          },
        },
        _count: {
          select: {
            members: true,
            events: true,
            followers: true,
          },
        },
      },
    })

    const items = orgs.map((org) => {
      const ownerMember = org.members[0]
      return {
        id: org.id,
        name: org.name,
        handle: org.handle,
        description: org.description,
        logo: org.logo,
        category: org.category,
        publicationStatus: org.publicationStatus,
        verificationStatus: org.verificationStatus,
        createdAt: org.createdAt.toISOString(),
        memberCount: org._count.members,
        eventCount: org._count.events,
        followerCount: org._count.followers,
        owner: ownerMember?.user
          ? {
              id: ownerMember.user.id,
              name: ownerMember.user.name,
              email: ownerMember.user.email,
              username: ownerMember.user.username,
            }
          : null,
      }
    })

    return NextResponse.json({ success: true, organizations: items })
  } catch (error) {
    console.error("Admin organizations fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch organizations" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!hasAdminAccess(session)) {
    return NextResponse.json({ error: "Forbidden: Superadmin access required" }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { name, handle, description, category, ownerEmail, verificationStatus, publicationStatus } = body

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 })
    }

    const cleanHandle = (handle || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")

    if (!cleanHandle || cleanHandle.length < 3) {
      return NextResponse.json({ error: "Handle must be at least 3 valid characters" }, { status: 400 })
    }

    const existing = await prisma.organization.findUnique({
      where: { handle: cleanHandle },
    })

    if (existing) {
      return NextResponse.json({ error: `Handle "${cleanHandle}" is already taken` }, { status: 409 })
    }

    // Identify owner user if email supplied
    let targetOwnerUserId = session.user.id
    if (ownerEmail && typeof ownerEmail === "string" && ownerEmail.trim()) {
      const foundUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: ownerEmail.trim().toLowerCase() },
            { username: ownerEmail.trim().toLowerCase() },
          ],
        },
        select: { id: true, email: true, name: true },
      })

      if (foundUser) {
        targetOwnerUserId = foundUser.id
      }
    }

    // Create organization transactionally with initial owner
    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: name.trim(),
          handle: cleanHandle,
          description: description?.trim() || null,
          category: category?.trim() || "COMMUNITY",
          publicationStatus: publicationStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
          verificationStatus: verificationStatus === "VERIFIED" ? "VERIFIED" : "UNVERIFIED",
          createdById: session.user.id,
        },
      })

      // Add specified owner
      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: targetOwnerUserId,
          role: "OWNER",
          status: "ACTIVE",
          invitedById: session.user.id,
        },
      })

      // Audit log
      await tx.organizationAuditLog.create({
        data: {
          organizationId: org.id,
          actorId: session.user.id,
          action: "CONCIERGE_PROVISIONED",
          targetType: "ORGANIZATION",
          targetId: org.id,
          metadata: {
            provisionedByAdmin: session.user.email,
            assignedOwnerUserId: targetOwnerUserId,
            handle: cleanHandle,
          },
        },
      })

      return org
    })

    return NextResponse.json({ success: true, organization })
  } catch (error) {
    console.error("Concierge organization provisioning error:", error)
    return NextResponse.json({ error: "Failed to provision organization" }, { status: 500 })
  }
}
