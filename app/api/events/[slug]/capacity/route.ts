import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendSlotConfirmedEmail } from '@/lib/email'
import { createNotification } from '@/lib/notifications'
import { generateConfirmationCode } from '@/lib/confirmationCode'

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { slug } = params
    const body = await req.json()
    const { newCapacity, token } = body

    const event = await prisma.event.findUnique({ where: { slug } })
    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    if (event.dashboardToken !== token) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    if (!Number.isInteger(newCapacity) || newCapacity <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid new capacity' }, { status: 400 })
    }

    if (event.capacity !== null && newCapacity <= event.capacity) {
      return NextResponse.json({ success: false, error: 'New capacity must be greater than current capacity' }, { status: 400 })
    }

    const addedSlots = event.capacity === null
      ? newCapacity - event.confirmedCount
      : newCapacity - event.capacity

    if (addedSlots <= 0) {
      return NextResponse.json({ success: false, error: 'New capacity must be greater than current capacity' }, { status: 400 })
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

    // Send confirmation emails to promoted attendees (non-blocking)
    const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://eventsslot.com'
    await Promise.allSettled(
      result.promotedRegistrations
        .filter(r => r.attendeeEmail)
        .map(r =>
          sendSlotConfirmedEmail({
            to: r.attendeeEmail!,
            eventTitle: event.title,
            communityLink: event.communityLink,
            consentTransactional: r.consentTransactional,
            ticketUrl: r.confirmationCode ? `${BASE_URL}/register/success/${r.confirmationCode}` : null,
          }).catch(err => console.error(`Email failed for ${r.attendeeEmail}:`, err))
        )
    )

    // Notify organizer about promoted attendees (non-blocking, best-effort)
    if (result.promoted > 0 && event.organizerId) {
      try {
        await createNotification({
          userId: event.organizerId,
          type: "info",
          message: `${result.promoted} ${result.promoted === 1 ? "person was" : "people were"} moved from the waitlist to confirmed for "${event.title}".`,
          eventId: event.id,
        })
      } catch {
        // Non-critical
      }
    }

    return NextResponse.json({
      success: true,
      promoted: result.promoted,
      newConfirmedCount: result.newConfirmedCount,
      newWaitlistCount: result.newWaitlistCount,
      remainingSlots: result.remainingSlots,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
