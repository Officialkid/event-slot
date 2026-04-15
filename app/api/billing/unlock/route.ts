import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { PAYG_PRICING } from '@/lib/plans'
import { ratelimit } from '@/lib/ratelimit'

const FEATURES = ['watermark', 'csv', 'report', 'analytics', 'thankYou'] as const
type Feature = (typeof FEATURES)[number]

function getFeatureCost(feature: Feature, registrationCount: number): number {
  const blocks = Math.ceil(registrationCount / 100)
  switch (feature) {
    case 'watermark':
      return PAYG_PRICING.removeWatermark
    case 'csv':
      return PAYG_PRICING.csvExportBase + blocks * PAYG_PRICING.csvExportPer100
    case 'report':
      return PAYG_PRICING.wordReportBase + blocks * PAYG_PRICING.wordReportPer100
    case 'analytics':
      return PAYG_PRICING.analyticsUnlock
    case 'thankYou':
      return PAYG_PRICING.customThankYou
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Rate limit: max 10 unlock attempts per minute per user
    const { success: rateLimitOk } = await ratelimit.limit(`unlock:${session.user.id}`)
    if (!rateLimitOk) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429 }
      )
    }

    const { eventId, feature } = await req.json()

    if (!eventId || !feature || !FEATURES.includes(feature as Feature)) {
      return NextResponse.json({ error: 'Missing or invalid eventId/feature' }, { status: 400 })
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, organizerId: true, confirmedCount: true },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (event.organizerId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const cost = getFeatureCost(feature as Feature, event.confirmedCount)
    const userId = session.user.id

    // Atomic transaction: idempotency check + balance check + deduct + create unlock
    const result = await prisma.$transaction(async (tx) => {
      // Idempotency check inside the transaction
      const existing = await tx.eventUnlock.findFirst({
        where: { eventId, userId, feature },
      })
      if (existing) return { alreadyUnlocked: true }

      // Verify balance inside the transaction
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      })
      if (!user || user.creditBalance < cost) {
        throw new Error('INSUFFICIENT_CREDITS')
      }

      // Deduct credits
      await tx.user.update({
        where: { id: userId },
        data: { creditBalance: { decrement: cost } },
      })

      // Record the transaction
      await tx.creditTransaction.create({
        data: {
          userId,
          type: 'spend',
          amount: -cost,
          description: `Unlock "${feature}" for event "${event.title}"`,
          eventId,
        },
      })

      // Create the unlock record
      await tx.eventUnlock.create({
        data: { eventId, userId, feature },
      })

      return { alreadyUnlocked: false }
    })

    if (result.alreadyUnlocked) {
      return NextResponse.json({ success: true, alreadyUnlocked: true })
    }

    return NextResponse.json({ success: true, cost })
  } catch (err) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_CREDITS') {
      return NextResponse.json(
        {
          success: false,
          error: 'Insufficient credits',
          insufficientCredits: true,
          creditsUrl: `${process.env.NEXTAUTH_URL ?? 'https://www.eventsslot.com'}/dashboard/billing`,
        },
        { status: 402 }
      )
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
