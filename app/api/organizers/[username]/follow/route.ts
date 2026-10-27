import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(
  _req: NextRequest,
  props: { params: Promise<{ username: string }> }
) {
  const params = await props.params
  try {
    const rawUsername = params.username.toLowerCase().trim()
    const organiser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: rawUsername, mode: 'insensitive' } },
          { id: params.username.trim() },
          { email: { equals: rawUsername, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        showFollowerCountPublicly: true,
        _count: {
          select: { followers: true },
        },
      },
    })

    if (!organiser) {
      return NextResponse.json({ success: false, error: 'Organiser not found' }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    const followerUserId = session?.user?.id ?? null

    let isFollowing = false
    let notifyNewEvents = true

    if (followerUserId) {
      const followRecord = await prisma.organiserFollower.findUnique({
        where: {
          followerId_organiserId: {
            followerId: followerUserId,
            organiserId: organiser.id,
          },
        },
      })
      if (followRecord) {
        isFollowing = true
        notifyNewEvents = followRecord.notifyNewEvents
      }
    }

    const isSelf = Boolean(session?.user?.id && session.user.id === organiser.id)

    return NextResponse.json({
      success: true,
      organiserId: organiser.id,
      organiserUsername: organiser.username,
      organiserName: organiser.name,
      followerCount: organiser._count.followers,
      showFollowerCountPublicly: organiser.showFollowerCountPublicly,
      isFollowing,
      notifyNewEvents,
      isSelf,
    })
  } catch (error) {
    console.error('[Follow GET Error]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ username: string }> }
) {
  const params = await props.params
  try {
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
          error: 'Please sign in or create a free account on EventSlot to follow organisers.',
          code: 'AUTH_REQUIRED',
        },
        { status: 401 }
      )
    }

    const rawUsername = params.username.toLowerCase().trim()
    const organiser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: rawUsername, mode: 'insensitive' } },
          { id: params.username.trim() },
          { email: { equals: rawUsername, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true },
    })

    if (!organiser) {
      return NextResponse.json({ success: false, error: 'Organiser not found' }, { status: 404 })
    }

    if (organiser.id === followerUserId) {
      return NextResponse.json(
        { success: false, error: 'You cannot follow yourself.' },
        { status: 400 }
      )
    }

    const notifyNewEvents = typeof body?.notifyNewEvents === 'boolean' ? body.notifyNewEvents : true

    // Idempotent upsert
    await prisma.organiserFollower.upsert({
      where: {
        followerId_organiserId: {
          followerId: followerUserId,
          organiserId: organiser.id,
        },
      },
      create: {
        followerId: followerUserId,
        organiserId: organiser.id,
        notifyNewEvents,
      },
      update: {
        notifyNewEvents,
      },
    })

    const count = await prisma.organiserFollower.count({
      where: { organiserId: organiser.id },
    })

    return NextResponse.json({
      success: true,
      isFollowing: true,
      notifyNewEvents,
      followerCount: count,
    })
  } catch (error) {
    console.error('[Follow POST Error]', error)
    return NextResponse.json({ success: false, error: 'Failed to follow organiser' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  props: { params: Promise<{ username: string }> }
) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    const followerUserId = session?.user?.id ?? null

    if (!followerUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const rawUsername = params.username.toLowerCase().trim()
    const organiser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: rawUsername, mode: 'insensitive' } },
          { id: params.username.trim() },
          { email: { equals: rawUsername, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    })

    if (!organiser) {
      return NextResponse.json({ success: false, error: 'Organiser not found' }, { status: 404 })
    }

    await prisma.organiserFollower.deleteMany({
      where: {
        followerId: followerUserId,
        organiserId: organiser.id,
      },
    })

    const count = await prisma.organiserFollower.count({
      where: { organiserId: organiser.id },
    })

    return NextResponse.json({
      success: true,
      isFollowing: false,
      followerCount: count,
    })
  } catch (error) {
    console.error('[Follow DELETE Error]', error)
    return NextResponse.json({ success: false, error: 'Failed to unfollow organiser' }, { status: 500 })
  }
}
