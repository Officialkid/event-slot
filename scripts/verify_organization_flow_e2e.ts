import { prisma } from "../lib/prisma"
import { generateTicketForRegistration } from "../lib/tickets"
import { generateConfirmationCode } from "../lib/confirmationCode"
import crypto from "crypto"

async function run() {
  console.log("=== STARTING END-TO-END GROUP BOOKING FLOW TEST ===")

  // 1. Find an event
  const event = await prisma.event.findFirst({
    where: { groupRegistrationEnabled: true },
    select: { id: true, slug: true, title: true, capacity: true },
  })

  if (!event) {
    console.error("No event with groupRegistrationEnabled found!")
    process.exit(1)
  }

  console.log(`Using event: "${event.title}" (${event.slug})`)

  const testOrgName = `J-Quad Test Corp ${Date.now()}`
  const testContactEmail = `test-jquad-${Date.now()}@example.com`
  const testSlots = 10

  // 2. Simulate Group Reservation (10 slots for J-Quad)
  const bookingToken = crypto.randomBytes(24).toString("hex")
  const claimToken = crypto.randomBytes(24).toString("hex")

  const booking = await prisma.groupBooking.create({
    data: {
      eventId: event.id,
      orgName: testOrgName,
      orgType: "COMPANY",
      contactName: "J-Quad Admin",
      contactEmail: testContactEmail.toLowerCase(),
      contactPhone: "+254712345678",
      totalSlots: testSlots,
      bookingToken,
      claimToken,
      slots: {
        create: Array.from({ length: testSlots }, (_, i) => ({
          slotIndex: i + 1,
          qrToken: crypto.randomBytes(16).toString("hex"),
          status: "UNASSIGNED",
        })),
      },
    },
    include: {
      slots: true,
    },
  })

  console.log(`✓ GroupBooking created with ID: ${booking.id}`)
  console.log(`✓ Total slots created: ${booking.slots.length}`)
  if (booking.slots.length !== 10) throw new Error("Expected 10 slots!")

  // 3. Simulate assigning a delegate to slot #1
  const slot1 = booking.slots[0]
  const confirmationCode = generateConfirmationCode()
  const delegateName = "James J-Quad"
  const delegateEmail = "james.jquad@example.com"

  const reg = await prisma.registration.create({
    data: {
      eventId: event.id,
      answers: [
        { questionId: "name", value: delegateName },
        { questionId: "email", value: delegateEmail },
      ],
      status: "confirmed",
      registrationNumber: slot1.slotIndex,
      confirmationCode,
      submittedAt: new Date(),
      notified: false,
      attendeeEmail: delegateEmail,
      source: "group_delegation",
    },
  })

  console.log(`✓ Delegate Registration created with code: ${confirmationCode}`)

  const ticket = await generateTicketForRegistration(reg.id)
  console.log(`✓ Official Ticket generated: ID ${ticket.id}, Code ${ticket.code}`)

  const updatedSlot = await prisma.groupTicketSlot.update({
    where: { id: slot1.id },
    data: {
      attendeeName: delegateName,
      attendeeEmail: delegateEmail,
      attendeePhone: "+254700000001",
      ticketId: ticket.id,
      qrToken: ticket.code,
      status: "ASSIGNED",
      assignedAt: new Date(),
    },
  })

  console.log(`✓ Slot #1 updated to ASSIGNED with ticketId: ${updatedSlot.ticketId}`)

  // 4. Verify gate lookup logic
  const slotWithOrg = await prisma.groupTicketSlot.findFirst({
    where: { ticketId: ticket.id },
    select: {
      booking: {
        select: {
          orgName: true,
          orgType: true,
        },
      },
    },
  })

  if (!slotWithOrg || slotWithOrg.booking.orgName !== testOrgName) {
    throw new Error(`Gate lookup failed to find orgName! Found: ${slotWithOrg?.booking?.orgName}`)
  }
  console.log(`✓ Gate scanner lookup successfully identified: "${slotWithOrg.booking.orgName} Delegate"`)

  // 5. Verify unassignment / revocation
  await prisma.registration.update({
    where: { id: reg.id },
    data: { status: "cancelled" },
  })

  const resetSlot = await prisma.groupTicketSlot.update({
    where: { id: slot1.id },
    data: {
      attendeeName: null,
      attendeeEmail: null,
      attendeePhone: null,
      ticketId: null,
      status: "UNASSIGNED",
      qrToken: crypto.randomBytes(16).toString("hex"),
      assignedAt: null,
    },
  })

  console.log(`✓ Slot #1 successfully reset to UNASSIGNED (status: ${resetSlot.status})`)

  // 6. Clean up test records
  await prisma.groupTicketSlot.deleteMany({
    where: { bookingId: booking.id },
  })
  await prisma.groupBooking.delete({
    where: { id: booking.id },
  })
  await prisma.ticket.deleteMany({
    where: { registrationId: reg.id },
  })
  await prisma.registration.delete({
    where: { id: reg.id },
  })

  console.log("✓ Test records completely cleaned up from database.")
  console.log("=== ALL E2E VERIFICATION CHECKS PASSED SUCCESSFULLY ===")
}

run()
  .catch((e) => {
    console.error("Test failed with error:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
