import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasAdminAccess } from '@/lib/isAdmin'
import { getEffectivePlanPolicy } from '@/lib/effectivePlanPolicy'
import { getPricingRolloutLabel, isPricingRolloutActive } from '@/lib/pricingRollout'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        plan: true,
        creditBalance: true,
        paygSettings: {
          select: {
            isEnabled: true,
            monthlyCapUsd: true,
            mpesaPhone: true,
            billingAuthorizationAccepted: true,
            billingAuthorizedAt: true,
            cardholderName: true,
            billingCardBrand: true,
            billingCardLast4: true,
            billingCardExpiryMonth: true,
            billingCardExpiryYear: true,
          },
        },
      },
    })
    const isAdmin = hasAdminAccess(session)
    const plan = user?.plan ?? 'free'
    const policy = getEffectivePlanPolicy(plan)
    return NextResponse.json({
      plan,
      creditBalance: user?.creditBalance ?? 0,
      isAdmin,
      pricingActive: isPricingRolloutActive(),
      pricingStartsAtLabel: getPricingRolloutLabel(),
      planLimits: {
        maxAttendeesPerEvent: policy.maxAttendeesPerEvent,
        maxActiveEvents: policy.maxActiveEvents,
        maxWaitlistPerEvent: policy.maxWaitlistPerEvent,
        hasWaitlist: policy.hasWaitlist,
      },
      payg: user?.paygSettings ?? {
        isEnabled: false,
        monthlyCapUsd: 10,
        mpesaPhone: null,
        billingAuthorizationAccepted: false,
        billingAuthorizedAt: null,
        cardholderName: null,
        billingCardBrand: null,
        billingCardLast4: null,
        billingCardExpiryMonth: null,
        billingCardExpiryYear: null,
      },
    })
  } catch (err) {
    console.error('[me] GET error:', err)
    // Return safe defaults when DB is unavailable (e.g. Neon free tier paused)
    return NextResponse.json({
      plan: 'free',
      creditBalance: 0,
      isAdmin: false,
      pricingActive: isPricingRolloutActive(),
      pricingStartsAtLabel: getPricingRolloutLabel(),
      planLimits: {
        maxAttendeesPerEvent: -1,
        maxActiveEvents: -1,
        maxWaitlistPerEvent: -1,
        hasWaitlist: true,
      },
      payg: {
        isEnabled: false,
        monthlyCapUsd: 10,
        mpesaPhone: null,
        billingAuthorizationAccepted: false,
        billingAuthorizedAt: null,
        cardholderName: null,
        billingCardBrand: null,
        billingCardLast4: null,
        billingCardExpiryMonth: null,
        billingCardExpiryYear: null,
      },
    })
  }
}
