import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Paystack does not have a hosted billing portal.
    // Redirect to the in-app billing page instead.
    return NextResponse.json({ url: `${process.env.NEXTAUTH_URL}/dashboard/billing` })
  } catch (err) {
    console.error('[billing/portal] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
