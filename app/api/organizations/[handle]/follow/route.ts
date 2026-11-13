import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normalizeOrgHandle } from '@/lib/organizationPermissions'

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ handle: string }> }
) {
  try {
    const params = await props.params
    const rawHandle = normalizeOrgHandle(params.handle)

    const org = await prisma.organization.findUnique({
      where: { handle: rawHandle },
      select: {
        id: true,
        name: true,
        handle: true,
        createdById: true,
        _count: {
          select: { followers: true },
        },
      },
    })

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    const followerUserId = session?.user?.id ?? null

    let isFollowing = false
    let notifyNewEvents = true

    if (followerUserId) {
      const followRecord = await prisma.organizationFollower.findUnique({
        where: {
          followerId_organizationId: {
            followerId: followerUserId,
            organizationId: org.id,
          },
        },
      })
      if (followRecord) {
        isFollowing = true
        notifyNewEvents = followRecord.notifyNewEvents
      }
    }

    const isSelf = Boolean(followerUserId && followerUserId === org.createdById)

    return NextResponse.json({
      success: true,
      organizationId: org.id,
      organizationHandle: org.handle,
      organizationName: org.name,
      followerCount: org._count.followers,
      isFollowing,
      notifyNewEvents,
      isSelf,
    })
  } catch (error) {
    console.error('[Organization Follow GET Error]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ handle: string }> }
) {
  try {
    const params = await props.params
    const rawHandle = normalizeOrgHandle(params.handle)

    let body: { notifyNewEvents?: boolean } = {}
    try {
      body = await req.json()
    } catch {
      // Optional body
    }

    const session = await getServerSession(authOptions)
    const followerUserId = session?.user?.id ?? null

    if (!followerUserId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please sign in or create a free account on EventSlot to follow organizations.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      )
    }

    const org = await prisma.organization.findUnique({
      where: { handle: rawHandle },
      select: { id: true, name: true, handle: true, createdById: true },
    })

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    const notifyNewEvents = body.notifyNewEvents ?? true

    await prisma.organizationFollower.upsert({
      where: {
        followerId_organizationId: {
          followerId: followerUserId,
          organizationId: org.id,
        },
      },
      create: {
        followerId: followerUserId,
        organizationId: org.id,
        notifyNewEvents,
      },
      update: {
        notifyNewEvents,
      },
    })

    const updatedFollowerCount = await prisma.organizationFollower.count({
      where: { organizationId: org.id },
    })

    return NextResponse.json({
      success: true,
      isFollowing: true,
      notifyNewEvents,
      followerCount: updatedFollowerCount,
      organizationName: org.name,
    })
  } catch (error) {
    console.error('[Organization Follow POST Error]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ handle: string }> }
) {
  try {
    const params = await props.params
    const rawHandle = normalizeOrgHandle(params.handle)
    const session = await getServerSession(authOptions)
    const followerUserId = session?.user?.id ?? null

    if (!followerUserId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', code: 'AUTH_REQUIRED' },
        { status: 401 }
      )
    }

    const org = await prisma.organization.findUnique({
      where: { handle: rawHandle },
      select: { id: true, name: true, handle: true },
    })

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 })
    }

    await prisma.organizationFollower.deleteMany({
      where: {
        followerId: followerUserId,
        organizationId: org.id,
      },
    })

    const updatedFollowerCount = await prisma.organizationFollower.count({
      where: { organizationId: org.id },
    })

    return NextResponse.json({
      success: true,
      isFollowing: false,
      followerCount: updatedFollowerCount,
      organizationName: org.name,
    })
  } catch (error) {
    console.error('[Organization Follow DELETE Error]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
