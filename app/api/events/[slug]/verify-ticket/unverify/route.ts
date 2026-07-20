import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { hasOrganiserAccess } from '@/lib/adminMode'
import { hasDashboardOrVerifierToken } from '@/lib/eventVerifierAccess'

type VerifiedEntry = {
  name?: string
  email?: string | null
  verifiedAt?: string
  source?: string
}

function normalizeVerifiedEntries(value: unknown): VerifiedEntry[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is Record<string, unknown> => !!entry && typeof entry === 'object')
    .map((entry) => ({
      name: typeof entry.name === 'string' ? entry.name : undefined,
      email: typeof entry.email === 'string' ? entry.email : null,
      verifiedAt: typeof entry.verifiedAt === 'string' ? entry.verifiedAt : undefined,
      source: typeof entry.source === 'string' ? entry.source : undefined,
    }))
}

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
    select: { id: true, organizerId: true, dashboardToken: true, verifierCode: true, verifierCodeEnabled: true },
  })

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const session = await getServerSession(authOptions)
  const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
  const hasValidToken = hasDashboardOrVerifierToken(token, event)
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
    include: {
      registration: {
        select: {
          id: true,
          confirmationCode: true,
        },
      },
    },
  })

  if (!ticket) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  const verifiedEntries = normalizeVerifiedEntries(ticket.verifiedEntries)
  const nextAdmissionsUsed = Math.max(0, (ticket.admissionsUsed ?? 0) - 1)
  const nextVerifiedEntries = verifiedEntries.slice(0, nextAdmissionsUsed)
  const latestVerifiedAt = nextVerifiedEntries[nextVerifiedEntries.length - 1]?.verifiedAt
  const nextScannedAt = latestVerifiedAt ? new Date(latestVerifiedAt) : null

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        scannedAt: nextScannedAt,
        admissionsUsed: nextAdmissionsUsed,
        verifiedEntries: nextVerifiedEntries,
      },
    })

    await tx.registration.update({
      where: { id: ticket.registration.id },
      data: {
        checkedIn: nextAdmissionsUsed > 0,
        checkedInAt: nextScannedAt,
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

  return NextResponse.json({
    ok: true,
    ticket: {
      ticketCode: ticket.code,
      scannedAt: nextScannedAt?.toISOString() ?? null,
      admissionsTotal: Math.max(1, ticket.admissionsTotal ?? 1),
      admissionsUsed: nextAdmissionsUsed,
      admissionsRemaining: Math.max(0, Math.max(1, ticket.admissionsTotal ?? 1) - nextAdmissionsUsed),
      verifiedEntries: nextVerifiedEntries,
      confirmationCode: ticket.registration.confirmationCode,
    },
  })
}
