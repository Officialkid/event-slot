import { prisma } from "../lib/prisma"
import { checkAndAwardPioneerBadge } from "../lib/referral"

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, createdAt: true },
  })

  console.log(`Processing ${users.length} existing users for Pioneer badge...`)

  for (const user of users) {
    const awarded = await checkAndAwardPioneerBadge(user.id)
    console.log(`${user.email ?? user.id} - Pioneer: ${awarded ? "Awarded" : "Limit reached"}`)
  }

  const count = await prisma.pioneerBadge.count()
  console.log(`\nPioneer badges awarded: ${count} of 150`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
