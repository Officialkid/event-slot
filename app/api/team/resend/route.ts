import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendTeamInviteEmail } from '@/lib/email'
import { v4 as uuidv4 } from 'uuid'
import { APP_URL } from '@/lib/config'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { memberId } = await req.json()
    if (!memberId || typeof memberId !== 'string') {
      return NextResponse.json({ error: 'memberId is required' }, { status: 400 })
    }

    const record = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: {
        owner: { select: { name: true, email: true } },
        eventAccess: {
          take: 1,
          include: {
            event: { select: { title: true, startDate: true, location: true } },
          },
        },
      },
    })

    if (!record) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
    }

    if (record.ownerId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (record.status !== 'pending') {
      return NextResponse.json({ error: 'Cannot resend invite for a member who has already accepted' }, { status: 400 })
    }

    const newToken = uuidv4()

    await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        inviteToken: newToken,
        createdAt: new Date(),
      },
    })

    const BASE_URL = APP_URL
    const acceptUrl = `${BASE_URL}/team/accept?token=${newToken}`

    let emailFailed = false
    const assignedEvent = record.eventAccess[0]?.event
    try {
      await sendTeamInviteEmail({
        to: record.email,
        inviterName: record.owner.name ?? session.user.email ?? 'Your teammate',
        inviterEmail: record.owner.email ?? session.user.email ?? undefined,
        inviteToken: newToken,
        eventTitle: assignedEvent?.title ?? undefined,
        eventDate: assignedEvent?.startDate ?? undefined,
        eventLocation: assignedEvent?.location ?? undefined,
      })
    } catch (emailErr) {
      console.error('[team/resend] email failed:', emailErr)
      emailFailed = true
    }

    return NextResponse.json({ ok: true, emailFailed, acceptUrl })
  } catch (err) {
    console.error('[POST /api/team/resend]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
