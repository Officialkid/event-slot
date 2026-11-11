import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { hashToken } from '@/lib/invitationToken'
import { OrganizationInvitationStatus } from '@prisma/client'

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const params = await props.params
    const rawToken = params.token.trim()
    if (!rawToken) {
      return NextResponse.json({ success: false, error: 'Invalid invitation link' }, { status: 400 })
    }

    const tokenHash = hashToken(rawToken)

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { tokenHash },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            handle: true,
            logo: true,
            description: true,
          },
        },
        createdBy: {
          select: { name: true, email: true },
        },
      },
    })

    if (!invitation) {
      return NextResponse.json({ success: false, error: 'Invitation not found or has been removed.' }, { status: 404 })
    }

    if (invitation.status === OrganizationInvitationStatus.REVOKED) {
      return NextResponse.json(
        { success: false, error: 'This invitation has been revoked by an administrator.', code: 'REVOKED' },
        { status: 410 }
      )
    }

    if (invitation.expiresAt < new Date()) {
      if (invitation.status === OrganizationInvitationStatus.PENDING) {
        await prisma.organizationInvitation.update({
          where: { id: invitation.id },
          data: { status: OrganizationInvitationStatus.EXPIRED },
        })
      }
      return NextResponse.json(
        { success: false, error: 'This invitation link has expired.', code: 'EXPIRED' },
        { status: 410 }
      )
    }

    if (invitation.usesCount >= invitation.maxUses) {
      return NextResponse.json(
        { success: false, error: 'This invitation has reached its maximum number of uses.', code: 'EXHAUSTED' },
        { status: 410 }
      )
    }

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        type: invitation.type,
        role: invitation.role,
        email: invitation.email,
        organization: invitation.organization,
        inviterName: invitation.createdBy.name || 'A team member',
        expiresAt: invitation.expiresAt,
      },
    })
  } catch (error) {
    console.error('[GET /api/invitations/[token]] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
