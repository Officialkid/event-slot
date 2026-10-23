import { prisma } from '@/lib/prisma';
import { isAdminEmail } from '@/lib/isAdmin';

export async function getUserPlan(userId: string) {
  const now = new Date();
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      OR: [
        { status: 'ACTIVE' },
        { status: 'PAST_DUE', currentPeriodEnd: { gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) } },
      ],
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  if (!subscription) {
    // Fallback: return free plan
    const freePlan = await prisma.plan.findUnique({ where: { name: 'free' } });
    return { subscription: null, plan: freePlan };
  }

  return { subscription, plan: subscription.plan };
}

export async function isSubscriptionActive(userId: string): Promise<boolean> {
  const now = new Date();
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      OR: [
        { status: 'ACTIVE', currentPeriodEnd: { gte: now } },
        { status: 'PAST_DUE', currentPeriodEnd: { gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) } },
      ],
    },
  });
  return !!subscription;
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  return isAdminEmail(email);
}
