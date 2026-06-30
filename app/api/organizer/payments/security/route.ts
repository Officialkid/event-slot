import bcrypt from "bcryptjs"
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { z } from "zod"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

const payloadSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, "Use a 4 to 6 digit payments PIN."),
  confirmPin: z.string().regex(/^\d{4,6}$/, "Use a 4 to 6 digit payments PIN."),
})

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      twoFactorEnabled: true,
      paymentPinEnabled: true,
      paymentPinUpdatedAt: true,
    },
  })

  return NextResponse.json({
    email: user?.email ?? null,
    twoFactorEnabled: Boolean(user?.twoFactorEnabled),
    paymentPinEnabled: Boolean(user?.paymentPinEnabled),
    paymentPinUpdatedAt: user?.paymentPinUpdatedAt?.toISOString() ?? null,
  })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = payloadSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payments PIN." }, { status: 400 })
  }

  if (parsed.data.pin !== parsed.data.confirmPin) {
    return NextResponse.json({ error: "PIN confirmation does not match." }, { status: 400 })
  }

  const paymentPinHash = await bcrypt.hash(parsed.data.pin, 10)
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      paymentPinHash,
      paymentPinEnabled: true,
      paymentPinUpdatedAt: new Date(),
    },
  })

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "PAYMENTS_PIN_SET",
      metadata: {
        at: new Date().toISOString(),
      },
    },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
