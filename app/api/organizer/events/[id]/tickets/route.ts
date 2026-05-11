import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasTeamEventAccess } from '@/lib/eventAccess'

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await props.params

  let body: { ticketsEnabled?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (typeof body.ticketsEnabled !== 'boolean') {
    return NextResponse.json({ error: 'ticketsEnabled must be a boolean' }, { status: 400 })
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, organizerId: true },
  })

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const userId = session.user.id
  const isOwner = event.organizerId === userId
  const isSuperAdmin = session.user.role === 'SUPER_ADMIN' || session.user.isAdmin
  const isTeamMember = !isOwner && !isSuperAdmin && !!(event.organizerId && await hasTeamEventAccess({
    userId,
    organizerId: event.organizerId,
    eventId: event.id,
  }))

  if (!isOwner && !isSuperAdmin && !isTeamMember) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated = await prisma.event.update({
    where: { id: event.id },
    data: { ticketsEnabled: body.ticketsEnabled },
    select: { id: true, ticketsEnabled: true },
  })

  return NextResponse.json(updated)
}
