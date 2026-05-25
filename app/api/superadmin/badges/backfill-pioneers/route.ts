import { NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { runPioneerBackfill } from '@/lib/pioneer-backfill'

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
  try {
    const authHeader = request.headers.get('authorization')
    if (!env.CRON_SECRET || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await runPioneerBackfill(150)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[superadmin/backfill-pioneers] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
