import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { hasOrganiserAccess } from '@/lib/adminMode'
import { canUseEventFeature } from '@/lib/planEnforcement'

type EventQuestion = { id: string; label: string; type: string }
type AnswerRow = { questionId: string; value: string }

function csvCell(value: unknown): string {
  const raw = value == null ? '' : String(value)
  return `"${raw.replace(/"/g, '""')}"`
}

function extractNameAndEmail(answers: AnswerRow[], questions: EventQuestion[], attendeeEmail: string | null): { name: string; email: string } {
  const nameQuestion = questions.find((q) => q.type === 'text' && q.label.toLowerCase().includes('name'))
  const emailQuestion = questions.find((q) => q.type === 'email')
  const name = nameQuestion ? (answers.find((a) => a.questionId === nameQuestion.id)?.value ?? '') : ''
  const emailFromAnswers = emailQuestion ? (answers.find((a) => a.questionId === emailQuestion.id)?.value ?? '') : ''
  return {
    name,
    email: attendeeEmail || emailFromAnswers || '',
  }
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  try {
    const params = await props.params
    const session = await getServerSession(authOptions)
    const token = req.nextUrl.searchParams.get('token')

    const event = await prisma.event.findUnique({
      where: { slug: params.slug },
      select: { id: true, slug: true, title: true, organizerId: true, dashboardToken: true, questions: true },
    })

    if (!event) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)
    const hasTeamAccess = !!(session?.user?.id && await hasTeamEventAccess({
      userId: session.user.id,
      organizerId: event.organizerId,
      eventId: event.id,
    }))
    const adminAccess = !!(session && await hasOrganiserAccess(session, event.id))

    if (!isOwner && !hasValidToken && !hasTeamAccess && !adminAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Plan enforcement — analytics export requires Basic Analytics
    if (session?.user?.id) {
      const check = await canUseEventFeature(session.user.id, session.user.email ?? '', event.id, 'hasBasicAnalytics')
      if (!check.allowed) {
        return NextResponse.json(
          { error: check.reason, upgradeRequired: check.upgradeRequired, code: 'PLAN_LIMIT_FEATURE' },
          { status: 403 }
        )
      }
    }

    const registrations = await prisma.registration.findMany({
      where: { eventId: event.id },
      select: {
        status: true,
        submittedAt: true,
        attendeeEmail: true,
        answers: true,
        ticket: { select: { scannedAt: true } },
      },
      orderBy: { submittedAt: 'desc' },
    })

    const questions = Array.isArray(event.questions) ? (event.questions as EventQuestion[]) : []

    const rows: string[][] = [
      ['Name', 'Email', 'Status', 'Registered At', 'Checked In', 'Check-in Time'],
    ]

    for (const registration of registrations) {
      const answers = Array.isArray(registration.answers) ? (registration.answers as AnswerRow[]) : []
      const attendee = extractNameAndEmail(answers, questions, registration.attendeeEmail)
      rows.push([
        attendee.name,
        attendee.email,
        registration.status,
        new Date(registration.submittedAt).toISOString(),
        registration.ticket?.scannedAt ? 'Yes' : 'No',
        registration.ticket?.scannedAt ? new Date(registration.ticket.scannedAt).toISOString() : '',
      ])
    }

    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${event.slug}-attendees-${Date.now()}.csv"`,
      },
    })
  } catch (error) {
    console.error('Per-event analytics export error:', error)
    return NextResponse.json({ error: 'Unable to export event analytics right now.' }, { status: 503 })
  }
}
