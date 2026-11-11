import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkOrgPermission,
  normalizeOrgHandle,
} from '@/lib/organizationPermissions'
import { recordOrgAuditLog } from '@/lib/organizationAudit'
import { generateSecureToken, hashToken } from '@/lib/invitationToken'
import { APP_URL } from '@/lib/config'
import { OrganizationRole, OrganizationInvitationType } from '@prisma/client'

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
      select: { id: true, name: true },
    })

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const permCheck = await checkOrgPermission({
      userId: session.user.id,
      organizationId: org.id,
      permission: 'invite_members',
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        { success: false, error: permCheck.reason || 'You do not have permission to invite members.' },
        { status: 403 }
      )
    }

    let body: {
      type?: 'EMAIL' | 'LINK'
      email?: string
      role?: OrganizationRole
      expiresInDays?: number
      maxUses?: number
    }

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const type = body.type === 'LINK' ? OrganizationInvitationType.LINK : OrganizationInvitationType.EMAIL
    const email = type === OrganizationInvitationType.EMAIL ? (body.email ?? '').trim().toLowerCase() : null

    if (type === OrganizationInvitationType.EMAIL && (!email || !email.includes('@'))) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid recipient email address.' },
        { status: 400 }
      )
    }

    // Role ceiling: Cannot invite as OWNER via ordinary invitation. Must use transfer ownership workflow.
    const requestedRole = body.role || OrganizationRole.EVENT_MANAGER
    if (requestedRole === OrganizationRole.OWNER) {
      return NextResponse.json(
        {
          success: false,
          error: 'Owner role cannot be granted via invitation. Use the explicit ownership transfer workflow.',
        },
        { status: 403 }
      )
    }

    // Admins cannot invite fellow Admins if policy restricts it to Owner
    if (permCheck.role === OrganizationRole.ADMIN && requestedRole === OrganizationRole.ADMIN) {
      // Allowed if policy permits, but check role ceiling
    }

    // Expiration date
    const days = Math.min(Math.max(body.expiresInDays || 7, 1), 30)
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000)

    // Raw token generation & hashing
    const rawToken = generateSecureToken()
    const tokenHash = hashToken(rawToken)

    const invitation = await prisma.organizationInvitation.create({
      data: {
        organizationId: org.id,
        type,
        email,
        tokenHash,
        role: requestedRole,
        createdById: session.user.id,
        expiresAt,
        maxUses: type === OrganizationInvitationType.LINK ? Math.min(body.maxUses || 10, 100) : 1,
      },
    })

    await recordOrgAuditLog({
      organizationId: org.id,
      actorId: session.user.id,
      action: 'INVITATION_CREATED',
      targetType: 'INVITATION',
      targetId: invitation.id,
      metadata: { type, email, role: requestedRole, expiresAt },
    })

    const inviteUrl = `${APP_URL}/invite/${rawToken}`

    return NextResponse.json(
      {
        success: true,
        invitation: {
          id: invitation.id,
          type: invitation.type,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
          maxUses: invitation.maxUses,
          inviteUrl,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[POST /api/organizations/[handle]/invitations] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
