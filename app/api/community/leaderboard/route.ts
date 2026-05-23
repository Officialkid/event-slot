import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getWeekKey, getMonthKey } from "@/lib/leaderboard"

type Period = "weekly" | "monthly" | "alltime"

function resolvePeriod(value: string | null): Period {
  if (value === "monthly") return "monthly"
  if (value === "alltime") return "alltime"
  return "weekly"
}

function toPeriodKey(period: Period): string {
  const now = new Date()
  if (period === "monthly") return getMonthKey(now)
  if (period === "alltime") return "all-time"
  return getWeekKey(now)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const period = resolvePeriod(req.nextUrl.searchParams.get("period"))
  const periodKey = toPeriodKey(period)

  const top10 = await prisma.leaderboardEntry.findMany({
    where: { period: periodKey },
    orderBy: { totalPts: "desc" },
    take: 10,
    select: {
      userId: true,
      totalPts: true,
      overallRank: true,
      user: {
        select: {
          name: true,
          image: true,
          pioneerBadge: { select: { id: true } },
          badges: { select: { badge: true } },
        },
      },
    },
  })

  let ownRank: number | null = null
  let ownScore: number | null = null

  if (session?.user?.id) {
    const ownEntry = await prisma.leaderboardEntry.findUnique({
      where: { userId_period: { userId: session.user.id, period: periodKey } },
      select: { totalPts: true, overallRank: true },
    })
    if (ownEntry) {
      ownRank = ownEntry.overallRank
      ownScore = ownEntry.totalPts
    }
  }

  return NextResponse.json({
    period,
    top10: top10.map((entry, index) => ({
      rank: entry.overallRank ?? index + 1,
      name: entry.user.name ?? "EventSlot User",
      avatar: entry.user.image,
      score: entry.totalPts,
      isPioneer: !!entry.user.pioneerBadge,
      badges: entry.user.badges.map((b) => b.badge),
    })),
    ownRank,
    ownScore,
  })
}
