import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { normalizeEmailForOtp, verifyOtpForEmail } from "@/lib/emailOtp"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const { email, otp } = (await req.json()) as { email?: string; otp?: string }

  if (!email || !otp) {
    return NextResponse.json({ error: "Email and OTP required" }, { status: 400 })
  }

  const normalizedEmail = normalizeEmailForOtp(email)
  const record = await verifyOtpForEmail(normalizedEmail, otp)

  if (!record) {
    return NextResponse.json(
      { error: "Invalid or expired code. Please request a new one." },
      { status: 400 }
    )
  }

  await prisma.user.updateMany({
    where: { email: normalizedEmail },
    data: {
      emailVerified: new Date(),
      otpRequired: false,
    },
  })

  return NextResponse.json({ success: true, verified: true })
}
