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
      subject?: string
      content?: string
    }

    const subject = payload.subject?.trim() ?? ""
    const content = payload.content?.trim() ?? ""

    if (!subject || !content) {
      return NextResponse.json({ error: "Subject and content are required" }, { status: 400 })
    }

    const [message, users] = await Promise.all([
      prisma.message.create({
        data: {
          type: "ADMIN_BROADCAST",
          authorId: null,
          subject,
          content,
          isPublic: true,
        },
      }),
      prisma.user.findMany({ select: { id: true } }),
    ])

    if (users.length > 0) {
      await prisma.notification.createMany({
        data: users.map((user) => ({
          userId: user.id,
          type: "PLATFORM",
          title: subject,
          message: content.length > 120 ? `${content.slice(0, 120).trim()}…` : content,
          link: "/comms",
        })),
      })
    }

    return NextResponse.json(message, { status: 201 })
  } catch (err) {
    console.error("[admin/comms] POST error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
