import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { resend } from "@/lib/resend"

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req: NextRequest) {
  const { email } = (await req.json()) as { email?: string }

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 })
  }

  const recentCount = await prisma.emailOTP.count({
    where: {
      email,
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
  })

  if (recentCount >= 3) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait 10 minutes before trying again." },
      { status: 429 }
    )
  }

  const otp = generateOTP()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  await prisma.emailOTP.create({
    data: { email, otp, expiresAt },
  })

  await resend.emails.send({
    from: "EventSlot <hello@eventsslot.com>",
    to: email,
    subject: `${otp} - Your EventSlot verification code`,
    html: `
      <div style="background:#0A0A0A;padding:40px;font-family:sans-serif;max-width:400px;">
        <div style="margin-bottom:24px;">
          <span style="font-size:20px;font-weight:bold;color:#fff;">Event</span>
          <span style="font-size:20px;font-weight:bold;color:#C8F55A;">Slot</span>
        </div>
        <h2 style="color:#fff;margin-bottom:8px;">Verify your email</h2>
        <p style="color:#A3A3A3;font-size:14px;margin-bottom:24px;">
          Enter this code to verify your email address.
          It expires in 10 minutes.
        </p>
        <div style="background:#141414;border:2px solid #C8F55A;border-radius:12px;
                    padding:20px;text-align:center;margin-bottom:24px;">
          <span style="font-size:36px;font-weight:bold;color:#C8F55A;
                       letter-spacing:8px;">${otp}</span>
        </div>
        <p style="color:#525252;font-size:12px;">
          If you did not request this, ignore this email.
        </p>
      </div>
    `,
  })

  return NextResponse.json({ success: true, message: "OTP sent" })
}
