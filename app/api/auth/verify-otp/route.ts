import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  const { email, otp } = (await req.json()) as { email?: string; otp?: string }

  if (!email || !otp) {
    return NextResponse.json({ error: "Email and OTP required" }, { status: 400 })
  }

  const record = await prisma.emailOTP.findFirst({
    where: {
      email,
      otp,
      used: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  })

  if (!record) {
    return NextResponse.json(
      { error: "Invalid or expired code. Please request a new one." },
      { status: 400 }
    )
  }

  await prisma.emailOTP.update({
    where: { id: record.id },
    data: { used: true },
  })

  await prisma.user.updateMany({
    where: { email },
    data: { emailVerified: new Date() },
  })

  return NextResponse.json({ success: true, verified: true })
}
