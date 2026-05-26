/**
 * Seeds a Google Play reviewer test account with a sample event and registration.
 *
 * Usage:
 *   node scripts/seed-reviewer.mjs <PASSWORD>
 *
 * Example:
 *   node scripts/seed-reviewer.mjs "SomeStr0ngP@ss!"
 *
 * Safe to re-run — upserts the user, skips if event/registration already exist.
 * The account is created with:
 *   - Email:    reviewer@eventsslot.com
 *   - Username: eventslot-reviewer
 *   - Plan:     free
 *   - One active sample event ("Tech Meetup Nairobi — Sample")
 *   - One confirmed registration on that event
 *   - Google Calendar NOT connected
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"

const REVIEWER_EMAIL    = "reviewer@eventsslot.com"
const REVIEWER_USERNAME = "eventslot-reviewer"
const REVIEWER_NAME     = "EventSlot Reviewer"

const password = process.argv[2]
if (!password) {
  console.error("Usage: node scripts/seed-reviewer.mjs <PASSWORD>")
  process.exit(1)
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.")
  process.exit(1)
}

const prisma = new PrismaClient()

async function main() {
  // ── 1. Upsert reviewer user ───────────────────────────────────────────────
  const hashed = await bcrypt.hash(password, 12)

  const user = await prisma.user.upsert({
    where: { email: REVIEWER_EMAIL },
    update: { password: hashed },
    create: {
      email:                  REVIEWER_EMAIL,
      name:                   REVIEWER_NAME,
      username:               REVIEWER_USERNAME,
      password:               hashed,
      emailVerified:          new Date(),
      plan:                   "free",
      googleCalendarConnected: false,
      onboardingCompleted:    true,
      consentSystemEmails:    false,
      marketingConsent:       false,
    },
  })

  console.log(`✓ Reviewer user ready — id: ${user.id}`)

  // ── 2. Create sample event (skip if already exists) ───────────────────────
  const slug = "tech-meetup-nairobi-sample"

  let event = await prisma.event.findUnique({ where: { slug } })

  if (!event) {
    const now  = new Date()
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now

    event = await prisma.event.create({
      data: {
        title:          "Tech Meetup Nairobi — Sample",
        slug,
        description:    "A sample event created for Google Play Store review. Join us for an evening of networking, lightning talks, and demos from Nairobi's tech community.",
        capacity:       100,
        confirmedCount: 1,
        waitlistCount:  0,
        organizerEmail: REVIEWER_EMAIL,
        organizerId:    user.id,
        dashboardToken: randomBytes(24).toString("hex"),
        questions:      [
          { id: "q1", label: "Full Name",       type: "text",   required: true  },
          { id: "q2", label: "Email Address",   type: "email",  required: true  },
          { id: "q3", label: "Organisation",    type: "text",   required: false },
          { id: "q4", label: "T-shirt size",    type: "select", required: false,
            options: ["XS", "S", "M", "L", "XL", "XXL"] },
        ],
        eventDate:      soon,
        location:       "Nairobi Garage, Westlands, Nairobi",
        eventType:      "PHYSICAL",
        status:         "active",
        category:       "NETWORKING",
        ticketsEnabled: true,
        isPaid:         false,
        faqEnabled:     true,
      },
    })

    // Sample FAQ entries
    await prisma.eventFAQ.createMany({
      data: [
        { eventId: event.id, question: "Is this event free?",       answer: "Yes, this is a free community event. No ticket fee required.", order: 0 },
        { eventId: event.id, question: "Where exactly is it held?", answer: "Nairobi Garage, 9th Floor, The Mirage, Westlands.", order: 1 },
        { eventId: event.id, question: "Will there be refreshments?", answer: "Light refreshments and drinks will be provided.", order: 2 },
      ],
    })

    console.log(`✓ Sample event created — slug: ${slug}`)
  } else {
    console.log(`• Sample event already exists — slug: ${slug} (skipped)`)
  }

  // ── 3. Create sample registration (skip if already exists) ────────────────
  const existing = await prisma.registration.findFirst({
    where: { eventId: event.id, attendeeEmail: REVIEWER_EMAIL },
  })

  if (!existing) {
    const qrCode            = randomBytes(16).toString("hex")
    const confirmationCode  = randomBytes(8).toString("hex").toUpperCase()

    const reg = await prisma.registration.create({
      data: {
        eventId:            event.id,
        attendeeEmail:      REVIEWER_EMAIL,
        status:             "confirmed",
        registrationNumber: 1,
        qrCode,
        confirmationCode,
        consentTransactional: false,
        consentMarketing:   false,
        answers: {
          q1: REVIEWER_NAME,
          q2: REVIEWER_EMAIL,
          q3: "Google Play Review Team",
          q4: "M",
        },
      },
    })

    // Ticket
    await prisma.ticket.create({
      data: { registrationId: reg.id },
    })

    console.log(`✓ Sample registration created — confirmationCode: ${confirmationCode}`)
  } else {
    console.log(`• Sample registration already exists (skipped)`)
  }

  console.log("\n──────────────────────────────────────────────────")
  console.log("Play Console reviewer credentials:")
  console.log(`  Email:    ${REVIEWER_EMAIL}`)
  console.log(`  Password: [as supplied to this script]`)
  console.log(`  Notes:    Use the Events tab to see the sample event.`)
  console.log(`            Use the Community tab for the leaderboard.`)
  console.log(`            AI features are accessible via the ? button.`)
  console.log("──────────────────────────────────────────────────")
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
