import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/prisma"
import { authOptions } from "@/lib/auth"
import { billingRatelimit } from "@/lib/ratelimit"
import { paystackFetch } from "@/lib/paystack"
import { APP_URL } from "@/lib/config"
import {
  getOneTimePassQuote,
  normalizeOneTimePassTier,
} from "@/lib/oneTimePassCatalog"
import { syncEventPassStatusForEvent } from "@/lib/eventPasses"

function normalizePassPaymentMethod(value: string | null | undefined) {
  return value === "mpesa" ? "mpesa" : "card"
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({ error: "Payment service not configured." }, { status: 503 })
    }

    const { success: rlOk } = await billingRatelimit.limit(`event-pass-checkout:${session.user.id}`)
    if (!rlOk) {
      return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 })
    }

    const body = await request.json()
    const eventId = typeof body.eventId === "string" ? body.eventId : ""
    const tier = normalizeOneTimePassTier(typeof body.tier === "string" ? body.tier : "")
    const paymentMethod = normalizePassPaymentMethod(
      typeof body.paymentMethod === "string" ? body.paymentMethod : ""
    )
    const mpesaPhone = typeof body.mpesaPhone === "string" ? body.mpesaPhone.trim().slice(0, 32) : ""

    if (!eventId || !tier) {
      return NextResponse.json({ error: "Event and pass tier are required." }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        organizerId: true,
        slug: true,
        eventPass: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    })

    if (!event || event.organizerId !== session.user.id) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 })
    }

    await syncEventPassStatusForEvent(event.id)

    const existingPass = await prisma.eventPass.findUnique({
      where: { eventId: event.id },
      select: {
        id: true,
        status: true,
      },
    })

    if (existingPass?.status === "ACTIVE") {
      return NextResponse.json({ error: "This event already has an active one-time pass." }, { status: 409 })
    }

    const quote = getOneTimePassQuote(tier)
    const eventPass = existingPass
      ? await prisma.eventPass.update({
          where: { id: existingPass.id },
          data: {
            organizerId: session.user.id,
            tier: tier.toUpperCase() as "STANDARD" | "PRO" | "BUSINESS",
            status: "PENDING",
            priceUsd: quote.priceUsd,
            priceKes: quote.priceKes,
            commissionRate: quote.commissionRate,
            paymentMethod: paymentMethod === "card" ? "CARD" : "MPESA",
            paymentProvider: "paystack",
            paymentReference: null,
            checkoutRequestId: null,
            activatedAt: null,
            cancelledAt: null,
          },
        })
      : await prisma.eventPass.create({
          data: {
            eventId: event.id,
            organizerId: session.user.id,
            tier: tier.toUpperCase() as "STANDARD" | "PRO" | "BUSINESS",
            status: "PENDING",
            priceUsd: quote.priceUsd,
            priceKes: quote.priceKes,
            commissionRate: quote.commissionRate,
            paymentMethod: paymentMethod === "card" ? "CARD" : "MPESA",
            paymentProvider: "paystack",
          },
        })

    await prisma.eventPassPayment.updateMany({
      where: {
        eventPassId: eventPass.id,
        status: "PENDING",
      },
      data: { status: "CANCELLED" },
    })

    const paymentRecord = await prisma.eventPassPayment.create({
      data: {
        eventPassId: eventPass.id,
        amountKes: quote.priceKes,
        amountUsd: quote.priceUsd,
        exchangeRate: quote.exchangeRate,
        provider: "paystack",
        status: "PENDING",
        phone: paymentMethod === "mpesa" ? mpesaPhone : null,
        description: JSON.stringify({
          eventId: event.id,
          organizerId: session.user.id,
          tier,
          priceUsd: quote.priceUsd,
          priceKes: quote.priceKes,
          exchangeRate: quote.exchangeRate,
          paymentProvider: "paystack",
          paymentMethod,
          mpesaPhone,
        }),
      },
    })

    const paystack = await paystackFetch("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email: session.user.email,
        amount: Math.round(quote.priceKes * 100),
        currency: "KES",
        callback_url: `${APP_URL}/api/billing/verify`,
        channels: paymentMethod === "card" ? ["card"] : ["mobile_money"],
        metadata: {
          type: "event_pass",
          userId: session.user.id,
          eventId: event.id,
          eventSlug: event.slug,
          paymentRecordId: paymentRecord.id,
          eventPassId: eventPass.id,
          tier,
          paymentMethod,
          mpesaPhone,
          priceUsd: quote.priceUsd,
          priceKes: quote.priceKes,
          exchangeRate: quote.exchangeRate,
          commissionRate: quote.commissionRate,
        },
      }),
    })

    if (!paystack.status || !paystack.data?.authorization_url || !paystack.data?.reference) {
      await prisma.eventPassPayment.update({
        where: { id: paymentRecord.id },
        data: { status: "FAILED" },
      }).catch(() => {})

      return NextResponse.json(
        { error: paystack.message ?? "Unable to start checkout." },
        { status: 502 }
      )
    }

    await prisma.$transaction([
      prisma.eventPass.update({
        where: { id: eventPass.id },
        data: {
          checkoutRequestId: paystack.data.reference,
        },
      }),
      prisma.eventPassPayment.update({
        where: { id: paymentRecord.id },
        data: {
          checkoutRequestId: paystack.data.reference,
          providerRef: paystack.data.reference,
        },
      }),
    ])

    return NextResponse.json({
      url: paystack.data.authorization_url,
      reference: paystack.data.reference,
      paymentRecordId: paymentRecord.id,
      eventPassId: eventPass.id,
    })
  } catch (error) {
    console.error("[billing/event-passes/checkout]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
