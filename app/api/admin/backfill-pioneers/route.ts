import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/isAdmin'
import { runPioneerBackfill } from '@/lib/pioneer-backfill'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN' || isAdminEmail(session?.user?.email)

    if (!isSuperAdmin || !session?.user?.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const result = await runPioneerBackfill(150)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[admin/backfill-pioneers] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
