import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { decrypt } from '@/lib/encrypt'
import { hasOrganiserAccess } from '@/lib/adminMode'

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        calendarSyncs: {
          where: { role: 'organiser' },
          select: { googleEventId: true, syncStatus: true, lastSyncedAt: true },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    const isOwner = event.organizerId === session.user.id
    const hasAdminAccess = await hasOrganiserAccess(session, event.id)
    if (!isOwner && !hasAdminAccess) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // 1. Link configured check
    const linkConfigured = Boolean(event.virtualLink && event.virtualLinkIv)

    // 2. Encryption validity check (in-memory decrypt test)
    let encryptionValid = false
    let providerDetected = 'Unknown'
    if (linkConfigured && event.virtualLink && event.virtualLinkIv) {
      try {
        const decrypted = decrypt(event.virtualLink, event.virtualLinkIv)
        if (decrypted && decrypted.startsWith('http')) {
          encryptionValid = true
          if (decrypted.includes('meet.google.com')) providerDetected = 'Google Meet'
          else if (decrypted.includes('zoom.us')) providerDetected = 'Zoom'
          else if (decrypted.includes('teams.microsoft')) providerDetected = 'Microsoft Teams'
          else if (decrypted.includes('youtube.com') || decrypted.includes('youtu.be')) providerDetected = 'YouTube Live'
          else providerDetected = 'Custom Web Provider'
        }
      } catch {
        encryptionValid = false
      }
    }

    // 3. Organizer Google Calendar token
    const organizerCalendarToken = event.organizerId
      ? await prisma.googleCalendarToken.findUnique({
          where: { userId: event.organizerId },
          select: { connected: true, expiresAt: true },
        })
      : null
    const calendarConnected = Boolean(organizerCalendarToken?.connected)

    // 4. Google Meet calendar event sync record
    const syncRecord = event.calendarSyncs[0] ?? null
    const googleMeetLinked = Boolean(syncRecord?.googleEventId)

    // 5. Access window timing
    const now = new Date()
    const eventStart = event.eventDate
    const openWindow = event.joinOpensAt ?? (eventStart ? new Date(eventStart.getTime() - 30 * 60 * 1000) : null)
    const isAccessOpen = openWindow ? now >= openWindow : false
    const minutesUntilOpen = openWindow ? Math.ceil((openWindow.getTime() - now.getTime()) / 60000) : null

    // 6. Confirmed attendees count
    const confirmedCount = await prisma.registration.count({
      where: { eventId: event.id, status: 'confirmed' },
    })

    return NextResponse.json({
      success: true,
      diagnostics: {
        eventType: event.eventType,
        platform: providerDetected,
        linkConfigured,
        encryptionValid,
        calendarConnected,
        googleMeetLinked,
        googleEventId: syncRecord?.googleEventId ? `${syncRecord.googleEventId.substring(0, 8)}...` : null,
        accessWindow: {
          eventDate: eventStart?.toISOString() ?? null,
          joinOpensAt: openWindow?.toISOString() ?? null,
          serverTime: now.toISOString(),
          isOpen: isAccessOpen,
          minutesUntilOpen,
        },
        confirmedAttendees: confirmedCount,
        allChecksPassed: Boolean(
          event.eventType === 'VIRTUAL' &&
          linkConfigured &&
          encryptionValid &&
          openWindow
        ),
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
