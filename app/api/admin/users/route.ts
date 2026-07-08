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
    const search = searchParams.get("search") ?? ""
    const plan = searchParams.get("plan") ?? "all"
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200)
    const skip = (page - 1) * limit

    const where = {
      ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" as const } }, { email: { contains: search, mode: "insensitive" as const } }] } : {}),
      ...(plan !== "all" ? { plan } : {}),
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
          suspended: true,
          createdAt: true,
          _count: { select: { events: true } },
        },
        take: limit,
        skip,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({ users, page, limit, total })
  } catch (err) {
    console.error("[admin/users] GET error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
