import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { hasAdminAccess } from "@/lib/isAdmin"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const filterParam = req.nextUrl.searchParams.get("filter")
    const filter = filterParam === "all" ? "all" : "flagged"
    const parsedPage = Number.parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10)
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1
    const limit = 25

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
  } catch (error) {
    // Compatibility fallback for environments with partially migrated assistant schema.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
      return NextResponse.json(
        {
          sessions: [],
          total: 0,
          flaggedCount: 0,
          page: 1,
          limit: 25,
          error: "Assistant sessions schema is out of sync. Run prisma migrate deploy.",
          success: false,
        },
        { status: 200 }
      )
    }

    console.error("[admin/assistant-sessions] GET error:", error)
    return NextResponse.json(
      {
        sessions: [],
        total: 0,
        flaggedCount: 0,
        page: 1,
        limit: 25,
        error: "Failed to load assistant sessions.",
      },
      { status: 500 }
    )
  }
}
