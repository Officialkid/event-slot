import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

function isSuperAdmin(email: string | null | undefined) {
  return email && email === process.env.SUPER_ADMIN_EMAIL
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!isSuperAdmin(session?.user?.email)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const plansParam = req.nextUrl.searchParams.get('plans') ?? 'all'
    const plans = plansParam.split(',').map(p => p.trim()).filter(Boolean)
    const isAll = plans.includes('all') || plans.length === 0

    const count = await prisma.user.count({
      where: {
        email: { not: null },
        suspended: false,
        ...(isAll ? {} : { plan: { in: plans } }),
      },
    })

    return NextResponse.json({ count })
  } catch (err) {
    console.error('[admin/broadcast/count] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
