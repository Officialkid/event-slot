import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.role !== "SUPER_ADMIN" || !session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const payload = await req.json() as {
      title?: string
      message?: string
      link?: string | null
    }

    const title = payload.title?.trim() ?? ""
    const message = payload.message?.trim() ?? ""
    const link = payload.link?.trim() || null

    if (!title || !message) {
      return NextResponse.json({ error: "Title and message required" }, { status: 400 })
    }

    const users = await prisma.user.findMany({
      select: { id: true },
    })

    if (users.length === 0) {
      return NextResponse.json({ success: true, notified: 0 })
    }

    await prisma.notification.createMany({
      data: users.map((user) => ({
        userId: user.id,
        type: "PLATFORM",
        title,
        message,
        link,
      })),
    })

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "PLATFORM_NOTIFICATION_BROADCAST",
        metadata: { title, recipientCount: users.length },
      },
    })

    return NextResponse.json({ success: true, notified: users.length })
  } catch (err) {
    console.error("[admin/notify-all] POST error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
