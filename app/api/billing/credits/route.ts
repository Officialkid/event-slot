import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paystackFetch } from '@/lib/paystack'
import { CREDIT_BUNDLES } from '@/lib/credits'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 503 })
    }

    const body = await req.json()

    // Support both { bundleId } and legacy { credits } formats
    let bundle = CREDIT_BUNDLES.find(b => b.id === body.bundleId)
    if (!bundle && typeof body.credits === 'number') {
      bundle = CREDIT_BUNDLES.find(b => b.credits === body.credits)
    }
    if (!bundle) {
      return NextResponse.json({ error: 'Invalid credit package' }, { status: 400 })
    }

    const data = await paystackFetch('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: session.user.email,
        amount: bundle.kesPrice * 100, // KES kobo
        currency: 'KES',
        callback_url: `${process.env.NEXTAUTH_URL}/api/billing/verify`,
        metadata: {
          userId: session.user.id,
          type: 'credits',
          creditAmount: bundle.credits,
          bundleId: bundle.id,
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
