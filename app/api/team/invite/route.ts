import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TEAM_MEMBER_LIMIT } from '@/lib/plans'
import { sendTeamInviteEmail } from '@/lib/email'
import { v4 as uuidv4 } from 'uuid'
import { teamInviteSchema } from '@/lib/schemas/team.schema'
import { APP_URL } from '@/lib/config'

type InviteResult = {
  email: string
  ok: boolean
  alreadyInvited?: boolean
  emailFailed?: boolean
  acceptUrl?: string
  error?: string
}

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

    if (eventId) {
      const eventCheck = await prisma.event.findFirst({
        where: { id: eventId, organizerId: session.user.id },
        select: { id: true },
      })
      if (!eventCheck) {
        return NextResponse.json({ error: 'Event not found or access denied' }, { status: 403 })
      }
    }

    const selfEmail = session.user.email?.toLowerCase()
    if (emails.some((email) => email === selfEmail)) {
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

    if (eventId) {
      const eventMembers = await prisma.teamMemberEvent.count({
        where: { eventId },
      })
      if (eventMembers >= 10) {
        return NextResponse.json(
          {
            success: false,
            error: `This event already has 10 assigned team members. You can have up to 10 members per event.`,
          },
          { status: 403 }
        )
      }
    } else if (currentMembers >= 50) {
      return NextResponse.json(
        {
          success: false,
          error: `Your workspace has reached the limit of 50 team collaborators across all events.`,
        },
        { status: 403 }
      )
    }

    const inviterName = owner?.name || owner?.email || 'Someone'
    const baseUrl = APP_URL

    const settled = await Promise.allSettled(
      emails.map(async (email): Promise<InviteResult> => {
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

        if (eventId) {
          await prisma.teamMemberEvent.create({
            data: { teamMemberId: newMember.id, eventId },
          }).catch(() => {
            // Ignore duplicate event access records so the invite still succeeds.
          })
        }

        const acceptUrl = `${baseUrl}/team/accept?token=${inviteToken}`
        try {
          await sendTeamInviteEmail({ to: email, inviterName, inviteToken })
          return { email, ok: true, emailFailed: false, acceptUrl }
        } catch (emailErr) {
          const message = emailErr instanceof Error ? emailErr.message : 'Email delivery failed'
          console.error('[team/invite] email failed:', message)
          return { email, ok: true, emailFailed: true, acceptUrl, error: message }
        }
      })
    )

    const results: InviteResult[] = settled.map((item, index) => {
      if (item.status === 'fulfilled') return item.value
      const reason = item.reason instanceof Error ? item.reason.message : 'Internal error'
      console.error('[team/invite] per-email error:', reason)
      return { email: emails[index] ?? 'unknown', ok: false, error: reason }
    })

    const sentCount = results.filter((result) => result.ok && !result.emailFailed).length
    const failedCount = results.length - sentCount
    const failedReasons = results
      .filter((result) => result.emailFailed || (!result.ok && !result.alreadyInvited))
      .map((result) => result.error)
      .filter(Boolean) as string[]

    if (failedReasons.length > 0) {
      console.error('[team-invite] Some invites failed:', failedReasons)
    }

    const linkableResults = results.filter((result) => !!result.acceptUrl)

    if (linkableResults.length > 0) {
      return NextResponse.json(
        {
          sent: sentCount,
          failed: failedCount,
          emailFailed: sentCount === 0 || results.some((result) => result.emailFailed),
          message: sentCount > 0
            ? `Invite${sentCount > 1 ? 's' : ''} sent successfully.`
            : 'Invite created, but email delivery is paused. Share the direct invite link below.',
          results,
        },
        { status: 201 }
      )
    }

    return NextResponse.json(
      {
        sent: sentCount,
        failed: failedCount,
        message: `Invite${sentCount > 1 ? 's' : ''} sent successfully.`,
        results,
      },
      { status: 201 }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[team-invite] Error:', err)
    return NextResponse.json({ error: `Failed to send invites: ${message}` }, { status: 500 })
  }
}
