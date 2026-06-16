import { prisma } from '@/lib/prisma';
import { getUserPlan, isSuperAdmin } from '@/lib/subscription';

interface EnforcementResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: string; // plan name needed: "standard" | "pro" | "business"
  currentUsage?: number;
  limit?: number;
}

// ── Check attendee cap ────────────────────────────────────────────────────────
export async function canAddAttendee(
  userId: string,
  eventId: string,
  userEmail: string
): Promise<EnforcementResult> {
  if (isSuperAdmin(userEmail)) return { allowed: true };

  const { plan } = await getUserPlan(userId);
  if (!plan) return { allowed: false, reason: 'No active plan found' };
  if (plan.maxAttendeesPerEvent === -1) return { allowed: true };

  const currentCount = await prisma.registration.count({
    where: { eventId, status: 'confirmed' },
  });

  if (currentCount >= plan.maxAttendeesPerEvent) {
    return {
      allowed: false,
      reason: `Your ${plan.displayName} plan allows up to ${plan.maxAttendeesPerEvent} confirmed attendees per event.`,
      upgradeRequired: plan.name === 'free' ? 'standard' : plan.name === 'standard' ? 'pro' : 'business',
      currentUsage: currentCount,
      limit: plan.maxAttendeesPerEvent,
    };
  }
  return { allowed: true, currentUsage: currentCount, limit: plan.maxAttendeesPerEvent };
}

// ── Check active event cap ────────────────────────────────────────────────────
export async function canCreateEvent(
  userId: string,
  userEmail: string
): Promise<EnforcementResult> {
  if (isSuperAdmin(userEmail)) return { allowed: true };

  const { plan } = await getUserPlan(userId);
  if (!plan) return { allowed: false, reason: 'No active plan found' };
  if (plan.maxActiveEvents === -1) return { allowed: true };

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

  if (activeCount >= plan.maxActiveEvents) {
    return {
      allowed: false,
      reason: `Your ${plan.displayName} plan allows up to ${plan.maxActiveEvents} active event${plan.maxActiveEvents === 1 ? '' : 's'}.`,
      upgradeRequired: plan.name === 'free' ? 'standard' : plan.name === 'standard' ? 'pro' : 'business',
      currentUsage: activeCount,
      limit: plan.maxActiveEvents,
    };
  }
  return { allowed: true, currentUsage: activeCount, limit: plan.maxActiveEvents };
}

// ── Check waitlist access ─────────────────────────────────────────────────────
export async function canUseWaitlist(
  userId: string,
  userEmail: string
): Promise<EnforcementResult> {
  if (isSuperAdmin(userEmail)) return { allowed: true };
  const { plan } = await getUserPlan(userId);
  if (!plan?.hasWaitlist) {
    return {
      allowed: false,
      reason: 'Waitlist is not available on the Free plan.',
      upgradeRequired: 'standard',
    };
  }
  return { allowed: true };
}

// ── Check feature flags ───────────────────────────────────────────────────────
type PlanFeatureFlag =
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
