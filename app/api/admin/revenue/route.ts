import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isAdminEmail } from '@/lib/isAdmin'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const now = new Date()
    const monthStart     = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

    // Build last 12 month buckets
    const months: { start: Date; end: Date; label: string }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      months.push({ start: d, end, label })
    }

    const [purchaseTxs, spendTxs,
      totalTokensPurchasedAgg,
      tokensThisMonthAgg,
      tokensLastMonthAgg,
      tokensOnDocumentsAgg,
      tokensOnVoiceAgg,
      totalTokensSpentAgg,
      totalTokensHeldAgg,
      monthlyTokenPurchases,
      uniqueBuyers,
    ] = await Promise.all([
      // ── Existing credits data ────────────────────────────
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

      // ── Token economy data ───────────────────────────────
      prisma.tokenTransaction.aggregate({
        where: { type: 'PURCHASE' },
        _sum: { amount: true },
      }),
      prisma.tokenTransaction.aggregate({
        where: { type: 'PURCHASE', createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.tokenTransaction.aggregate({
        where: { type: 'PURCHASE', createdAt: { gte: lastMonthStart, lt: monthStart } },
        _sum: { amount: true },
      }),
      prisma.tokenTransaction.aggregate({
        where: { type: 'DEBIT', description: { contains: 'Document' } },
        _sum: { amount: true },
      }),
      prisma.tokenTransaction.aggregate({
        where: { type: 'DEBIT', description: { contains: 'Voice' } },
        _sum: { amount: true },
      }),
      prisma.tokenTransaction.aggregate({
        where: { type: 'DEBIT' },
        _sum: { amount: true },
      }),
      prisma.tokenBalance.aggregate({ _sum: { balance: true } }),
      prisma.$queryRaw<{ month: string; tokens: number; ksh: number }[]>`
        SELECT
          TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') AS month,
          SUM(amount)::int AS tokens,
          (SUM(amount) * 5)::int AS ksh
        FROM "TokenTransaction"
        WHERE type = 'PURCHASE'
          AND "createdAt" >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', "createdAt")
        ORDER BY DATE_TRUNC('month', "createdAt") ASC
      `,
      prisma.tokenTransaction.groupBy({
        by: ['userId'],
        where: { type: 'PURCHASE' },
      }),
    ])

    const proSubscribers = 0
    const businessSubscribers = 0
    const newPaidThisMonth = 0
    const churnedThisMonth = 0

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

    // ── Token economy calculations ───────────────────────
    const totalPurchasedTokens  = totalTokensPurchasedAgg._sum.amount ?? 0
    const totalRevenueKsh        = totalPurchasedTokens * 5
    const thisMonthKsh           = (tokensThisMonthAgg._sum.amount ?? 0) * 5
    const lastMonthKsh           = (tokensLastMonthAgg._sum.amount ?? 0) * 5

    const revenueChangePercent = lastMonthKsh > 0
      ? ((thisMonthKsh - lastMonthKsh) / lastMonthKsh * 100).toFixed(1)
      : thisMonthKsh > 0 ? '+100' : '0'

    return NextResponse.json({
      // Existing credit revenue
      totalCreditsPurchased,
      totalCreditsSpent,
      creditRevenueTotal,
      proSubscribers,
      businessSubscribers,
      estimatedMRR,
      newPaidThisMonth,
      churnedThisMonth,
      creditsByMonth: revenueByMonth,

      // Token economy
      totalRevenueKsh,
      thisMonthKsh,
      lastMonthKsh,
      revenueChangePercent,
      totalTokensPurchased: totalPurchasedTokens,
      totalTokensSpent: Math.abs(totalTokensSpentAgg._sum.amount ?? 0),
      totalTokensHeld: totalTokensHeldAgg._sum.balance ?? 0,
      tokensOnDocuments: Math.abs(tokensOnDocumentsAgg._sum.amount ?? 0),
      tokensOnVoice: Math.abs(tokensOnVoiceAgg._sum.amount ?? 0),
      uniqueBuyerCount: uniqueBuyers.length,
      monthlyPurchases: monthlyTokenPurchases,
    })
  } catch (err) {
    console.error('[admin/revenue] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
