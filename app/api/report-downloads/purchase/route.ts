import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { REPORT_DOWNLOAD_PRICING } from '@/lib/plans'
import { billingRatelimit } from '@/lib/ratelimit'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: 'Sign in required' }, { status: 401 })
    }

    const { success: rlOk } = await billingRatelimit.limit(`rd-purchase:${session.user.id}`)
    if (!rlOk) {
      return Response.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 })
    }

    const { bundleKey } = await request.json()
    const bundle = REPORT_DOWNLOAD_PRICING[bundleKey as keyof typeof REPORT_DOWNLOAD_PRICING]

    if (!bundle) {
      return Response.json({ error: 'Invalid bundle' }, { status: 400 })
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return Response.json({ error: 'Payments are temporarily unavailable. Missing PAYSTACK_SECRET_KEY.' }, { status: 503 })
    }

    if (!process.env.NEXTAUTH_URL) {
      return Response.json({ error: 'Payments are temporarily unavailable. Missing NEXTAUTH_URL.' }, { status: 503 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true },
    })

    const checkoutEmail = session.user.email ?? user?.email
    if (!checkoutEmail) {
      return Response.json({ error: 'Your account is missing an email address for payment checkout.' }, { status: 400 })
    }

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: checkoutEmail,
        amount: bundle.amount * 100,
        currency: 'KES',
        callback_url: `${process.env.NEXTAUTH_URL}/api/report-downloads/verify`,
        metadata: {
          userId: session.user.id,
          bundleKey,
          downloads: bundle.downloads,
          bundle,
          type: 'report_download',
        },
      }),
    })

    const data = await response.json().catch(() => ({} as { status?: boolean; message?: string; data?: { authorization_url?: string } }))

    if (!response.ok) {
      const message = data?.message || 'Unable to initialize payment at the moment.'
      return Response.json({ error: message }, { status: 502 })
    }

    if (!data.status) {
      return Response.json({ error: data.message || 'Unable to initialize payment.' }, { status: 500 })
    }

    return Response.json({ url: data.data?.authorization_url })
  } catch (error) {
    console.error('[report-downloads/purchase]', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
