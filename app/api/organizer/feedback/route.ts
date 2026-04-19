import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const VALID_TYPES = ['complaint', 'compliment', 'suggestion', 'general'] as const

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { type, subject, message, rating } = body

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json({ error: 'Invalid feedback type' }, { status: 400 })
    }
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return NextResponse.json({ error: 'Subject is required' }, { status: 400 })
    }
    if (subject.trim().length > 100) {
      return NextResponse.json({ error: 'Subject must be 100 characters or fewer' }, { status: 400 })
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }
    if (message.trim().length > 2000) {
      return NextResponse.json({ error: 'Message must be 2000 characters or fewer' }, { status: 400 })
    }
    if (rating !== undefined && rating !== null) {
      const r = Number(rating)
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
      }
    }

    const showRating = type === 'compliment' || type === 'general'

    const feedback = await prisma.organizerFeedback.create({
      data: {
        organizerId: session.user.id,
        type: type.trim(),
        subject: subject.trim(),
        message: message.trim(),
        rating: showRating && rating != null ? Number(rating) : null,
      },
    })

    return NextResponse.json({ success: true, id: feedback.id }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/organizer/feedback]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = 20
    const skip = (page - 1) * limit

    const [items, total] = await Promise.all([
      prisma.organizerFeedback.findMany({
        where: { organizerId: session.user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
        select: {
          id: true,
          type: true,
          subject: true,
          rating: true,
          status: true,
          createdAt: true,
        },
      }),
      prisma.organizerFeedback.count({ where: { organizerId: session.user.id } }),
    ])

    return NextResponse.json({ items, total, page, pages: Math.ceil(total / limit) })
  } catch (err) {
    console.error('[GET /api/organizer/feedback]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
