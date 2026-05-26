import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminEmail } from "@/lib/isAdmin"
import { hasTeamEventAccess } from "@/lib/eventAccess"
import { cancelCalendarEvent } from "@/lib/googleCalendar"

export async function PATCH(_req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { slug } = params
    const event = await prisma.event.findUnique({ where: { slug } })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const isOwner = event.organizerId === session.user.id
    const isAdmin = isAdminEmail(session.user.email)
    const isTeamMember = !isOwner && !isAdmin && !!(await hasTeamEventAccess({
      userId: session.user.id,
      organizerId: event.organizerId,
      eventId: event.id,
    }))

    if (!isOwner && !isAdmin && !isTeamMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await prisma.event.update({
      where: { slug },
      data: { archived: true, status: "archived" },
    })

    // Cancel Google Calendar entries for organiser and all synced attendees
    if (event.organizerId) {
      cancelCalendarEvent({
        userId:      event.organizerId,
        eventSlotId: event.id,
        role:        'organiser',
        eventTitle:  event.title,
      }).catch(console.error)

      const attendeesSynced = await prisma.calendarEventSync.findMany({
        where:  { eventId: event.id, role: 'attendee' },
        select: { userId: true },
      })
      for (const { userId } of attendeesSynced) {
        cancelCalendarEvent({
          userId,
          eventSlotId: event.id,
          role:        'attendee',
          eventTitle:  event.title,
        }).catch(console.error)
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to archive event" }, { status: 500 })
  }
}
