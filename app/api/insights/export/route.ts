import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

type InsightsRange = '30d' | '90d' | '1y' | 'all'
type EventQuestion = { id: string; label: string; type: string }
type AnswerRow = { questionId: string; value: string }

function getStartDate(range: InsightsRange): Date | undefined {
  const now = Date.now()
  if (range === '30d') return new Date(now - 30 * 86_400_000)
  if (range === '90d') return new Date(now - 90 * 86_400_000)
  if (range === '1y') return new Date(now - 365 * 86_400_000)
  return undefined
}

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

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rangeParam = req.nextUrl.searchParams.get('range')
    const range: InsightsRange =
      rangeParam === '30d' || rangeParam === '90d' || rangeParam === '1y' || rangeParam === 'all'
        ? rangeParam
        : '90d'
    const startDate = getStartDate(range)

    const registrations = await prisma.registration.findMany({
      where: {
        event: { organizerId: session.user.id },
        ...(startDate ? { submittedAt: { gte: startDate } } : {}),
      },
      select: {
        status: true,
        submittedAt: true,
        attendeeEmail: true,
        answers: true,
        event: {
          select: {
            title: true,
            slug: true,
            eventDate: true,
            questions: true,
          },
        },
        ticket: { select: { scannedAt: true } },
      },
      orderBy: { submittedAt: 'desc' },
      take: 5000,
    })

    const rows: string[][] = [
      ['Event', 'Event Slug', 'Event Date', 'Name', 'Email', 'Status', 'Registered At', 'Checked In', 'Check-in Time'],
    ]

    for (const registration of registrations) {
      const answers = Array.isArray(registration.answers) ? (registration.answers as AnswerRow[]) : []
      const questions = Array.isArray(registration.event.questions)
        ? (registration.event.questions as EventQuestion[])
        : []
      const attendee = extractNameAndEmail(answers, questions, registration.attendeeEmail)

      rows.push([
        registration.event.title,
        registration.event.slug,
        registration.event.eventDate ? new Date(registration.event.eventDate).toISOString() : '',
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
        'Content-Disposition': `attachment; filename="eventslot-insights-${Date.now()}.csv"`,
      },
    })
  } catch (error) {
    console.error('Insights export error:', error)
    return NextResponse.json({ error: 'Unable to export insights right now.' }, { status: 503 })
  }
}
