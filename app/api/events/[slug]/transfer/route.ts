import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkOrgPermission,
  normalizeOrgHandle,
} from '@/lib/organizationPermissions'
import { recordOrgAuditLog } from '@/lib/organizationAudit'
import { EventTransferStatus } from '@prisma/client'

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const params = await props.params
    const slug = params.slug.trim()
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        organizerId: true,
        organizationId: true,
        creatorId: true,
        status: true,
        archived: true,
        isPaid: true,
        paymentsLive: true,
      },
    })

    if (!event || event.archived) {
      return NextResponse.json({ success: false, error: 'Event not found or archived.' }, { status: 404 })
    }

    let body: {
      targetOrganizationHandle?: string
      targetOrganizationId?: string
      notes?: string
    }

    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const targetHandleOrId = (body.targetOrganizationHandle || body.targetOrganizationId || '').trim()
    if (!targetHandleOrId) {
      return NextResponse.json(
        { success: false, error: 'Please specify the target organization handle or ID.' },
        { status: 400 }
      )
    }

    // 1. Resolve target organization
    const targetOrg = await prisma.organization.findFirst({
      where: {
        OR: [
          { id: targetHandleOrId },
          { handle: normalizeOrgHandle(targetHandleOrId) },
        ],
      },
      select: { id: true, name: true, handle: true, contactEmail: true },
    })

    if (!targetOrg) {
      return NextResponse.json(
        { success: false, error: 'Destination organization not found.' },
        { status: 404 }
      )
    }

    if (event.organizationId === targetOrg.id) {
      return NextResponse.json(
        { success: false, error: 'This event already belongs to the specified organization.' },
        { status: 400 }
      )
    }

    // 2. Authorization check on Source
    if (!event.organizationId) {
      // Source is personal: Caller must be the event organizer
      if (event.organizerId !== session.user.id) {
        return NextResponse.json(
          { success: false, error: 'Only the personal owner can transfer this event.' },
          { status: 403 }
        )
      }
    } else {
      // Source is another organization: Caller must be an Owner of source organization
      const sourcePerm = await checkOrgPermission({
        userId: session.user.id,
        organizationId: event.organizationId,
        permission: 'transfer_event',
      })
      if (!sourcePerm.allowed) {
        return NextResponse.json(
          { success: false, error: 'Only an Owner of the source organization can transfer this event.' },
          { status: 403 }
        )
      }
    }

    // 3. Authorization check on Destination
    const destPerm = await checkOrgPermission({
      userId: session.user.id,
      organizationId: targetOrg.id,
      permission: 'create_event',
    })
    if (!destPerm.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'You do not have permission to receive events into the destination organization.',
        },
        { status: 403 }
      )
    }

    // 4. Financial & Settlement safety check
    // If event is paid with active settlement, ensure no live payouts are disrupted
    if (event.isPaid && event.paymentsLive && event.organizerId) {
      // Check for pending withdrawals or unbalanced payouts
      const pendingWithdrawals = await prisma.withdrawal.count({
        where: {
          organiserId: event.organizerId,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
      })
      if (pendingWithdrawals > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'This event has pending withdrawals in progress. Complete or reconcile settlements before transferring.',
          },
          { status: 400 }
        )
      }
    }

    // 5. Execute Transfer Transactionally
    const sourceOwnerType = event.organizationId ? 'ORGANIZATION' : 'PERSONAL'
    const sourceOwnerId = event.organizationId || event.organizerId || session.user.id

    const result = await prisma.$transaction(async (tx) => {
      const transferRecord = await tx.eventTransferRequest.create({
        data: {
          eventId: event.id,
          sourceOwnerType,
          sourceOwnerId,
          targetOwnerType: 'ORGANIZATION',
          targetOwnerId: targetOrg.id,
          status: EventTransferStatus.COMPLETED,
          initiatedById: session.user.id,
          approvedById: session.user.id,
          notes: body.notes?.trim() || null,
        },
      })

      const updatedEvent = await tx.event.update({
        where: { id: event.id },
        data: {
          organizationId: targetOrg.id,
          organizerName: targetOrg.name,
          organizerEmail: targetOrg.contactEmail || undefined,
          // creatorId is strictly preserved for attribution
          creatorId: event.creatorId || event.organizerId || session.user.id,
        },
        select: {
          id: true,
          slug: true,
          title: true,
          organizationId: true,
          creatorId: true,
          organizerName: true,
        },
      })

      return { transferRecord, updatedEvent }
    })

    await recordOrgAuditLog({
      organizationId: targetOrg.id,
      actorId: session.user.id,
      action: 'EVENT_TRANSFERRED_IN',
      targetType: 'EVENT',
      targetId: event.id,
      metadata: {
        eventId: event.id,
        slug: event.slug,
        title: event.title,
        sourceOwnerType,
        sourceOwnerId,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Event "${event.title}" has been successfully transferred to ${targetOrg.name}.`,
      event: result.updatedEvent,
      transferId: result.transferRecord.id,
    })
  } catch (error) {
    console.error('[POST /api/events/[slug]/transfer] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
