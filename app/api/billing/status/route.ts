import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getSubscriptionPlan } from '@/lib/subscriptionPlans'
import { getSubscriberMigrationStatus } from '@/lib/subscriptionMigration'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [user, subscription, migration] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          plan: true,
          billingCycle: true,
          planEndDate: true,
          paystackSubscriptionCode: true,
          paystackCustomerCode: true,
          creditBalance: true,
        },
      }),
      prisma.subscription.findFirst({
        where: { userId: session.user.id },
        orderBy: { updatedAt: 'desc' },
        include: { plan: true },
      }),
      getSubscriberMigrationStatus(session.user.id),
    ])

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const planDefinition = getSubscriptionPlan(user.plan)

    return NextResponse.json({
      plan: user.plan,
      billingCycle: user.billingCycle,
      planEndDate: user.planEndDate?.toISOString() ?? null,
      paystackSubscriptionCode: user.paystackSubscriptionCode,
      creditBalance: user.creditBalance,
      planDetails: {
        name: planDefinition.name,
        monthlyPriceUsd: planDefinition.monthlyPriceUsd,
        annualPriceUsd: planDefinition.annualPriceUsd,
        commissionRate: planDefinition.commissionRate,
        highlights: planDefinition.highlights,
      },
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            paymentProvider: subscription.paymentProvider,
            currentPeriodStart: subscription.currentPeriodStart.toISOString(),
            currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
            cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
          }
        : null,
      migration,
    })
  } catch (err) {
    console.error('[billing/status] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
