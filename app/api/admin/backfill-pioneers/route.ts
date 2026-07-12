import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasAdminAccess } from '@/lib/isAdmin'
import { runPioneerBackfill } from '@/lib/pioneer-backfill'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session) || !session?.user?.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await runPioneerBackfill(150)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[admin/backfill-pioneers] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
