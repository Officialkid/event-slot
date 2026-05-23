import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getWeekKey } from "@/lib/leaderboard"

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const lastWeekKey = getWeekKey(new Date(Date.now() - 7 * 86_400_000))

  const entries = await prisma.leaderboardEntry.findMany({
    where: { period: lastWeekKey, totalPts: { gt: 0 } },
    orderBy: { totalPts: "desc" },
  })

  let created = 0
  for (let i = 0; i < entries.length; i++) {
    await prisma.weeklyRankingNotification.upsert({
      where: { userId_weekKey: { userId: entries[i].userId, weekKey: lastWeekKey } },
      update: {},
      create: {
        userId: entries[i].userId,
        weekKey: lastWeekKey,
        rank: i + 1,
        totalPts: entries[i].totalPts,
      },
    })
    created++
  }

  return NextResponse.json({ created, weekKey: lastWeekKey })
}
