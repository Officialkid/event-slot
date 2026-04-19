import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getPlanLimits } from '@/lib/plans'
import { sendTeamInviteEmail } from '@/lib/email'
import { v4 as uuidv4 } from 'uuid'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email } = await req.json()
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Cannot invite yourself
    if (normalizedEmail === session.user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 })
    }

    const owner = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, name: true, email: true },
    })

    const plan = owner?.plan ?? 'free'
    const limits = getPlanLimits(plan)

    const currentMembers = await prisma.teamMember.count({
      where: { ownerId: session.user.id, status: 'accepted' },
    })

    if (currentMembers >= limits.maxTeamMembers) {
      return NextResponse.json({
        success: false,
        error: `Your ${plan} plan supports up to ${limits.maxTeamMembers} team member${limits.maxTeamMembers === 1 ? '' : 's'}. Upgrade to add more.`,
        upgradeRequired: true,
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

    let emailFailed = false
    try {
      await sendTeamInviteEmail({ to: normalizedEmail, inviterName, inviteToken })
    } catch (emailErr) {
      console.error('[team/invite] email failed:', emailErr)
      emailFailed = true
    }

    return NextResponse.json({ ok: true, emailFailed }, { status: 201 })
  } catch (err) {
    console.error('[team/invite]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
