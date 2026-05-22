import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasTeamEventAccess } from '@/lib/eventAccess'

// GET /api/events/[slug]/campaigns — list campaigns + confirmed count for this event
export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const token = req.nextUrl.searchParams.get('token')
  const session = await getServerSession(authOptions)

  const event = await prisma.event.findUnique({
    where: { slug },
    select: { id: true, title: true, organizerId: true, dashboardToken: true, confirmedCount: true },
  })

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
  const hasValidToken = !!(token && event.dashboardToken === token)
  const hasTeamAccess = !!(
    session?.user?.id &&
    (await hasTeamEventAccess({ userId: session.user.id, organizerId: event.organizerId, eventId: event.id }))
  )

  if (!isOwner && !hasValidToken && !hasTeamAccess) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const campaigns = await prisma.emailCampaign.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      subject: true,
      type: true,
      status: true,
      sentAt: true,
      recipientCount: true,
      createdAt: true,
    },
  })

  return NextResponse.json({
    campaigns,
    confirmedCount: event.confirmedCount,
    eventTitle: event.title,
  })
}
