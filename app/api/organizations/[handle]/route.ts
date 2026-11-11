import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkOrgPermission,
  normalizeOrgHandle,
} from '@/lib/organizationPermissions'
import { recordOrgAuditLog } from '@/lib/organizationAudit'
import { OrganizationPublicationStatus } from '@prisma/client'

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ handle: string }> }
) {
  try {
    const params = await props.params
    const rawHandle = normalizeOrgHandle(params.handle)
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? null

    const org = await prisma.organization.findUnique({
      where: { handle: rawHandle },
      include: {
        _count: {
          select: {
            members: { where: { status: 'ACTIVE' } },
            events: { where: { archived: false, status: 'active' } },
            followers: true,
          },
        },
      },
    })

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    // Check if requester is an active member
    let requesterMember: { role: string; status: string } | null = null
    if (userId) {
      requesterMember = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: {
            organizationId: org.id,
            userId,
          },
        },
        select: { role: true, status: true },
      })
    }

    const isMember = requesterMember && requesterMember.status === 'ACTIVE'

    // If not a member and org is not published, return 404 to avoid leaking draft existence
    if (!isMember && org.publicationStatus !== OrganizationPublicationStatus.PUBLISHED) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    // Public DTO for non-members
    if (!isMember) {
      return NextResponse.json({
        success: true,
        organization: {
          id: org.id,
          name: org.name,
          handle: org.handle,
          description: org.description,
          logo: org.logo,
          coverImage: org.coverImage,
          category: org.category,
          website: org.website,
          socialLinks: org.socialLinks,
          contactEmail: org.contactEmail,
          contactPhone: org.contactPhone,
          contactWhatsapp: org.contactWhatsapp,
          verificationStatus: org.verificationStatus,
          verifiedAt: org.verifiedAt,
          followerCount: org._count.followers,
          eventCount: org._count.events,
          isMember: false,
        },
      })
    }

    // Full DTO for active members
    return NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        handle: org.handle,
        description: org.description,
        logo: org.logo,
        coverImage: org.coverImage,
        category: org.category,
        website: org.website,
        socialLinks: org.socialLinks,
        contactEmail: org.contactEmail,
        contactPhone: org.contactPhone,
        contactWhatsapp: org.contactWhatsapp,
        publicationStatus: org.publicationStatus,
        verificationStatus: org.verificationStatus,
        verifiedAt: org.verifiedAt,
        publishedAt: org.publishedAt,
        createdAt: org.createdAt,
        updatedAt: org.updatedAt,
        memberCount: org._count.members,
        eventCount: org._count.events,
        followerCount: org._count.followers,
        isMember: true,
        userRole: requesterMember?.role,
      },
    })
  } catch (error) {
    console.error('[GET /api/organizations/[handle]] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ handle: string }> }
) {
  try {
    const params = await props.params
    const rawHandle = normalizeOrgHandle(params.handle)
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const org = await prisma.organization.findUnique({
      where: { handle: rawHandle },
      select: { id: true, handle: true },
    })

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const permCheck = await checkOrgPermission({
      userId: session.user.id,
      organizationId: org.id,
      permission: 'edit_org_profile',
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        { success: false, error: permCheck.reason || 'You do not have permission to edit this organization.' },
        { status: 403 }
      )
    }

    let body: {
      name?: string
      description?: string
      logo?: string
      coverImage?: string
      category?: string
      website?: string
      socialLinks?: Record<string, string>
      contactEmail?: string
      contactPhone?: string
      contactWhatsapp?: string
    }

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: {
        name: body.name?.trim() || undefined,
        description: typeof body.description === 'string' ? body.description.trim() || null : undefined,
        logo: typeof body.logo === 'string' ? body.logo.trim() || null : undefined,
        coverImage: typeof body.coverImage === 'string' ? body.coverImage.trim() || null : undefined,
        category: typeof body.category === 'string' ? body.category.trim() || null : undefined,
        website: typeof body.website === 'string' ? body.website.trim() || null : undefined,
        socialLinks: body.socialLinks !== undefined ? body.socialLinks : undefined,
        contactEmail: typeof body.contactEmail === 'string' ? body.contactEmail.trim() || null : undefined,
        contactPhone: typeof body.contactPhone === 'string' ? body.contactPhone.trim() || null : undefined,
        contactWhatsapp: typeof body.contactWhatsapp === 'string' ? body.contactWhatsapp.trim() || null : undefined,
      },
    })

    await recordOrgAuditLog({
      organizationId: org.id,
      actorId: session.user.id,
      action: 'ORG_PROFILE_UPDATED',
      targetType: 'ORGANIZATION',
      targetId: org.id,
      metadata: { fieldsUpdated: Object.keys(body) },
    })

    return NextResponse.json({ success: true, organization: updated })
  } catch (error) {
    console.error('[PATCH /api/organizations/[handle]] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
