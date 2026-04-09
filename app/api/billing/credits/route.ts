import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paystack } from '@/lib/paystack'

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

    const transaction = await paystack.transaction.initialize({
      email: session.user.email,
      amount: creditAmount * 100,
      callback_url: `${process.env.NEXTAUTH_URL}/dashboard/billing?credits=added`,
      metadata: {
        userId: session.user.id,
        type: 'credits',
      },
    })

    return NextResponse.json({ url: transaction.data.authorization_url })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
