import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paystackFetch } from '@/lib/paystack'

// credits count → USD price in dollars (× 100 = cents for Paystack)
const CREDIT_PACKAGES: Record<number, number> = {
  100: 5,    // 100 credits = $5
  500: 22,   // 500 credits = $22 (save ~12%)
  1000: 40,  // 1,000 credits = $40 (save 20%)
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

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 503 })
    }

    const usdPrice = CREDIT_PACKAGES[credits]
    if (!usdPrice) {
      return NextResponse.json({ error: 'Invalid credit package' }, { status: 400 })
    }

    const data = await paystackFetch('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: session.user.email,
        amount: usdPrice * 100, // cents
        currency: 'USD',
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
