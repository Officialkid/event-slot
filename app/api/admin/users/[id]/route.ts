import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasAdminAccess, isAdminEmail } from "@/lib/isAdmin"

const ALLOWED_PLANS = new Set(["free", "standard", "pro", "business"])

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await req.json()
    const data: Record<string, unknown> = {}
    if (body.plan !== undefined) {
      const normalizedPlan = typeof body.plan === "string" ? body.plan.trim().toLowerCase() : ""
      if (!ALLOWED_PLANS.has(normalizedPlan)) {
        return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
      }
      data.plan = normalizedPlan
    }
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
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Prevent deleting the super admin account
    const target = await prisma.user.findUnique({ where: { id: params.id }, select: { email: true } })
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    if (isAdminEmail(target?.email)) {
      return NextResponse.json({ error: "Cannot delete super admin" }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      // Referral rows are one of the few user-linked records that do not cascade on delete.
      await tx.referral.deleteMany({
        where: {
          OR: [
            { referrerId: params.id },
            { referredUserId: params.id },
          ],
        },
      })

      await tx.user.delete({ where: { id: params.id } })
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[admin/users/[id]] DELETE error:", err)
    return NextResponse.json({ error: "Unable to delete this user right now." }, { status: 500 })
  }
}
