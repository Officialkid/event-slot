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
      where: { claimToken: token },
      include: {
        event: {
          select: {
            title: true,
            slug: true,
            eventDate: true,
            location: true,
            imageUrl: true,
            organizerName: true,
          },
        },
        slots: {
          where: { status: "UNASSIGNED" },
          select: { id: true },
        },
      },
    })

    if (!booking || booking.status === "CANCELLED") {
      return NextResponse.json({ error: "Self-claim allocation not found or closed" }, { status: 404 })
    }

    const availableSlots = booking.slots.length

    return NextResponse.json({
      success: true,
      allocation: {
        orgName: booking.orgName,
        eventTitle: booking.event.title,
        eventSlug: booking.event.slug,
        eventDate: booking.event.eventDate,
        location: booking.event.location,
        imageUrl: booking.event.imageUrl,
        organizerName: booking.event.organizerName,
        totalSlots: booking.totalSlots,
        availableSlots,
        isFull: availableSlots === 0,
      },
    })
  } catch (error) {
    console.error("[CLAIM GET]", error)
    return NextResponse.json({ error: "Failed to fetch claim link" }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params
    const body = await req.json()

    const { attendeeName, attendeeEmail, attendeePhone } = body

    if (!attendeeName || typeof attendeeName !== "string" || !attendeeName.trim()) {
      return NextResponse.json({ error: "Your name is required to claim a ticket slot" }, { status: 400 })
    }

    const booking = await prisma.groupBooking.findUnique({
      where: { claimToken: token },
      include: {
        event: {
          select: { title: true, slug: true },
        },
      },
    })

    if (!booking || booking.status === "CANCELLED") {
      return NextResponse.json({ error: "Self-claim allocation not found or closed" }, { status: 404 })
    }

    // Find next unassigned slot
    const unassignedSlot = await prisma.groupTicketSlot.findFirst({
      where: { bookingId: booking.id, status: "UNASSIGNED" },
      orderBy: { slotIndex: "asc" },
    })

    if (!unassignedSlot) {
      return NextResponse.json(
        { error: `This allocation for ${booking.orgName} is fully claimed.` },
        { status: 400 }
      )
    }

    const newQrToken = uuidv4()
    const claimedSlot = await prisma.groupTicketSlot.update({
      where: { id: unassignedSlot.id },
      data: {
        attendeeName: attendeeName.trim(),
        attendeeEmail: attendeeEmail?.trim()?.toLowerCase() || null,
        attendeePhone: attendeePhone?.trim() || null,
        status: "ASSIGNED",
        qrToken: newQrToken,
        assignedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      claimedSlot: {
        id: claimedSlot.id,
        slotIndex: claimedSlot.slotIndex,
        attendeeName: claimedSlot.attendeeName,
        qrToken: claimedSlot.qrToken,
      },
    })
  } catch (error) {
    console.error("[CLAIM POST]", error)
    return NextResponse.json({ error: "Failed to claim ticket slot" }, { status: 500 })
  }
}
