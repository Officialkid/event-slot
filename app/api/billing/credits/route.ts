import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paystackFetch } from '@/lib/paystack'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { creditAmount } = await req.json()

    if (!creditAmount || typeof creditAmount !== 'number' || creditAmount <= 0) {
      return NextResponse.json({ error: 'Invalid creditAmount' }, { status: 400 })
    }

    const data = await paystackFetch('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: session.user.email,
        amount: creditAmount * 100,
        currency: 'NGN',
        callback_url: `${process.env.NEXTAUTH_URL}/api/billing/verify`,
        metadata: {
          userId: session.user.id,
          type: 'credits',
          creditAmount,
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
