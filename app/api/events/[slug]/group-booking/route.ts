import { NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import prisma from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await props.params
    const body = await req.json()

    const { orgName, orgType, contactName, contactEmail, contactPhone, totalSlots } = body

    if (!orgName || typeof orgName !== "string" || !orgName.trim()) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 })
    }
    if (!contactName || !contactEmail || !contactPhone) {
      return NextResponse.json({ error: "Contact name, email, and phone are required" }, { status: 400 })
    }

    const slotsCount = Number(totalSlots)
    if (!Number.isInteger(slotsCount) || slotsCount < 1 || slotsCount > 500) {
      return NextResponse.json({ error: "Reserved slots must be between 1 and 500" }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        capacity: true,
        confirmedCount: true,
        groupRegistrationEnabled: true,
        allowGroupSelfClaim: true,
        isPaid: true,
        ticketPrice: true,
        currency: true,
        status: true,
      },
    })

    if (!event || event.status === "archived") {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    if (!event.groupRegistrationEnabled) {
      return NextResponse.json(
        { error: "Group & Organization registration is not enabled for this event" },
        { status: 400 }
      )
    }

    // Check capacity
    if (event.capacity && event.confirmedCount + slotsCount > event.capacity) {
      const remaining = Math.max(0, event.capacity - event.confirmedCount)
      return NextResponse.json(
        { error: `Not enough remaining spots. Only ${remaining} slot(s) available.` },
        { status: 400 }
      )
    }

    const bookingToken = uuidv4()
    const claimToken = uuidv4()
    const validOrgType = [
      "CHURCH",
      "COMPANY",
      "SCHOOL",
      "UNIVERSITY",
      "NGO",
      "SPONSOR",
      "FAMILY_TEAM",
      "OTHER",
    ].includes(orgType)
      ? orgType
      : "OTHER"

    const totalAmountKes = event.isPaid && event.ticketPrice ? slotsCount * event.ticketPrice : 0
    const paymentStatus = event.isPaid ? "RESERVED_PREVIEW" : "FREE"

    const result = await prisma.$transaction(async (tx) => {
      // Create GroupBooking
      const booking = await tx.groupBooking.create({
        data: {
          eventId: event.id,
          orgName: orgName.trim(),
          orgType: validOrgType,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim().toLowerCase(),
          contactPhone: contactPhone.trim(),
          totalSlots: slotsCount,
          bookingToken,
          claimToken,
          status: "ACTIVE",
          slots: {
            create: Array.from({ length: slotsCount }, (_, i) => ({
              slotIndex: i + 1,
              status: "UNASSIGNED",
              qrToken: uuidv4(),
            })),
          },
        },
        include: {
          slots: true,
        },
      })

      // Reserve capacity
      await tx.event.update({
        where: { id: event.id },
        data: {
          confirmedCount: { increment: slotsCount },
        },
      })

      return booking
    })

    const origin = req.headers.get("origin") || "https://www.eventsslot.com"
    const managerUrl = `${origin}/booking/${result.bookingToken}`
    const claimUrl = `${origin}/claim/${result.claimToken}`

    return NextResponse.json({
      success: true,
      booking: {
        id: result.id,
        orgName: result.orgName,
        totalSlots: result.totalSlots,
        totalAmountKes,
        currency: event.currency || "KSh",
        isPaid: event.isPaid,
        paymentStatus,
        bookingToken: result.bookingToken,
        claimToken: result.claimToken,
        managerUrl,
        claimUrl,
      },
    })
  } catch (error) {
    console.error("[GROUP BOOKING CREATE]", error)
    return NextResponse.json({ error: "Failed to create group booking" }, { status: 500 })
  }
}
