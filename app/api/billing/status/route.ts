import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      plan: true,
      billingCycle: true,
      planEndDate: true,
      paystackSubscriptionCode: true,
      creditBalance: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  return NextResponse.json({
    plan: user.plan,
    billingCycle: user.billingCycle,
    planEndDate: user.planEndDate?.toISOString() ?? null,
    paystackSubscriptionCode: user.paystackSubscriptionCode,
    creditBalance: user.creditBalance,
  })
}
