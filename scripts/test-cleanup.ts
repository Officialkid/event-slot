import { PrismaClient } from "@prisma/client"
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

async function main() {
  const testEventIds = (
    await prisma.event.findMany({
      where: { isTestData: true },
      select: { id: true },
    })
  ).map((event) => event.id)

  const paymentsDeleted = await prisma.payment.deleteMany({
    where: {
      OR: [
        { isTestData: true },
        { eventId: { in: testEventIds } },
      ],
    },
  })

  const paidOrdersDeleted = await prisma.paidEventOrder.deleteMany({
    where: {
      eventId: { in: testEventIds },
    },
  })

  const ticketsDeleted = await prisma.ticket.deleteMany({
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

  const registrationsDeleted = await prisma.registration.deleteMany({
    where: {
      OR: [
        { isTestData: true },
        { eventId: { in: testEventIds } },
      ],
    },
  })

  const ticketTiersDeleted = await prisma.ticketTier.deleteMany({
    where: {
      eventId: { in: testEventIds },
    },
  })

  const eventsDeleted = await prisma.event.deleteMany({
    where: { isTestData: true },
  })

  const usersDeleted = await prisma.user.deleteMany({
    where: { isTestData: true },
  })

  console.log("🧹 EventSlot Test Data Cleaned")
  console.log("───────────────────────────────")
  console.log(`Payments deleted:      ${paymentsDeleted.count}`)
  console.log(`Paid orders deleted:   ${paidOrdersDeleted.count}`)
  console.log(`Tickets deleted:       ${ticketsDeleted.count}`)
  console.log(`Registrations deleted: ${registrationsDeleted.count}`)
  console.log(`Ticket tiers deleted:  ${ticketTiersDeleted.count}`)
  console.log(`Events deleted:        ${eventsDeleted.count}`)
  console.log(`Users deleted:         ${usersDeleted.count}`)
  console.log("───────────────────────────────")
  console.log("Database is clean.")
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
