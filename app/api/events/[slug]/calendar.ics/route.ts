import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { buildEventIcs, buildEventPublicUrl, getDurationMins } from '@/lib/calendarLinks'

export async function GET(_req: Request, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params

  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      location: true,
      eventDate: true,
      eventEndAt: true,
      organizer: { select: { username: true } },
    },
  })

  if (!event || !event.eventDate) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const publicUrl = buildEventPublicUrl(event.slug, event.organizer?.username)
  const ics = buildEventIcs({
    uid: `${event.id}@eventsslot.com`,
    title: event.title,
    description: [event.description?.trim(), publicUrl].filter(Boolean).join('\n\n'),
    location: event.location,
    startDate: new Date(event.eventDate),
    endDate: event.eventEndAt ? new Date(event.eventEndAt) : null,
    durationMins: getDurationMins(event.eventDate, event.eventEndAt),
    url: publicUrl,
  })

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename=\"${event.slug}.ics\"`,
      'Cache-Control': 'no-store',
    },
  })
}
