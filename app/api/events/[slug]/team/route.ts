import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasOrganiserAccess } from '@/lib/adminMode'
import { hasAdminAccess } from '@/lib/isAdmin'
import { purgeUserCache } from '@/lib/cache'

// GET /api/events/[slug]/team — list team members who have access to this event
export async function GET(_req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const event = await prisma.event.findUnique({
      where: { slug: params.slug },
      select: { id: true, organizerId: true },
    })

    if (!event || (event.organizerId !== session.user.id && !(await hasOrganiserAccess(session, event.id)))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const eventTeam = await prisma.teamMemberEvent.findMany({
      where: { eventId: event.id },
      include: {
        teamMember: {
          include: {
            member: { select: { name: true, email: true, image: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({
      members: eventTeam.map(et => ({
        teamMemberId: et.teamMemberId,
        email: et.teamMember.email,
        status: et.teamMember.status as 'pending' | 'accepted',
        member: et.teamMember.member,
        createdAt: et.teamMember.createdAt,
      })),
    })
  } catch (err) {
    console.error('[GET /api/events/[slug]/team]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/events/[slug]/team?memberId=xxx — remove a member's access to this event
export async function DELETE(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const memberId = new URL(req.url).searchParams.get('memberId')
    if (!memberId) {
      return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { slug: params.slug },
      select: { id: true, organizerId: true },
    })

    if (!event) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Only the event organizer who owns the event or a super admin can remove team members
    const isOwner = event.organizerId === session.user.id
    const isSuperAdmin = hasAdminAccess({ user: session.user })
    if (!isOwner && !isSuperAdmin) {
      return NextResponse.json(
        { error: 'Only the event organizer or super admin can remove team members' },
        { status: 403 }
      )
    }

    const teamMember = await prisma.teamMember.findUnique({
      where: { id: memberId },
      select: {
        memberId: true,
        member: { select: { email: true } },
      },
    })

    await prisma.teamMemberEvent.deleteMany({
      where: { teamMemberId: memberId, eventId: event.id },
    })

    // If this team member has no other event links, clean up the teamMember record
    // so revoked invite links cannot be claimed
    const remainingEvents = await prisma.teamMemberEvent.count({
      where: { teamMemberId: memberId },
    })
    if (remainingEvents === 0) {
      await prisma.teamMember.delete({
        where: { id: memberId },
      }).catch(() => {})
    }

    if (teamMember?.memberId) {
      purgeUserCache(teamMember.memberId, teamMember.member?.email ?? null)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /api/events/[slug]/team]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
