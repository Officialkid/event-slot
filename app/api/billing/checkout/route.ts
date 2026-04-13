import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paystackFetch } from '@/lib/paystack'

// Amounts in KES (Kenyan Shillings) at ~130 KES/USD.
// Target: Pro $20/mo, Business $100/mo.
const PLAN_AMOUNTS: Record<string, Record<string, number>> = {
  pro: { monthly: 2600, annual: 25000 },      // $20/mo · $192/yr
  business: { monthly: 13000, annual: 125000 }, // $100/mo · $960/yr
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { plan, billingCycle } = await req.json()

    if (!plan || !billingCycle || !PLAN_AMOUNTS[plan]?.[billingCycle]) {
      return NextResponse.json({ error: 'Invalid plan or billingCycle' }, { status: 400 })
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 503 })
    }

    const amount = PLAN_AMOUNTS[plan][billingCycle]

    const data = await paystackFetch('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: session.user.email,
        amount: amount * 100, // KES cents
        currency: 'KES',
        callback_url: `${process.env.NEXTAUTH_URL}/api/billing/verify`,
        metadata: {
          userId: session.user.id,
          plan,
          billingCycle,
          type: 'plan',
        },
      }),
    })

    if (!data.status) {
      console.error('[billing/checkout] Paystack error:', data.message)
      return NextResponse.json({ error: data.message ?? 'Paystack error' }, { status: 500 })
    }

    return NextResponse.json({ url: data.data.authorization_url })
  } catch (err) {
    console.error('[billing/checkout]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
