import { NextRequest, NextResponse } from "next/server"
import { issueOtpForEmail, normalizeEmailForOtp } from "@/lib/emailOtp"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { email } = (await req.json()) as { email?: string }

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 })
  }

  try {
    await issueOtpForEmail(normalizeEmailForOtp(email))
  } catch (error) {
    if (error instanceof Error && error.name === "OTP_RATE_LIMIT") {
      return NextResponse.json(
        { error: "Too many attempts. Please wait 10 minutes before trying again." },
        { status: 429 }
      )
    }
    throw error
  }

  return NextResponse.json({ success: true, message: "OTP sent" })
}
