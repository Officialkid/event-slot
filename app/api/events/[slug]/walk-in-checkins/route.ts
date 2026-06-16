import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { hasOrganiserAccess } from '@/lib/adminMode'
import { normalizeInternationalPhoneNumber } from '@/lib/eventContact'
import {
  formatWalkInDayLabel,
  getEventEndDayKey,
  getEventStartDayKey,
  getWalkInDayPosition,
  getWalkInDayRange,
  getTodayWalkInDate,
  getWalkInDayKey,
  isWalkInOpenToday,
} from '@/lib/walkInEvents'

const WALK_IN_TIME_ZONE = 'Africa/Nairobi'

type WalkInDashboardEvent = NonNullable<Awaited<ReturnType<typeof prisma.event.findUnique>>>

type DashboardAccessResult =
  | { ok: true; event: WalkInDashboardEvent }
  | { ok: false; response: NextResponse }

async function getWalkInEventWithDashboardAccess(req: NextRequest, slug: string): Promise<DashboardAccessResult> {
  const token = req.nextUrl.searchParams.get('token')
  const session = await getServerSession(authOptions)

  const event = await prisma.event.findUnique({
    where: { slug },
    include: {
      organizer: { select: { suspended: true } },
    },
  })

  if (!event) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 }) }
  }

  if (event.accessType !== 'WALK_IN') {
    return { ok: false, response: NextResponse.json({ success: false, error: 'This event does not use walk-in check-in.' }, { status: 400 }) }
  }

  const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
  const hasValidToken = !!(token && event.dashboardToken === token)
  const hasTeamAccess = !!(session?.user?.id && await hasTeamEventAccess({
    userId: session.user.id,
    organizerId: event.organizerId,
    eventId: event.id,
  }))
  const adminAccess = !!(session && await hasOrganiserAccess(session, event.id))

  if (!isOwner && !hasValidToken && !hasTeamAccess && !adminAccess) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }) }
  }

  return { ok: true, event }
}

function getWalkInAvailability(eventDate: Date | null, eventEndAt: Date | null) {
  const openToday = isWalkInOpenToday({
    eventDate,
    eventEndAt,
    timeZone: WALK_IN_TIME_ZONE,
  })
  const todayKey = getWalkInDayKey(new Date(), WALK_IN_TIME_ZONE)
  const startDayKey = eventDate ? getEventStartDayKey(eventDate, WALK_IN_TIME_ZONE) : null
  const endDayKey = eventDate ? getEventEndDayKey(eventDate, eventEndAt, WALK_IN_TIME_ZONE) : null

  let availabilityMessage = ''
  if (!eventDate) {
    availabilityMessage = 'Check-in dates have not been configured yet.'
  } else if (openToday) {
    availabilityMessage = `Walk-in check-in is open for ${formatWalkInDayLabel(todayKey, WALK_IN_TIME_ZONE)}.`
  } else if (startDayKey && todayKey < startDayKey) {
    availabilityMessage = `Check-in opens on ${formatWalkInDayLabel(startDayKey, WALK_IN_TIME_ZONE)}.`
  } else if (endDayKey && todayKey > endDayKey) {
    availabilityMessage = `This walk-in event ended on ${formatWalkInDayLabel(endDayKey, WALK_IN_TIME_ZONE)}.`
  } else {
    availabilityMessage = 'Walk-in check-in is not open right now.'
  }

  return {
    openToday,
    todayKey,
    startDayKey,
    endDayKey,
    availabilityMessage,
  }
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params
  try {
    const access = await getWalkInEventWithDashboardAccess(req, params.slug)
    if (!access.ok) return access.response

    const { event } = access
    const availability = getWalkInAvailability(event.eventDate, event.eventEndAt)

    const [totalCount, todayCount, recent, groupedByDay] = await Promise.all([
      prisma.walkInCheckin.count({
        where: { eventId: event.id },
      }),
      prisma.walkInCheckin.count({
        where: {
          eventId: event.id,
          dayDate: getTodayWalkInDate(new Date(), WALK_IN_TIME_ZONE),
        },
      }),
      prisma.walkInCheckin.findMany({
        where: { eventId: event.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          name: true,
          phone: true,
          dayDate: true,
          createdAt: true,
        },
      }),
      prisma.walkInCheckin.groupBy({
        by: ['dayDate'],
        where: { eventId: event.id },
        _count: { _all: true },
        orderBy: { dayDate: 'asc' },
      }),
    ])

    const dayRange = getWalkInDayRange({
      eventDate: event.eventDate,
      eventEndAt: event.eventEndAt,
      timeZone: WALK_IN_TIME_ZONE,
    })
    const groupedCountByDay = new Map(
      groupedByDay.map((entry) => [getWalkInDayKey(entry.dayDate, WALK_IN_TIME_ZONE), entry._count._all])
    )
    const currentDayPosition = getWalkInDayPosition({
      dayKey: availability.todayKey,
      eventDate: event.eventDate,
      eventEndAt: event.eventEndAt,
      timeZone: WALK_IN_TIME_ZONE,
    })

    return NextResponse.json({
      success: true,
      summary: {
        totalCount,
        todayCount,
        currentDayKey: availability.todayKey,
        currentDayLabel: formatWalkInDayLabel(availability.todayKey, WALK_IN_TIME_ZONE),
        currentDayTitle: currentDayPosition && currentDayPosition.total > 1
          ? `Day ${currentDayPosition.index} of ${currentDayPosition.total}`
          : null,
        isOpenToday: availability.openToday,
        availabilityMessage: availability.availabilityMessage,
        dayCounts: dayRange.map((dayKey) => {
          const dayPosition = getWalkInDayPosition({
            dayKey,
            eventDate: event.eventDate,
            eventEndAt: event.eventEndAt,
            timeZone: WALK_IN_TIME_ZONE,
          })
          return {
            dayKey,
            dayLabel: formatWalkInDayLabel(dayKey, WALK_IN_TIME_ZONE),
            dayTitle: dayPosition && dayPosition.total > 1 ? `Day ${dayPosition.index} of ${dayPosition.total}` : null,
            count: groupedCountByDay.get(dayKey) ?? 0,
          }
        }),
        recent: recent.map((entry) => {
          const dayKey = getWalkInDayKey(entry.dayDate, WALK_IN_TIME_ZONE)
          const dayPosition = getWalkInDayPosition({
            dayKey,
            eventDate: event.eventDate,
            eventEndAt: event.eventEndAt,
            timeZone: WALK_IN_TIME_ZONE,
          })
          return {
            id: entry.id,
            name: entry.name,
            phone: entry.phone,
            dayKey,
            dayLabel: formatWalkInDayLabel(dayKey, WALK_IN_TIME_ZONE),
            dayTitle: dayPosition && dayPosition.total > 1 ? `Day ${dayPosition.index} of ${dayPosition.total}` : null,
            createdAt: entry.createdAt.toISOString(),
          }
        }),
      },
    })
  } catch (error) {
    console.error('[WALK-IN CHECKINS GET]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params
  try {
    const body = await req.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const rawPhone = typeof body?.phone === 'string' ? body.phone.trim() : ''

    if (name.length < 2) {
      return NextResponse.json({ success: false, error: 'Please enter the attendee name.' }, { status: 400 })
    }

    const normalizedPhone = normalizeInternationalPhoneNumber(rawPhone)
    if (!normalizedPhone.ok) {
      return NextResponse.json({ success: false, error: normalizedPhone.error }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { slug: params.slug },
      include: {
        organizer: { select: { suspended: true, name: true } },
      },
    })

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found.' }, { status: 404 })
    }

    if (event.accessType !== 'WALK_IN') {
      return NextResponse.json({ success: false, error: 'This event does not accept walk-in check-ins.' }, { status: 400 })
    }

    if (event.archived || event.status === 'archived' || event.status === 'closed' || event.organizer?.suspended) {
      return NextResponse.json({ success: false, error: 'This event is not accepting check-ins right now.' }, { status: 400 })
    }

    const availability = getWalkInAvailability(event.eventDate, event.eventEndAt)
    if (!availability.openToday) {
      return NextResponse.json({ success: false, error: availability.availabilityMessage }, { status: 400 })
    }

    const todayDate = getTodayWalkInDate(new Date(), WALK_IN_TIME_ZONE)

    let duplicate = false
    try {
      await prisma.walkInCheckin.create({
        data: {
          eventId: event.id,
          name,
          phone: normalizedPhone.number,
          dayDate: todayDate,
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        duplicate = true
      } else {
        throw error
      }
    }

    const [todayCount, totalCount] = await Promise.all([
      prisma.walkInCheckin.count({
        where: {
          eventId: event.id,
          dayDate: todayDate,
        },
      }),
      prisma.walkInCheckin.count({
        where: { eventId: event.id },
      }),
    ])

    const todayPosition = getWalkInDayPosition({
      dayKey: availability.todayKey,
      eventDate: event.eventDate,
      eventEndAt: event.eventEndAt,
      timeZone: WALK_IN_TIME_ZONE,
    })

    return NextResponse.json({
      success: true,
      duplicate,
      attendee: {
        name,
        phone: normalizedPhone.number,
      },
      event: {
        title: event.title,
        slug: event.slug,
        organizerName: event.organizer?.name ?? null,
      },
      day: {
        key: availability.todayKey,
        title: todayPosition && todayPosition.total > 1 ? `Day ${todayPosition.index} of ${todayPosition.total}` : null,
        label: formatWalkInDayLabel(availability.todayKey, WALK_IN_TIME_ZONE),
        index: todayPosition?.index ?? 1,
        total: todayPosition?.total ?? 1,
      },
      todayCount,
      totalCount,
    })
  } catch (error) {
    console.error('[WALK-IN CHECKINS POST]', error)
    return NextResponse.json({ success: false, error: 'Unable to complete check-in right now.' }, { status: 500 })
  }
}
