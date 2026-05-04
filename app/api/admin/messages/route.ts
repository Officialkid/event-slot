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

    const messages = await prisma.message.findMany({
      where: {
        ...(filter === "unread" ? { read: false, archived: false } : {}),
        ...(filter === "organizer" ? { type: "organizer" } : {}),
        ...(filter === "attendee" ? { type: "attendee" } : {}),
        ...(filter === "all" ? { archived: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    const unreadCount = await prisma.message.count({ where: { read: false, archived: false } })

    return NextResponse.json({ messages, unreadCount })
  } catch (err) {
    console.error("[admin/messages] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { id, read, archived } = await req.json()
    const data: Record<string, boolean> = {}
    if (read !== undefined) data.read = read
    if (archived !== undefined) data.archived = archived

    const updated = await prisma.message.update({ where: { id }, data })
    return NextResponse.json({ message: updated })
  } catch (err) {
    console.error("[admin/messages] PATCH error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
