import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getWeekKey } from "@/lib/leaderboard"

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  // Runs on Monday — award badges for the week that just ended (previous week key)
  const prevWeekDate = new Date(now)
  prevWeekDate.setUTCDate(prevWeekDate.getUTCDate() - 7)
  const weekKey = getWeekKey(prevWeekDate)

  const topThisWeek = await prisma.leaderboardEntry.findMany({
    where: { period: weekKey },
    orderBy: { totalPts: "desc" },
    take: 10,
    select: { userId: true },
  })

  for (const entry of topThisWeek) {
    await prisma.userBadge.upsert({
      where: { userId_badge: { userId: entry.userId, badge: "COMMUNITY_CHAMPION" } },
      create: { userId: entry.userId, badge: "COMMUNITY_CHAMPION" },
      update: {},
    })
  }

  const top3 = topThisWeek.slice(0, 3)
  for (const entry of top3) {
    await prisma.userBadge.upsert({
      where: { userId_badge: { userId: entry.userId, badge: "HALL_OF_FAME" } },
      create: { userId: entry.userId, badge: "HALL_OF_FAME" },
      update: {},
    })

    await prisma.notification.create({
      data: {
        userId: entry.userId,
        type: "PLATFORM",
        title: "Hall of Fame!",
        message:
          "You finished in the top 3 on this week's EventSlot leaderboard. You've been added to the Hall of Fame.",
        link: "/dashboard/community",
      },
    })
  }

  const isFirstMondayOfMonth = now.getUTCDate() <= 7

  return NextResponse.json({
    success: true,
    weeklyBadgesAwarded: topThisWeek.length,
    hallOfFameAwarded: top3.length,
    monthlyReset: isFirstMondayOfMonth,
    weekKey,
    timestamp: now.toISOString(),
  })
}
