import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasOrganiserAccess } from "@/lib/adminMode"
import { hasTeamEventAccess } from "@/lib/eventAccess"

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params
    const token = req.nextUrl.searchParams.get("token")
    const session = await getServerSession(authOptions)

    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true, organizerId: true, dashboardToken: true },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)
    const adminAccess = !!(session && (await hasOrganiserAccess(session, event.id)))
    const hasTeamAccess = !!(
      session?.user?.id &&
      (await hasTeamEventAccess({
        userId: session.user.id,
        organizerId: event.organizerId,
        eventId: event.id,
      }))
    )

    if (!isOwner && !adminAccess && !hasValidToken && !hasTeamAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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

    const totalGroupSlots = data.reduce((sum, b) => sum + b.totalSlots, 0)

    return NextResponse.json({ success: true, groupBookings: data, totalGroupSlots })
  } catch (error) {
    console.error("[EVENT GROUP BOOKINGS LIST]", error)
    return NextResponse.json({ error: "Failed to fetch group bookings" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params
    const token = req.nextUrl.searchParams.get("token")
    const bookingId = req.nextUrl.searchParams.get("bookingId")
    const session = await getServerSession(authOptions)

    if (!bookingId) {
      return NextResponse.json({ error: "bookingId is required" }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true, organizerId: true, dashboardToken: true, confirmedCount: true },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)
    const adminAccess = !!(session && (await hasOrganiserAccess(session, event.id)))
    const hasTeamAccess = !!(
      session?.user?.id &&
      (await hasTeamEventAccess({
        userId: session.user.id,
        organizerId: event.organizerId,
        eventId: event.id,
      }))
    )

    if (!isOwner && !adminAccess && !hasValidToken && !hasTeamAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const booking = await prisma.groupBooking.findFirst({
      where: { id: bookingId, eventId: event.id },
      include: {
        slots: {
          select: { id: true, ticketId: true },
        },
      },
    })

    if (!booking) {
      return NextResponse.json({ error: "Group booking not found" }, { status: 404 })
    }

    const ticketIds = booking.slots
      .map((s) => s.ticketId)
      .filter((id): id is string => typeof id === "string" && id.length > 0)

    await prisma.$transaction(async (tx) => {
      if (ticketIds.length > 0) {
        const tickets = await tx.ticket.findMany({
          where: { id: { in: ticketIds } },
          select: { registrationId: true },
        })
        const regIds = tickets.map((t) => t.registrationId).filter(Boolean)
        await tx.ticket.deleteMany({
          where: { id: { in: ticketIds } },
        })
        if (regIds.length > 0) {
          await tx.registration.deleteMany({
            where: { id: { in: regIds } },
          })
        }
      }

      await tx.groupTicketSlot.deleteMany({
        where: { bookingId: booking.id },
      })

      await tx.groupBooking.delete({
        where: { id: booking.id },
      })

      const nextConfirmedCount = Math.max(0, event.confirmedCount - booking.totalSlots)
      await tx.event.update({
        where: { id: event.id },
        data: { confirmedCount: nextConfirmedCount },
      })
    })

    return NextResponse.json({
      success: true,
      deletedBookingId: booking.id,
      slotsFreed: booking.totalSlots,
    })
  } catch (error) {
    console.error("[EVENT GROUP BOOKING DELETE]", error)
    return NextResponse.json({ error: "Failed to delete group booking" }, { status: 500 })
  }
}
