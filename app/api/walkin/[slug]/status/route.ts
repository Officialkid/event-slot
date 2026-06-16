import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  formatWalkInLongDayLabel,
  getEventEndDayKey,
  getEventStartDayKey,
  getTodayWalkInDate,
  getWalkInDayKey,
  getWalkInDayPosition,
} from '@/lib/walkInEvents'

const WALK_IN_TIME_ZONE = 'Africa/Nairobi'

type WalkInStatus = 'ACTIVE' | 'NOT_STARTED' | 'ENDED'

function resolveStatus(todayKey: string, startDayKey: string, endDayKey: string): WalkInStatus {
  if (todayKey < startDayKey) return 'NOT_STARTED'
  if (todayKey > endDayKey) return 'ENDED'
  return 'ACTIVE'
}

export async function GET(_req: Request, props: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await props.params
    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        accessType: true,
        eventDate: true,
        eventEndAt: true,
      },
    })

    if (!event || event.accessType !== 'WALK_IN') {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    const todayKey = getWalkInDayKey(new Date(), WALK_IN_TIME_ZONE)
    const startDayKey = getEventStartDayKey(event.eventDate, WALK_IN_TIME_ZONE)
    const endDayKey = getEventEndDayKey(event.eventDate, event.eventEndAt, WALK_IN_TIME_ZONE)

    if (!startDayKey || !endDayKey) {
      return NextResponse.json({ success: false, error: 'Walk-in dates are not configured' }, { status: 400 })
    }

    const status = resolveStatus(todayKey, startDayKey, endDayKey)
    const displayDayKey = status === 'NOT_STARTED' ? startDayKey : status === 'ENDED' ? endDayKey : todayKey
    const dayPosition = getWalkInDayPosition({
      dayKey: displayDayKey,
      eventDate: event.eventDate,
      eventEndAt: event.eventEndAt,
      timeZone: WALK_IN_TIME_ZONE,
    })
    const countToday = status === 'ACTIVE'
      ? await prisma.walkInCheckin.count({
          where: { eventId: event.id, dayDate: getTodayWalkInDate(new Date(), WALK_IN_TIME_ZONE) },
        })
      : 0

    return NextResponse.json({
      eventTitle: event.title,
      status,
      dayNumber: dayPosition?.index ?? null,
      totalDays: dayPosition?.total ?? 0,
      dayLabel: formatWalkInLongDayLabel(displayDayKey, WALK_IN_TIME_ZONE),
      countToday,
    })
  } catch (error) {
    console.error('[WALKIN STATUS]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
