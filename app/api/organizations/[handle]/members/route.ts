import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import {
  checkOrgPermission,
  normalizeOrgHandle,
} from '@/lib/organizationPermissions'

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ handle: string }> }
) {
  try {
    const params = await props.params
    const rawHandle = normalizeOrgHandle(params.handle)
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const org = await prisma.organization.findUnique({
      where: { handle: rawHandle },
      select: { id: true },
    })

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const permCheck = await checkOrgPermission({
      userId: session.user.id,
      organizationId: org.id,
      permission: 'view_members',
    })

    if (!permCheck.allowed) {
      return NextResponse.json(
        { success: false, error: permCheck.reason || 'You do not have permission to view members.' },
        { status: 403 }
      )
    }

    const canInvite = permCheck.role === 'OWNER' || permCheck.role === 'ADMIN'

    const [members, invitations] = await Promise.all([
      prisma.organizationMember.findMany({
        where: {
          organizationId: org.id,
          status: { in: ['ACTIVE', 'SUSPENDED'] },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              username: true,
              image: true,
            },
          },
        },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      }),
      canInvite
        ? prisma.organizationInvitation.findMany({
            where: {
              organizationId: org.id,
              status: 'PENDING',
              expiresAt: { gt: new Date() },
            },
            select: {
              id: true,
              type: true,
              email: true,
              role: true,
              expiresAt: true,
              maxUses: true,
              usesCount: true,
              createdAt: true,
              createdBy: {
                select: { name: true, email: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),
    ])

    return NextResponse.json({
      success: true,
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        status: m.status,
        createdAt: m.createdAt,
        user: m.user,
      })),
      invitations,
      currentUserRole: permCheck.role,
    })
  } catch (error) {
    console.error('[GET /api/organizations/[handle]/members] Error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
