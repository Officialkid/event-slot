import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const filter = req.nextUrl.searchParams.get("filter") ?? "flagged"
  const page   = parseInt(req.nextUrl.searchParams.get("page") ?? "1")
  const limit  = 25

  const where = filter === "flagged" ? { flagged: true } : {}

  const [sessions, total, flaggedCount] = await Promise.all([
    prisma.assistantSession.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: { messages: { orderBy: { createdAt: "asc" } } },
    }),
    prisma.assistantSession.count({ where }),
    prisma.assistantSession.count({ where: { flagged: true } }),
  ])

  return NextResponse.json({ sessions, total, flaggedCount, page, limit })
}
