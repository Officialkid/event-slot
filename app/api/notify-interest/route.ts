import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import { ratelimit } from "@/lib/ratelimit"

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 10 requests per minute per IP (reuse global limiter)
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"
    const { success } = await ratelimit.limit(`notify-interest:${ip}`)
    if (!success) {
      return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 })
    }

    const body = await req.json()
    const email: unknown = body?.email
    const featureName: unknown = body?.featureName

    if (
      typeof email !== "string" ||
      typeof featureName !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      featureName.trim().length === 0 ||
      featureName.trim().length > 120
    ) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 })
    }

    await prisma.featureInterest.upsert({
      where: { email_featureName: { email: email.toLowerCase(), featureName: featureName.trim() } },
      create: { email: email.toLowerCase(), featureName: featureName.trim() },
      update: {}, // already exists — no-op
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[NOTIFY INTEREST ERROR]", err)
    return NextResponse.json({ error: "Failed to save interest. Please try again." }, { status: 500 })
  }
}
