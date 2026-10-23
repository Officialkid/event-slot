/**
 * Safe Legacy Subscriber Migration & Compatibility Service
 *
 * Implements non-disruptive migration handling for existing IntaSend subscribers:
 * 1. Preserves existing subscriber plan benefits and entitlements through period end.
 * 2. Does NOT silently auto-charge or move subscribers to Paystack without authorization.
 * 3. Tracks migration eligibility, requiring explicit user consent/card authorization
 *    when renewing onto Paystack recurring billing.
 * 4. Keeps IntaSend integration functional for legacy records.
 */

import prisma from '@/lib/prisma'
import { getSubscriptionPlan } from '@/lib/subscriptionPlans'

export type SubscriberMigrationStatus =
  | 'PAYSTACK_ACTIVE'
  | 'LEGACY_INTASEND_ACTIVE'
  | 'LEGACY_INTASEND_EXPIRED'
  | 'FREE_TIER'

export type MigrationAnalysisResult = {
  userId: string
  status: SubscriberMigrationStatus
  planKey: string
  billingCycle: 'monthly' | 'annual' | null
  currentPeriodEnd: Date | null
  daysRemaining: number
  paymentProvider: string | null
  migrationRequired: boolean
  canRenewViaPaystack: boolean
  migrationGuidance: string
}

/**
 * Analyzes an organizer's subscription and determines whether migration from IntaSend is needed.
 */
export async function getSubscriberMigrationStatus(userId: string): Promise<MigrationAnalysisResult> {
  const [user, subscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        plan: true,
        billingCycle: true,
        planEndDate: true,
        paystackCustomerCode: true,
        paystackSubscriptionCode: true,
      },
    }),
    prisma.subscription.findFirst({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const planKey = user?.plan || subscription?.plan?.name || 'free'
  const isFree = planKey === 'free'
  const now = new Date()

  if (isFree && !subscription) {
    return {
      userId,
      status: 'FREE_TIER',
      planKey: 'free',
      billingCycle: null,
      currentPeriodEnd: null,
      daysRemaining: 0,
      paymentProvider: null,
      migrationRequired: false,
      canRenewViaPaystack: true,
      migrationGuidance: 'Organizer is on the free tier. No subscription migration needed.',
    }
  }

  const effectiveEnd = subscription?.currentPeriodEnd || user?.planEndDate || null
  const daysRemaining = effectiveEnd
    ? Math.max(0, Math.ceil((effectiveEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  const provider = subscription?.paymentProvider?.toLowerCase() || (user?.paystackSubscriptionCode ? 'paystack' : 'intasend')

  if (provider === 'paystack') {
    return {
      userId,
      status: 'PAYSTACK_ACTIVE',
      planKey,
      billingCycle: (subscription?.billingCycle?.toLowerCase() as 'monthly' | 'annual') || (user?.billingCycle as any) || 'monthly',
      currentPeriodEnd: effectiveEnd,
      daysRemaining,
      paymentProvider: 'paystack',
      migrationRequired: false,
      canRenewViaPaystack: true,
      migrationGuidance: 'Subscriber is already on Paystack recurring billing.',
    }
  }

  // Legacy IntaSend subscriber
  const isExpired = effectiveEnd ? effectiveEnd.getTime() < now.getTime() : true

  return {
    userId,
    status: isExpired ? 'LEGACY_INTASEND_EXPIRED' : 'LEGACY_INTASEND_ACTIVE',
    planKey,
    billingCycle: (subscription?.billingCycle?.toLowerCase() as 'monthly' | 'annual') || (user?.billingCycle as any) || 'monthly',
    currentPeriodEnd: effectiveEnd,
    daysRemaining,
    paymentProvider: 'intasend',
    migrationRequired: true,
    canRenewViaPaystack: true,
    migrationGuidance: isExpired
      ? 'Your previous IntaSend subscription has expired. Please select a plan and complete Paystack authorization to continue your benefits.'
      : `Your active IntaSend subscription remains fully valid for ${daysRemaining} days. At your next renewal, you will be prompted to re-authorize via Paystack recurring billing.`,
  }
}

/**
 * Asserts that a legacy subscriber keeps full access while their current period is active.
 */
export async function assertLegacySubscriberAccess(userId: string): Promise<boolean> {
  const status = await getSubscriberMigrationStatus(userId)
  if (status.status === 'LEGACY_INTASEND_ACTIVE' && status.daysRemaining > 0) {
    return true
  }
  return false
}
