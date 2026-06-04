import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { resolveEventGrant } from '@/lib/permissions'

type EventQuestion = { id: string; type: string; label: string; required?: boolean; order?: number }
type AnswerRow = { questionId: string; value: string }

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ slug: string; registrationId: string }> }
) {
  const { slug, registrationId } = await props.params

  const session = await getServerSession(authOptions)
  const grant = await resolveEventGrant(slug, session)

  if (!grant) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }
  if (!grant.hasAccess) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: { ticket: { select: { code: true } } },
  })

  if (!registration || registration.eventId !== grant.eventId) {
    return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
  }

  const event = await prisma.event.findUnique({
    where: { id: grant.eventId },
    select: { questions: true },
  })

  const questions = ((event?.questions ?? []) as EventQuestion[]).sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0)
  )

  const answers = Array.isArray(registration.answers)
    ? (registration.answers as AnswerRow[])
    : []

  const answersMap = Object.fromEntries(answers.map((a) => [a.questionId, a.value]))

  const questionAnswers = questions.map((q) => ({
    questionId: q.id,
    label: q.label,
    type: q.type,
    required: q.required ?? false,
    answer: answersMap[q.id] ?? null,
  }))

  return NextResponse.json({
    id: registration.id,
    status: registration.status,
    registeredAt: registration.submittedAt,
    attendeeEmail: registration.attendeeEmail ?? null,
    confirmationCode: registration.confirmationCode ?? null,
    ticketCode: registration.ticket?.code ?? null,
    checkedIn: registration.checkedIn,
    checkedInAt: registration.checkedInAt ?? null,
    registrationNumber: registration.registrationNumber ?? null,
    questionAnswers,
  })
}
