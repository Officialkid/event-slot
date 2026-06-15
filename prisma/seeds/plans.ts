import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function seedPlans() {
  const plans = [
    {
      name: 'free',
      displayName: 'Free',
      monthlyPriceUsd: 0,
      annualPriceUsd: 0,
      maxAttendeesPerEvent: 50,
      maxWaitlistPerEvent: 0,
      maxActiveEvents: 1,
      maxOrganizerSeats: 1,
      dataRetentionDays: 14,
      paidEventCommission: 0.05,
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
      name: 'standard',
      displayName: 'Standard',
      monthlyPriceUsd: 9,
      annualPriceUsd: 90,
      maxAttendeesPerEvent: 200,
      maxWaitlistPerEvent: 100,
      maxActiveEvents: 5,
      maxOrganizerSeats: 3,
      dataRetentionDays: 90,
      paidEventCommission: 0.035,
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
      name: 'pro',
      displayName: 'Pro',
      monthlyPriceUsd: 25,
      annualPriceUsd: 250,
      maxAttendeesPerEvent: 1000,
      maxWaitlistPerEvent: 500,
      maxActiveEvents: 20,
      maxOrganizerSeats: 10,
      dataRetentionDays: 365,
      paidEventCommission: 0.02,
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
      name: 'business',
      displayName: 'Business',
      monthlyPriceUsd: 69,
      annualPriceUsd: 690,
      maxAttendeesPerEvent: -1,
      maxWaitlistPerEvent: -1,
      maxActiveEvents: -1,
      maxOrganizerSeats: 30,
      dataRetentionDays: -1,
      paidEventCommission: 0.015,
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
    console.log(`✓ Seeded plan: ${plan.displayName}`)
  }

  // Assign the Free plan subscription to all existing users who don't have one
  const freePlan = await prisma.plan.findUnique({ where: { name: 'free' } })
  if (!freePlan) return

  const usersWithoutSub = await prisma.user.findMany({
    where: { subscriptions: { none: {} } },
    select: { id: true },
  })

  for (const user of usersWithoutSub) {
    await prisma.subscription.create({
      data: {
        userId: user.id,
        planId: freePlan.id,
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000), // far future for free
      },
    })
  }
  console.log(`✓ Assigned Free plan to ${usersWithoutSub.length} existing users`)
}
