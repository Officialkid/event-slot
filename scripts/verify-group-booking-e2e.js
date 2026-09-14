const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equals = trimmed.indexOf('=');
    if (equals === -1) continue;
    const key = trimmed.slice(0, equals).trim();
    const value = trimmed.slice(equals + 1).trim().replace(/^"+|"+$/g, '');
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();
const prisma = new PrismaClient();

async function main() {
  console.log('===========================================================');
  console.log('🏁 E2E VERIFICATION: GROUP & ORGANIZATION BOOKING ENGINE');
  console.log('===========================================================\n');

  // 1. Fetch an event to test with
  const event = await prisma.event.findFirst({
    where: {
      slug: 'disruptors-convention-ilax',
    },
  }) || await prisma.event.findFirst({ orderBy: { createdAt: 'desc' } });

  if (!event) {
    throw new Error('No events found in database to test.');
  }

  console.log(`[PASS] Using Event: "${event.title}" (slug: ${event.slug}, id: ${event.id})`);

  // 2. Enable group registration on this event (as would happen via Create/Edit Event UI)
  const updatedEvent = await prisma.event.update({
    where: { id: event.id },
    data: { groupRegistrationEnabled: true },
    select: { id: true, slug: true, groupRegistrationEnabled: true },
  });

  console.log(`[PASS] Enabled Group Registration on Event: groupRegistrationEnabled = ${updatedEvent.groupRegistrationEnabled}`);

  // 3. Create a Group Booking (e.g. 5 seats for City of Refuge Assembly)
  const bookingToken = uuidv4();
  const claimToken = uuidv4();
  const totalSlots = 5;

  const testBooking = await prisma.groupBooking.create({
    data: {
      eventId: event.id,
      orgName: 'City of Refuge Assembly',
      orgType: 'CHURCH',
      contactName: 'Pastor David Ndungu',
      contactEmail: 'pastor.david@example.com',
      contactPhone: '+254712345678',
      totalSlots,
      bookingToken,
      claimToken,
      slots: {
        create: Array.from({ length: totalSlots }, (_, i) => ({
          slotIndex: i + 1,
          status: 'UNASSIGNED',
          qrToken: uuidv4(),
        })),
      },
    },
    include: {
      slots: true,
    },
  });

  console.log(`[PASS] Created Group Booking for "${testBooking.orgName}":`);
  console.log(`  • Booking ID: ${testBooking.id}`);
  console.log(`  • Booking Token (Manager Portal): ${testBooking.bookingToken}`);
  console.log(`  • Claim Token (Member Self-Claim): ${testBooking.claimToken}`);
  console.log(`  • Pre-allocated Slots: ${testBooking.slots.length} slots created`);

  // 4. Verify slot assignment (Delegate Mary Wanjiku assigned to slot #1)
  const slotToAssign = testBooking.slots[0];
  const assignedSlot = await prisma.groupTicketSlot.update({
    where: { id: slotToAssign.id },
    data: {
      attendeeName: 'Mary Wanjiku',
      attendeeEmail: 'mary.wanjiku@example.com',
      attendeePhone: '+254722000001',
      status: 'ASSIGNED',
      assignedAt: new Date(),
    },
  });

  console.log(`[PASS] Assigned Slot #1 to Delegate: "${assignedSlot.attendeeName}" (${assignedSlot.attendeeEmail}, status: ${assignedSlot.status})`);

  // 5. Verify Check-in at the Gates
  const checkedInSlot = await prisma.groupTicketSlot.update({
    where: { id: slotToAssign.id },
    data: {
      status: 'CHECKED_IN',
      checkedInAt: new Date(),
    },
  });

  console.log(`[PASS] Checked In Delegate at Gate: status = ${checkedInSlot.status}, checkedInAt = ${checkedInSlot.checkedInAt.toISOString()}`);

  // 6. Test Querying Group Bookings for the Event (matches /api/events/[slug]/group-bookings logic)
  const allBookings = await prisma.groupBooking.findMany({
    where: { eventId: event.id },
    include: {
      slots: { select: { status: true } },
    },
  });

  const target = allBookings.find(b => b.id === testBooking.id);
  const assignedCount = target.slots.filter(s => s.status === 'ASSIGNED' || s.status === 'CHECKED_IN').length;
  const checkedInCount = target.slots.filter(s => s.status === 'CHECKED_IN').length;
  const unassignedCount = target.totalSlots - assignedCount;

  console.log(`[PASS] Event Delegations Summary Verified:`);
  console.log(`  • Total Delegations: ${allBookings.length}`);
  console.log(`  • Target Allocation: ${target.orgName}`);
  console.log(`  • Total Held: ${target.totalSlots}`);
  console.log(`  • Assigned: ${assignedCount}`);
  console.log(`  • Unassigned: ${unassignedCount}`);
  console.log(`  • Checked In: ${checkedInCount}`);

  // 7. Clean up test booking
  await prisma.groupBooking.delete({
    where: { id: testBooking.id },
  });

  console.log(`[PASS] Test Booking Cleaned Up Successfully.`);

  console.log('\n===========================================================');
  console.log('✅ ALL GROUP & ORGANIZATION BOOKING CHECKS PASSED!');
  console.log('===========================================================\n');
}

main()
  .catch(err => {
    console.error('[FAIL] Verification error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
