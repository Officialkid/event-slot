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
      select: {
        id: true,
        name: true,
        handle: true,
        _count: {
          select: { followers: true },
        },
      },
    })

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const permCheck = await checkOrgPermission({
      userId: session.user.id,
      organizationId: org.id,
      permission: 'view_org_analytics',
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        { success: false, error: permCheck.reason || 'You do not have permission to view organization analytics.' },
        { status: 403 }
      )
    }

    // Retrieve organization events
    const orgEvents = await prisma.event.findMany({
      where: {
        organizationId: org.id,
        archived: false,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        eventDate: true,
        confirmedCount: true,
        waitlistCount: true,
        capacity: true,
        isPaid: true,
        _count: {
          select: {
            registrations: { where: { checkedIn: true } },
          },
        },
      },
      orderBy: { eventDate: 'desc' },
    })

    const totalEvents = orgEvents.length
    const activeEvents = orgEvents.filter((e) => e.status === 'active').length

    let totalRegistrations = 0
    let totalWaitlist = 0
    let totalCheckins = 0

    const recentEventsPerformance = orgEvents.slice(0, 10).map((e) => {
      totalRegistrations += e.confirmedCount
      totalWaitlist += e.waitlistCount
      totalCheckins += e._count.registrations

      const checkinRate = e.confirmedCount > 0 ? Math.round((e._count.registrations / e.confirmedCount) * 100) : 0

      return {
        id: e.id,
        title: e.title,
        slug: e.slug,
        status: e.status,
        eventDate: e.eventDate,
        registrations: e.confirmedCount,
        waitlist: e.waitlistCount,
        checkins: e._count.registrations,
        checkinRatePercent: checkinRate,
        capacity: e.capacity,
      }
    })

    return NextResponse.json({
      success: true,
      organization: {
        id: org.id,
        name: org.name,
        handle: org.handle,
      },
      metrics: {
        totalEvents,
        activeEvents,
        totalRegistrations,
        totalWaitlist,
        totalCheckins,
        followerCount: org._count.followers,
      },
      recentEvents: recentEventsPerformance,
      currentUserRole: permCheck.role,
    })
  } catch (error) {
    console.error('[GET /api/organizations/[handle]/analytics] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
