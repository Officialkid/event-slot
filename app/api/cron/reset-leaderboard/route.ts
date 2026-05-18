import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  const weekStart = new Date(now)
  const day = weekStart.getUTCDay()
  const offset = day === 0 ? 6 : day - 1
  weekStart.setUTCDate(weekStart.getUTCDate() - offset)
  weekStart.setUTCHours(0, 0, 0, 0)

  const topThisWeek = await prisma.leaderboardEntry.findMany({
    orderBy: { weeklyScore: "desc" },
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

  await prisma.leaderboardEntry.updateMany({
    data: { weeklyScore: 0, weekStart },
  })

  const isFirstMondayOfMonth = weekStart.getUTCDate() <= 7
  if (isFirstMondayOfMonth) {
    await prisma.leaderboardEntry.updateMany({
      data: { monthlyScore: 0 },
    })
  }

  return NextResponse.json({
    success: true,
    weeklyReset: true,
    monthlyReset: isFirstMondayOfMonth,
    top10Awarded: topThisWeek.length,
    timestamp: now.toISOString(),
  })
}
