import { prisma } from '@/lib/prisma';

export async function getUserPlan(userId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
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
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: 'ACTIVE',
      currentPeriodEnd: { gte: new Date() },
    },
  });
  return !!subscription;
}

// Super admins bypass all plan limits
export const SUPER_ADMIN_EMAILS = [
  process.env.SUPERADMIN_EMAIL_1 ?? '',
  process.env.SUPERADMIN_EMAIL_2 ?? '',
];

export function isSuperAdmin(email: string | null | undefined): boolean {
  return SUPER_ADMIN_EMAILS.includes(email ?? '');
}
