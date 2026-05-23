import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    const [badges, pioneerBadge] = await Promise.all([
      prisma.userBadge.findMany({
        where: { userId },
        select: { badge: true },
        orderBy: { awardedAt: "asc" },
      }),
      prisma.pioneerBadge.findUnique({
        where: { userId },
        select: { id: true },
      }),
    ])

    return NextResponse.json({
      badges: badges.map((b) => b.badge),
      hasPioneer: !!pioneerBadge,
    })
  } catch {
    return NextResponse.json({ badges: [], hasPioneer: false })
  }
}
