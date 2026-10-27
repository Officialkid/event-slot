import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  props: { params: Promise<{ organiserId: string }> }
) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { organiserId } = params
    const body = await req.json()

    if (typeof body.notifyNewEvents !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'notifyNewEvents (boolean) is required' },
        { status: 400 }
      )
    }

    const updated = await prisma.organiserFollower.updateMany({
      where: {
        followerId: session.user.id,
        organiserId,
      },
      data: {
        notifyNewEvents: body.notifyNewEvents,
      },
    })

    if (updated.count === 0) {
      return NextResponse.json(
        { success: false, error: 'Follow relationship not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      notifyNewEvents: body.notifyNewEvents,
    })
  } catch (error) {
    console.error('[Following PATCH Error]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  props: { params: Promise<{ organiserId: string }> }
) {
  const params = await props.params
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { organiserId } = params

    await prisma.organiserFollower.deleteMany({
      where: {
        followerId: session.user.id,
        organiserId,
      },
    })

    return NextResponse.json({
      success: true,
      isFollowing: false,
    })
  } catch (error) {
    console.error('[Following DELETE Error]', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
