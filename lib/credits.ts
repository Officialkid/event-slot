import prisma from './prisma'

export const CREDIT_COSTS = {
  ai_report: 150,
  ai_insights: 2,
  ai_query: 1,
  remove_watermark: 10,
  export_csv: 15,
  word_report: 100,
  analytics_unlock: 150,
  custom_thank_you: 20,
}

export const CREDIT_BUNDLES = [
  { id: 'credits_100', credits: 100, kesPrice: 1000, label: '100 credits — Ksh 1,000', savePct: null },
  { id: 'credits_500', credits: 500, kesPrice: 4500, label: '500 credits — Ksh 4,500 (save 10%)', savePct: 10 },
  { id: 'credits_1000', credits: 1000, kesPrice: 8000, label: '1,000 credits — Ksh 8,000 (save 20%)', savePct: 20 },
] as const

export type CreditBundleId = typeof CREDIT_BUNDLES[number]['id']

export async function getUserCredits(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true },
  })
  return user?.creditBalance ?? 0
}

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
  reference,
}: {
  userId: string
  amount: number
  description: string
  reference?: string
}): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: amount } },
    }),
    prisma.creditTransaction.create({
      data: { userId, amount, type: 'purchase', description, reference },
    }),
  ])
}
