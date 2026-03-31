import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type EventQuestion = { id: string; type: string; label: string; required?: boolean }

export async function GET(
  _req: NextRequest,
  { params }: { params: { registrationId: string } }
) {
  const registration = await prisma.registration.findUnique({
    where: { id: params.registrationId },
  })

  if (!registration) {
    return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
  }

  const event = await prisma.event.findUnique({
    where: { id: registration.eventId },
    select: { title: true, questions: true, status: true, archived: true },
  })

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  return NextResponse.json({ registration: { ...registration, event } })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { registrationId: string } }
) {
  const registration = await prisma.registration.findUnique({
    where: { id: params.registrationId },
  })

  if (!registration) {
    return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
  }

  // Fetch event to check status + get questions
  const event = await prisma.event.findUnique({
    where: { id: registration.eventId },
    select: { status: true, archived: true, questions: true },
  })

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  // Don't allow editing if event is closed/archived
  if (event.status === 'closed' || event.status === 'archived' || event.archived) {
    return NextResponse.json({ error: 'Registrations cannot be edited for this event' }, { status: 400 })
  }

  const body = await req.json()
  const { answers } = body as { answers: Array<{ questionId: string; value: string }> }

  if (!Array.isArray(answers)) {
    return NextResponse.json({ error: 'Invalid answers' }, { status: 400 })
  }

  // Server-side required field validation
  const questions = (event.questions as EventQuestion[]) ?? []
  for (const q of questions) {
    if (q.required) {
      const answer = answers.find(a => a.questionId === q.id)
      if (!answer?.value?.trim()) {
        return NextResponse.json({ error: `"${q.label}" is required` }, { status: 400 })
      }
    }
  }

  const updated = await prisma.registration.update({
    where: { id: params.registrationId },
    data: { answers },
  })

  return NextResponse.json({ success: true, registration: updated })
}
