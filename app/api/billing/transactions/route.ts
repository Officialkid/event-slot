import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [user, raw] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { creditBalance: true },
    }),
    prisma.creditTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, amount: true, type: true, description: true, createdAt: true },
    }),
  ])

  const currentBalance = user?.creditBalance ?? 0

  // Compute per-row running balance (ascending pass, then reverse for display)
  const asc = [...raw].reverse()
  const totalInList = asc.reduce((sum, t) => sum + t.amount, 0)
  let running = currentBalance - totalInList

  const transactions = asc
    .map(tx => {
      running += tx.amount
      return {
        ...tx,
        createdAt: tx.createdAt.toISOString(),
        balance: Math.round(running * 100) / 100,
      }
    })
    .reverse()

  return NextResponse.json({ transactions })
}
