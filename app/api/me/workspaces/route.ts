import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isAdminEmail } from '@/lib/isAdmin'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [user, teamMemberships] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          image: true,
        },
      }),
      prisma.teamMember.findMany({
        where: {
          memberId: session.user.id,
          status: 'accepted',
        },
        include: {
          owner: {
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              image: true,
            },
          },
        },
      }),
    ])

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isPlatformAdmin = Boolean(user.email && isAdminEmail(user.email))

    const organizations = teamMemberships
      .map(tm => tm.owner)
      .filter((owner): owner is NonNullable<typeof owner> => Boolean(owner))

    return NextResponse.json({
      success: true,
      personal: {
        id: user.id,
        name: user.name || 'Personal Account',
        username: user.username,
        email: user.email,
        image: user.image,
      },
      organizations: organizations.map(org => ({
        id: org.id,
        name: org.name || org.username || 'Organization',
        username: org.username,
        email: org.email,
        image: org.image,
      })),
      isAdmin: isPlatformAdmin,
    })
  } catch (error) {
    console.error('Failed to load workspaces:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to load available workspaces' },
      { status: 500 }
    )
  }
}
