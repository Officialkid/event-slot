import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const excludeSlug = searchParams.get('excludeSlug')?.trim() || ''
    const organizerId = searchParams.get('organizerId')?.trim() || ''
    const category = searchParams.get('category')?.trim() || ''

    const now = new Date()

    const activeUpcomingCondition = {
      archived: false,
      visibility: 'PUBLIC' as const,
      status: { in: ['published', 'active', 'ACTIVE', 'PUBLISHED'] },
      AND: [
        {
          OR: [
            { eventEndAt: { gte: now } },
            { eventDate: { gte: now } },
            { eventDate: null },
          ],
        },
        {
          OR: [
            { deadline: null },
            { deadline: { gte: now } },
          ],
        },
      ],
    }

    // 1. More from this Organiser (strictly active upcoming events)
    let moreFromOrganiser: Array<{
      id: string
      title: string
      slug: string
      imageUrl: string | null
      eventDate: Date | null
      location: string | null
      isPaid: boolean
      ticketPrice: number | null
      category: string | null
      organizerName: string | null
      status: string
    }> = []

    if (organizerId) {
      moreFromOrganiser = await prisma.event.findMany({
        where: {
          organizerId,
          slug: { not: excludeSlug },
          ...activeUpcomingCondition,
        },
        select: {
          id: true,
          title: true,
          slug: true,
          imageUrl: true,
          eventDate: true,
          location: true,
          isPaid: true,
          ticketPrice: true,
          category: true,
          organizerName: true,
          status: true,
        },
        orderBy: [
          { eventDate: 'asc' },
          { createdAt: 'desc' },
        ],
        take: 3,
      })
    }

    // 2. Events You May Like (strictly active upcoming events)
    const excludeIds = [
      ...(excludeSlug ? [excludeSlug] : []),
      ...moreFromOrganiser.map(e => e.slug),
    ]

    let eventsYouMayLike = await prisma.event.findMany({
      where: {
        slug: { notIn: excludeIds },
        ...activeUpcomingCondition,
        ...(category ? { category: { equals: category, mode: 'insensitive' as const } } : {}),
      },
      select: {
        id: true,
        title: true,
        slug: true,
        imageUrl: true,
        eventDate: true,
        location: true,
        isPaid: true,
        ticketPrice: true,
        category: true,
        organizerName: true,
        status: true,
        organizer: {
          select: {
            username: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: [
        { confirmedCount: 'desc' },
        { eventDate: 'asc' },
      ],
      take: 4,
    })

    // If category yielded fewer than 4, fill remaining with other upcoming public events
    if (eventsYouMayLike.length < 4) {
      const currentExcluded = [...excludeIds, ...eventsYouMayLike.map(e => e.slug)]
      const fillEvents = await prisma.event.findMany({
        where: {
          slug: { notIn: currentExcluded },
          ...activeUpcomingCondition,
        },
        select: {
          id: true,
          title: true,
          slug: true,
          imageUrl: true,
          eventDate: true,
          location: true,
          isPaid: true,
          ticketPrice: true,
          category: true,
          organizerName: true,
          status: true,
          organizer: {
            select: {
              username: true,
              name: true,
              image: true,
            },
          },
        },
        orderBy: [
          { confirmedCount: 'desc' },
          { eventDate: 'asc' },
        ],
        take: 4 - eventsYouMayLike.length,
      })
      if (Array.isArray(fillEvents)) {
        eventsYouMayLike = [...eventsYouMayLike, ...fillEvents]
      }
    }

    return NextResponse.json({
      success: true,
      moreFromOrganiser: moreFromOrganiser.map(e => ({
        ...e,
        eventDate: e.eventDate ? e.eventDate.toISOString() : null,
      })),
      eventsYouMayLike: eventsYouMayLike.map(e => ({
        ...e,
        eventDate: e.eventDate ? e.eventDate.toISOString() : null,
        organizerUsername: e.organizer?.username || null,
        organizerDisplayName: e.organizerName || e.organizer?.name || 'Organizer',
      })),
    })
  } catch (error) {
    console.error('Error in /api/events/recommended:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch recommended events' },
      { status: 500 }
    )
  }
}
