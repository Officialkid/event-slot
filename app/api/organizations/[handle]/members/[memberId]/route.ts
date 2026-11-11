import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkOrgPermission,
  normalizeOrgHandle,
} from '@/lib/organizationPermissions'
import { recordOrgAuditLog } from '@/lib/organizationAudit'
import { OrganizationRole, OrganizationMemberStatus } from '@prisma/client'

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ handle: string; memberId: string }> }
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
      permission: 'change_member_role',
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        { success: false, error: permCheck.reason || 'You do not have permission to change member roles.' },
        { status: 403 }
      )
    }

    const targetMember = await prisma.organizationMember.findFirst({
      where: { id: params.memberId, organizationId: org.id },
      include: { user: { select: { email: true, name: true } } },
    })

    if (!targetMember) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }

    let body: { role?: OrganizationRole }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const nextRole = body.role
    if (!nextRole || !['OWNER', 'ADMIN', 'EVENT_MANAGER'].includes(nextRole)) {
      return NextResponse.json({ success: false, error: 'Invalid organization role' }, { status: 400 })
    }

    // Safeguard: Demoting an Owner
    if (targetMember.role === OrganizationRole.OWNER && nextRole !== OrganizationRole.OWNER) {
      const activeOwnerCount = await prisma.organizationMember.count({
        where: {
          organizationId: org.id,
          role: OrganizationRole.OWNER,
          status: OrganizationMemberStatus.ACTIVE,
        },
      })

      if (activeOwnerCount <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot demote the last remaining Owner. An organization must have at least one active Owner.',
          },
          { status: 400 }
        )
      }
    }

    // Role ceiling: Admins cannot promote anyone to Owner or alter Owner roles
    if (permCheck.role === OrganizationRole.ADMIN) {
      if (targetMember.role === OrganizationRole.OWNER || nextRole === OrganizationRole.OWNER) {
        return NextResponse.json(
          { success: false, error: 'Only Owners can grant or modify Owner roles.' },
          { status: 403 }
        )
      }
    }

    const updated = await prisma.organizationMember.update({
      where: { id: targetMember.id },
      data: { role: nextRole },
    })

    await recordOrgAuditLog({
      organizationId: org.id,
      actorId: session.user.id,
      action: 'MEMBER_ROLE_CHANGED',
      targetType: 'MEMBER',
      targetId: targetMember.id,
      metadata: { previousRole: targetMember.role, newRole: nextRole, targetUserId: targetMember.userId },
    })

    return NextResponse.json({ success: true, member: updated })
  } catch (error) {
    console.error('[PATCH /api/organizations/[handle]/members/[memberId]] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ handle: string; memberId: string }> }
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
      permission: 'remove_members',
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        { success: false, error: permCheck.reason || 'You do not have permission to remove members.' },
        { status: 403 }
      )
    }

    const targetMember = await prisma.organizationMember.findFirst({
      where: { id: params.memberId, organizationId: org.id },
    })

    if (!targetMember) {
      return NextResponse.json({ success: false, error: 'Member not found' }, { status: 404 })
    }

    // Safeguard: Cannot remove the last Owner
    if (targetMember.role === OrganizationRole.OWNER) {
      const activeOwnerCount = await prisma.organizationMember.count({
        where: {
          organizationId: org.id,
          role: OrganizationRole.OWNER,
          status: OrganizationMemberStatus.ACTIVE,
        },
      })

      if (activeOwnerCount <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot remove the last remaining Owner. Please transfer ownership or assign another Owner first.',
          },
          { status: 400 }
        )
      }
    }

    // Admins cannot remove Owners or fellow Admins
    if (permCheck.role === OrganizationRole.ADMIN) {
      if (targetMember.role === OrganizationRole.OWNER || targetMember.role === OrganizationRole.ADMIN) {
        return NextResponse.json(
          { success: false, error: 'Admins cannot remove Owners or fellow Admins.' },
          { status: 403 }
        )
      }
    }

    await prisma.organizationMember.update({
      where: { id: targetMember.id },
      data: { status: OrganizationMemberStatus.REMOVED },
    })

    await recordOrgAuditLog({
      organizationId: org.id,
      actorId: session.user.id,
      action: 'MEMBER_REMOVED',
      targetType: 'MEMBER',
      targetId: targetMember.id,
      metadata: { removedRole: targetMember.role, removedUserId: targetMember.userId },
    })

    return NextResponse.json({ success: true, message: 'Member removed successfully.' })
  } catch (error) {
    console.error('[DELETE /api/organizations/[handle]/members/[memberId]] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
