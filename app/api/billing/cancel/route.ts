import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { paystackSubscriptionCode: true },
    })

    if (!user?.paystackSubscriptionCode) {
      // No subscription code — downgrade locally (handles manual upgrades or partial webhook state)
      await prisma.user.update({
        where: { id: session.user.id },
        data: { plan: 'free', billingCycle: null, planEndDate: null, paystackSubscriptionCode: null },
      })
      return NextResponse.json({ success: true })
    }

    const subCode = user.paystackSubscriptionCode

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

    await prisma.user.update({
      where: { id: session.user.id },
      data: { plan: 'free', billingCycle: null, planEndDate: null, paystackSubscriptionCode: null },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[billing/cancel] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
