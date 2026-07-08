import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasAdminAccess } from '@/lib/isAdmin'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!hasAdminAccess(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const typeFilter = searchParams.get('type') ?? 'all'
    const statusFilter = searchParams.get('status') ?? 'all'
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = 25
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (typeFilter !== 'all') where.type = typeFilter
    if (statusFilter !== 'all') where.status = statusFilter

    const [
      items,
      total,
      unreadCount,
      totalFeedback,
      averageRating,
      ratingDistribution,
      recentComments,
    ] = await Promise.all([
      prisma.organizerFeedback.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        include: {
          organizer: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.organizerFeedback.count({ where }),
      prisma.organizerFeedback.count({ where: { status: 'unread' } }),
      prisma.assistantFeedback.count(),
      prisma.assistantFeedback.aggregate({ _avg: { rating: true } }),
      prisma.assistantFeedback.groupBy({
        by: ['rating'],
        _count: { rating: true },
        orderBy: { rating: 'asc' },
      }),
      prisma.assistantFeedback.findMany({
        where: { comment: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { rating: true, comment: true, createdAt: true },
      }),
    ])

    return NextResponse.json({
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
      unreadCount,
      assistantFeedback: {
        totalFeedback,
        averageRating: Math.round((averageRating._avg.rating ?? 0) * 10) / 10,
        ratingDistribution: ratingDistribution.map((r) => ({
          stars: r.rating,
          count: r._count.rating,
        })),
        recentComments,
      },
    })
  } catch (err) {
    console.error('[GET /api/admin/feedback]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
