import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paystackFetch } from '@/lib/paystack'

// credits count → KES price in Kenyan Shillings (× 100 = cents for Paystack)
// Conversion: 100 KSH = 10 points (so 1 point = 10 KSH)
const CREDIT_PACKAGES: Record<number, number> = {
  100: 1000,   // 100 points = Ksh 1,000
  500: 4500,   // 500 points = Ksh 4,500 (save 10%)
  1000: 8000,  // 1,000 points = Ksh 8,000 (save 20%)
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

    const kesPrice = CREDIT_PACKAGES[credits]
    if (!kesPrice) {
      return NextResponse.json({ error: 'Invalid credit package' }, { status: 400 })
    }

    const data = await paystackFetch('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: session.user.email,
        amount: kesPrice * 100, // KES cents
        currency: 'KES',
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
