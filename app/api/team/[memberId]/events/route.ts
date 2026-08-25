import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { purgeUserCache } from '@/lib/cache'

interface Ctx { params: Promise<{ memberId: string }> }

// GET /api/team/[memberId]/events — return assigned event IDs for this member
export async function GET(_req: NextRequest, props: Ctx) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const record = await prisma.teamMember.findUnique({
      where: { id: params.memberId },
      include: { eventAccess: { include: { event: { select: { id: true, title: true, slug: true, status: true } } } } },
    })

    if (!record || record.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ events: record.eventAccess.map(a => a.event) })
  } catch (err) {
    console.error('[GET team/[memberId]/events]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PUT /api/team/[memberId]/events — replace all assigned events { eventIds: string[] }
export async function PUT(req: NextRequest, props: Ctx) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const eventIds: string[] = Array.isArray(body.eventIds) ? body.eventIds : []

    const record = await prisma.teamMember.findUnique({
      where: { id: params.memberId },
      select: {
        id: true,
        ownerId: true,
        status: true,
        memberId: true,
        member: { select: { email: true } },
      },
    })

    if (!record || record.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (record.status !== 'accepted') {
      return NextResponse.json({ error: 'Can only assign events to accepted members' }, { status: 400 })
    }

    // Verify all events belong to this organizer and enforce 10 members per event
    if (eventIds.length > 0) {
      const events = await prisma.event.findMany({
        where: { id: { in: eventIds }, organizerId: session.user.id },
        select: { id: true, title: true },
      })
      if (events.length !== eventIds.length) {
        return NextResponse.json({ error: 'One or more events not found' }, { status: 400 })
      }

      for (const ev of events) {
        const assignedCount = await prisma.teamMemberEvent.count({
          where: { eventId: ev.id, teamMemberId: { not: params.memberId } },
        })
        if (assignedCount >= 10) {
          return NextResponse.json(
            { error: `Event "${ev.title}" already has the maximum of 10 team members assigned.` },
            { status: 400 }
          )
        }
      }
    }

    // Replace existing access list atomically
    await prisma.$transaction([
      prisma.teamMemberEvent.deleteMany({ where: { teamMemberId: params.memberId } }),
      ...(eventIds.length > 0
        ? [prisma.teamMemberEvent.createMany({
            data: eventIds.map(eventId => ({ teamMemberId: params.memberId, eventId })),
          })]
        : []),
    ])

    if (record.memberId) {
      purgeUserCache(record.memberId, record.member?.email ?? null)
    }

    return NextResponse.json({ ok: true, assigned: eventIds.length })
  } catch (err) {
    console.error('[PUT team/[memberId]/events]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
