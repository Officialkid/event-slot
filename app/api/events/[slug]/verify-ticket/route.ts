import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasTeamEventAccess } from '@/lib/eventAccess'

type EventQuestion = { id: string; type: string; label: string }

type VerifyBody = {
  token?: string
  code?: string
  identity?: string
}

type RegistrationLookup = {
  id: string
  status: string
  attendeeEmail: string | null
  checkedIn: boolean
  checkedInAt: Date | null
  confirmationCode: string | null
  answers: Array<{ questionId: string; value: string }>
  registrationNumber: number | null
}

function extractCode(input: string): string {
  const raw = input.trim()
  if (!raw) return ''

  try {
    const parsed = new URL(raw)
    const parts = parsed.pathname.split('/').filter(Boolean)
    const verifyIdx = parts.findIndex((p) => p.toLowerCase() === 'verify')
    if (verifyIdx >= 0 && parts[verifyIdx + 1]) {
      return decodeURIComponent(parts[verifyIdx + 1])
    }
  } catch {
    // Not a URL; continue with raw value.
  }

  return raw
}

function getNameFromAnswers(answers: Array<{ questionId: string; value: string }>, questions: EventQuestion[]): string {
  const nameQuestionIds = questions
    .filter((q) => q.type === 'text' && q.label.toLowerCase().includes('name'))
    .map((q) => q.id)

  if (nameQuestionIds.length === 0) return ''
  const hit = answers.find((a) => nameQuestionIds.includes(a.questionId) && a.value?.trim())
  return hit?.value?.trim() ?? ''
}

export async function POST(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params

  try {
    const body = (await req.json()) as VerifyBody
    const { token, code, identity } = body

    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true, title: true, organizerId: true, dashboardToken: true, questions: true },
    })

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    const session = await getServerSession(authOptions)
    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)
    const hasTeamAccess = !!(session?.user?.id && await hasTeamEventAccess({
      userId: session.user.id,
      organizerId: event.organizerId,
      eventId: event.id,
    }))

    if (!isOwner && !hasValidToken && !hasTeamAccess) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const normalizedCode = code ? extractCode(code) : ''
    const normalizedIdentity = identity?.trim() ?? ''

    if (!normalizedCode && !normalizedIdentity) {
      return NextResponse.json({ success: false, error: 'Provide a ticket code or attendee identity.' }, { status: 400 })
    }

    const questions = ((event.questions as unknown) as EventQuestion[]) ?? []

    let target: RegistrationLookup | null = null

    if (normalizedCode) {
      target = await prisma.registration.findFirst({
        where: {
          eventId: event.id,
          confirmationCode: normalizedCode,
        },
        select: {
          id: true,
          status: true,
          attendeeEmail: true,
          checkedIn: true,
          checkedInAt: true,
          confirmationCode: true,
          answers: true,
          registrationNumber: true,
        },
      }) as RegistrationLookup | null
    } else {
      const all = await prisma.registration.findMany({
        where: {
          eventId: event.id,
          status: 'confirmed',
        },
        select: {
          id: true,
          status: true,
          attendeeEmail: true,
          checkedIn: true,
          checkedInAt: true,
          confirmationCode: true,
          answers: true,
          registrationNumber: true,
        },
      }) as RegistrationLookup[]

      const q = normalizedIdentity.toLowerCase()
      const isEmailLookup = q.includes('@')

      const matches = all.filter((r) => {
        if (isEmailLookup) {
          return (r.attendeeEmail ?? '').toLowerCase() === q
        }
        const attendeeName = getNameFromAnswers(r.answers, questions).toLowerCase()
        return attendeeName === q
      })

      if (matches.length > 1) {
        return NextResponse.json(
          {
            success: false,
            error: 'Multiple tickets matched this name/email. Use the ticket code for exact verification.',
          },
          { status: 409 }
        )
      }

      target = matches[0] ?? null
    }

    if (!target) {
      return NextResponse.json({ success: false, error: 'No ticket found for this event.' }, { status: 404 })
    }

    if (target.status !== 'confirmed') {
      return NextResponse.json({ success: false, error: 'Ticket exists but is not confirmed.' }, { status: 400 })
    }

    const attendeeName = getNameFromAnswers(target.answers, questions)

    if (target.checkedIn) {
      return NextResponse.json({
        success: true,
        valid: false,
        alreadyVerified: true,
        message: 'Ticket already verified and used.',
        ticket: {
          registrationId: target.id,
          registrationNumber: target.registrationNumber,
          attendeeName,
          attendeeEmail: target.attendeeEmail,
          confirmationCode: target.confirmationCode,
          checkedInAt: target.checkedInAt,
        },
      })
    }

    const updated = await prisma.registration.update({
      where: { id: target.id },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
      },
      select: {
        id: true,
        registrationNumber: true,
        attendeeEmail: true,
        confirmationCode: true,
        checkedInAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      valid: true,
      alreadyVerified: false,
      message: 'Ticket verified successfully.',
      ticket: {
        registrationId: updated.id,
        registrationNumber: updated.registrationNumber,
        attendeeName,
        attendeeEmail: updated.attendeeEmail,
        confirmationCode: updated.confirmationCode,
        checkedInAt: updated.checkedInAt,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
