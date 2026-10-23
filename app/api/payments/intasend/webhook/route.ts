import { NextResponse } from 'next/server'

/**
 * DECOMMISSIONED ENDPOINT (Phase 04b Remediation)
 * IntraSend payment processing and webhooks have been permanently retired from EventSlot.
 * This route is entirely inert: it parses no payload, performs no database queries,
 * invokes no payment finalizers, and strictly returns HTTP 410 Gone.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'IntaSend payment processing has been decommissioned on EventSlot.',
      provider: 'intasend',
      status: 'DECOMMISSIONED',
    },
    { status: 410 }
  )
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'IntaSend payment processing has been decommissioned on EventSlot.',
      provider: 'intasend',
      status: 'DECOMMISSIONED',
    },
    { status: 410 }
  )
}
