import { NextRequest, NextResponse } from "next/server"
import { dispatchPaystackWebhook } from "@/lib/paystackWebhookDispatcher"

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get("x-paystack-signature")

  const result = await dispatchPaystackWebhook({
    rawBody,
    signature,
  })

  return NextResponse.json(result.body, { status: result.status })
}
