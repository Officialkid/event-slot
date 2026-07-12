import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"
import { paystackFetch } from "@/lib/paystack"
import { APP_URL } from "@/lib/config"
import { billingRatelimit } from "@/lib/ratelimit"
import { isBillingCheckoutEnabled } from "@/lib/pricingRollout"
import { getSubscriptionPlan } from "@/lib/subscriptionPlans"
import {
  getSubscriptionBillingQuote,
  normalizeBillingCycle,
  normalizePaymentMethod,
} from "@/lib/subscriptionBilling"

export async function POST(request: NextRequest) {
  try {
    if (!isBillingCheckoutEnabled()) {
      return NextResponse.json(
        { error: "Subscription checkout is coming soon. Everyone currently keeps full access." },
        { status: 503 }
      )
    }

    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: "Payment service not configured." }, { status: 503 })
    }

    const { success: rlOk } = await billingRatelimit.limit(`subscription-checkout:${session.user.id}`)
    if (!rlOk) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 })
    }

    const body = await request.json()
    const planKey = typeof body.planKey === "string" ? body.planKey : ""
    const billingCycle = normalizeBillingCycle(typeof body.billingCycle === "string" ? body.billingCycle : "")
    const paymentMethod = normalizePaymentMethod(
      typeof body.paymentMethod === "string" ? body.paymentMethod : ""
    )
    const payerName = typeof body.payerName === "string" ? body.payerName.trim().slice(0, 120) : ""
    const mpesaPhone = typeof body.mpesaPhone === "string" ? body.mpesaPhone.trim().slice(0, 32) : ""

    const selectedPlan = getSubscriptionPlan(planKey)
    if (!selectedPlan || selectedPlan.key === "free") {
      return NextResponse.json({ error: "Invalid plan selected." }, { status: 400 })
    }

    const plan = await prisma.plan.findUnique({
      where: { name: selectedPlan.key },
      select: { id: true, name: true, monthlyPriceUsd: true, annualPriceUsd: true },
    })

    if (!plan) {
      return NextResponse.json({ error: "Plan not found in billing catalog." }, { status: 404 })
    }

    const quote = getSubscriptionBillingQuote(plan, billingCycle)
    const checkoutCurrency = "KES"
    const checkoutAmount = quote.totalKes

    const now = new Date()
    const existingSubscription = await prisma.subscription.findFirst({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    })

    const subscription =
      existingSubscription ??
      (await prisma.subscription.create({
        data: {
          userId: session.user.id,
          planId: plan.id,
          billingCycle: billingCycle === "annual" ? "ANNUAL" : "MONTHLY",
          status: "PAST_DUE",
          currentPeriodStart: now,
          currentPeriodEnd: now,
          paymentProvider: "paystack",
        },
      }))

    const paymentRecord = await prisma.subscriptionPayment.create({
      data: {
        subscriptionId: subscription.id,
        amountKes: quote.totalKes,
        amountUsd: quote.totalUsd,
        exchangeRate: quote.exchangeRate,
        provider: "paystack",
        status: "PENDING",
        description: JSON.stringify({
          userId: session.user.id,
          planId: plan.id,
          billingCycle: billingCycle === "annual" ? "ANNUAL" : "MONTHLY",
          planAmountUsd: billingCycle === "annual" ? plan.annualPriceUsd : plan.monthlyPriceUsd,
          taxAmountUsd: quote.taxUsd,
          totalUsd: quote.totalUsd,
          totalKes: quote.totalKes,
          exchangeRate: quote.exchangeRate,
          paymentProvider: "paystack",
          paymentMethod,
          payerName,
          mpesaPhone,
        }),
      },
    })

    const paystack = await paystackFetch("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: session.user.email,
        amount: Math.round(checkoutAmount * 100),
        currency: checkoutCurrency,
        callback_url: `${APP_URL}/api/billing/verify`,
        channels: paymentMethod === "card" ? ["card"] : ["mobile_money"],
        metadata: {
          type: "subscription_plan",
          userId: session.user.id,
          paymentRecordId: paymentRecord.id,
          plan: selectedPlan.key,
          billingCycle,
          paymentMethod,
          payerName,
          mpesaPhone,
          settlementCurrency: checkoutCurrency,
          subtotalUsd: quote.subtotalUsd,
          taxUsd: quote.taxUsd,
          totalUsd: quote.totalUsd,
          subtotalKes: quote.subtotalKes,
          taxKes: quote.taxKes,
          totalKes: quote.totalKes,
        },
      }),
    })

    if (!paystack.status || !paystack.data?.authorization_url || !paystack.data?.reference) {
      await prisma.subscriptionPayment.update({
        where: { id: paymentRecord.id },
        data: { status: "FAILED" },
      }).catch(() => {})

      return NextResponse.json(
        { error: paystack.message ?? "Unable to start checkout." },
        { status: 502 }
      )
    }

    await prisma.subscriptionPayment.update({
      where: { id: paymentRecord.id },
      data: {
        checkoutRequestId: paystack.data.reference,
        providerRef: paystack.data.reference,
      },
    })

    return NextResponse.json({
      url: paystack.data.authorization_url,
      reference: paystack.data.reference,
      paymentRecordId: paymentRecord.id,
    })
  } catch (error) {
    console.error("[billing/subscriptions/checkout]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
