import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { isBillingCheckoutEnabled } from "@/lib/pricingRollout"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const settings = await prisma.paygSettings.findUnique({
    where: { userId: session.user.id },
    select: {
      isEnabled: true,
      monthlyCapUsd: true,
      mpesaPhone: true,
      paymentProvider: true,
      billingAuthorizationAccepted: true,
      billingAuthorizedAt: true,
      cardholderName: true,
      billingCardBrand: true,
      billingCardLast4: true,
      billingCardExpiryMonth: true,
      billingCardExpiryYear: true,
    },
  })

  return NextResponse.json({
    settings: settings ?? {
      isEnabled: false,
      monthlyCapUsd: 10,
      mpesaPhone: null,
      paymentProvider: "mpesa_stk",
      billingAuthorizationAccepted: false,
      billingAuthorizedAt: null,
      cardholderName: null,
      billingCardBrand: null,
      billingCardLast4: null,
      billingCardExpiryMonth: null,
      billingCardExpiryYear: null,
    },
  })
}

export async function PATCH(req: NextRequest) {
  if (!isBillingCheckoutEnabled()) {
    return NextResponse.json(
      { error: "PAYG setup is coming soon. Everyone currently keeps full access." },
      { status: 503 }
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const isEnabled = Boolean(body?.isEnabled)
  const monthlyCapUsd = Number(body?.monthlyCapUsd)
  const paymentMethod = body?.paymentMethod === "card" ? "card" : "mpesa"
  const mpesaPhone = typeof body?.mpesaPhone === "string" ? body.mpesaPhone.trim() : null
  const billingAuthorizationAccepted = Boolean(body?.billingAuthorizationAccepted)
  const cardholderName = typeof body?.cardholderName === "string" ? body.cardholderName.trim() : ""
  const billingCardBrand = typeof body?.billingCardBrand === "string" ? body.billingCardBrand.trim() : ""
  const billingCardLast4 = typeof body?.billingCardLast4 === "string" ? body.billingCardLast4.replace(/\D/g, "").slice(-4) : ""
  const billingCardExpiryMonth = Number(body?.billingCardExpiryMonth)
  const billingCardExpiryYear = Number(body?.billingCardExpiryYear)

  if (!Number.isFinite(monthlyCapUsd) || monthlyCapUsd < 1 || monthlyCapUsd > 5000) {
    return NextResponse.json({ error: "Monthly PAYG cap must be between $1 and $5,000." }, { status: 400 })
  }

  if (isEnabled) {
    if (!billingAuthorizationAccepted) {
      return NextResponse.json({ error: "You must authorize PAYG billing before enabling it." }, { status: 400 })
    }

    if (paymentMethod === "mpesa") {
      if (!mpesaPhone) {
        return NextResponse.json({ error: "Add the M-Pesa number that should receive the STK push prompt." }, { status: 400 })
      }
    } else {
      if (!cardholderName || !billingCardBrand || !/^\d{4}$/.test(billingCardLast4)) {
        return NextResponse.json({ error: "Add the cardholder name, card brand, and card last 4 digits before enabling PAYG." }, { status: 400 })
      }

      if (!Number.isInteger(billingCardExpiryMonth) || billingCardExpiryMonth < 1 || billingCardExpiryMonth > 12) {
        return NextResponse.json({ error: "Enter a valid card expiry month." }, { status: 400 })
      }

      if (!Number.isInteger(billingCardExpiryYear) || billingCardExpiryYear < new Date().getFullYear()) {
        return NextResponse.json({ error: "Enter a valid card expiry year." }, { status: 400 })
      }
    }
  }

  const settings = await prisma.paygSettings.upsert({
    where: { userId: session.user.id },
    update: {
      isEnabled,
      monthlyCapUsd,
      mpesaPhone: mpesaPhone || null,
      paymentProvider: paymentMethod === "card" ? "paystack_card" : "mpesa_stk",
      billingAuthorizationAccepted,
      billingAuthorizedAt: isEnabled && billingAuthorizationAccepted ? new Date() : null,
      cardholderName: cardholderName || null,
      billingCardBrand: billingCardBrand || null,
      billingCardLast4: billingCardLast4 || null,
      billingCardExpiryMonth: Number.isInteger(billingCardExpiryMonth) ? billingCardExpiryMonth : null,
      billingCardExpiryYear: Number.isInteger(billingCardExpiryYear) ? billingCardExpiryYear : null,
    },
    create: {
      userId: session.user.id,
      isEnabled,
      monthlyCapUsd,
      mpesaPhone: mpesaPhone || null,
      paymentProvider: paymentMethod === "card" ? "paystack_card" : "mpesa_stk",
      billingAuthorizationAccepted,
      billingAuthorizedAt: isEnabled && billingAuthorizationAccepted ? new Date() : null,
      cardholderName: cardholderName || null,
      billingCardBrand: billingCardBrand || null,
      billingCardLast4: billingCardLast4 || null,
      billingCardExpiryMonth: Number.isInteger(billingCardExpiryMonth) ? billingCardExpiryMonth : null,
      billingCardExpiryYear: Number.isInteger(billingCardExpiryYear) ? billingCardExpiryYear : null,
    },
    select: {
      isEnabled: true,
      monthlyCapUsd: true,
      mpesaPhone: true,
      paymentProvider: true,
      billingAuthorizationAccepted: true,
      billingAuthorizedAt: true,
      cardholderName: true,
      billingCardBrand: true,
      billingCardLast4: true,
      billingCardExpiryMonth: true,
      billingCardExpiryYear: true,
    },
  })

  return NextResponse.json({ success: true, settings })
}
