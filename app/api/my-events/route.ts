import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { eventListCache } from '@/lib/cache'
import { syncEventPassStatusForEvent, needsEventPassSync } from '@/lib/eventPasses'

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

    // Backfill: claim any events created with this email but no organizerId (checks first to avoid repeated writes)
    if (email) {
      try {
        const unclaimed = typeof prisma.event?.findFirst === 'function'
          ? await prisma.event.findFirst({
              where: { organizerEmail: email, organizerId: null },
              select: { id: true },
            })
          : true

        if (unclaimed) {
          await prisma.event.updateMany({
            where: { organizerEmail: email, organizerId: null },
            data: { organizerId: userId },
          })
        }
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
      return NextResponse.json(cached, { headers: { 'Cache-Control': 'private, no-store' } })
    }

    const [events, total, groupBookings] = await Promise.all([
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
          eventEndAt: true,
          isRecurring: true,
          location: true,
          eventType: true,
          dataExpired: true,
          eventPass: {
            select: {
              id: true,
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
      email
        ? prisma.groupBooking.findMany({
            where: {
              OR: [
                { contactEmail: email.toLowerCase() },
                { contactEmail: email },
              ],
              status: { not: 'CANCELLED' },
            },
            include: {
              event: {
                select: {
                  id: true,
                  title: true,
                  slug: true,
                  eventDate: true,
                  location: true,
                  eventType: true,
                },
              },
              slots: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ])

    // Sync only events that actually require an event-pass state transition
    const eventsNeedingSync = events.filter((e) =>
      typeof needsEventPassSync === 'function' ? needsEventPassSync(e) : !!e.eventPass
    )
    if (eventsNeedingSync.length > 0) {
      await Promise.all(eventsNeedingSync.map((event) => syncEventPassStatusForEvent(event).catch(() => null)))
    }

    const payload = {
      success: true as const,
      events: events.map((event) => ({
        ...event,
        eventPassTier: event.eventPass?.tier?.toLowerCase() ?? null,
        eventPassStatus: event.eventPass?.status ?? null,
        eventPassExpiresAt: event.eventPass?.expiresAt ?? null,
      })),
      groupBookings: (groupBookings || []).map((b: any) => {
        const slots = b.slots || []
        const assignedCount = slots.filter((s: any) => s.status === 'ASSIGNED' || s.status === 'CHECKED_IN').length
        const checkedInCount = slots.filter((s: any) => s.status === 'CHECKED_IN').length
        const unassignedCount = Math.max(0, b.totalSlots - assignedCount)

        return {
          id: b.id,
          orgName: b.orgName,
          orgType: b.orgType,
          totalSlots: b.totalSlots,
          assignedCount,
          unassignedCount,
          checkedInCount,
          bookingToken: b.bookingToken,
          claimToken: b.claimToken,
          createdAt: b.createdAt,
          event: b.event,
        }
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    }

    eventListCache.set(cacheKey, payload)

    return NextResponse.json(payload, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}
