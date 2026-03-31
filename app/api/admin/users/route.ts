import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

function isSuperAdmin(email: string | null | undefined) {
  return email && email === process.env.SUPER_ADMIN_EMAIL
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!isSuperAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") ?? ""
  const plan = searchParams.get("plan") ?? "all"

  const users = await prisma.user.findMany({
    where: {
      ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] } : {}),
      ...(plan !== "all" ? { plan } : {}),
    },
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
  })

  return NextResponse.json({ users })
}
