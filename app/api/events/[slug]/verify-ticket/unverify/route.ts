import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { hasOrganiserAccess } from '@/lib/adminMode'

export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const body = (await req.json().catch(() => null)) as { token?: string; ticketCode?: string; registrationId?: string } | null
  const token = body?.token?.trim() ?? ''
  const ticketCode = body?.ticketCode?.trim().toUpperCase() ?? ''
  const registrationId = body?.registrationId?.trim() ?? ''

  if (!ticketCode && !registrationId) {
    return NextResponse.json({ error: 'ticketCode or registrationId is required' }, { status: 400 })
  }

  const event = await prisma.event.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    select: { id: true, organizerId: true, dashboardToken: true },
  })

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const session = await getServerSession(authOptions)
  const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
  const hasValidToken = !!(token && token === event.dashboardToken)
  const hasTeamAccess = !!(session?.user?.id && await hasTeamEventAccess({
    userId: session.user.id,
    organizerId: event.organizerId,
    eventId: event.id,
  }))
  const adminAccess = !!(session && await hasOrganiserAccess(session, event.id))

  if (!isOwner && !hasValidToken && !hasTeamAccess && !adminAccess) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ticket = await prisma.ticket.findFirst({
    where: ticketCode
      ? { code: ticketCode, registration: { eventId: event.id } }
      : { registrationId, registration: { eventId: event.id } },
    include: { registration: { select: { id: true } } },
  })

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticket.id },
      data: { scannedAt: null },
    })

    await tx.registration.update({
      where: { id: ticket.registration.id },
      data: {
        checkedIn: false,
        checkedInAt: null,
      },
    })

    await tx.entryLog.create({
      data: {
        eventId: event.id,
        ticketId: ticket.code,
        attendeeName: 'Attendee',
        success: false,
        failReason: 'UNVERIFIED',
      },
    })
  })

  return NextResponse.json({ ok: true })
}
