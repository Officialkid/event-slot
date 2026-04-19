import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/team/events — return organizer's own event list (id, title, slug, status)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const events = await prisma.event.findMany({
      where: {
        OR: [
          { organizerId: session.user.id },
          { organizerEmail: session.user.email ?? '' },
        ],
      },
      select: { id: true, title: true, slug: true, status: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ events })
  } catch (err) {
    console.error('[GET team/events]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
