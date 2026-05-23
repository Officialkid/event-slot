import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/superadmin/badges/backfill-pioneers
 * One-time backfill: award PIONEER badge to the first 150 users who don't have it yet.
 * Protected by CRON_SECRET (same token used for all privileged internal operations).
 *
 * Usage:
 *   curl -X POST https://www.eventsslot.com/api/superadmin/badges/backfill-pioneers \
 *     -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const firstUsers = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    take: 150,
    select: { id: true },
  })

  let awarded = 0
  for (const u of firstUsers) {
    const has = await prisma.userBadge.findUnique({
      where: { userId_badge: { userId: u.id, badge: 'PIONEER' } },
    })
    if (!has) {
      await prisma.userBadge.create({ data: { userId: u.id, badge: 'PIONEER' } })
      await prisma.pioneerBadge.upsert({
        where: { userId: u.id },
        update: {},
        create: { userId: u.id, hasSeenCongratulations: false },
      })
      awarded++
    }
  }

  return NextResponse.json({ awarded, total: firstUsers.length })
}
