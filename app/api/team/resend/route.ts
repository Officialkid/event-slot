import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendTeamInviteEmail } from '@/lib/email'
import { v4 as uuidv4 } from 'uuid'

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
      include: { owner: { select: { name: true } } },
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

    let emailFailed = false
    try {
      await sendTeamInviteEmail({
        to: record.email,
        inviterName: record.owner.name ?? session.user.email ?? 'Your teammate',
        inviteToken: newToken,
      })
    } catch (emailErr) {
      console.error('[team/resend] email failed:', emailErr)
      emailFailed = true
    }

    return NextResponse.json({ ok: true, emailFailed })
  } catch (err) {
    console.error('[POST /api/team/resend]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
