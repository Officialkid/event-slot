import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { isAdminEmail } from "@/lib/isAdmin"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const filter = searchParams.get("filter") ?? "all"

    const where =
      filter === "feedback"
        ? { type: "USER_FEEDBACK" as const }
        : filter === "broadcast"
          ? { type: "ADMIN_BROADCAST" as const }
          : {}

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    const [totalCount, feedbackCount, broadcastCount] = await Promise.all([
      prisma.message.count({ where }),
      prisma.message.count({ where: { type: "USER_FEEDBACK" } }),
      prisma.message.count({ where: { type: "ADMIN_BROADCAST" } }),
    ])

    return NextResponse.json({
      messages,
      totalCount,
      feedbackCount,
      broadcastCount,
    })
  } catch (err) {
    console.error("[admin/messages] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH() {
  return NextResponse.json({ error: "Message state flags were removed" }, { status: 405 })
}
