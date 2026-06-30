import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { issueOtpForEmail } from "@/lib/emailOtp"

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      paymentPinEnabled: true,
      twoFactorEnabled: true,
    },
  })

  if (!user?.email) {
    return NextResponse.json({ error: "Add an email address to your account before using withdrawal approvals." }, { status: 400 })
  }

  if (!user.paymentPinEnabled) {
    return NextResponse.json({ error: "Set your payments PIN before requesting a withdrawal OTP." }, { status: 400 })
  }

  if (!user.twoFactorEnabled) {
    return NextResponse.json({ error: "Turn on account 2FA in Profile before requesting a withdrawal OTP." }, { status: 400 })
  }

  try {
    await issueOtpForEmail(user.email)
  } catch (error) {
    if (error instanceof Error && error.name === "OTP_RATE_LIMIT") {
      return NextResponse.json({ error: error.message }, { status: 429 })
    }
    console.error("[organizer-payments-security-otp] POST error:", error)
    return NextResponse.json({ error: "Unable to send withdrawal OTP right now." }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: "A withdrawal verification code has been sent to your email." })
}
