import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasAdminAccess } from '@/lib/isAdmin'
import { backfillTickets } from '@/lib/tickets'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!hasAdminAccess(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const count = await backfillTickets()
    return NextResponse.json({ success: true, backfilled: count })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
