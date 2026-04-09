import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { paystackSubscriptionCode: true },
  })

  if (!user?.paystackSubscriptionCode) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 400 })
  }

  const subCode = user.paystackSubscriptionCode

  try {
    // Fetch subscription to retrieve email_token required by Paystack disable endpoint
    const fetchRes = await fetch(`https://api.paystack.co/subscription/${subCode}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    })
    const fetchData = await fetchRes.json()
    const emailToken: string | undefined = fetchData.data?.email_token

    if (!emailToken) {
      return NextResponse.json(
        { error: 'Could not retrieve subscription token. Please contact support.' },
        { status: 400 }
      )
    }

    const disableRes = await fetch('https://api.paystack.co/subscription/disable', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: subCode, token: emailToken }),
    })
    const disableData = await disableRes.json()

    if (!disableRes.ok) {
      return NextResponse.json(
        { error: disableData.message ?? 'Failed to cancel subscription' },
        { status: 400 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
