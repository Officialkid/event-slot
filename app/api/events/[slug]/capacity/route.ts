import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendWaitlistPromotedEmail } from '@/lib/email'
import { isCalendarConnected, updateCalendarEvent } from '@/lib/googleCalendar'
import { decrypt } from '@/lib/encrypt'
import { createNotification } from '@/lib/notifications'
import { generateConfirmationCode } from '@/lib/confirmationCode'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/isAdmin'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { APP_URL } from '@/lib/config'
import { getDurationMins } from '@/lib/calendarLinks'

type EmailAttemptResult = {
  registrationId: string
  attendeeEmail: string | null
  status: 'sent' | 'failed' | 'skipped_no_email'
  error?: string
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const { slug } = params
    const body = await req.json()
    const { newCapacity, token } = body

    const session = await getServerSession(authOptions)

    const event = await prisma.event.findUnique({ where: { slug } })
    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    // Accept: valid dashboard token OR authenticated owner/admin/team-member
    const hasValidToken = !!(token && event.dashboardToken === token)
    const userId = session?.user?.id
    const isOwner = !!(userId && event.organizerId === userId)
    const isAdmin = isAdminEmail(session?.user?.email)
    const isTeamMember = !hasValidToken && !isOwner && !isAdmin && !!(userId && await hasTeamEventAccess({
      userId,
      organizerId: event.organizerId,
      eventId: event.id,
    }))

    if (!hasValidToken && !isOwner && !isAdmin && !isTeamMember) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    if (!Number.isInteger(newCapacity) || newCapacity <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid new capacity' }, { status: 400 })
    }

    if (event.isPaid) {
      return NextResponse.json({
        success: false,
        error: 'Paid-event capacity changes are now managed per ticket tier. Use the ticket tiers editor instead.',
      }, { status: 400 })
    }

    if (event.capacity !== null && newCapacity === event.capacity) {
      return NextResponse.json({ success: false, error: 'Capacity is already set to that number.' }, { status: 400 })
    }

    if (newCapacity < event.confirmedCount) {
      return NextResponse.json({
        success: false,
        error: `Capacity cannot be lower than the ${event.confirmedCount} people already confirmed.`,
      }, { status: 400 })
    }

    const addedSlots = event.capacity === null
      ? Math.max(0, newCapacity - event.confirmedCount)
      : Math.max(0, newCapacity - event.capacity)

    if (event.capacity !== null && newCapacity < event.capacity) {
      const updatedEvent = await prisma.event.update({
        where: { id: event.id },
        data: { capacity: newCapacity },
        select: {
          capacity: true,
          confirmedCount: true,
          waitlistCount: true,
        },
      })

      return NextResponse.json({
        success: true,
        promoted: 0,
        newConfirmedCount: updatedEvent.confirmedCount,
        newWaitlistCount: updatedEvent.waitlistCount,
        remainingSlots: Math.max(0, newCapacity - updatedEvent.confirmedCount),
        emailDiagnostics: {
          attempted: 0,
          sent: 0,
          failed: 0,
          skippedNoEmail: 0,
        },
      })
    }

    if (addedSlots <= 0) {
      return NextResponse.json({ success: false, error: 'Capacity update did not create any new slots.' }, { status: 400 })
    }

    const result = await prisma.$transaction(async tx => {
      const waitlistToPromote = await tx.registration.findMany({
        where: { eventId: event.id, status: 'waitlist' },
        orderBy: { waitlistPosition: 'asc' },
        take: Math.min(addedSlots, event.waitlistCount),
        select: { id: true, attendeeEmail: true, consentTransactional: true },
      })

      const promoted = waitlistToPromote.length

      const updatedRegistrations = await Promise.all(
        waitlistToPromote.map(item =>
          tx.registration.update({
            where: { id: item.id },
            data: { status: 'confirmed', waitlistPosition: null, confirmationCode: generateConfirmationCode() },
            select: { id: true, attendeeEmail: true, consentTransactional: true, confirmationCode: true },
          })
        )
      )

      const updatedEvent = await tx.event.update({
        where: { id: event.id },
        data: {
          capacity: newCapacity,
          confirmedCount: { increment: promoted },
          waitlistCount: { increment: promoted * -1 },
        },
      })

      const remainingSlots = Math.max(0, addedSlots - promoted)

      return {
        promoted,
        newConfirmedCount: updatedEvent.confirmedCount,
        newWaitlistCount: updatedEvent.waitlistCount,
        remainingSlots,
        promotedRegistrations: updatedRegistrations,
      }
    })

    // Send confirmation emails to promoted attendees and capture diagnostics.
    const BASE_URL = APP_URL
    const emailAttempts: EmailAttemptResult[] = await Promise.all(
      result.promotedRegistrations.map(async r => {
        if (!r.attendeeEmail) {
          return {
            registrationId: r.id,
            attendeeEmail: null,
            status: 'skipped_no_email',
          }
        }

        try {
          await sendWaitlistPromotedEmail({
            to: r.attendeeEmail,
            eventTitle: event.title,
            eventDate: event.eventDate ? event.eventDate.toISOString() : null,
            eventEndAt: event.eventEndAt ? event.eventEndAt.toISOString() : null,
            eventLocation: event.location,
            communityLink: event.communityLink,
            ticketUrl: r.confirmationCode ? `${BASE_URL}/register/success/${r.confirmationCode}` : null,
            eventSlug: event.slug,
          })

          return {
            registrationId: r.id,
            attendeeEmail: r.attendeeEmail,
            status: 'sent',
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown email error'
          console.error(`Email failed for ${r.attendeeEmail}:`, err)
          return {
            registrationId: r.id,
            attendeeEmail: r.attendeeEmail,
            status: 'failed',
            error: message,
          }
        }
      })
    )

    const emailDiagnostics = {
      attempted: emailAttempts.length,
      sent: emailAttempts.filter(a => a.status === 'sent').length,
      failed: emailAttempts.filter(a => a.status === 'failed').length,
      skippedNoEmail: emailAttempts.filter(a => a.status === 'skipped_no_email').length,
    }

    // Persist a compact diagnostics log so support can inspect outcomes live.
    await prisma.errorLog.create({
      data: {
        route: `waitlist-promotion-email:${event.id}`,
        message: JSON.stringify({
          eventId: event.id,
          slug,
          promoted: result.promoted,
          summary: emailDiagnostics,
          attempts: emailAttempts,
          createdAt: new Date().toISOString(),
        }),
      },
    }).catch(() => {
      // Non-critical diagnostics write failure.
    })

    // Notify organizer about promoted attendees (non-blocking, best-effort)
    if (result.promoted > 0 && event.organizerId) {
      try {
        await createNotification({
          userId: event.organizerId,
          type: "EVENT",
          title: "Waitlist Promotion",
          message: `${result.promoted} ${result.promoted === 1 ? "person was" : "people were"} moved from the waitlist to confirmed for "${event.title}".`,
          link: `/dashboard/events/${slug}`,
        })
      } catch {
        // Non-critical
      }
    }

    // Update Google Calendar for promoted attendees with connected calendars (non-blocking)
    if (result.promoted > 0 && event.eventDate) {
      ;(async () => {
        try {
          const isVirtual = event.eventType === 'VIRTUAL'
          const meetingLink = isVirtual && event.virtualLink
            ? decrypt(event.virtualLink, event.virtualLinkIv ?? '')
            : null
          const eventUrl = `${APP_URL}/join/${event.slug}`
          await Promise.all(
            result.promotedRegistrations.map(async r => {
              if (!r.attendeeEmail) return
              const user = await prisma.user.findUnique({
                where:  { email: r.attendeeEmail.toLowerCase() },
                select: { id: true },
              })
              if (!user?.id) return
              const connected = await isCalendarConnected(user.id)
              if (!connected) return
              updateCalendarEvent({
                userId:       user.id,
                eventSlotId:  event.id,
                role:         'attendee',
                title:        event.title,
                description:  [
                  `You're confirmed for ${event.title}! 🎉`,
                  `Confirmation code: ${r.confirmationCode ?? ''}`,
                  '',
                  `View your ticket: ${eventUrl}`,
                ].join('\n'),
                location:     event.location,
                startDate:    new Date(event.eventDate!),
                durationMins: getDurationMins(event.eventDate, event.eventEndAt),
                eventUrl,
                isVirtual,
                meetingLink,
              }).catch(err => console.error('[calendar] Promotion calendar update failed:', err))
            })
          )
        } catch (err) {
          console.error('[calendar] Promotion calendar block failed:', err)
        }
      })()
    }

    return NextResponse.json({
      success: true,
      promoted: result.promoted,
      newConfirmedCount: result.newConfirmedCount,
      newWaitlistCount: result.newWaitlistCount,
      remainingSlots: result.remainingSlots,
      emailDiagnostics,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
