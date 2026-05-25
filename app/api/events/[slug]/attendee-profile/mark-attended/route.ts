import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasTeamEventAccess } from "@/lib/eventAccess"

export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params

  try {
    const body = (await req.json()) as { ticketCode?: string; note?: string; token?: string }
    const ticketCode = body.ticketCode?.trim().toUpperCase() ?? ""
    const token = body.token?.trim() ?? ""
    const note = body.note?.trim() ?? ""

    if (!ticketCode) {
      return NextResponse.json({ error: "ticketCode is required" }, { status: 400 })
    }

    const event = await prisma.event.findFirst({
      where: { OR: [{ slug }, { id: slug }] },
      select: { id: true, organizerId: true, dashboardToken: true },
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && token === event.dashboardToken)
    const hasTeamAccess = !!(session?.user?.id && (await hasTeamEventAccess({
      userId: session.user.id,
      organizerId: event.organizerId,
      eventId: event.id,
    })))

    if (!isOwner && !hasValidToken && !hasTeamAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const ticket = await prisma.ticket.findFirst({
      where: {
        code: ticketCode,
        registration: { eventId: event.id },
      },
      include: {
        registration: {
          select: { id: true, confirmationCode: true },
        },
      },
    })

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 })
    }

    const now = new Date()

    await prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id: ticket.id },
        data: { scannedAt: now },
      })

      await tx.registration.update({
        where: { id: ticket.registration.id },
        data: {
          checkedIn: true,
          checkedInAt: now,
        },
      })

      await tx.entryLog.create({
        data: {
          eventId: event.id,
          ticketId: ticket.code,
          attendeeName: "Attendee",
          success: true,
          failReason: note ? `NOTE: ${note}` : null,
        },
      })
    })

    return NextResponse.json({ ok: true, checkedInAt: now })
  } catch (error) {
    console.error("[events/attendee-profile/mark-attended] POST error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
