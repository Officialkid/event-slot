import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { normalizeInternationalPhoneNumber } from '@/lib/eventContact'
import { walkInCheckinRatelimit } from '@/lib/ratelimit'
import { buildWalkInReturnLink, createWalkInReturnToken, verifyWalkInReturnToken } from '@/lib/walkInReturnLink'
import {
  formatWalkInLongDayLabel,
  getEventEndDayKey,
  getEventStartDayKey,
  getTodayWalkInDate,
  getWalkInDayKey,
  getWalkInDayPosition,
} from '@/lib/walkInEvents'

const WALK_IN_TIME_ZONE = 'Africa/Nairobi'

function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  const realIp = req.headers.get('x-real-ip')
  return (forwarded ? forwarded.split(',')[0] : realIp ?? '127.0.0.1').trim()
}

export async function POST(req: Request, props: { params: Promise<{ slug: string }> }) {
  try {
    const ip = getClientIp(req)
    const rateLimit = await walkInCheckinRatelimit.limit(ip)
    if (!rateLimit.success) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please try again shortly.' }, { status: 429 })
    }

    const { slug } = await props.params
    const requestOrigin = new URL(req.url).origin
    const body = await req.json().catch(() => null)
    const returnToken = typeof body?.returnToken === 'string' ? body.returnToken.trim() : ''
    const returnPayload = returnToken ? verifyWalkInReturnToken(returnToken) : null
    const name = returnPayload ? returnPayload.name : typeof body?.name === 'string' ? body.name.trim() : ''
    const rawPhone = returnPayload ? returnPayload.phone : typeof body?.phone === 'string' ? body.phone.trim() : ''

    if (name.length < 2) {
      return NextResponse.json({ success: false, error: 'Please enter the attendee name.' }, { status: 400 })
    }

    const phone = normalizeInternationalPhoneNumber(rawPhone)
    if (!phone.ok) {
      return NextResponse.json({ success: false, error: phone.error }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        accessType: true,
        eventDate: true,
        eventEndAt: true,
        organizer: {
          select: {
            name: true,
          },
        },
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

    if (todayKey < startDayKey) {
      return NextResponse.json(
        { success: false, code: 'EVENT_NOT_STARTED', startDate: startDayKey },
        { status: 400 },
      )
    }

    if (todayKey > endDayKey) {
      return NextResponse.json(
        { success: false, code: 'EVENT_ENDED', endDate: endDayKey },
        { status: 400 },
      )
    }

    const todayDate = getTodayWalkInDate(new Date(), WALK_IN_TIME_ZONE)
    let duplicate = false

    try {
      await prisma.walkInCheckin.create({
        data: {
          eventId: event.id,
          name,
          phone: phone.number,
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

    const attendeeEntry = await prisma.walkInCheckin.findUnique({
      where: {
        eventId_phone_dayDate: {
          eventId: event.id,
          phone: phone.number,
          dayDate: todayDate,
        },
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    })

    if (!attendeeEntry) {
      throw new Error('Walk-in check-in could not be loaded after save.')
    }

    const [countToday, totalCount, dayPosition, checkinNumber] = await Promise.all([
      prisma.walkInCheckin.count({ where: { eventId: event.id, dayDate: todayDate } }),
      prisma.walkInCheckin.count({ where: { eventId: event.id } }),
      Promise.resolve(getWalkInDayPosition({
        dayKey: todayKey,
        eventDate: event.eventDate,
        eventEndAt: event.eventEndAt,
        timeZone: WALK_IN_TIME_ZONE,
      })),
      prisma.walkInCheckin.count({
        where: {
          eventId: event.id,
          dayDate: todayDate,
          OR: [
            { createdAt: { lt: attendeeEntry.createdAt } },
            {
              createdAt: attendeeEntry.createdAt,
              id: { lte: attendeeEntry.id },
            },
          ],
        },
      }),
    ])

    const returnTokenValue = createWalkInReturnToken({
      slug: event.slug,
      name: attendeeEntry.name,
      phone: phone.number,
    })

    const dayTitle = dayPosition && dayPosition.total > 1
      ? `Day ${dayPosition.index} of ${dayPosition.total}`
      : null

    return NextResponse.json({
      success: true,
      duplicate,
      attendee: {
        name: attendeeEntry.name,
        phone: phone.number,
      },
      event: {
        title: event.title,
        slug: event.slug,
        organizerName: event.organizer?.name ?? null,
      },
      day: {
        key: todayKey,
        title: dayTitle,
        label: formatWalkInLongDayLabel(todayKey, WALK_IN_TIME_ZONE),
        index: dayPosition?.index ?? 1,
        total: dayPosition?.total ?? 1,
      },
      todayCount: countToday,
      totalCount,
      dayNumber: dayPosition?.index ?? 1,
      totalDays: dayPosition?.total ?? 1,
      dayLabel: formatWalkInLongDayLabel(todayKey, WALK_IN_TIME_ZONE),
      countToday,
      eventTitle: event.title,
      attendeeName: attendeeEntry.name,
      checkinNumber,
      returnToken: returnTokenValue,
      returnLink: buildWalkInReturnLink(requestOrigin, slug, returnTokenValue),
    })
  } catch (error) {
    console.error('[WALKIN CHECKIN]', error)
    return NextResponse.json({ success: false, error: 'Unable to complete check-in right now.' }, { status: 500 })
  }
}
