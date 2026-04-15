import prisma from './prisma'

export const CREDIT_COSTS = {
  // Reports
  standard_report: 0,
  ai_report: 50,
  // Analytics
  event_analytics: 10,
  ai_insights: 20,
  ask_your_data: 60,
  // Per-event unlocks
  export_csv: 15,
  remove_watermark: 10,
  duplicate_event: 5,
  custom_thank_you: 10,
  // Advanced features
  team_members: 10,
  insight_tracker: 50,
  feedback_forms: 30,
  predictive_capacity: 25,
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

export async function purchaseFeatureAccess({
  userId,
  feature,
  eventId,
}: {
  userId: string
  feature: keyof typeof CREDIT_COSTS
  eventId?: string
}): Promise<{ success: boolean; accessId?: string; error?: string }> {
  const cost = CREDIT_COSTS[feature]
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { creditBalance: true, plan: true },
  })
  if (!user) return { success: false, error: 'User not found' }

  // Idempotent: return existing active access for this event
  if (eventId) {
    const existing = await prisma.featureAccess.findFirst({
      where: { userId, feature, eventId, expiresAt: { gt: new Date() } },
    })
    if (existing) return { success: true, accessId: existing.id }
  }

  if (user.creditBalance < cost) {
    return {
      success: false,
      error: `Insufficient credits. You need ${cost} credits but have ${user.creditBalance}.`,
    }
  }

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  const [, , access] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { creditBalance: { decrement: cost } },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        type: 'spend',
        amount: -cost,
        description: `One-time access: ${feature}${eventId ? ' for event' : ''}`,
      },
    }),
    prisma.featureAccess.create({
      data: { userId, feature, eventId: eventId ?? null, expiresAt },
    }),
  ])

  return { success: true, accessId: access.id }
}

// Features included free on Pro (and Business)
const PRO_INCLUDED_FEATURES = [
  'standard_report',
  'ai_report',
  'event_analytics',
  'ai_insights',
  'export_csv',
  'remove_watermark',
  'duplicate_event',
  'custom_thank_you',
  'predictive_capacity',
]

// Features included free on Business (everything Pro + more)
const BUSINESS_INCLUDED_FEATURES = [
  ...PRO_INCLUDED_FEATURES,
  'ask_your_data',
  'team_members',
  'insight_tracker',
  'feedback_forms',
]

export async function hasFeatureAccess({
  userId,
  feature,
  eventId,
  plan,
}: {
  userId: string
  feature: string
  eventId?: string
  plan: string
}): Promise<{ hasAccess: boolean; reason: 'plan' | 'unlock' | 'none'; cost?: number }> {
  // Business plan — everything is included, no credits ever needed
  if (plan === 'business' && BUSINESS_INCLUDED_FEATURES.includes(feature)) {
    return { hasAccess: true, reason: 'plan' }
  }

  // Pro plan — check if feature is included
  if (plan === 'pro' && PRO_INCLUDED_FEATURES.includes(feature)) {
    return { hasAccess: true, reason: 'plan' }
  }

  // Check for existing credits unlock (active FeatureAccess record)
  const access = await prisma.featureAccess.findFirst({
    where: {
      userId,
      feature,
      eventId: eventId ?? null,
      expiresAt: { gt: new Date() },
    },
  })

  if (access) {
    return { hasAccess: true, reason: 'unlock' }
  }

  // No access — return the credit cost so the client can show "Unlock for X credits"
  const cost = CREDIT_COSTS[feature as keyof typeof CREDIT_COSTS]
  return { hasAccess: false, reason: 'none', cost }
}
