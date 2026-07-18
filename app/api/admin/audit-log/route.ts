// GET /api/admin/audit-log?action=ADMIN_MODE_ACTIVATED&limit=50
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession }          from 'next-auth'
import { authOptions }               from '@/lib/auth'
import { prisma }                    from '@/lib/prisma'
import { hasAdminAccess }            from '@/lib/isAdmin'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!hasAdminAccess(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const action = req.nextUrl.searchParams.get('action')
  const limit  = Math.min(
    parseInt(req.nextUrl.searchParams.get('limit') ?? '100'),
    500,
  )

  const logs = await prisma.auditLog.findMany({
    where:   action ? { action } : undefined,
    orderBy: { createdAt: 'desc' },
    take:    limit,
  })

  return NextResponse.json({ logs })
}
