import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { ratelimit } from "@/lib/ratelimit"
import { verifyHumanChallenge } from "@/lib/humanVerification"
import { normalizeVerifierCode } from "@/lib/verifierCode"

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1"
  const limited = await ratelimit.limit(`verify-access:${ip}`)
  if (!limited.success) {
    return NextResponse.json({ error: "Too many attempts. Please try again shortly." }, { status: 429 })
  }

  const body = (await req.json().catch(() => null)) as { code?: string; challengeToken?: string } | null
  const code = normalizeVerifierCode(body?.code)

  if (!code || code.length < 6) {
    return NextResponse.json({ error: "Enter the event verifier code." }, { status: 400 })
  }

  const human = await verifyHumanChallenge(body?.challengeToken, ip)
  if (!human.ok) {
    return NextResponse.json({ error: human.error ?? "Human verification failed." }, { status: 400 })
  }

  const event = await prisma.event.findFirst({
    where: {
      verifierCode: code,
      verifierCodeEnabled: true,
      archived: false,
    },
    select: {
      title: true,
      slug: true,
      eventDate: true,
      location: true,
      status: true,
      ticketsEnabled: true,
      verifierCode: true,
    },
  })

  if (!event) {
    return NextResponse.json({ error: "Verifier code not found or disabled." }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    event: {
      title: event.title,
      slug: event.slug,
      eventDate: event.eventDate,
      location: event.location,
      status: event.status,
      ticketsEnabled: event.ticketsEnabled,
    },
    accessToken: event.verifierCode,
    humanVerificationSkipped: human.skipped ?? false,
  })
}
