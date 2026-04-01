import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getEffectiveUserId } from '@/lib/getEffectiveUserId'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const effective = await getEffectiveUserId()
    if (!effective) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { userId, email } = effective

    // Backfill: claim any events created with this email but no organizerId
    if (email) {
      await prisma.event.updateMany({
        where: { organizerEmail: email, organizerId: null },
        data: { organizerId: userId },
      })
    }

    const events = await prisma.event.findMany({
      where: {
        OR: [
          { organizerId: userId },
          ...(email ? [{ organizerEmail: email }] : []),
        ],
      },
      select: {
        id: true,
        title: true,
        slug: true,
        capacity: true,
        deadline: true,
        confirmedCount: true,
        waitlistCount: true,
        dashboardToken: true,
        createdAt: true,
        archived: true,
        status: true,
        eventDate: true,
        location: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, events })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}
