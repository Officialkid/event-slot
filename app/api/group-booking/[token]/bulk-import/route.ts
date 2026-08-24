import { NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import prisma from "@/lib/prisma"

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

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < toImport.length; i++) {
        const delegate = toImport[i]
        const slot = availableSlots[i]
        if (!delegate.name || !delegate.name.trim()) continue

        await tx.groupTicketSlot.update({
          where: { id: slot.id },
          data: {
            attendeeName: delegate.name.trim(),
            attendeeEmail: delegate.email?.trim()?.toLowerCase() || null,
            attendeePhone: delegate.phone?.trim() || null,
            status: "ASSIGNED",
            qrToken: uuidv4(),
            assignedAt: new Date(),
          },
        })
      }
    })

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
