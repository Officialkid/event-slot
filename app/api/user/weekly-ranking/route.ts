import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getWeekKey } from "@/lib/leaderboard"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ show: false })

  const lastWeekKey = getWeekKey(new Date(Date.now() - 7 * 86_400_000))

  const n = await prisma.weeklyRankingNotification.findUnique({
    where: { userId_weekKey: { userId: session.user.id, weekKey: lastWeekKey } },
  })

  if (!n || n.seen) return NextResponse.json({ show: false })

  return NextResponse.json({ show: true, rank: n.rank, totalPts: n.totalPts, weekKey: lastWeekKey })
}
