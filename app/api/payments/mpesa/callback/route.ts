import { NextRequest, NextResponse } from 'next/server'
import { processMpesaCallback, type MpesaCallbackBody } from '@/lib/mpesaCallback'

// Safaricom posts to this URL after the user completes (or cancels) the STK push.
// This route MUST be publicly accessible - no auth middleware.
export async function POST(req: NextRequest) {
  let body: MpesaCallbackBody | null = null
  try {
    body = (await req.json()) as MpesaCallbackBody
  } catch {
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
  }

  try {
    await processMpesaCallback(body)
  } catch (error) {
    console.error('[mpesa/callback] failed to process callback', error)
  }

  return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' })
}
