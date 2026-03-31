import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Backfill: claim any events created with this email but no organizerId
    await prisma.event.updateMany({
      where: {
        organizerEmail: session.user.email,
        organizerId: null,
      },
      data: { organizerId: session.user.id },
    })

    const events = await prisma.event.findMany({
      where: {
        OR: [
          { organizerId: session.user.id },
          { organizerEmail: session.user.email },
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
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, events })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}
