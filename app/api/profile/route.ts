import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, image: true, password: true },
  })

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  return NextResponse.json({
    name: user.name,
    email: user.email,
    image: user.image,
    hasPassword: !!user.password,
  })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { name } = body as { name?: string }

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  if (name.trim().length > 100) {
    return NextResponse.json({ error: "Name is too long" }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: name.trim() },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Delete all events owned by user — cascades their registrations
  await prisma.event.deleteMany({ where: { organizerId: session.user.id } })

  // Delete the user — cascades accounts, sessions, notifications
  await prisma.user.delete({ where: { id: session.user.id } })

  return NextResponse.json({ success: true })
}
