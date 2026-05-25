import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { isAdminEmail } from "@/lib/isAdmin"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const isSuperAdmin = session?.user?.role === "SUPER_ADMIN" || isAdminEmail(session?.user?.email)
    if (!isSuperAdmin || !session?.user?.id) {
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

    const message = await prisma.message.create({
      data: {
        type: "ADMIN_BROADCAST",
        authorId: null,
        subject,
        content,
        isPublic: true,
      },
    })

    const batchSize = 1000
    let cursor: string | null = null
    let notified = 0

    for (;;) {
      const users: { id: string }[] = await prisma.user.findMany({
        select: { id: true },
        orderBy: { id: "asc" },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      })

      if (users.length === 0) {
        break
      }

      await prisma.notification.createMany({
        data: users.map((user: { id: string }) => ({
          userId: user.id,
          type: "PLATFORM",
          title: subject,
          message: content.length > 120 ? `${content.slice(0, 120).trim()}…` : content,
          link: "/comms",
        })),
      })

      notified += users.length
      cursor = users[users.length - 1].id
    }

    return NextResponse.json({ ...message, recipientsNotified: notified }, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2022") {
      return NextResponse.json(
        {
          success: false,
          error: "Comms service is temporarily unavailable.",
        },
        { status: 503 }
      )
    }
    console.error("[admin/comms] POST error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
