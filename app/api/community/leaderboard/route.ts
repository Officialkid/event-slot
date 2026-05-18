import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type Period = "weekly" | "monthly" | "alltime"

function resolvePeriod(value: string | null): Period {
  if (value === "monthly") return "monthly"
  if (value === "alltime") return "alltime"
  return "weekly"
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const period = resolvePeriod(req.nextUrl.searchParams.get("period"))

  const scoreField =
    period === "monthly" ? "monthlyScore" : period === "alltime" ? "allTimeScore" : "weeklyScore"

  const top10 = await prisma.leaderboardEntry.findMany({
    orderBy: { [scoreField]: "desc" },
    take: 10,
    select: {
      weeklyScore: true,
      monthlyScore: true,
      allTimeScore: true,
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
    const allEntries = await prisma.leaderboardEntry.findMany({
      orderBy: { [scoreField]: "desc" },
      select: {
        userId: true,
        weeklyScore: true,
        monthlyScore: true,
        allTimeScore: true,
      },
    })

    const index = allEntries.findIndex((e) => e.userId === session.user.id)
    if (index !== -1) {
      ownRank = index + 1
      ownScore = allEntries[index][scoreField]
    }
  }

  return NextResponse.json({
    period,
    top10: top10.map((entry, index) => ({
      rank: index + 1,
      name: entry.user.name ?? "EventSlot User",
      avatar: entry.user.image,
      score: entry[scoreField],
      isPioneer: !!entry.user.pioneerBadge,
      badges: entry.user.badges.map((b) => b.badge),
    })),
    ownRank,
    ownScore,
  })
}
