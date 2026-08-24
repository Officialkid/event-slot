import { NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import prisma from "@/lib/prisma"

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
      select: { id: true, status: true },
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

    // Assign or replace attendee with a newly issued QR token (revokes old token)
    const newQrToken = uuidv4()
    const updatedSlot = await prisma.groupTicketSlot.update({
      where: { id: slot.id },
      data: {
        attendeeName: attendeeName.trim(),
        attendeeEmail: attendeeEmail?.trim()?.toLowerCase() || null,
        attendeePhone: attendeePhone?.trim() || null,
        qrToken: newQrToken,
        status: "ASSIGNED",
        assignedAt: new Date(),
      },
    })

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

    const updatedSlot = await prisma.groupTicketSlot.update({
      where: { id: slotId },
      data: {
        attendeeName: null,
        attendeeEmail: null,
        attendeePhone: null,
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
