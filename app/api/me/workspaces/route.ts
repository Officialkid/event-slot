import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdminEmail } from '@/lib/isAdmin'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [user, orgMemberships, legacyTeamMemberships] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          image: true,
        },
      }),
      prisma.organizationMember.findMany({
        where: {
          userId: session.user.id,
          status: 'ACTIVE',
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              handle: true,
              logo: true,
              publicationStatus: true,
              verificationStatus: true,
              contactEmail: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.teamMember.findMany({
        where: {
          memberId: session.user.id,
          status: 'accepted',
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              image: true,
            },
          },
        },
      }),
    ])

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isPlatformAdmin = Boolean(user.email && isAdminEmail(user.email))

    // Map modern first-class Organization models
    const modernOrgs = orgMemberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      handle: m.organization.handle,
      username: m.organization.handle, // Backwards compatibility for components expecting username
      email: m.organization.contactEmail,
      image: m.organization.logo,
      role: m.role,
      publicationStatus: m.organization.publicationStatus,
      verificationStatus: m.organization.verificationStatus,
      isOrganization: true,
    }))

    // Map legacy team memberships (deduplicated by id)
    const existingOrgIds = new Set(modernOrgs.map((o) => o.id))
    const legacyOrgs = legacyTeamMemberships
      .map((tm) => tm.owner)
      .filter((owner): owner is NonNullable<typeof owner> => Boolean(owner) && !existingOrgIds.has(owner.id))
      .map((owner) => ({
        id: owner.id,
        name: owner.name || owner.username || 'Workspace',
        handle: owner.username || owner.id,
        username: owner.username,
        email: owner.email,
        image: owner.image,
        role: 'ADMIN',
        publicationStatus: 'PUBLISHED',
        verificationStatus: 'UNVERIFIED',
        isOrganization: false,
      }))

    const combinedOrganizations = [...modernOrgs, ...legacyOrgs]

    return NextResponse.json({
      success: true,
      personal: {
        id: user.id,
        name: user.name || 'Personal Account',
        username: user.username,
        email: user.email,
        image: user.image,
      },
      organizations: combinedOrganizations,
      isAdmin: isPlatformAdmin,
    })
  } catch (error) {
    console.error('Failed to load workspaces:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load available workspaces' },
      { status: 500 }
    )
  }
}
