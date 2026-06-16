import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import {
  formatWalkInShortDayLabel,
  getEventEndDayKey,
  getEventStartDayKey,
  getWalkInDayKey,
  getWalkInDayPosition,
  getWalkInDayRange,
} from '@/lib/walkInEvents'

const WALK_IN_TIME_ZONE = 'Africa/Nairobi'

type DayStatus = 'CLOSED' | 'ACTIVE' | 'UPCOMING'
type WalkInStatus = 'NOT_STARTED' | 'ACTIVE' | 'ENDED'

function dayStatus(dayKey: string, todayKey: string): DayStatus {
  if (dayKey < todayKey) return 'CLOSED'
  if (dayKey > todayKey) return 'UPCOMING'
  return 'ACTIVE'
}

function resolveStatus(todayKey: string, startDayKey: string, endDayKey: string): WalkInStatus {
  if (todayKey < startDayKey) return 'NOT_STARTED'
  if (todayKey > endDayKey) return 'ENDED'
  return 'ACTIVE'
}

export async function GET(_req: Request, props: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await props.params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        accessType: true,
        organizerId: true,
        eventDate: true,
        eventEndAt: true,
      },
    })

    if (!event || event.accessType !== 'WALK_IN') {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    if (event.organizerId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const startDate = getEventStartDayKey(event.eventDate, WALK_IN_TIME_ZONE)
    const endDate = getEventEndDayKey(event.eventDate, event.eventEndAt, WALK_IN_TIME_ZONE)
    if (!startDate || !endDate) {
      return NextResponse.json({ success: false, error: 'Walk-in dates are not configured' }, { status: 400 })
    }

    const status = resolveStatus(getWalkInDayKey(new Date(), WALK_IN_TIME_ZONE), startDate, endDate)
    const dayKeys = getWalkInDayRange({
      eventDate: event.eventDate,
      eventEndAt: event.eventEndAt,
      timeZone: WALK_IN_TIME_ZONE,
    })
    const groupedByDay = await prisma.walkInCheckin.groupBy({
      by: ['dayDate'],
      where: { eventId: event.id },
      _count: { _all: true },
      orderBy: { dayDate: 'asc' },
    })
    const counts = new Map(groupedByDay.map((entry) => [getWalkInDayKey(entry.dayDate, WALK_IN_TIME_ZONE), entry._count._all]))
    const todayKey = getWalkInDayKey(new Date(), WALK_IN_TIME_ZONE)

    const days = dayKeys.map((date) => {
      const position = getWalkInDayPosition({
        dayKey: date,
        eventDate: event.eventDate,
        eventEndAt: event.eventEndAt,
        timeZone: WALK_IN_TIME_ZONE,
      })

      return {
        date,
        dayNumber: position?.index ?? 1,
        label: formatWalkInShortDayLabel(date, WALK_IN_TIME_ZONE),
        count: counts.get(date) ?? 0,
        status: dayStatus(date, todayKey),
      }
    })

    return NextResponse.json({
      eventTitle: event.title,
      startDate,
      endDate,
      status,
      days,
      totalCheckins: days.reduce((sum, day) => sum + day.count, 0),
    })
  } catch (error) {
    console.error('[WALKIN DASHBOARD]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
