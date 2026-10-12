import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { generateConfirmationCode } from "@/lib/confirmationCode"
import { generateTicketForRegistration } from "@/lib/tickets"
import { computeNextOccurrenceDate } from "@/lib/recurringEvents"
import { sendDelegateTicketEmail } from "@/lib/email"

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params
    const body = await req.json()
    const { delegates } = body

    if (!Array.isArray(delegates) || delegates.length === 0) {
      return NextResponse.json({ error: "Delegates array is required" }, { status: 400 })
    }

    const booking = await prisma.groupBooking.findUnique({
      where: { bookingToken: token },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            slug: true,
            eventDate: true,
            location: true,
            isRecurring: true,
            recurrenceFrequency: true,
            recurrenceDayOfWeek: true,
          },
        },
        slots: {
          where: { status: "UNASSIGNED" },
          orderBy: { slotIndex: "asc" },
        },
      },
    })

    if (!booking || booking.status === "CANCELLED") {
      return NextResponse.json({ error: "Booking allocation not found" }, { status: 404 })
    }

    const availableSlots = booking.slots
    if (availableSlots.length === 0) {
      return NextResponse.json({ error: "No unassigned slots available in this allocation." }, { status: 400 })
    }

    const toImport = delegates.slice(0, availableSlots.length)

    // Occurrence date for registrations
    const occurrenceDate = booking.event.isRecurring
      ? computeNextOccurrenceDate(booking.event)
      : (booking.event.eventDate ?? new Date())

    const eventDateFormatted = booking.event.eventDate
      ? new Date(booking.event.eventDate).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null

    const emailsToDispatch: Array<{
      email: string
      name: string
      confirmationCode: string
    }> = []

    for (let i = 0; i < toImport.length; i++) {
      const delegate = toImport[i]
      const slot = availableSlots[i]
      if (!delegate.name || !delegate.name.trim()) continue

      const cleanName = delegate.name.trim()
      const cleanEmail = delegate.email?.trim()?.toLowerCase() || null
      const cleanPhone = delegate.phone?.trim() || null
      const confirmationCode = generateConfirmationCode()

      // Create Registration
      const reg = await prisma.registration.create({
        data: {
          eventId: booking.eventId,
          answers: [
            { questionId: "name", value: cleanName },
            ...(cleanEmail ? [{ questionId: "email", value: cleanEmail }] : []),
            ...(cleanPhone ? [{ questionId: "phone", value: cleanPhone }] : []),
          ],
          status: "confirmed",
          registrationNumber: slot.slotIndex,
          confirmationCode,
          submittedAt: new Date(),
          notified: false,
          attendeeEmail: cleanEmail,
          occurrenceDate,
          source: "group_delegation",
        },
      })

      // Generate Ticket
      const ticketRecord = await generateTicketForRegistration(reg.id)

      // Update Slot
      await prisma.groupTicketSlot.update({
        where: { id: slot.id },
        data: {
          attendeeName: cleanName,
          attendeeEmail: cleanEmail,
          attendeePhone: cleanPhone,
          ticketId: ticketRecord.id,
          qrToken: ticketRecord.code,
          status: "ASSIGNED",
          assignedAt: new Date(),
        },
      })

      if (cleanEmail) {
        emailsToDispatch.push({
          email: cleanEmail,
          name: cleanName,
          confirmationCode,
        })
      }
    }

    // Dispatch emails asynchronously
    for (const item of emailsToDispatch) {
      sendDelegateTicketEmail({
        to: item.email,
        name: item.name,
        orgName: booking.orgName,
        eventTitle: booking.event.title,
        confirmationNumber: item.confirmationCode,
        eventDate: eventDateFormatted,
        eventLocation: booking.event.location,
      }).catch((err) => console.error("[BULK IMPORT EMAIL FAILED]", item.email, err))
    }

    return NextResponse.json({
      success: true,
      importedCount: toImport.length,
      unimportedCount: Math.max(0, delegates.length - availableSlots.length),
    })
  } catch (error) {
    console.error("[GROUP BULK IMPORT]", error)
    return NextResponse.json({ error: "Failed to process bulk CSV import" }, { status: 500 })
  }
}
