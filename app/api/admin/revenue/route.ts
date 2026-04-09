import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

function isSuperAdmin(email: string | null | undefined) {
  return email && email === process.env.SUPER_ADMIN_EMAIL
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!isSuperAdmin(session?.user?.email)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // Build last 12 month buckets
    const months: { start: Date; end: Date; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      months.push({ start: d, end, label })
    }

    const [
      purchaseTxs,
      spendTxs,
      proSubscribers,
      businessSubscribers,
      newPaidThisMonth,
      churnedThisMonth,
    ] = await Promise.all([
      // All credit purchase transactions (positive amounts — top-ups)
      prisma.creditTransaction.findMany({
        where: { type: 'purchase' },
        select: { amount: true, createdAt: true },
      }),
      // All credit spend transactions (negative amounts — feature unlocks)
      prisma.creditTransaction.findMany({
        where: { type: { not: 'purchase' } },
        select: { amount: true },
      }),
      prisma.user.count({ where: { plan: 'pro' } }),
      prisma.user.count({ where: { plan: 'business' } }),
      // Users who upgraded to paid this month (planStartDate this month)
      prisma.user.count({
        where: {
          plan: { in: ['pro', 'business'] },
          planStartDate: { gte: startOfMonth },
        },
      }),
      // Users who downgraded: plan = free but planEndDate this month (recently cancelled)
      prisma.user.count({
        where: {
          plan: 'free',
          planEndDate: { gte: startOfMonth, lt: now },
        },
      }),
    ])

    const totalCreditsPurchased = purchaseTxs.reduce((s, t) => s + t.amount, 0)
    const totalCreditsSpent = spendTxs.reduce((s, t) => s + Math.abs(t.amount), 0)
    const creditRevenueTotal = totalCreditsPurchased // $1 = 1 credit

    const estimatedMRR = proSubscribers * 20 + businessSubscribers * 100

    // Group purchases by month for chart
    const revenueByMonth = months.map(({ start, end, label }) => {
      const revenue = purchaseTxs
        .filter(t => t.createdAt >= start && t.createdAt < end)
        .reduce((s, t) => s + t.amount, 0)
      return { month: label, revenue }
    })

    return NextResponse.json({
      totalCreditsPurchased,
      totalCreditsSpent,
      creditRevenueTotal,
      proSubscribers,
      businessSubscribers,
      estimatedMRR,
      newPaidThisMonth,
      churnedThisMonth,
      creditsByMonth: revenueByMonth,
    })
  } catch (err) {
    console.error('[admin/revenue] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
