import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const following = await prisma.organiserFollower.findMany({
      where: { followerId: session.user.id },
      include: {
        organiser: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            showFollowerCountPublicly: true,
            _count: {
              select: {
                followers: true,
                events: {
                  where: {
                    status: 'active',
                    visibility: 'PUBLIC',
                    archived: false,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const items = following.map((entry) => ({
      organiserId: entry.organiser.id,
      name: entry.organiser.name || entry.organiser.username || 'Organiser',
      username: entry.organiser.username,
      image: entry.organiser.image,
      notifyNewEvents: entry.notifyNewEvents,
      followedAt: entry.createdAt.toISOString(),
      followerCount: entry.organiser.showFollowerCountPublicly
        ? entry.organiser._count.followers
        : null,
      activeEventsCount: entry.organiser._count.events,
    }))

    return NextResponse.json({
      success: true,
      following: items,
      totalCount: items.length,
    })
  } catch (error) {
    console.error('[Following GET Error]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
