import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paystackFetch } from '@/lib/paystack'

// credits count → NGN price in naira (× 100 = kobo for Paystack)
const CREDIT_PACKAGES: Record<number, number> = {
  100: 10000,   // 100 credits = ₦10,000
  500: 45000,   // 500 credits = ₦45,000 (10% off)
  1000: 80000,  // 1,000 credits = ₦80,000 (20% off)
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { credits } = await req.json()

    if (!credits || typeof credits !== 'number') {
      return NextResponse.json({ error: 'Invalid credit package' }, { status: 400 })
    }

    const ngnPrice = CREDIT_PACKAGES[credits]
    if (!ngnPrice) {
      return NextResponse.json({ error: 'Invalid credit package' }, { status: 400 })
    }

    const data = await paystackFetch('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: session.user.email,
        amount: ngnPrice * 100, // kobo
        currency: 'NGN',
        callback_url: `${process.env.NEXTAUTH_URL}/api/billing/verify`,
        metadata: {
          userId: session.user.id,
          type: 'credits',
          creditAmount: credits, // number of credits to add to balance
        },
      }),
    })

    if (!data.status) {
      console.error('[billing/credits] Paystack error:', data.message)
      return NextResponse.json({ error: data.message ?? 'Paystack error' }, { status: 500 })
    }

    return NextResponse.json({ url: data.data.authorization_url })
  } catch (err) {
    console.error('[billing/credits]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
