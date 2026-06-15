import { PrismaClient } from '@prisma/client'
import { seedPlans } from './seeds/plans'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')
  await seedPlans()
  console.log('Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
