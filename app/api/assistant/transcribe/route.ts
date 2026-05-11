import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { checkVoiceAccess, recordVoiceUse } from "@/lib/voice-quota"
import { PAYMENTS_ENABLED } from "@/lib/payments"
import { rateLimit } from "@/lib/rate-limit"

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const session = await getServerSession(authOptions)

  // ── Per-IP transcription rate limit (30/hr) ───────────
  const ip = (req.headers.get("x-forwarded-for") ?? "127.0.0.1").split(",")[0].trim()
  const transcribeRl = await rateLimit(ip, "TRANSCRIPTION", 30, 60)
  if (!transcribeRl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded. Please try again later." }, { status: 429 })
  }

  const formData  = await req.formData()
  const audioFile = formData.get("audio") as File

  if (!audioFile) {
    return NextResponse.json({ error: "No audio file" }, { status: 400 })
  }

  // ── Voice quota / token check ─────────────────────────
  let isFreeQuota = true

  if (session?.user) {
    const access = await checkVoiceAccess(session.user.id, session.user.email!)

    if (!access.allowed) {
      // No free quota AND insufficient tokens
      const resetDate = access.resetAt
        ? new Date(access.resetAt).toLocaleDateString("en-KE", {
            day: "numeric", month: "long",
          })
        : "the 1st of next month"

      return NextResponse.json({
        error: "VOICE_QUOTA_EXCEEDED",
        message: PAYMENTS_ENABLED
          ? `You've used your 5 free voice messages for this month. Each additional voice message costs 10 tokens (KSh 50). Your current balance is ${access.tokenBalance} tokens. Purchase tokens to continue.`
          : `You've used your 5 free voice messages for this month. Your quota resets on ${resetDate}. Token purchases are coming soon — you'll be able to top up your balance to use more voice messages.`,
        resetAt: access.resetAt,
        tokenBalance: access.tokenBalance,
        paymentsEnabled: PAYMENTS_ENABLED,
        action: PAYMENTS_ENABLED ? "BUY_TOKENS" : "WAIT_FOR_RESET",
      }, { status: 402 })
    }

    isFreeQuota = access.isFreeQuota
  }

  // ── Size check ────────────────────────────────────────
  if (audioFile.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Recording too long. Please keep voice messages under 2 minutes." },
      { status: 413 }
    )
  }

  // ── Transcribe ────────────────────────────────────────
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "en",
      prompt: "EventSlot event registration waitlist organiser attendee Kenya Nairobi tokens",
    })

    // Record usage after successful transcription
    if (session?.user) {
      await recordVoiceUse(session.user.id, session.user.email!, isFreeQuota)
    }

    return NextResponse.json({
      text: transcription.text,
      isFreeQuota,
      usedToken: !isFreeQuota,
    })

  } catch (error) {
    console.error("[EventSlot] Whisper error:", error)
    return NextResponse.json(
      { error: "Transcription failed. Please type your message instead." },
      { status: 500 }
    )
  }
}
