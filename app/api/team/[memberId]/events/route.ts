import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
      select: { id: true, ownerId: true, status: true },
    })

    if (!record || record.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (record.status !== 'accepted') {
      return NextResponse.json({ error: 'Can only assign events to accepted members' }, { status: 400 })
    }

    // Verify all events belong to this organizer
    if (eventIds.length > 0) {
      const count = await prisma.event.count({
        where: { id: { in: eventIds }, organizerId: session.user.id },
      })
      if (count !== eventIds.length) {
        return NextResponse.json({ error: 'One or more events not found' }, { status: 400 })
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

    return NextResponse.json({ ok: true, assigned: eventIds.length })
  } catch (err) {
    console.error('[PUT team/[memberId]/events]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
