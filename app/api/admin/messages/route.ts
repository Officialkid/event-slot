import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasAdminAccess } from "@/lib/isAdmin"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { searchParams } = new URL(req.url)
    const filter = searchParams.get("filter") ?? "all"

    const where =
      filter === "feedback"
        ? { type: "USER_FEEDBACK" as const }
        : filter === "announcement"
          ? { type: "ADMIN_BROADCAST" as const, authorId: null, isPublic: true }
          : filter === "email-broadcast"
            ? { type: "ADMIN_BROADCAST" as const, authorId: { not: null } }
            : filter === "platform"
              ? { type: "ADMIN_BROADCAST" as const }
              : {}

    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    const [totalCount, feedbackCount, platformCount, announcementCount, emailBroadcastCount] = await Promise.all([
      prisma.message.count({ where }),
      prisma.message.count({ where: { type: "USER_FEEDBACK" } }),
      prisma.message.count({ where: { type: "ADMIN_BROADCAST" } }),
      prisma.message.count({ where: { type: "ADMIN_BROADCAST", authorId: null, isPublic: true } }),
      prisma.message.count({ where: { type: "ADMIN_BROADCAST", authorId: { not: null } } }),
    ])

    return NextResponse.json({
      messages: messages.map((message) => ({
        ...message,
        kind:
          message.type === "USER_FEEDBACK"
            ? "feedback"
            : message.authorId
              ? "email_broadcast"
              : "announcement",
      })),
      totalCount,
      feedbackCount,
      platformCount,
      announcementCount,
      emailBroadcastCount,
    })
  } catch (err) {
    console.error("[admin/messages] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH() {
  return NextResponse.json({ error: "Message state flags were removed" }, { status: 405 })
}
