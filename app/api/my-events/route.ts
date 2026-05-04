import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { eventListCache } from '@/lib/cache'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id
    const email = session.user.email ?? null

    const { searchParams } = new URL(req.url)
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100)
    const skip = (page - 1) * limit

    // Backfill: claim any events created with this email but no organizerId
    if (email) {
      try {
        await prisma.event.updateMany({
          where: { organizerEmail: email, organizerId: null },
          data: { organizerId: userId },
        })
      } catch (backfillErr) {
        console.warn('[my-events] backfill skipped:', backfillErr)
      }
    }

    const memberships = await prisma.teamMember.findMany({
      where: {
        memberId: userId,
        status: 'accepted',
      },
      select: {
        ownerId: true,
        _count: { select: { eventAccess: true } },
        eventAccess: { select: { eventId: true } },
      },
    })

    const ownerIdsWithGlobalAccess = memberships
      .filter((m) => m._count.eventAccess === 0)
      .map((m) => m.ownerId)

    const explicitlyAssignedEventIds = memberships.flatMap((m) => m.eventAccess.map((ea) => ea.eventId))

    const where = {
      OR: [
        { organizerId: userId },
        ...(email ? [{ organizerEmail: email }] : []),
        ...(ownerIdsWithGlobalAccess.length > 0 ? [{ organizerId: { in: ownerIdsWithGlobalAccess } }] : []),
        ...(explicitlyAssignedEventIds.length > 0 ? [{ id: { in: explicitlyAssignedEventIds } }] : []),
      ],
    }

    const cacheKey = `my-events:${userId}:${email ?? 'none'}:${page}:${limit}`
    const cached = eventListCache.get(cacheKey) as
      | { success: true; events: unknown[]; pagination: { page: number; limit: number; total: number; totalPages: number } }
      | undefined
    if (cached) {
      return NextResponse.json(cached)
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
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
          dataExpired: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.event.count({ where }),
    ])

    const payload = {
      success: true as const,
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    }

    eventListCache.set(cacheKey, payload)

    return NextResponse.json(payload)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}
