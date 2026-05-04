import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { REPORT_DOWNLOAD_PRICING } from '@/lib/plans'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return Response.json({ error: 'Sign in required' }, { status: 401 })
    }

    const { bundleKey } = await request.json()
    const bundle = REPORT_DOWNLOAD_PRICING[bundleKey as keyof typeof REPORT_DOWNLOAD_PRICING]

    if (!bundle) {
      return Response.json({ error: 'Invalid bundle' }, { status: 400 })
    }

    await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true },
    })

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: session.user.email,
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

    const data = await response.json()
    if (!data.status) {
      return Response.json({ error: data.message }, { status: 500 })
    }

    return Response.json({ url: data.data.authorization_url })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
