import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { eventListCache } from '@/lib/cache'
import { syncEventPassStatusForEvent } from '@/lib/eventPasses'

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
        eventAccess: { select: { eventId: true } },
      },
    })

    const explicitlyAssignedEventIds = memberships.flatMap((m) => m.eventAccess.map((ea) => ea.eventId))

    const where = {
      OR: [
        { organizerId: userId },
        ...(email ? [{ organizerEmail: email }] : []),
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
          eventPass: {
            select: {
              tier: true,
              status: true,
              expiresAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      prisma.event.count({ where }),
    ])

    await Promise.all(events.map((event) => syncEventPassStatusForEvent(event.id).catch(() => null)))

    const payload = {
      success: true as const,
      events: events.map((event) => ({
        ...event,
        eventPassTier: event.eventPass?.tier?.toLowerCase() ?? null,
        eventPassStatus: event.eventPass?.status ?? null,
        eventPassExpiresAt: event.eventPass?.expiresAt ?? null,
      })),
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
