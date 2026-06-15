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
import { buildEventPublicUrl, buildGoogleCalendarTemplateUrl, getDurationMins } from '@/lib/calendarLinks';

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
      const eventUrl = buildEventPublicUrl(event.slug, organizerUsername);

      const result = await createCalendarEvent({
        userId:       session.user.id,
        eventSlotId:  event.id,
        role:         'attendee',
        title:        event.title,
        description:  event.description ?? '',
        location:     event.location,
        startDate:    new Date(event.eventDate),
        durationMins: getDurationMins(event.eventDate, event.eventEndAt),
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
    ? buildGoogleCalendarTemplateUrl({
        title:        event.title,
        description:  event.description ?? '',
        location:     event.location ?? (event.eventType === 'VIRTUAL' ? 'Online' : ''),
        startDate:    new Date(event.eventDate),
        endDate:      event.eventEndAt ? new Date(event.eventEndAt) : null,
      })
    : null;

  return NextResponse.json({ autoPushed: false, calendarUrl });
}
