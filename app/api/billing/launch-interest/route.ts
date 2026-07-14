import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { z } from "zod"

const ALLOWED_PREVIEW_MODES = new Set(["visuals", "text"])
const launchInterestSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  previewMode: z.string().trim().optional(),
  source: z.string().trim().optional(),
})

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json().catch(() => ({}))
    const parsed = launchInterestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid email." }, { status: 400 })
    }
    const previewMode = typeof parsed.data.previewMode === "string" ? parsed.data.previewMode.trim().toLowerCase() : "visuals"
    const source = typeof parsed.data.source === "string" && parsed.data.source.trim() ? parsed.data.source.trim() : "billing_coming_soon_banner"

    if (!ALLOWED_PREVIEW_MODES.has(previewMode)) {
      return NextResponse.json({ error: "Invalid preview mode." }, { status: 400 })
    }

    const email = parsed.data.email.trim().toLowerCase()
    const isAdmin = Boolean(session?.user?.role === "SUPER_ADMIN" || session?.user?.isAdmin)

    const interest = await prisma.billingLaunchInterest.upsert({
      where: { email },
      update: {
        userId: session?.user?.id ?? null,
        name: session?.user?.name ?? null,
        accountType: isAdmin ? "super_admin" : "organiser",
        previewMode,
        source,
        notes: "Requested notification for upcoming billing launch.",
      },
      create: {
        userId: session?.user?.id ?? null,
        email,
        name: session?.user?.name ?? null,
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
