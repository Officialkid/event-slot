import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// GET /api/assistant/my-sessions — list the current user's chat sessions
export async function GET(_req: NextRequest) {
  const authSession = await getServerSession(authOptions)
  if (!authSession?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sessions = await prisma.assistantSession.findMany({
    where: { userId: authSession.user.id },
    orderBy: { startedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      label: true,
      channel: true,
      status: true,
      startedAt: true,
      endedAt: true,
      messageCount: true,
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, role: true, content: true, isVoice: true, createdAt: true },
      },
    },
  })

  return NextResponse.json({ sessions })
}
