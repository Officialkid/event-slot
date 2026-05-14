import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/isAdmin'
import { createHash } from 'crypto'
import { DAILY_SESSION_LIMIT } from '@/lib/assistant-context'

// POST /api/assistant/session — start a new session
export async function POST(req: NextRequest) {
  const authSession = await getServerSession(authOptions)

  const ip =
    req.headers.get('x-forwarded-for') ??
    req.headers.get('x-real-ip') ??
    'unknown'
  const ipHash = createHash('sha256').update(ip).digest('hex')

  // Daily limit check
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todaySessions = await prisma.assistantSession.count({
    where: { ipHash, startedAt: { gte: today } },
  })

  if (todaySessions >= DAILY_SESSION_LIMIT) {
    return NextResponse.json(
      {
        error: 'DAILY_LIMIT_REACHED',
        message:
          'You have reached the maximum support sessions for today. ' +
          'Please try again tomorrow or email info@eventsslot.com.',
      },
      { status: 429 }
    )
  }

  const channel = req.headers.get('x-channel') === 'voice' ? 'VOICE' : 'TEXT'

  const newSession = await prisma.assistantSession.create({
    data: {
      ipHash,
      userId: authSession?.user?.id ?? null,
      userAgent: req.headers.get('user-agent'),
      channel,
    },
  })

  return NextResponse.json({ sessionId: newSession.id })
}

// GET /api/assistant/session — admin: list all sessions (conversations inbox)
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = session.user.role === 'SUPER_ADMIN' || isAdminEmail(session.user.email)
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const flaggedOnly = searchParams.get('flagged') === 'true'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = 20

  const where = flaggedOnly ? { flagged: true } : {}

  const [sessions, total] = await Promise.all([
    prisma.assistantSession.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    }),
    prisma.assistantSession.count({ where }),
  ])

  return NextResponse.json({ sessions, total, page, pageSize })
}
