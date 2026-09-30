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
