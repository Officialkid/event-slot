import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000)

    // ─── Step 1: Delete data for free users past 30-day window ────────────────

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

    // Only expire data for free-plan organizers
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
      where: { userId, type: 'data_expiry_warning', eventId: event.id },
    })
    if (existing) continue

    const daysAgo = Math.floor(
      (now.getTime() - new Date(event.deadline!).getTime()) / (1000 * 60 * 60 * 24)
    )
    const daysRemaining = 30 - daysAgo

    await prisma.notification.create({
      data: {
        userId,
        type: 'data_expiry_warning',
        eventId: event.id,
        message: `Data for "${event.title}" will be deleted in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
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
