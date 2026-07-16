import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(req: NextRequest) {
  void req
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json(
      {
        error: 'Subscription plans and report bundles are temporarily disabled while premium billing is being introduced.',
        code: 'ENDPOINT_DEPRECATED',
      },
      { status: 410 }
    )
  } catch (err) {
    console.error('[billing/checkout]', err)
    return NextResponse.json({ error: 'Unable to initialize payment right now.' }, { status: 502 })
  }
}
