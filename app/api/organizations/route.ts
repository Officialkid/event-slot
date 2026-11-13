import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  normalizeOrgHandle,
  validateOrgHandle,
} from '@/lib/organizationPermissions'
import { recordOrgAuditLog } from '@/lib/organizationAudit'
import {
  OrganizationRole,
  OrganizationMemberStatus,
  OrganizationPublicationStatus,
  OrganizationVerificationStatus,
  OrganizationFinanceStatus,
} from '@prisma/client'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let body: {
      name?: string
      handle?: string
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

    const rawName = (body.name ?? '').trim()
    if (!rawName || rawName.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Organization name must be at least 2 characters.' },
        { status: 400 }
      )
    }

    const rawHandle = (body.handle ?? rawName).trim()
    const handleValidation = validateOrgHandle(rawHandle)
    if (!handleValidation.valid) {
      return NextResponse.json(
        { success: false, error: handleValidation.error },
        { status: 400 }
      )
    }

    const normalizedHandle = normalizeOrgHandle(rawHandle)

    // Check collision in Organization table and User username table
    const [existingOrg, existingUser] = await Promise.all([
      prisma.organization.findUnique({
        where: { handle: normalizedHandle },
        select: { id: true },
      }),
      prisma.user.findUnique({
        where: { username: normalizedHandle },
        select: { id: true },
      }),
    ])

    if (existingOrg || existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: `Handle "${normalizedHandle}" is already taken. Please choose another unique handle.`,
        },
        { status: 409 }
      )
    }

    // Transactionally create Organization, initial Owner Member, and Finance Profile
    const organization = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: rawName,
          handle: normalizedHandle,
          description: body.description?.trim() || null,
          logo: body.logo?.trim() || null,
          coverImage: body.coverImage?.trim() || null,
          category: body.category?.trim() || null,
          website: body.website?.trim() || null,
          socialLinks: body.socialLinks || undefined,
          contactEmail: body.contactEmail?.trim() || session.user.email || null,
          contactPhone: body.contactPhone?.trim() || null,
          contactWhatsapp: body.contactWhatsapp?.trim() || null,
          publicationStatus: OrganizationPublicationStatus.DRAFT,
          verificationStatus: OrganizationVerificationStatus.UNVERIFIED,
          createdById: session.user.id,
        },
      })

      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: session.user.id,
          role: OrganizationRole.OWNER,
          status: OrganizationMemberStatus.ACTIVE,
        },
      })

      await tx.organizationFinanceProfile.create({
        data: {
          organizationId: org.id,
          status: OrganizationFinanceStatus.UNCONFIGURED,
          currency: 'KES',
        },
      })

      return org
    })

    await recordOrgAuditLog({
      organizationId: organization.id,
      actorId: session.user.id,
      action: 'ORG_CREATED',
      targetType: 'ORGANIZATION',
      targetId: organization.id,
      metadata: { name: organization.name, handle: organization.handle },
    })

    return NextResponse.json(
      {
        success: true,
        organization: {
          id: organization.id,
          name: organization.name,
          handle: organization.handle,
          publicationStatus: organization.publicationStatus,
          verificationStatus: organization.verificationStatus,
          role: OrganizationRole.OWNER,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/organizations] Error creating organization:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error creating organization' },
      { status: 500 }
    )
  }
}
