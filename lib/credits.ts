import prisma from './prisma'

export async function spendCredits({
  userId,
  amount,
  description,
  eventId,
}: {
  userId: string
  amount: number
  description: string
  eventId?: string
}): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return { success: false, error: 'User not found' }
  if (user.creditBalance < amount) {
    return { success: false, error: 'Insufficient credits' }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { creditBalance: { decrement: amount } },
    }),
    prisma.creditTransaction.create({
      data: { userId, amount: -amount, type: 'spend', description, eventId },
    }),
  ])

  return { success: true }
}

export async function addCredits({
  userId,
  amount,
  description,
}: {
  userId: string
  amount: number
  description: string
}) {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: amount } },
    }),
    prisma.creditTransaction.create({
      data: { userId, amount, type: 'purchase', description },
    }),
  ])
}
