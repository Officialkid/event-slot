import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"
import { prisma } from "@/lib/prisma"
import { creditTokens } from "@/lib/tokens"

function verifySignature(body: string, sig: string): boolean {
  const hash = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest("hex")
  return hash === sig
}

export async function POST(req: NextRequest) {
  // Hard gate — webhook does nothing until payments are enabled
  if (process.env.PAYMENTS_ENABLED !== "true") {
    return NextResponse.json({ message: "Payments not active" }, { status: 200 })
  }

  const rawBody = await req.text()
  const sig     = req.headers.get("x-paystack-signature") ?? ""

  if (!verifySignature(rawBody, sig)) {
    console.error("[EventSlot] Invalid Paystack webhook signature")
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  const event = JSON.parse(rawBody)

  if (event.event === "charge.success") {
    const { reference, metadata } = event.data
    const { userId, tokens } = metadata ?? {}

    if (!userId || !tokens) {
      console.error("[EventSlot] Missing metadata in Paystack event", metadata)
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 })
    }

    // Idempotency — never double-credit
    const exists = await prisma.tokenTransaction.findFirst({
      where: { referenceId: reference, type: "PURCHASE" },
    })
    if (exists) {
      return NextResponse.json({ message: "Already processed" })
    }

    await creditTokens(
      userId,
      parseInt(tokens),
      "PURCHASE",
      `Token purchase — ${tokens} tokens via Paystack`,
      reference
    )

    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "TOKEN_PURCHASE",
        metadata: { reference, tokens, amount: event.data.amount },
      },
    })
  }

  return NextResponse.json({ message: "OK" })
}
