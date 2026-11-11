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
      select: { id: true, publicationStatus: true },
    })

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const permCheck = await checkOrgPermission({
      userId: session.user.id,
      organizationId: org.id,
      permission: 'publish_org_profile',
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: permCheck.reason || 'Only the organization Owner can publish or unpublish this profile.',
        },
        { status: 403 }
      )
    }

    let body: { action?: 'publish' | 'unpublish' }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const shouldPublish = body.action === 'publish'
    const newStatus = shouldPublish
      ? OrganizationPublicationStatus.PUBLISHED
      : OrganizationPublicationStatus.DRAFT

    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: {
        publicationStatus: newStatus,
        publishedAt: shouldPublish ? new Date() : undefined,
      },
    })

    await recordOrgAuditLog({
      organizationId: org.id,
      actorId: session.user.id,
      action: shouldPublish ? 'ORG_PUBLISHED' : 'ORG_UNPUBLISHED',
      targetType: 'ORGANIZATION',
      targetId: org.id,
      metadata: { previousStatus: org.publicationStatus, newStatus },
    })

    return NextResponse.json({
      success: true,
      publicationStatus: updated.publicationStatus,
      publishedAt: updated.publishedAt,
    })
  } catch (error) {
    console.error('[POST /api/organizations/[handle]/publish] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
