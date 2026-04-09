import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { spendCredits } from '@/lib/credits'
import { PAYG_PRICING } from '@/lib/plans'

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

    // Check if already unlocked
    const existing = await prisma.eventUnlock.findFirst({
      where: { eventId, userId: session.user.id, feature },
    })
    if (existing) {
      return NextResponse.json({ success: true, alreadyUnlocked: true })
    }

    const cost = getFeatureCost(feature as Feature, event.confirmedCount)

    const result = await spendCredits({
      userId: session.user.id,
      amount: cost,
      description: `Unlock "${feature}" for event "${event.title}"`,
      eventId,
    })

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          insufficientCredits: true,
          cost,
          creditsUrl: `${process.env.NEXTAUTH_URL}/dashboard/billing`,
        },
        { status: 402 }
      )
    }

    await prisma.eventUnlock.create({
      data: { eventId, userId: session.user.id, feature },
    })

    return NextResponse.json({ success: true, cost })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
