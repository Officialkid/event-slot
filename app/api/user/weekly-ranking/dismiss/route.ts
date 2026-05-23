import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { weekKey, shared } = (await req.json()) as { weekKey: string; shared?: boolean }

  await prisma.weeklyRankingNotification.updateMany({
    where: { userId: session.user.id, weekKey },
    data: { seen: true, ...(shared ? { sharedAt: new Date() } : {}) },
  })

  return NextResponse.json({ ok: true })
}
