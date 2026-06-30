import { prisma } from '@/lib/prisma';
import { getUserPlan, isSuperAdmin } from '@/lib/subscription';
import { getEffectivePlanPolicy, getNextPlanKey } from '@/lib/effectivePlanPolicy';
import { canUseEventScopedFeature } from '@/lib/eventPasses';

interface EnforcementResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: string; // plan name needed: "standard" | "pro" | "business"
  currentUsage?: number;
  limit?: number;
  paygAvailable?: boolean;
  paygEnabled?: boolean;
  paygUnitCostUsd?: number;
}

const EXTRA_ATTENDEE_PAYG_USD = 0.05

// ── Check attendee cap ────────────────────────────────────────────────────────
export async function canAddAttendee(
  userId: string,
  eventId: string,
  userEmail: string
): Promise<EnforcementResult> {
  if (isSuperAdmin(userEmail)) return { allowed: true };

  const { plan } = await getUserPlan(userId);
  if (!plan) return { allowed: false, reason: 'No active plan found' };
  const policy = getEffectivePlanPolicy(plan.name);
  if (policy.maxAttendeesPerEvent === -1) return { allowed: true };

  const currentCount = await prisma.registration.count({
    where: { eventId, status: 'confirmed' },
  });

  if (currentCount >= policy.maxAttendeesPerEvent) {
    const paygSettings = await prisma.paygSettings.findUnique({
      where: { userId },
      select: { id: true, isEnabled: true, monthlyCapUsd: true },
    })

    if (paygSettings?.isEnabled) {
      const billingMonth = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`
      const usage = await prisma.paygUsage.aggregate({
        where: {
          paygSettingsId: paygSettings.id,
          billingMonth,
        },
        _sum: { totalCostUsd: true },
      })

      const currentSpend = usage._sum.totalCostUsd ?? 0
      if (currentSpend + EXTRA_ATTENDEE_PAYG_USD <= paygSettings.monthlyCapUsd) {
        return {
          allowed: true,
          currentUsage: currentCount,
          limit: policy.maxAttendeesPerEvent,
          paygAvailable: true,
          paygEnabled: true,
          paygUnitCostUsd: EXTRA_ATTENDEE_PAYG_USD,
        }
      }
    }

    const nextPlan = getNextPlanKey(plan.name)
    return {
      allowed: false,
      reason: `Your ${policy.displayName} plan allows up to ${policy.maxAttendeesPerEvent} confirmed attendees per event.`,
      upgradeRequired: nextPlan ?? undefined,
      currentUsage: currentCount,
      limit: policy.maxAttendeesPerEvent,
      paygAvailable: policy.hasPayg,
      paygEnabled: false,
      paygUnitCostUsd: policy.hasPayg ? EXTRA_ATTENDEE_PAYG_USD : undefined,
    };
  }
  return { allowed: true, currentUsage: currentCount, limit: policy.maxAttendeesPerEvent };
}

// ── Check active event cap ────────────────────────────────────────────────────
export async function canCreateEvent(
  userId: string,
  userEmail: string
): Promise<EnforcementResult> {
  if (isSuperAdmin(userEmail)) return { allowed: true };

  const { plan } = await getUserPlan(userId);
  if (!plan) return { allowed: false, reason: 'No active plan found' };
  const policy = getEffectivePlanPolicy(plan.name);
  if (policy.maxActiveEvents === -1) return { allowed: true };

  const now = new Date();

  const activeCount = await prisma.event.count({
    where: {
      organizerId: userId,
      archived: false,
      OR: [
        { deadline: null },
        { deadline: { gt: now } },
      ],
    },
  });

  if (activeCount >= policy.maxActiveEvents) {
    const nextPlan = getNextPlanKey(plan.name)
    return {
      allowed: false,
      reason: `Your ${policy.displayName} plan allows up to ${policy.maxActiveEvents} active event${policy.maxActiveEvents === 1 ? '' : 's'}.`,
      upgradeRequired: nextPlan ?? undefined,
      currentUsage: activeCount,
      limit: policy.maxActiveEvents,
    };
  }
  return { allowed: true, currentUsage: activeCount, limit: policy.maxActiveEvents };
}

// ── Check waitlist access ─────────────────────────────────────────────────────
export async function canUseWaitlist(
  userId: string,
  userEmail: string
): Promise<EnforcementResult> {
  if (isSuperAdmin(userEmail)) return { allowed: true };
  const { plan } = await getUserPlan(userId);
  const policy = getEffectivePlanPolicy(plan?.name);
  if (!policy.hasWaitlist) {
    return {
      allowed: false,
      reason: 'Waitlist is not available on this plan.',
      upgradeRequired: 'standard',
    };
  }
  return { allowed: true };
}

// ── Check feature flags ───────────────────────────────────────────────────────
type PlanFeatureFlag =
  | 'hasWaitlist'
  | 'hasPdfTickets'
  | 'hasQrCheckin'
  | 'hasBasicAnalytics'
  | 'hasFullAnalytics'
  | 'hasAiInsights'
  | 'hasAiReports'
  | 'hasEmailCampaigns'
  | 'hasCustomBranding'
  | 'hasCustomDomain'
  | 'hasFaqSystem'
  | 'hasRecurringEvents'
  | 'hasApiAccess'
  | 'hasPrioritySupport';

const FEATURE_UPGRADE_MAP: Record<PlanFeatureFlag, string> = {
  hasWaitlist: 'standard',
  hasPdfTickets: 'standard',
  hasQrCheckin: 'standard',
  hasBasicAnalytics: 'standard',
  hasFullAnalytics: 'pro',
  hasAiInsights: 'standard',
  hasAiReports: 'pro',
  hasEmailCampaigns: 'pro',
  hasCustomBranding: 'pro',
  hasCustomDomain: 'business',
  hasFaqSystem: 'pro',
  hasRecurringEvents: 'business',
  hasApiAccess: 'business',
  hasPrioritySupport: 'business',
};

export async function canUseFeature(
  userId: string,
  userEmail: string,
  feature: PlanFeatureFlag
): Promise<EnforcementResult> {
  if (isSuperAdmin(userEmail)) return { allowed: true };
  const { plan } = await getUserPlan(userId);
  if (!plan) return { allowed: false, reason: 'No active plan' };

  if (!plan[feature]) {
    return {
      allowed: false,
      reason: `This feature requires the ${FEATURE_UPGRADE_MAP[feature]} plan or higher.`,
      upgradeRequired: FEATURE_UPGRADE_MAP[feature],
    };
  }
  return { allowed: true };
}

export async function canUseEventFeature(
  userId: string,
  userEmail: string,
  eventId: string,
  feature: PlanFeatureFlag
): Promise<EnforcementResult> {
  if (isSuperAdmin(userEmail)) return { allowed: true };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true },
  })

  if (!event || event.organizerId !== userId) {
    return { allowed: false, reason: 'Event not found or unavailable.' }
  }

  const access = await canUseEventScopedFeature(eventId, event.organizerId, feature)
  if (!access.allowed) {
    return {
      allowed: false,
      reason: `This feature requires the ${FEATURE_UPGRADE_MAP[feature]} plan or higher for this event.`,
      upgradeRequired: FEATURE_UPGRADE_MAP[feature],
    }
  }

  return { allowed: true }
}

// ── Check AI insight quota ────────────────────────────────────────────────────
// Uses EventInsight records (one per event, unique on eventId) to count
// how many AI insights this user's events have generated this calendar month.
export async function canGenerateAiInsight(
  userId: string,
  userEmail: string
): Promise<EnforcementResult> {
  if (isSuperAdmin(userEmail)) return { allowed: true };
  const { plan } = await getUserPlan(userId);
  if (!plan?.hasAiInsights) {
    return { allowed: false, reason: 'AI insights require Standard plan or higher.', upgradeRequired: 'standard' };
  }
  if (plan.freeAiInsightsPerMonth === -1) return { allowed: true }; // Business unlimited

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Count EventInsight records generated this month for events owned by this user
  const insightsThisMonth = await prisma.eventInsight.count({
    where: {
      generatedAt: { gte: startOfMonth },
      event: { organizerId: userId },
    },
  });

  if (insightsThisMonth >= plan.freeAiInsightsPerMonth) {
    return {
      allowed: false,
      reason: `You have used all ${plan.freeAiInsightsPerMonth} free AI insight${plan.freeAiInsightsPerMonth === 1 ? '' : 's'} this month.`,
      upgradeRequired: plan.name === 'standard' ? 'pro' : 'business',
      currentUsage: insightsThisMonth,
      limit: plan.freeAiInsightsPerMonth,
    };
  }
  return { allowed: true, currentUsage: insightsThisMonth, limit: plan.freeAiInsightsPerMonth };
}
