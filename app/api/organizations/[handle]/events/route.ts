import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkOrgPermission,
  normalizeOrgHandle,
} from '@/lib/organizationPermissions'

export async function GET(
  _req: NextRequest,
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
      select: { id: true, name: true, handle: true },
    })

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const permCheck = await checkOrgPermission({
      userId: session.user.id,
      organizationId: org.id,
      permission: 'view_all_events',
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        { success: false, error: permCheck.reason || 'You do not have permission to view organization events.' },
        { status: 403 }
      )
    }

    const events = await prisma.event.findMany({
      where: {
        organizationId: org.id,
        archived: false,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        visibility: true,
        accessType: true,
        eventType: true,
        eventDate: true,
        eventEndAt: true,
        location: true,
        capacity: true,
        confirmedCount: true,
        waitlistCount: true,
        isPaid: true,
        ticketPrice: true,
        currency: true,
        ticketsEnabled: true,
        imageUrl: true,
        createdAt: true,
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        handle: org.handle,
      },
      events: events.map((ev) => ({
        ...ev,
        creatorName: ev.creator?.name || ev.creator?.username || ev.creator?.email || 'Team Member',
      })),
      currentUserRole: permCheck.role,
    })
  } catch (error) {
    console.error('[GET /api/organizations/[handle]/events] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
