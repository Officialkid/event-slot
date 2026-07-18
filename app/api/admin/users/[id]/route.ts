import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { hasAdminAccess, isAdminEmail } from "@/lib/isAdmin"

const ALLOWED_PLANS = new Set(["free", "standard", "pro", "business"])
const ALLOWED_DELETE_HANDLERS = new Set(["archive", "delete", "transfer"])

type DeleteEventHandling = "archive" | "delete" | "transfer"

function isMissingOptionalTable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2021"
  )
}

async function ignoreMissingOptionalTable(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (!isMissingOptionalTable(error)) throw error
  }
}

async function parseDeleteBody(req: NextRequest) {
  const rawBody = await req.text()
  if (!rawBody.trim()) return {}

  try {
    return JSON.parse(rawBody) as {
      eventHandling?: DeleteEventHandling
      transferUserId?: string
    }
  } catch {
    return {}
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params
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
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body = await parseDeleteBody(req)
    const eventHandling = typeof body.eventHandling === "string" ? body.eventHandling.trim().toLowerCase() : null
    const transferUserId = typeof body.transferUserId === "string" ? body.transferUserId.trim() : ""

    const target = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        _count: { select: { events: true } },
      },
    })

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    if (isAdminEmail(target.email)) {
      return NextResponse.json({ error: "Cannot delete super admin" }, { status: 400 })
    }

    const ownedEvents = target._count.events
    const ownedEventPreview = ownedEvents > 0
      ? await prisma.event.findMany({
          where: { organizerId: params.id },
          orderBy: [{ archived: "asc" }, { createdAt: "desc" }],
          take: 5,
          select: {
            id: true,
            title: true,
            slug: true,
            archived: true,
            status: true,
          },
        })
      : []

    if (ownedEvents > 0 && !eventHandling) {
      return NextResponse.json(
        {
          error: "This user still owns events. Choose how those events should be handled before deleting the account.",
          code: "OWNED_EVENTS_BLOCK_DELETE",
          ownedEventCount: ownedEvents,
          ownedEvents: ownedEventPreview,
        },
        { status: 409 }
      )
    }

    if (eventHandling && !ALLOWED_DELETE_HANDLERS.has(eventHandling)) {
      return NextResponse.json({ error: "Invalid event handling option." }, { status: 400 })
    }

    let transferTarget: { id: string; email: string | null } | null = null
    if (eventHandling === "transfer") {
      if (!transferUserId) {
        return NextResponse.json({ error: "Choose the user who should receive these events." }, { status: 400 })
      }
      if (transferUserId === params.id) {
        return NextResponse.json({ error: "A user cannot transfer events to the same account being deleted." }, { status: 400 })
      }

      transferTarget = await prisma.user.findUnique({
        where: { id: transferUserId },
        select: { id: true, email: true },
      })

      if (!transferTarget) {
        return NextResponse.json({ error: "Transfer target not found." }, { status: 404 })
      }
    }

    await prisma.$transaction(async (tx) => {
      if (eventHandling === "archive") {
        await tx.eventPass.deleteMany({
          where: { organizerId: params.id },
        })

        await tx.event.updateMany({
          where: { organizerId: params.id },
          data: {
            organizerId: null,
            archived: true,
            status: "archived",
          },
        })
      }

      if (eventHandling === "delete") {
        await tx.eventPass.deleteMany({
          where: { organizerId: params.id },
        })

        await tx.event.deleteMany({
          where: { organizerId: params.id },
        })
      }

      if (eventHandling === "transfer" && transferTarget) {
        await tx.event.updateMany({
          where: { organizerId: params.id },
          data: {
            organizerId: transferTarget.id,
            organizerEmail: transferTarget.email ?? target.email ?? "",
          },
        })

        await tx.eventPass.updateMany({
          where: { organizerId: params.id },
          data: {
            organizerId: transferTarget.id,
          },
        })
      }

      await tx.referral.deleteMany({
        where: {
          OR: [
            { referrerId: params.id },
            { referredUserId: params.id },
          ],
        },
      })
      await tx.teamMember.deleteMany({
        where: {
          OR: [
            { ownerId: params.id },
            { memberId: params.id },
          ],
        },
      })
      await tx.organizerFeedback.deleteMany({ where: { organizerId: params.id } })
      await tx.eventUnlock.deleteMany({ where: { userId: params.id } })
      await ignoreMissingOptionalTable(tx.billingLaunchInterest.deleteMany({ where: { userId: params.id } }))
      await tx.reportDownloadTransaction.deleteMany({ where: { userId: params.id } })
      await tx.paygUsage.deleteMany({ where: { userId: params.id } })
      await tx.paygInvoice.deleteMany({ where: { userId: params.id } })
      await tx.message.updateMany({
        where: { authorId: params.id },
        data: { authorId: null },
      })
      if (target.email) {
        await tx.loginSecurityState.deleteMany({
          where: { email: target.email },
        })
      }

      await tx.user.delete({ where: { id: params.id } })
    })

    return NextResponse.json({
      success: true,
      eventHandling: eventHandling ?? "none",
      ownedEventCount: ownedEvents,
    })
  } catch (err) {
    console.error("[admin/users/[id]] DELETE error:", err)
    return NextResponse.json({ error: "Unable to delete this user right now." }, { status: 500 })
  }
}
