import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { archiveEventToR2 } from '@/lib/r2Vault'
import { isPricingRolloutActive } from '@/lib/pricingRollout'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000)

    // ─── Step 1: Cloudflare R2 Vault Archiving & Cold Storage ────────────────
    const candidatesForExpiry = await prisma.event.findMany({
      where: {
        deadline: { lt: thirtyDaysAgo },
        dataExpired: false,
      },
      include: {
        organizer: { select: { plan: true } },
      },
    })

    let expiredCount = 0
    let archivedCount = 0

    for (const event of candidatesForExpiry) {
      let plan = event.organizer?.plan

      // Handle legacy events with no organizerId — look up by email
      if (!plan && event.organizerEmail) {
        const user = await prisma.user.findUnique({
          where: { email: event.organizerEmail },
          select: { plan: true },
        })
        plan = user?.plan
      }

      // Archive to Cloudflare R2 Vault first
      const archiveRes = await archiveEventToR2(event.id, { reason: '30-day-vault-archive' })
      if (archiveRes.success) {
        archivedCount++
      }

      // If pricing/upgrade tiers are not officially rolled out yet, keep the database intact
      // and do NOT mark data as expired or show expiration warnings to organizers.
      if (!isPricingRolloutActive()) {
        continue
      }

      // Only expire data for free-plan organizers once upgrade tiers are active
      if (!plan || plan !== 'free') continue

      await prisma.registration.deleteMany({ where: { eventId: event.id } })
      await prisma.eventView.deleteMany({ where: { eventId: event.id } })

      await prisma.event.update({
        where: { id: event.id },
        data: {
          confirmedCount: 0,
          waitlistCount: 0,
          dataExpired: true,
          status: 'expired',
        },
      })

      expiredCount++
    }

    // ─── Step 2: Warn users in the 20–29 day window (10-day heads-up) ────────
    // Only send warnings once pricing rollout / upgrade tiers are live
    if (!isPricingRolloutActive()) {
      return NextResponse.json({ ok: true, archivedCount, expiredCount: 0, warnCount: 0, mode: 'upgrade_dormant' })
    }

  const candidatesForWarning = await prisma.event.findMany({
    where: {
      deadline: {
        lt: twentyDaysAgo,
        gt: thirtyDaysAgo,
      },
      dataExpired: false,
    },
    include: {
      organizer: { select: { id: true, plan: true } },
    },
  })

  let warnCount = 0

  for (const event of candidatesForWarning) {
    let userId = event.organizerId
    let plan = event.organizer?.plan

    // Handle legacy events with no organizerId
    if (!userId || !plan) {
      if (event.organizerEmail) {
        const user = await prisma.user.findUnique({
          where: { email: event.organizerEmail },
          select: { id: true, plan: true },
        })
        if (user) {
          userId = user.id
          plan = user.plan
        }
      }
    }

    if (!userId || plan !== 'free') continue

    // Don't create a duplicate warning for the same event
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type: 'EVENT',
        title: 'Data Expiry Warning',
        link: `/dashboard/events/${event.slug}`,
      },
    })
    if (existing) continue

    const daysAgo = Math.floor(
      (now.getTime() - new Date(event.deadline!).getTime()) / (1000 * 60 * 60 * 24)
    )
    const daysRemaining = 30 - daysAgo

    await prisma.notification.create({
      data: {
        userId,
        type: 'EVENT',
        title: 'Data Expiry Warning',
        message: `Data for "${event.title}" will be deleted in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
        link: `/dashboard/events/${event.slug}`,
      },
    })

    warnCount++
  }

    return NextResponse.json({ ok: true, expiredCount, warnCount })
  } catch (err) {
    console.error('[cron/expire-data] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
