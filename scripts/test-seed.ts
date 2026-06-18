import { PrismaClient, Prisma } from "@prisma/client"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import fs from "fs"
import path from "path"

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env")
  if (!fs.existsSync(envPath)) return
  const raw = fs.readFileSync(envPath, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const equals = trimmed.indexOf("=")
    if (equals === -1) continue
    const key = trimmed.slice(0, equals).trim()
    const value = trimmed.slice(equals + 1).trim().replace(/^"+|"+$/g, "")
    if (!(key in process.env)) {
      process.env[key] = value
    }
  }
}

loadLocalEnv()

function normalizeDatabaseUrl(value: string | undefined) {
  return value?.trim().replace(/^"+|"+$/g, "")
}

const directUrl = normalizeDatabaseUrl(process.env.DIRECT_URL)
const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL)

if (directUrl) {
  process.env.DATABASE_URL = directUrl
} else if (databaseUrl) {
  process.env.DATABASE_URL = databaseUrl
}

const prisma = new PrismaClient()

const TEST_PASSWORD = "TestPass2024!"
const NOW = new Date()
const ONE_DAY = 24 * 60 * 60 * 1000

type SeedUser = {
  key: string
  name: string
  email: string
  plan: "free" | "standard" | "pro" | "business"
  isAdmin?: boolean
}

type SeedEvent = {
  key: string
  title: string
  ownerKey: string
  accessType: "REGISTRATION" | "WALK_IN"
  isPaid: boolean
  capacity: number | null
  confirmedCount: number
  waitlistCount: number
  eventDate: Date
  eventEndAt?: Date | null
  joinOpensAt?: Date | null
  deadline?: Date | null
  location: string
  description: string
  ticketTiers?: Array<{
    name: string
    priceKes: number
    capacity: number
    description?: string
    bundleSize?: number
  }>
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function buildDashboardToken() {
  return randomBytes(24).toString("hex")
}

function attendeePhone(index: number) {
  return `0712${String(index).padStart(6, "0")}`
}

function defaultQuestions(): Prisma.JsonArray {
  return [
    { id: "full-name", label: "Full Name", type: "text", required: true },
    { id: "email", label: "Email Address", type: "email", required: true },
    { id: "phone", label: "Phone Number", type: "phone", required: true },
  ]
}

function registrationAnswers(name: string, email: string, phone: string): Prisma.JsonArray {
  return [
    { questionId: "full-name", value: name },
    { questionId: "email", value: email },
    { questionId: "phone", value: phone },
  ]
}

async function ensurePlansSeeded() {
  const plans = [
    {
      name: "free",
      displayName: "Free",
      monthlyPriceUsd: 0,
      annualPriceUsd: 0,
      maxAttendeesPerEvent: 50,
      maxWaitlistPerEvent: 0,
      maxActiveEvents: 1,
      maxOrganizerSeats: 1,
      dataRetentionDays: 14,
      paidEventCommission: 0.1,
      hasWaitlist: false,
      hasPdfTickets: false,
      hasQrCheckin: false,
      hasBasicAnalytics: false,
      hasFullAnalytics: false,
      hasAiInsights: false,
      freeAiInsightsPerMonth: 0,
      hasAiReports: false,
      hasEmailCampaigns: false,
      hasCustomBranding: false,
      hasCustomDomain: false,
      hasFaqSystem: false,
      hasRecurringEvents: false,
      hasApiAccess: false,
      hasPrioritySupport: false,
    },
    {
      name: "standard",
      displayName: "Standard",
      monthlyPriceUsd: 9,
      annualPriceUsd: 90,
      maxAttendeesPerEvent: 200,
      maxWaitlistPerEvent: 100,
      maxActiveEvents: 5,
      maxOrganizerSeats: 3,
      dataRetentionDays: 90,
      paidEventCommission: 0.08,
      hasWaitlist: true,
      hasPdfTickets: true,
      hasQrCheckin: true,
      hasBasicAnalytics: true,
      hasFullAnalytics: false,
      hasAiInsights: true,
      freeAiInsightsPerMonth: 1,
      hasAiReports: false,
      hasEmailCampaigns: false,
      hasCustomBranding: false,
      hasCustomDomain: false,
      hasFaqSystem: false,
      hasRecurringEvents: false,
      hasApiAccess: false,
      hasPrioritySupport: false,
    },
    {
      name: "pro",
      displayName: "Pro",
      monthlyPriceUsd: 25,
      annualPriceUsd: 250,
      maxAttendeesPerEvent: 1000,
      maxWaitlistPerEvent: 500,
      maxActiveEvents: 20,
      maxOrganizerSeats: 10,
      dataRetentionDays: 365,
      paidEventCommission: 0.05,
      hasWaitlist: true,
      hasPdfTickets: true,
      hasQrCheckin: true,
      hasBasicAnalytics: true,
      hasFullAnalytics: true,
      hasAiInsights: true,
      freeAiInsightsPerMonth: 5,
      hasAiReports: true,
      hasEmailCampaigns: true,
      hasCustomBranding: true,
      hasCustomDomain: false,
      hasFaqSystem: true,
      hasRecurringEvents: false,
      hasApiAccess: false,
      hasPrioritySupport: false,
    },
    {
      name: "business",
      displayName: "Business",
      monthlyPriceUsd: 69,
      annualPriceUsd: 690,
      maxAttendeesPerEvent: -1,
      maxWaitlistPerEvent: -1,
      maxActiveEvents: -1,
      maxOrganizerSeats: 30,
      dataRetentionDays: -1,
      paidEventCommission: 0.03,
      hasWaitlist: true,
      hasPdfTickets: true,
      hasQrCheckin: true,
      hasBasicAnalytics: true,
      hasFullAnalytics: true,
      hasAiInsights: true,
      freeAiInsightsPerMonth: -1,
      hasAiReports: true,
      hasEmailCampaigns: true,
      hasCustomBranding: true,
      hasCustomDomain: true,
      hasFaqSystem: true,
      hasRecurringEvents: true,
      hasApiAccess: true,
      hasPrioritySupport: true,
    },
  ]

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    })
  }
}

async function cleanupExistingTestData() {
  const testEventIds = (
    await prisma.event.findMany({
      where: { isTestData: true },
      select: { id: true },
    })
  ).map((event) => event.id)

  await prisma.payment.deleteMany({
    where: {
      OR: [
        { isTestData: true },
        { eventId: { in: testEventIds } },
      ],
    },
  })

  await prisma.ticket.deleteMany({
    where: {
      OR: [
        { isTestData: true },
        {
          registration: {
            eventId: { in: testEventIds },
          },
        },
      ],
    },
  })

  await prisma.registration.deleteMany({
    where: {
      OR: [
        { isTestData: true },
        { eventId: { in: testEventIds } },
      ],
    },
  })

  await prisma.ticketTier.deleteMany({
    where: {
      eventId: { in: testEventIds },
    },
  })

  await prisma.event.deleteMany({
    where: { isTestData: true },
  })

  await prisma.user.deleteMany({
    where: { isTestData: true },
  })
}

async function ensureSubscription(userId: string, planName: SeedUser["plan"]) {
  const plan = await prisma.plan.findUnique({
    where: { name: planName },
  })

  if (!plan) {
    throw new Error(`Missing plan seed for ${planName}`)
  }

  const existing = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  })

  const currentPeriodStart = NOW
  const currentPeriodEnd = new Date(NOW.getTime() + 365 * ONE_DAY)

  if (existing) {
    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart,
        currentPeriodEnd,
      },
    })
    return
  }

  await prisma.subscription.create({
    data: {
      userId,
      planId: plan.id,
      billingCycle: "MONTHLY",
      status: "ACTIVE",
      currentPeriodStart,
      currentPeriodEnd,
    },
  })
}

async function main() {
  await cleanupExistingTestData()
  await ensurePlansSeeded()

  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 12)

  const seedUsers: SeedUser[] = [
    { key: "alice", name: "Alice Free", email: "alice.free@eventslot.test", plan: "free" },
    { key: "bob", name: "Bob Standard", email: "bob.standard@eventslot.test", plan: "standard" },
    { key: "carol", name: "Carol Pro", email: "carol.pro@eventslot.test", plan: "pro" },
    { key: "david", name: "David Business", email: "david.business@eventslot.test", plan: "business" },
    { key: "admin", name: "Test Admin", email: "admin@eventslot.test", plan: "business", isAdmin: true },
    { key: "staff", name: "Eve Staff", email: "eve.staff@eventslot.test", plan: "free" },
  ]

  const attendeeUsers: SeedUser[] = Array.from({ length: 55 }, (_, index) => {
    const num = index + 1
    return {
      key: `attendee-${String(num).padStart(2, "0")}`,
      name: `Attendee ${String(num).padStart(2, "0")}`,
      email: `attendee${String(num).padStart(2, "0")}@eventslot.test`,
      plan: "free" as const,
    }
  })

  const allUsers = [...seedUsers, ...attendeeUsers]
  const userIds = new Map<string, string>()

  for (const user of allUsers) {
    const created = await prisma.user.create({
      data: {
        isTestData: true,
        name: user.name,
        email: user.email,
        password: hashedPassword,
        emailVerified: NOW,
        plan: user.plan,
        isAdmin: user.isAdmin ?? false,
        googleCalendarConnected: false,
        onboardingCompleted: true,
        onboardingSkipped: true,
        consentSystemEmails: false,
        marketingConsent: false,
      },
    })

    userIds.set(user.key, created.id)
    await ensureSubscription(created.id, user.plan)
  }

  const seedEvents: SeedEvent[] = [
    {
      key: "free-event",
      title: "Test Free Event",
      ownerKey: "alice",
      accessType: "REGISTRATION",
      isPaid: false,
      capacity: 50,
      confirmedCount: 50,
      waitlistCount: 0,
      eventDate: new Date(NOW.getTime() + 14 * ONE_DAY),
      deadline: new Date(NOW.getTime() + 13 * ONE_DAY),
      location: "KICC, Nairobi",
      description: "Free registration event seeded for capacity and waitlist testing.",
    },
    {
      key: "paid-single",
      title: "Test Paid Event - Single Tier",
      ownerKey: "bob",
      accessType: "REGISTRATION",
      isPaid: true,
      capacity: 10,
      confirmedCount: 0,
      waitlistCount: 0,
      eventDate: new Date(NOW.getTime() + 21 * ONE_DAY),
      deadline: new Date(NOW.getTime() + 20 * ONE_DAY),
      location: "Sarit Expo Centre",
      description: "Single-tier paid event seeded for M-Pesa checkout testing.",
      ticketTiers: [
        { name: "Standard", priceKes: 1500, capacity: 10, description: "Single-tier ticket", bundleSize: 1 },
      ],
    },
    {
      key: "paid-multi",
      title: "Test Paid Event - Multi Tier",
      ownerKey: "carol",
      accessType: "REGISTRATION",
      isPaid: true,
      capacity: 38,
      confirmedCount: 0,
      waitlistCount: 0,
      eventDate: new Date(NOW.getTime() + 28 * ONE_DAY),
      deadline: new Date(NOW.getTime() + 27 * ONE_DAY),
      location: "Trademark Hotel, Nairobi",
      description: "Multi-tier paid event seeded for full checkout coverage.",
      ticketTiers: [
        { name: "Regular", priceKes: 1000, capacity: 20, bundleSize: 1 },
        { name: "VIP", priceKes: 3500, capacity: 10, bundleSize: 1 },
        { name: "VVIP", priceKes: 7000, capacity: 5, bundleSize: 1 },
        { name: "Table of 5", priceKes: 10000, capacity: 3, bundleSize: 5 },
      ],
    },
    {
      key: "walk-in",
      title: "Test Walk-In Event",
      ownerKey: "david",
      accessType: "WALK_IN",
      isPaid: false,
      capacity: null,
      confirmedCount: 0,
      waitlistCount: 0,
      eventDate: new Date(NOW.getTime() + 7 * ONE_DAY),
      eventEndAt: new Date(NOW.getTime() + 9 * ONE_DAY),
      location: "Ruaraka Sports Grounds",
      description: "Walk-in event seeded for open check-in testing.",
    },
    {
      key: "coming-soon",
      title: "Test Coming Soon Event",
      ownerKey: "david",
      accessType: "REGISTRATION",
      isPaid: false,
      capacity: 25,
      confirmedCount: 0,
      waitlistCount: 0,
      eventDate: new Date(NOW.getTime() + 35 * ONE_DAY),
      joinOpensAt: new Date(NOW.getTime() + 34 * ONE_DAY),
      deadline: new Date(NOW.getTime() + 34 * ONE_DAY),
      location: "Online Preview Event",
      description: "Gated future event seeded to exercise coming-soon style entry states.",
    },
  ]

  const eventIds = new Map<string, string>()

  for (const event of seedEvents) {
    const ownerId = userIds.get(event.ownerKey)
    const ownerEmail = allUsers.find((user) => user.key === event.ownerKey)?.email

    if (!ownerId || !ownerEmail) {
      throw new Error(`Missing owner for ${event.key}`)
    }

    const created = await prisma.event.create({
      data: {
        isTestData: true,
        title: event.title,
        description: event.description,
        slug: slugify(event.title),
        accessType: event.accessType,
        capacity: event.capacity,
        deadline: event.deadline ?? null,
        confirmedCount: event.confirmedCount,
        waitlistCount: event.waitlistCount,
        organizerEmail: ownerEmail,
        dashboardToken: buildDashboardToken(),
        questions: event.accessType === "WALK_IN" ? [] : defaultQuestions(),
        organizerId: ownerId,
        eventDate: event.eventDate,
        eventEndAt: event.eventEndAt ?? null,
        joinOpensAt: event.joinOpensAt ?? null,
        location: event.location,
        eventType: "PHYSICAL",
        archived: false,
        status: "active",
        isPaid: event.isPaid,
        ticketPrice: event.isPaid ? event.ticketTiers?.[0]?.priceKes ?? null : null,
        ticketsEnabled: true,
        faqEnabled: false,
        ticketTiers: event.ticketTiers
          ? {
              create: event.ticketTiers.map((tier, index) => ({
                name: tier.name,
                priceKes: tier.priceKes,
                capacity: tier.capacity,
                description: tier.description ?? null,
                bundleSize: tier.bundleSize ?? 1,
                sortOrder: index,
              })),
            }
          : undefined,
      },
    })

    eventIds.set(event.key, created.id)
  }

  const freeEventId = eventIds.get("free-event")
  if (!freeEventId) {
    throw new Error("Free test event was not created")
  }

  const attendeeRegistrations = attendeeUsers.slice(0, 50)
  let registrationNumber = 1

  for (const attendee of attendeeRegistrations) {
    const attendeeIndex = Number(attendee.key.replace("attendee-", ""))
    await prisma.registration.create({
      data: {
        isTestData: true,
        eventId: freeEventId,
        answers: registrationAnswers(attendee.name, attendee.email, attendeePhone(attendeeIndex)),
        status: "confirmed",
        registrationNumber,
        attendeeEmail: attendee.email,
        consentTransactional: true,
        consentMarketing: false,
        checkedIn: false,
        source: "test-seed",
      },
    })
    registrationNumber += 1
  }

  console.log("✅ EventSlot Test Seed Complete")
  console.log("───────────────────────────────")
  console.log(`Users created:     ${allUsers.length}`)
  console.log(`Events created:    ${seedEvents.length}`)
  console.log(`Registrations:     ${attendeeRegistrations.length}`)
  console.log("All tagged:        isTestData = true")
  console.log("───────────────────────────────")
  console.log("To clean up run:   npm run test:cleanup")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
