import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkOrgPermission,
  normalizeOrgHandle,
} from '@/lib/organizationPermissions'
import { recordOrgAuditLog } from '@/lib/organizationAudit'
import { OrganizationInvitationStatus } from '@prisma/client'

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ handle: string; id: string }> }
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
      select: { id: true },
    })

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const permCheck = await checkOrgPermission({
      userId: session.user.id,
      organizationId: org.id,
      permission: 'revoke_invites',
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        { success: false, error: permCheck.reason || 'You do not have permission to revoke invitations.' },
        { status: 403 }
      )
    }

    const invitation = await prisma.organizationInvitation.findFirst({
      where: { id: params.id, organizationId: org.id },
    })

    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Invitation not found' }, { status: 404 })
    }

    await prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: { status: OrganizationInvitationStatus.REVOKED },
    })

    await recordOrgAuditLog({
      organizationId: org.id,
      actorId: session.user.id,
      action: 'INVITATION_REVOKED',
      targetType: 'INVITATION',
      targetId: invitation.id,
      metadata: { previousStatus: invitation.status },
    })

    return NextResponse.json({ success: true, message: 'Invitation revoked successfully.' })
  } catch (error) {
    console.error('[DELETE /api/organizations/[handle]/invitations/[id]] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
