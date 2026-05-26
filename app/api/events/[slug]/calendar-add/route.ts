// POST /api/events/[slug]/calendar-add
// Called when an attendee clicks "Add to Google Calendar".
// If the user is logged in and has Google Calendar connected — auto-pushes silently.
// Otherwise returns the standard Google Calendar URL for manual add.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession }          from 'next-auth';
import { authOptions }               from '@/lib/auth';
import { createCalendarEvent,
         isCalendarConnected }       from '@/lib/googleCalendar';
import { decrypt }                   from '@/lib/encrypt';
import prisma                        from '@/lib/prisma';
import { APP_URL }                   from '@/lib/config';

function buildGoogleCalendarUrl(params: {
  title:       string;
  description: string;
  location:    string;
  startDate:   Date;
  durationMins: number;
}): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
    `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`

  const end = new Date(params.startDate.getTime() + params.durationMins * 60_000)

  const qs = new URLSearchParams({
    action:   'TEMPLATE',
    text:     params.title,
    dates:    `${fmt(params.startDate)}/${fmt(end)}`,
    details:  params.description,
    location: params.location,
  })
  return `https://calendar.google.com/calendar/render?${qs.toString()}`
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  const { slug } = await props.params;
  const session  = await getServerSession(authOptions);

  const event = await prisma.event.findUnique({
    where:   { slug },
    include: { organizer: { select: { username: true } } },
  });
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // If user is logged in and has Google Calendar connected — auto-push silently
  if (session?.user?.id && event.eventDate) {
    const calendarConnected = await isCalendarConnected(session.user.id);
    if (calendarConnected) {
      const isVirtual  = event.eventType === 'VIRTUAL';
      const meetingLink = isVirtual && event.virtualLink
        ? decrypt(event.virtualLink, event.virtualLinkIv ?? '')
        : null;
      const organizerUsername = event.organizer?.username;
      const eventUrl = organizerUsername
        ? `${APP_URL}/${organizerUsername}/${event.slug}`
        : `${APP_URL}/join/${event.slug}`;

      const result = await createCalendarEvent({
        userId:       session.user.id,
        eventSlotId:  event.id,
        role:         'attendee',
        title:        event.title,
        description:  event.description ?? '',
        location:     event.location,
        startDate:    new Date(event.eventDate),
        durationMins: 120,
        eventUrl,
        isVirtual,
        meetingLink,
      });

      if (result.success) {
        return NextResponse.json({ autoPushed: true });
      }
    }
  }

  // Fall back to returning the Google Calendar URL for manual add
  const calendarUrl = event.eventDate
    ? buildGoogleCalendarUrl({
        title:        event.title,
        description:  event.description ?? '',
        location:     event.location ?? (event.eventType === 'VIRTUAL' ? 'Online' : ''),
        startDate:    new Date(event.eventDate),
        durationMins: 120,
      })
    : null;

  return NextResponse.json({ autoPushed: false, calendarUrl });
}
