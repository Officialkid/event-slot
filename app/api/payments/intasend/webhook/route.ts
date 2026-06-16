import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import {
  activateSubscriptionPayment,
  failPaidEventOrderPayment,
  failSubscriptionPayment,
  finalizePaidEventOrderPayment,
} from '@/lib/paymentFinalizers'
import { isValidIntaSendWebhookChallenge } from '@/lib/intasend'

type IntaSendWebhookPayload = {
  invoice_id?: string
  state?: string
  api_ref?: string | null
  challenge?: string
  mpesa_reference?: string | null
  failed_reason?: string | null
}

function parseApiRef(apiRef: string | null | undefined) {
  if (!apiRef) return null
  if (apiRef.startsWith('order_')) return { kind: 'order' as const, id: apiRef.slice('order_'.length) }
  if (apiRef.startsWith('subpay_')) return { kind: 'subscription' as const, id: apiRef.slice('subpay_'.length) }
  return null
}

export async function POST(req: NextRequest) {
  let payload: IntaSendWebhookPayload | null = null

  try {
    payload = (await req.json()) as IntaSendWebhookPayload
  } catch {
    return NextResponse.json({ received: true })
  }

  if (!payload || !isValidIntaSendWebhookChallenge(payload.challenge)) {
    return NextResponse.json({ received: true }, { status: 202 })
  }

  const parsedRef = parseApiRef(payload.api_ref)
  if (!parsedRef) {
    return NextResponse.json({ received: true })
  }

  if (parsedRef.kind === 'order') {
    if (payload.state === 'COMPLETE') {
      await finalizePaidEventOrderPayment(parsedRef.id, payload.mpesa_reference ?? payload.invoice_id ?? null)
    } else if (payload.state === 'FAILED') {
      await failPaidEventOrderPayment(parsedRef.id, 'FAILED')
    }

    return NextResponse.json({ received: true })
  }

  const payment = await prisma.subscriptionPayment.findUnique({
    where: { id: parsedRef.id },
    select: { id: true },
  })

  if (!payment) {
    return NextResponse.json({ received: true })
  }

  if (payload.state === 'COMPLETE') {
    await activateSubscriptionPayment(payment.id, payload.mpesa_reference ?? payload.invoice_id ?? null)
  } else if (payload.state === 'FAILED') {
    await failSubscriptionPayment(payment.id, 'FAILED')
  }

  return NextResponse.json({ received: true })
}
