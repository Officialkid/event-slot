import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const unreadOnly = searchParams.get("unread") === "true"
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200)
    const skip = (page - 1) * limit

    if (unreadOnly) {
      const count = await prisma.notification.count({
        where: { userId: session.user.id, read: false },
      })
      return NextResponse.json({ count })
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: session.user.id },
        select: {
          id: true,
          userId: true,
          type: true,
          title: true,
          message: true,
          link: true,
          read: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.notification.count({ where: { userId: session.user.id } }),
    ])

    return NextResponse.json({
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    })
  } catch (err) {
    console.error("[notifications] GET error:", err)
    // Return safe empty payload if DB is unavailable (e.g. Neon free tier paused) or table is missing
    return NextResponse.json({ notifications: [], count: 0, pagination: { page: 1, limit: 50, total: 0, totalPages: 1 } })
  }
}
