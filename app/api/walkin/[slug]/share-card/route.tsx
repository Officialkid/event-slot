import { ImageResponse } from 'next/og'
import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import prisma from '@/lib/prisma'
import {
  dayKeyToDate,
  formatWalkInLongDayLabel,
  getWalkInDayKey,
  getWalkInDayPosition,
  getWalkInDayRange,
} from '@/lib/walkInEvents'

export const runtime = 'nodejs'

const WALK_IN_TIME_ZONE = 'Africa/Nairobi'

async function loadFont(fileName: string) {
  const fontPath = path.join(process.cwd(), 'app', 'fonts', fileName)
  return readFile(fontPath)
}

function parseDayIndex(rawDay: string | null, totalDays: number) {
  if (!rawDay) return null
  const parsed = Number(rawDay)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > totalDays) return null
  return parsed
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await props.params
    const { searchParams } = new URL(req.url)
    const requestedDay = searchParams.get('day')

    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        title: true,
        accessType: true,
        eventDate: true,
        eventEndAt: true,
        imageUrl: true,
      },
    })

    if (!event || event.accessType !== 'WALK_IN') {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const dayRange = getWalkInDayRange({
      eventDate: event.eventDate,
      eventEndAt: event.eventEndAt,
      timeZone: WALK_IN_TIME_ZONE,
    })

    if (dayRange.length === 0) {
      return NextResponse.json({ error: 'Walk-in dates are not configured' }, { status: 400 })
    }

    const todayKey = getWalkInDayKey(new Date(), WALK_IN_TIME_ZONE)
    const todayIndex = dayRange.findIndex((dayKey) => dayKey === todayKey)
    const fallbackDayIndex = todayIndex >= 0 ? todayIndex + 1 : 1
    const dayIndex = parseDayIndex(requestedDay, dayRange.length) ?? fallbackDayIndex
    const dayKey = dayRange[dayIndex - 1]
    const dayPosition = getWalkInDayPosition({
      dayKey,
      eventDate: event.eventDate,
      eventEndAt: event.eventEndAt,
      timeZone: WALK_IN_TIME_ZONE,
    })

    const dayDate = dayKeyToDate(dayKey)
    const countToday = await prisma.walkInCheckin.count({
      where: {
        eventId: event.id,
        dayDate,
      },
    })

    const [geistRegular, geistBold] = await Promise.all([
      loadFont('GeistVF.woff'),
      loadFont('GeistVF.woff'),
    ])

    const response = new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            position: 'relative',
            overflow: 'hidden',
            background: 'linear-gradient(160deg, #0A0A0A 0%, #101722 50%, #0D1410 100%)',
            color: '#F0EDE6',
            fontFamily: 'Geist, system-ui, sans-serif',
          }}
        >
          {event.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.imageUrl}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage:
                  'linear-gradient(135deg, rgba(200,245,90,0.12) 0 2px, transparent 2px 32px), linear-gradient(45deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 28px), linear-gradient(160deg, #0A0A0A 0%, #111722 100%)',
                opacity: 0.95,
              }}
            />
          )}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(180deg, rgba(5,7,10,0.24) 0%, rgba(5,7,10,0.52) 38%, rgba(5,7,10,0.78) 72%, rgba(5,7,10,0.92) 100%)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              top: 72,
              left: 72,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: '0.02em',
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: 999,
                background: '#C8F55A',
                boxShadow: '0 0 0 10px rgba(200,245,90,0.08)',
              }}
            />
            <span>EventSlot</span>
          </div>

          <div
            style={{
              position: 'absolute',
              left: 72,
              right: 72,
              top: 420,
              display: 'flex',
              flexDirection: 'column',
              gap: 28,
              alignItems: 'center',
              textAlign: 'center',
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: 102,
                height: 102,
                borderRadius: 999,
                border: '2px solid rgba(200,245,90,0.55)',
                background: 'rgba(200,245,90,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#C8F55A',
                fontSize: 60,
                fontWeight: 700,
              }}
            >
              ✓
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.08 }}>
                I attended
              </div>
              <div
                style={{
                  fontSize: 70,
                  fontWeight: 700,
                  lineHeight: 1.03,
                  paddingLeft: 24,
                  paddingRight: 24,
                }}
              >
                {event.title}
              </div>
              <div style={{ fontSize: 34, fontWeight: 600, color: '#C8F55A' }}>
                {dayPosition && dayPosition.total > 1 ? `Day ${dayPosition.index} of ${dayPosition.total} · ` : ''}
                {formatWalkInLongDayLabel(dayKey, WALK_IN_TIME_ZONE)}
              </div>
              <div style={{ fontSize: 38, fontWeight: 700 }}>
                {countToday.toLocaleString()} people here today
              </div>
            </div>
          </div>

          <div
            style={{
              position: 'absolute',
              left: 72,
              right: 72,
              bottom: 68,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              zIndex: 2,
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700 }}>Powered by EventSlot</div>
            <div style={{ fontSize: 22, color: 'rgba(240,237,230,0.78)' }}>eventsslot.com</div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1920,
        fonts: [
          { name: 'Geist', data: geistRegular, style: 'normal', weight: 400 },
          { name: 'Geist', data: geistBold, style: 'normal', weight: 700 },
        ],
      },
    )

    response.headers.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=300')
    return response
  } catch (error) {
    console.error('[WALKIN SHARE CARD]', error)
    return NextResponse.json({ error: 'Unable to generate share card.' }, { status: 500 })
  }
}
