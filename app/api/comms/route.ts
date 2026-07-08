import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    let userCreatedAt: Date | null = null
    if (session?.user?.id) {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { createdAt: true },
      })
      userCreatedAt = user?.createdAt ?? null
    }

    const messages = await prisma.message.findMany({
      where: {
        type: "ADMIN_BROADCAST",
        authorId: null,
        isPublic: true,
        ...(userCreatedAt ? { createdAt: { gte: userCreatedAt } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ messages })
  } catch (err) {
    console.error("[comms] GET error:", err)
    return NextResponse.json({ messages: [] })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
        type: "USER_FEEDBACK",
        authorId: session.user.id,
        subject,
        content,
        isPublic: false,
      },
    })

    return NextResponse.json(message, { status: 201 })
  } catch (err) {
    console.error("[comms] POST error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
