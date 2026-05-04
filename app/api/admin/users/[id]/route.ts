import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { isAdminEmail } from "@/lib/isAdmin"

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.plan !== undefined) data.plan = 'free'
    if (body.suspended !== undefined) data.suspended = body.suspended
    if (body.name !== undefined) data.name = body.name || null
    if (body.email !== undefined && body.email) data.email = body.email

    const updated = await prisma.user.update({
      where: { id: params.id },
      data,
      select: { id: true, plan: true, suspended: true },
    })

    return NextResponse.json({ user: updated })
  } catch (err) {
    console.error("[admin/users/[id]] PATCH error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Prevent deleting the super admin account
    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { email: true } })
    if (isAdminEmail(target?.email)) {
      return NextResponse.json({ error: "Cannot delete super admin" }, { status: 400 })
    }

    await prisma.user.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/users/[id]] DELETE error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
