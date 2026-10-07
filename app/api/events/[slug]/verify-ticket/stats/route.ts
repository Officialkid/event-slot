import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { hasOrganiserAccess } from '@/lib/adminMode'
import { hasDashboardOrVerifierToken } from '@/lib/eventVerifierAccess'

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const token = req.nextUrl.searchParams.get('token')?.trim() ?? ''

  const event = await prisma.event.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    select: {
      id: true,
      title: true,
      organizerId: true,
      dashboardToken: true,
      verifierCode: true,
      verifierCodeEnabled: true,
    },
  })

  if (!event) {
    return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
  }

  const session = await getServerSession(authOptions)
  const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
  const hasValidToken = hasDashboardOrVerifierToken(token, event)
  const hasTeamAccess = !!(
    session?.user?.id &&
    (await hasTeamEventAccess({
      userId: session.user.id,
      organizerId: event.organizerId,
      eventId: event.id,
    }))
  )
  const adminAccess = !!(session && (await hasOrganiserAccess(session, event.id)))

  if (!isOwner && !hasValidToken && !hasTeamAccess && !adminAccess) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const [totalConfirmed, totalCheckedIn] = await Promise.all([
    prisma.registration.count({
      where: { eventId: event.id, status: 'confirmed' },
    }),
    prisma.registration.count({
      where: { eventId: event.id, status: 'confirmed', checkedIn: true },
    }),
  ])

  const remaining = Math.max(0, totalConfirmed - totalCheckedIn)
  const turnoutRate = totalConfirmed > 0 ? Math.round((totalCheckedIn / totalConfirmed) * 100) : 0

  return NextResponse.json({
    success: true,
    eventTitle: event.title,
    totalConfirmed,
    totalCheckedIn,
    remaining,
    turnoutRate,
  })
}
