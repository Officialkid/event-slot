import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { purchaseFeatureAccess, CREDIT_COSTS } from '@/lib/credits'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const userId = session.user.id
    const body = await req.json()
    const { feature, eventId } = body as { feature: string; eventId?: string }

    if (!feature || !(feature in CREDIT_COSTS)) {
      return NextResponse.json({ error: 'Invalid feature' }, { status: 400 })
    }

    const result = await purchaseFeatureAccess({
      userId,
      feature: feature as keyof typeof CREDIT_COSTS,
      eventId,
    })

    if (!result.success) {
      // Get current balance to return in error response
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      })
      return NextResponse.json(
        { success: false, error: result.error, creditsRemaining: user?.creditBalance ?? 0 },
        { status: 402 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    })

    return NextResponse.json({
      success: true,
      accessId: result.accessId,
      creditsRemaining: user?.creditBalance ?? 0,
    })
  } catch (err) {
    console.error('[features/unlock]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
