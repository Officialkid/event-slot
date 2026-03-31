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
  const status = searchParams.get("status") ?? "all"
  const userId = searchParams.get("user") ?? ""

  const events = await prisma.event.findMany({
    where: {
      ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { organizerEmail: { contains: search, mode: "insensitive" } }] } : {}),
      ...(status !== "all" ? (status === "archived" ? { archived: true } : { status, archived: false }) : {}),
      ...(userId ? { organizerId: userId } : {}),
    },
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
  })

  return NextResponse.json({ events })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!isSuperAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  await prisma.event.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
