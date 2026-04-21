import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200)
    const skip = (page - 1) * limit

    const members = await prisma.teamMember.findMany({
      where: { ownerId: session.user.id },
      select: {
        id: true,
        status: true,
        email: true,
        ownerId: true,
        memberId: true,
        createdAt: true,
        member: { select: { name: true, email: true, image: true } },
        eventAccess: {
          select: {
            id: true,
            teamMemberId: true,
            eventId: true,
            event: { select: { id: true, title: true, slug: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip,
    })

    return NextResponse.json({ members, page, limit })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
