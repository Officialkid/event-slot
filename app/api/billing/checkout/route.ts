import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paystack } from '@/lib/paystack'

const PLAN_CODES: Record<string, Record<string, string>> = {
  pro: {
    monthly: process.env.PAYSTACK_PRO_MONTHLY_PLAN_CODE!,
    annual: process.env.PAYSTACK_PRO_ANNUAL_PLAN_CODE!,
  },
  business: {
    monthly: process.env.PAYSTACK_BUSINESS_MONTHLY_PLAN_CODE!,
    annual: process.env.PAYSTACK_BUSINESS_ANNUAL_PLAN_CODE!,
  },
}

const PLAN_AMOUNTS: Record<string, Record<string, number>> = {
  pro: { monthly: 2000, annual: 19200 },
  business: { monthly: 10000, annual: 96000 },
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan, billingCycle } = await req.json()

    if (!plan || !billingCycle || !PLAN_CODES[plan]?.[billingCycle]) {
      return NextResponse.json({ error: 'Invalid plan or billingCycle' }, { status: 400 })
    }

    const planCode = PLAN_CODES[plan][billingCycle]
    const amount = PLAN_AMOUNTS[plan][billingCycle]

    const transaction = await paystack.transaction.initialize({
      email: session.user.email,
      amount,
      plan: planCode,
      callback_url: `${process.env.NEXTAUTH_URL}/dashboard/billing?success=true&plan=${plan}`,
      metadata: {
        userId: session.user.id,
        planCode,
        billingCycle,
      },
    })

    return NextResponse.json({ url: transaction.data.authorization_url })
  } catch (err) {
    console.error('[billing/checkout]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
