import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const members = await prisma.teamMember.findMany({
      where: { ownerId: session.user.id },
      include: {
        member: { select: { name: true, email: true, image: true } },
        eventAccess: {
          include: { event: { select: { id: true, title: true, slug: true, status: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ members })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
