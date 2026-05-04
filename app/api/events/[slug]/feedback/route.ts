import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')
    const session = await getServerSession(authOptions)

    const event = await prisma.event.findUnique({
      where: { slug },
      include: { organizer: { select: { plan: true } } },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)

    if (!isOwner && !hasValidToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [feedback, confirmedCount] = await Promise.all([
      prisma.attendeeFeedback.findMany({
        where: { eventId: event.id },
        orderBy: { submittedAt: 'desc' },
        select: {
          id: true,
          rating: true,
          enjoyed: true,
          improve: true,
          complaint: true,
          submittedAt: true,
        },
      }),
      prisma.registration.count({
        where: { eventId: event.id, status: 'confirmed' },
      }),
    ])

    const totalResponses = feedback.length
    const averageRating = totalResponses > 0
      ? Math.round((feedback.reduce((sum, f) => sum + f.rating, 0) / totalResponses) * 10) / 10
      : null

    return NextResponse.json({ feedback, totalResponses, averageRating, confirmedCount })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
