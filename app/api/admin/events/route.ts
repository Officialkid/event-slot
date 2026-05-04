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
    const search = searchParams.get("search") ?? ""
    const status = searchParams.get("status") ?? "all"
    const userId = searchParams.get("user") ?? ""
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20', 10), 1), 100)
    const skip = (page - 1) * limit

    const where = {
      ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" as const } }, { organizerEmail: { contains: search, mode: "insensitive" as const } }] } : {}),
      ...(status !== "all" ? (status === "archived" ? { archived: true } : { status, archived: false }) : {}),
      ...(userId ? { organizerId: userId } : {}),
    }

    const [events, total] = await Promise.all([
      prisma.event.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          title: true,
          slug: true,
          organizerEmail: true,
          confirmedCount: true,
          waitlistCount: true,
          status: true,
          archived: true,
          createdAt: true,
        },
        take: limit,
        skip,
      }),
      prisma.event.count({ where }),
    ])

    return NextResponse.json({ events, page, limit, total })
  } catch (err) {
    console.error("[admin/events] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

    await prisma.event.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/events] DELETE error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
