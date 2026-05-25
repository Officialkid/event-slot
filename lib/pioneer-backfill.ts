import { prisma } from '@/lib/prisma'

export async function runPioneerBackfill(limit = 150): Promise<{ awarded: number; total: number }> {
  const firstUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  })

  let awarded = 0
  for (const u of firstUsers) {
    const has = await prisma.userBadge.findUnique({
      where: { userId_badge: { userId: u.id, badge: 'PIONEER' } },
    })
    if (!has) {
      await prisma.userBadge.create({ data: { userId: u.id, badge: 'PIONEER' } })
      await prisma.pioneerBadge.upsert({
        where: { userId: u.id },
        update: {},
        create: { userId: u.id, hasSeenCongratulations: false },
      })
      awarded++
    }
  }

  return { awarded, total: firstUsers.length }
}
