import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')

    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true, organizerId: true, dashboardToken: true },
    })

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)

    if (!isOwner && !hasValidToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const logs = await prisma.errorLog.findMany({
      where: { route: `waitlist-promotion-email:${event.id}` },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, message: true, createdAt: true },
    })

    const history = logs.map(log => {
      try {
        const parsed = JSON.parse(log.message) as {
          promoted?: number
          summary?: { attempted: number; sent: number; failed: number; skippedNoEmail: number }
        }
        return {
          id: log.id,
          createdAt: log.createdAt,
          promoted: parsed.promoted ?? 0,
          summary: parsed.summary ?? { attempted: 0, sent: 0, failed: 0, skippedNoEmail: 0 },
        }
      } catch {
        return {
          id: log.id,
          createdAt: log.createdAt,
          promoted: 0,
          summary: { attempted: 0, sent: 0, failed: 0, skippedNoEmail: 0 },
        }
      }
    })

    return NextResponse.json({
      success: true,
      latest: history[0] ?? null,
      history,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
