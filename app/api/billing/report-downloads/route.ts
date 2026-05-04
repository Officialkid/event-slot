import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paystackFetch } from '@/lib/paystack'
import { REPORT_DOWNLOAD_PRICING } from '@/lib/plans'

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
    const bundleKey = String(body?.bundleKey ?? '') as keyof typeof REPORT_DOWNLOAD_PRICING
    const bundle = REPORT_DOWNLOAD_PRICING[bundleKey]

    if (!bundle) {
      return NextResponse.json({ error: 'Invalid download package' }, { status: 400 })
    }

    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/billing/verify`

    const data = await paystackFetch('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify({
        email: session.user.email,
        amount: bundle.amount * 100,
        currency: 'KES',
        callback_url: callbackUrl,
        metadata: {
          userId: session.user.id,
          type: 'report_download',
          bundleKey,
          downloads: bundle.downloads,
        },
      }),
    })

    if (!data.status) {
      console.error('[billing/report-downloads] Paystack error:', data.message)
      return NextResponse.json({ error: data.message ?? 'Paystack error' }, { status: 502 })
    }

    return NextResponse.json({
      url: data.data.authorization_url,
      bundle: {
        key: bundleKey,
        amount: bundle.amount,
        downloads: bundle.downloads,
      },
    })
  } catch (err) {
    console.error('[billing/report-downloads]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
