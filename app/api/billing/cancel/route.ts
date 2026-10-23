import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { paystackSubscriptionCode: true, planEndDate: true, plan: true },
    })

    const subscription = await prisma.subscription.findFirst({
      where: { userId: session.user.id },
      orderBy: { updatedAt: 'desc' },
    })

    const now = new Date()
    const subCode = user?.paystackSubscriptionCode

    // 1. If active Paystack subscription code exists, disable recurring billing on Paystack
    if (subCode && process.env.PAYSTACK_SECRET_KEY) {
      try {
        const fetchRes = await fetch(`https://api.paystack.co/subscription/${encodeURIComponent(subCode)}`, {
          headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
        })
        const fetchData = await fetchRes.json()
        const emailToken: string | undefined = fetchData.data?.email_token

        if (emailToken) {
          await fetch('https://api.paystack.co/subscription/disable', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: subCode, token: emailToken }),
          })
        }
      } catch (paystackErr) {
        console.warn('[billing/cancel] Error disabling remote Paystack subscription:', paystackErr)
      }
    }

    // 2. Determine whether remaining paid period exists
    const effectiveEnd = subscription?.currentPeriodEnd || user?.planEndDate || null
    const hasRemainingPeriod = effectiveEnd ? effectiveEnd.getTime() > now.getTime() : false

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelledAt: now,
          status: hasRemainingPeriod ? 'ACTIVE' : 'CANCELLED',
        },
      })
    }

    if (hasRemainingPeriod) {
      // User keeps paid plan benefits through the remainder of their paid period
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          paystackSubscriptionCode: null,
        },
      })
    } else {
      // Immediate downgrade if no remaining paid period
      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          plan: 'free',
          billingCycle: null,
          planEndDate: null,
          paystackSubscriptionCode: null,
        },
      })
    }

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: 'SUBSCRIPTION_CANCELLED',
        metadata: {
          subCode,
          hasRemainingPeriod,
          effectiveEnd: effectiveEnd?.toISOString(),
        },
      },
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      hasRemainingPeriod,
      effectiveEnd: effectiveEnd?.toISOString(),
      message: hasRemainingPeriod
        ? `Your subscription has been cancelled. Your benefits remain active until ${effectiveEnd?.toLocaleDateString()}.`
        : 'Your subscription has been cancelled and your plan has been returned to Free.',
    })
  } catch (err) {
    console.error('[billing/cancel] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
