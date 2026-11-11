import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkOrgPermission,
  normalizeOrgHandle,
} from '@/lib/organizationPermissions'
import { recordOrgAuditLog } from '@/lib/organizationAudit'
import { OrganizationVerificationStatus, Prisma } from '@prisma/client'

export async function POST(
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
      select: { id: true, verificationStatus: true },
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
        { success: false, error: permCheck.reason || 'You do not have permission to request verification.' },
        { status: 403 }
      )
    }

    if (org.verificationStatus === OrganizationVerificationStatus.VERIFIED) {
      return NextResponse.json(
        { success: false, error: 'This organization is already verified.' },
        { status: 400 }
      )
    }

    let body: { evidence?: Record<string, unknown> }
    try {
      body = await req.json()
    } catch {
      body = {}
    }

    const jsonEvidence = body.evidence ? (body.evidence as unknown as Prisma.InputJsonValue) : Prisma.JsonNull

    const [request] = await prisma.$transaction([
      prisma.organizationVerificationRequest.create({
        data: {
          organizationId: org.id,
          requestedById: session.user.id,
          status: OrganizationVerificationStatus.PENDING,
          evidence: jsonEvidence,
        },
      }),
      prisma.organization.update({
        where: { id: org.id },
        data: {
          verificationStatus: OrganizationVerificationStatus.PENDING,
          verificationEvidence: jsonEvidence,
        },
      }),
    ])

    await recordOrgAuditLog({
      organizationId: org.id,
      actorId: session.user.id,
      action: 'ORG_VERIFICATION_REQUESTED',
      targetType: 'VERIFICATION_REQUEST',
      targetId: request.id,
      metadata: { evidence: body.evidence },
    })

    return NextResponse.json(
      {
        success: true,
        verificationStatus: OrganizationVerificationStatus.PENDING,
        requestId: request.id,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/organizations/[handle]/verification] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
