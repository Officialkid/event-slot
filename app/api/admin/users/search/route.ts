import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { isAdminEmail } from '@/lib/isAdmin'

type SessionLike = {
  user?: {
    role?: string | null
    email?: string | null
  }
} | null

function canManageBroadcast(session: SessionLike): boolean {
  return Boolean(session?.user?.role === 'SUPER_ADMIN' || isAdminEmail(session?.user?.email))
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!canManageBroadcast(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const q = (req.nextUrl.searchParams.get('q') || '').trim()

  if (q.length < 2) {
    return NextResponse.json({ users: [] })
  }

  const users = await prisma.user.findMany({
    where: {
      suspended: false,
      email: { not: null },
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      marketingConsent: true,
    },
    take: 20,
  })

  return NextResponse.json({ users })
}
