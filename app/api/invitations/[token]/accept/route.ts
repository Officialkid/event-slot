import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hashToken } from '@/lib/invitationToken'
import { recordOrgAuditLog } from '@/lib/organizationAudit'
import {
  OrganizationInvitationStatus,
  OrganizationMemberStatus,
  OrganizationInvitationType,
} from '@prisma/client'

export async function POST(
  _req: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const params = await props.params
    const rawToken = params.token.trim()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json(
        { success: false, error: 'Please sign in or create an account to accept this invitation.', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const tokenHash = hashToken(rawToken)

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { tokenHash },
      include: {
        organization: {
          select: { id: true, name: true, handle: true },
        },
      },
    })

    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Invitation not found or invalid.' }, { status: 404 })
    }

    if (invitation.status === OrganizationInvitationStatus.REVOKED) {
      return NextResponse.json(
        { success: false, error: 'This invitation has been revoked.', code: 'REVOKED' },
        { status: 410 }
      )
    }

    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'This invitation link has expired.', code: 'EXPIRED' },
        { status: 410 }
      )
    }

    if (invitation.usesCount >= invitation.maxUses) {
      return NextResponse.json(
        { success: false, error: 'This invitation has already reached its usage limit.', code: 'EXHAUSTED' },
        { status: 410 }
      )
    }

    // Email binding check for EMAIL invitations
    if (invitation.type === OrganizationInvitationType.EMAIL && invitation.email) {
      if (session.user.email.toLowerCase() !== invitation.email.toLowerCase()) {
        return NextResponse.json(
          {
            success: false,
            error: `This invitation was issued to ${invitation.email}. You are currently signed in as ${session.user.email}. Please sign in with the invited email address.`,
            code: 'EMAIL_MISMATCH',
          },
          { status: 403 }
        )
      }
    }

    // Atomically increment usage, update invitation status if exhausted, and upsert membership
    const result = await prisma.$transaction(async (tx) => {
      const nextUsesCount = invitation.usesCount + 1
      const isExhausted = nextUsesCount >= invitation.maxUses

      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: {
          usesCount: nextUsesCount,
          status: isExhausted ? OrganizationInvitationStatus.ACCEPTED : undefined,
          acceptedById: session.user.id,
        },
      })

      const member = await tx.organizationMember.upsert({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: session.user.id,
          },
        },
        create: {
          organizationId: invitation.organizationId,
          userId: session.user.id,
          role: invitation.role,
          status: OrganizationMemberStatus.ACTIVE,
          invitedById: invitation.createdById,
        },
        update: {
          role: invitation.role,
          status: OrganizationMemberStatus.ACTIVE,
        },
      })

      return { member }
    })

    await recordOrgAuditLog({
      organizationId: invitation.organizationId,
      actorId: session.user.id,
      action: 'INVITATION_ACCEPTED',
      targetType: 'INVITATION',
      targetId: invitation.id,
      metadata: { role: invitation.role, acceptedByUserId: session.user.id },
    })

    return NextResponse.json({
      success: true,
      message: `Welcome to ${invitation.organization.name}! You are now an active ${invitation.role.replace('_', ' ').toLowerCase()}.`,
      organization: {
        id: invitation.organization.id,
        name: invitation.organization.name,
        handle: invitation.organization.handle,
        role: invitation.role,
      },
    })
  } catch (error) {
    console.error('[POST /api/invitations/[token]/accept] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
