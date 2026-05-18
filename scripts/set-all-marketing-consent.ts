import { prisma } from "../lib/prisma"

async function main() {
  const result = await prisma.user.updateMany({
    data: { marketingConsent: true },
  })

  console.log(`Updated ${result.count} users to marketingConsent = true`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
