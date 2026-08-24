import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params

    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const bookings = await prisma.groupBooking.findMany({
      where: { eventId: event.id },
      include: {
        slots: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    const origin = req.headers.get("origin") || "https://www.eventsslot.com"

    const data = bookings.map((b) => {
      const assignedCount = b.slots.filter((s) => s.status === "ASSIGNED" || s.status === "CHECKED_IN").length
      const checkedInCount = b.slots.filter((s) => s.status === "CHECKED_IN").length
      return {
        id: b.id,
        orgName: b.orgName,
        orgType: b.orgType,
        contactName: b.contactName,
        contactEmail: b.contactEmail,
        contactPhone: b.contactPhone,
        totalSlots: b.totalSlots,
        assignedCount,
        unassignedCount: b.totalSlots - assignedCount,
        checkedInCount,
        status: b.status,
        bookingToken: b.bookingToken,
        claimToken: b.claimToken,
        managerUrl: `${origin}/booking/${b.bookingToken}`,
        claimUrl: `${origin}/claim/${b.claimToken}`,
        createdAt: b.createdAt,
      }
    })

    return NextResponse.json({ success: true, groupBookings: data })
  } catch (error) {
    console.error("[EVENT GROUP BOOKINGS LIST]", error)
    return NextResponse.json({ error: "Failed to fetch group bookings" }, { status: 500 })
  }
}
