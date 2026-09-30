import { NextRequest, NextResponse } from 'next/server'
import { recalculateLeaderboard } from '@/lib/leaderboard'

// Cloud Scheduler: every 60 minutes
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await Promise.all([
    recalculateLeaderboard('week'),
    recalculateLeaderboard('month'),
    recalculateLeaderboard('all-time'),
  ])

  return NextResponse.json({ ok: true, results })
}
