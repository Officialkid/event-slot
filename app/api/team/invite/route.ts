import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TEAM_MEMBER_LIMIT } from '@/lib/plans'
import { sendTeamInviteEmail } from '@/lib/email'
import { v4 as uuidv4 } from 'uuid'
import { teamInviteSchema } from '@/lib/schemas/team.schema'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = teamInviteSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      )
    }

    const normalizedEmail = parsed.data.email

    // Cannot invite yourself
    if (normalizedEmail === session.user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 })
    }

    const owner = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, name: true, email: true },
    })

    const currentMembers = await prisma.teamMember.count({
      where: { ownerId: session.user.id, status: 'accepted' },
    })

    if (currentMembers >= TEAM_MEMBER_LIMIT) {
      return NextResponse.json({
        success: false,
        error: `You can have up to ${TEAM_MEMBER_LIMIT} team members. Remove one to invite another.`,
      }, { status: 403 })
    }

    // Check if already invited
    const existing = await prisma.teamMember.findFirst({
      where: { ownerId: session.user.id, email: normalizedEmail, status: { in: ['pending', 'accepted'] } },
    })
    if (existing) {
      return NextResponse.json({ error: 'This person has already been invited or is already a member' }, { status: 409 })
    }

    const inviteToken = uuidv4()

    await prisma.teamMember.create({
      data: {
        ownerId: session.user.id,
        email: normalizedEmail,
        status: 'pending',
        inviteToken,
      },
    })

    const inviterName = owner?.name || owner?.email || 'Someone'
    const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://www.eventsslot.com'
    const acceptUrl = `${BASE_URL}/team/accept?token=${inviteToken}`

    let emailFailed = false
    try {
      await sendTeamInviteEmail({ to: normalizedEmail, inviterName, inviteToken })
    } catch (emailErr) {
      console.error('[team/invite] email failed:', emailErr)
      emailFailed = true
    }

    return NextResponse.json({ ok: true, emailFailed, acceptUrl }, { status: 201 })
  } catch (err) {
    console.error('[team/invite]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
