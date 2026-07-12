import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

const ALLOWED_PREVIEW_MODES = new Set(["visuals", "text"])

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const previewMode = typeof body.previewMode === "string" ? body.previewMode.trim().toLowerCase() : "visuals"
    const source = typeof body.source === "string" && body.source.trim() ? body.source.trim() : "billing_coming_soon_banner"

    if (!ALLOWED_PREVIEW_MODES.has(previewMode)) {
      return NextResponse.json({ error: "Invalid preview mode." }, { status: 400 })
    }

    const email = session.user.email.trim().toLowerCase()
    const isAdmin = session.user.role === "SUPER_ADMIN" || session.user.isAdmin

    const interest = await prisma.billingLaunchInterest.upsert({
      where: { email },
      update: {
        userId: session.user.id,
        name: session.user.name ?? null,
        accountType: isAdmin ? "super_admin" : "organiser",
        previewMode,
        source,
        notes: "Requested notification for upcoming billing launch.",
      },
      create: {
        userId: session.user.id,
        email,
        name: session.user.name ?? null,
        accountType: isAdmin ? "super_admin" : "organiser",
        previewMode,
        source,
        notes: "Requested notification for upcoming billing launch.",
      },
      select: {
        id: true,
        email: true,
        previewMode: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ success: true, interest })
  } catch (error) {
    console.error("[billing/launch-interest] POST error:", error)
    return NextResponse.json({ error: "Could not save your billing launch interest right now." }, { status: 500 })
  }
}
