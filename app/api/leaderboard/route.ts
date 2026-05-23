import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getWeekKey, getMonthKey } from '@/lib/leaderboard'

export async function GET(req: NextRequest) {
  const period = req.nextUrl.searchParams.get('period') ?? 'week'
  const type = req.nextUrl.searchParams.get('type') ?? 'overall'
  const now = new Date()

  const periodKey =
    period === 'week'  ? getWeekKey(now)
    : period === 'month' ? getMonthKey(now)
    : 'all-time'

  const sortField =
    type === 'referral'  ? 'referralPts'
    : type === 'organiser' ? 'organiserPts'
    : 'totalPts'

  const entries = await prisma.leaderboardEntry.findMany({
    where: { period: periodKey },
    orderBy: { [sortField]: 'desc' },
    take: 50,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          badges: { select: { badge: true } },
        },
      },
    },
  })

  return NextResponse.json({
    period: periodKey,
    type,
    entries: entries.map((e, i) => ({
      rank: i + 1,
      userId: e.userId,
      name: e.user.name,
      avatar: e.user.image,
      badges: e.user.badges.map(b => b.badge),
      referralPts: e.referralPts,
      organiserPts: e.organiserPts,
      totalPts: e.totalPts,
    })),
  })
}
