import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { decrypt } from '@/lib/encrypt'

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await props.params

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      organizerId: true,
      title: true,
      eventDate: true,
      capacity: true,
      eventType: true,
      virtualLink: true,
      virtualLinkIv: true,
      _count: {
        select: {
          registrations: {
            where: { status: 'confirmed' },
          },
        },
      },
    },
  })

  if (!event) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isSuperAdmin = session.user.role === 'SUPER_ADMIN' || session.user.isAdmin
  if (event.organizerId !== session.user.id && !isSuperAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const entryLogs = await prisma.entryLog.findMany({
    where: { eventId: id, success: true },
    orderBy: { scannedAt: 'desc' },
    take: 200,
  })

  let hostLink: string | null = null
  if (event.eventType === 'VIRTUAL' && event.virtualLink && event.virtualLinkIv) {
    try {
      hostLink = decrypt(event.virtualLink, event.virtualLinkIv)
    } catch {
      hostLink = null
    }
  }

  return NextResponse.json({
    eventTitle: event.title,
    eventType: event.eventType,
    eventDate: event.eventDate,
    totalConfirmed: event._count.registrations,
    totalEntered: entryLogs.length,
    hostLink,
    entryLogs: entryLogs.map((log) => ({
      attendeeName: log.attendeeName,
      scannedAt: log.scannedAt,
    })),
  })
}
