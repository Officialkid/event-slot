import { NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import prisma from "@/lib/prisma"
import { generateConfirmationCode } from "@/lib/confirmationCode"
import { generateTicketForRegistration } from "@/lib/tickets"
import { computeNextOccurrenceDate } from "@/lib/recurringEvents"
import { sendDelegateTicketEmail } from "@/lib/email"

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params

    const booking = await prisma.groupBooking.findUnique({
      where: { bookingToken: token },
      include: {
        event: {
          select: {
            id: true,
            slug: true,
            title: true,
            eventDate: true,
            location: true,
            allowGroupSelfClaim: true,
            organizerName: true,
          },
        },
        slots: {
          orderBy: { slotIndex: "asc" },
        },
      },
    })

    if (!booking || booking.status === "CANCELLED") {
      return NextResponse.json({ error: "Booking allocation not found" }, { status: 404 })
    }

    const assignedCount = booking.slots.filter((s) => s.status === "ASSIGNED" || s.status === "CHECKED_IN").length
    const checkedInCount = booking.slots.filter((s) => s.status === "CHECKED_IN").length
    const unassignedCount = booking.totalSlots - assignedCount

    const origin = req.headers.get("origin") || "https://www.eventsslot.com"
    const claimUrl = `${origin}/claim/${booking.claimToken}`

    return NextResponse.json({
      success: true,
      booking: {
        id: booking.id,
        orgName: booking.orgName,
        orgType: booking.orgType,
        contactName: booking.contactName,
        contactEmail: booking.contactEmail,
        contactPhone: booking.contactPhone,
        totalSlots: booking.totalSlots,
        assignedCount,
        unassignedCount,
        checkedInCount,
        claimToken: booking.claimToken,
        claimUrl,
        event: booking.event,
        slots: booking.slots.map((s) => ({
          id: s.id,
          slotIndex: s.slotIndex,
          attendeeName: s.attendeeName,
          attendeeEmail: s.attendeeEmail,
          attendeePhone: s.attendeePhone,
          status: s.status,
          qrToken: s.qrToken,
          ticketId: s.ticketId,
          assignedAt: s.assignedAt,
          checkedInAt: s.checkedInAt,
        })),
      },
    })
  } catch (error) {
    console.error("[GROUP BOOKING GET]", error)
    return NextResponse.json({ error: "Failed to fetch allocation" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params
    const body = await req.json()

    const { slotId, attendeeName, attendeeEmail, attendeePhone } = body

    if (!slotId || !attendeeName || !attendeeName.trim()) {
      return NextResponse.json({ error: "Slot ID and attendee name are required" }, { status: 400 })
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
      },
    })

    if (!booking || booking.status === "CANCELLED") {
      return NextResponse.json({ error: "Booking allocation not found" }, { status: 404 })
    }

    const slot = await prisma.groupTicketSlot.findFirst({
      where: { id: slotId, bookingId: booking.id },
    })

    if (!slot) {
      return NextResponse.json({ error: "Slot not found in this allocation" }, { status: 404 })
    }

    // If replacing an existing attendee on this slot, cancel the old registration & revoke ticket
    if (slot.ticketId) {
      try {
        const oldTicket = await prisma.ticket.findUnique({
          where: { id: slot.ticketId },
          select: { registrationId: true },
        })
        if (oldTicket?.registrationId) {
          await prisma.registration.update({
            where: { id: oldTicket.registrationId },
            data: { status: "cancelled" },
          })
        }
      } catch (revokeErr) {
        console.warn("[SLOT REASSIGN REVOKE OLD TICKET FAILED]", revokeErr)
      }
    }

    // Determine event occurrence date
    const occurrenceDate = booking.event.isRecurring
      ? computeNextOccurrenceDate(booking.event)
      : (booking.event.eventDate ?? new Date())

    const confirmationCode = generateConfirmationCode()
    const cleanName = attendeeName.trim()
    const cleanEmail = attendeeEmail?.trim()?.toLowerCase() || null
    const cleanPhone = attendeePhone?.trim() || null

    // Create confirmed Registration for delegate
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

    // Generate formal Ticket record
    const ticketRecord = await generateTicketForRegistration(reg.id)

    // Update slot with attendee details, new QR code, and ticketId link
    const updatedSlot = await prisma.groupTicketSlot.update({
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

    // If email is provided, dispatch the delegate's official ticket pass email
    if (cleanEmail) {
      const eventDateFormatted = booking.event.eventDate
        ? new Date(booking.event.eventDate).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : null

      sendDelegateTicketEmail({
        to: cleanEmail,
        name: cleanName,
        orgName: booking.orgName,
        eventTitle: booking.event.title,
        confirmationNumber: confirmationCode,
        eventDate: eventDateFormatted,
        eventLocation: booking.event.location,
      }).catch((emailErr) => console.error("[DELEGATE TICKET EMAIL FAILED]", emailErr))
    }

    return NextResponse.json({
      success: true,
      slot: {
        id: updatedSlot.id,
        slotIndex: updatedSlot.slotIndex,
        attendeeName: updatedSlot.attendeeName,
        attendeeEmail: updatedSlot.attendeeEmail,
        attendeePhone: updatedSlot.attendeePhone,
        status: updatedSlot.status,
        qrToken: updatedSlot.qrToken,
        ticketId: updatedSlot.ticketId,
        confirmationCode,
      },
    })
  } catch (error) {
    console.error("[GROUP BOOKING ASSIGN]", error)
    return NextResponse.json({ error: "Failed to assign attendee" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params
    const { searchParams } = new URL(req.url)
    const slotId = searchParams.get("slotId")

    if (!slotId) {
      return NextResponse.json({ error: "Slot ID is required" }, { status: 400 })
    }

    const booking = await prisma.groupBooking.findUnique({
      where: { bookingToken: token },
      select: { id: true },
    })

    if (!booking) {
      return NextResponse.json({ error: "Booking allocation not found" }, { status: 404 })
    }

    const slot = await prisma.groupTicketSlot.findFirst({
      where: { id: slotId, bookingId: booking.id },
    })

    if (!slot) {
      return NextResponse.json({ error: "Slot not found" }, { status: 404 })
    }

    // Cancel old registration & revoke ticket
    if (slot.ticketId) {
      try {
        const oldTicket = await prisma.ticket.findUnique({
          where: { id: slot.ticketId },
          select: { registrationId: true },
        })
        if (oldTicket?.registrationId) {
          await prisma.registration.update({
            where: { id: oldTicket.registrationId },
            data: { status: "cancelled" },
          })
        }
      } catch (cancelErr) {
        console.warn("[SLOT UNASSIGN CANCEL REGISTRATION FAILED]", cancelErr)
      }
    }

    const updatedSlot = await prisma.groupTicketSlot.update({
      where: { id: slot.id },
      data: {
        attendeeName: null,
        attendeeEmail: null,
        attendeePhone: null,
        ticketId: null,
        status: "UNASSIGNED",
        qrToken: uuidv4(), // Revoke old QR token
        assignedAt: null,
      },
    })

    return NextResponse.json({ success: true, slotId: updatedSlot.id })
  } catch (error) {
    console.error("[GROUP BOOKING UNASSIGN]", error)
    return NextResponse.json({ error: "Failed to unassign slot" }, { status: 500 })
  }
}
