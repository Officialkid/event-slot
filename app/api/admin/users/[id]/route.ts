import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

function isSuperAdmin(email: string | null | undefined) {
  return email && email === process.env.SUPER_ADMIN_EMAIL
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!isSuperAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json()
  const data: Record<string, unknown> = {}
  if (body.plan !== undefined) data.plan = body.plan
  if (body.suspended !== undefined) data.suspended = body.suspended
  if (body.name !== undefined) data.name = body.name || null
  if (body.email !== undefined && body.email) data.email = body.email

  const updated = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, plan: true, suspended: true },
  })

  return NextResponse.json({ user: updated })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!isSuperAdmin(session?.user?.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Prevent deleting the super admin account
  const target = await prisma.user.findUnique({ where: { id: params.id }, select: { email: true } })
  if (target?.email === process.env.SUPER_ADMIN_EMAIL) {
    return NextResponse.json({ error: "Cannot delete super admin" }, { status: 400 })
  }

  await prisma.user.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
