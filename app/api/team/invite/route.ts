import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TEAM_MEMBER_LIMIT } from '@/lib/plans'
import { sendTeamInviteEmail } from '@/lib/email'
import { v4 as uuidv4 } from 'uuid'
import { teamInviteSchema } from '@/lib/schemas/team.schema'
import { APP_URL } from '@/lib/config'

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

    const emails = parsed.data.emails
    const eventId = parsed.data.eventId

    // If eventId is provided, verify it belongs to the caller
    if (eventId) {
      const eventCheck = await prisma.event.findFirst({
        where: { id: eventId, organizerId: session.user.id },
        select: { id: true },
      })
      if (!eventCheck) {
        return NextResponse.json({ error: 'Event not found or access denied' }, { status: 403 })
      }
    }

    // Reject if any email is the inviter's own address
    const selfEmail = session.user.email?.toLowerCase()
    if (emails.some(e => e === selfEmail)) {
      return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 })
    }

    const [owner, currentMembers] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true, name: true, email: true },
      }),
      prisma.teamMember.count({
        where: { ownerId: session.user.id, status: 'accepted' },
      }),
    ])

    if (currentMembers >= TEAM_MEMBER_LIMIT) {
      return NextResponse.json({
        success: false,
        error: `You can have up to ${TEAM_MEMBER_LIMIT} team members. Remove one to invite another.`,
      }, { status: 403 })
    }

    const inviterName = owner?.name || owner?.email || 'Someone'
    const BASE_URL = APP_URL

    type InviteResult = {
      email: string
      ok: boolean
      alreadyInvited?: boolean
      emailFailed?: boolean
      acceptUrl?: string
      error?: string
    }

    const results: InviteResult[] = await Promise.all(
      emails.map(async (email): Promise<InviteResult> => {
        try {
          const existing = await prisma.teamMember.findFirst({
            where: { ownerId: session.user.id, email, status: { in: ['pending', 'accepted'] } },
          })
          if (existing) {
            return { email, ok: false, alreadyInvited: true, error: 'Already invited or a member' }
          }

          const inviteToken = uuidv4()
          const newMember = await prisma.teamMember.create({
            data: { ownerId: session.user.id, email, status: 'pending', inviteToken },
          })

          // If invite is for a specific event, pre-create the event access record
          if (eventId) {
            await prisma.teamMemberEvent.create({
              data: { teamMemberId: newMember.id, eventId },
            }).catch(() => {/* ignore if already exists */})
          }

          const acceptUrl = `${BASE_URL}/team/accept?token=${inviteToken}`
          let emailFailed = false
          try {
            await sendTeamInviteEmail({ to: email, inviterName, inviteToken })
          } catch (emailErr) {
            console.error('[team/invite] email failed:', emailErr)
            emailFailed = true
          }

          return { email, ok: true, emailFailed, acceptUrl }
        } catch (err) {
          console.error('[team/invite] per-email error:', err)
          return { email, ok: false, error: 'Internal error' }
        }
      })
    )

    const anyOk = results.some(r => r.ok)
    const status = anyOk ? 201 : results.every(r => r.alreadyInvited) ? 409 : 500
    return NextResponse.json({ results }, { status })
  } catch (err) {
    console.error('[team/invite]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
