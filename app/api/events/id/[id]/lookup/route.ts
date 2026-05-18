import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type EventQuestion = { id: string; type: string; label: string }
type RegistrationAnswer = { questionId: string; value: string }

type RegistrationLookup = {
  id: string
  status: string
  registrationNumber: number | null
  waitlistPosition: number | null
  attendeeEmail: string | null
  confirmationCode: string | null
  answers: RegistrationAnswer[]
}

function getAttendeeName(answers: RegistrationAnswer[], questions: EventQuestion[]): string {
  const textQuestionIds = questions
    .filter((q) => q.type === 'text' && q.label.toLowerCase().includes('name'))
    .map((q) => q.id)

  if (textQuestionIds.length === 0) return ''
  const hit = answers.find((a) => textQuestionIds.includes(a.questionId) && a.value?.trim())
  return hit?.value?.trim() ?? ''
}

function normalizeStatus(status: string): 'CONFIRMED' | 'WAITLISTED' | 'NOT_REGISTERED' {
  if (status === 'confirmed') return 'CONFIRMED'
  if (status === 'waitlist') return 'WAITLISTED'
  return 'NOT_REGISTERED'
}

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const query = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (query.length < 2) {
    return NextResponse.json({ error: 'Search query too short' }, { status: 400 })
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      ticketsEnabled: true,
      eventDate: true,
      location: true,
      questions: true,
    },
  })

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const all = await prisma.registration.findMany({
    where: {
      eventId: event.id,
      status: { in: ['confirmed', 'waitlist'] },
    },
    orderBy: { submittedAt: 'desc' },
    select: {
      id: true,
      status: true,
      registrationNumber: true,
      waitlistPosition: true,
      attendeeEmail: true,
      confirmationCode: true,
      answers: true,
    },
  }) as RegistrationLookup[]

  const q = query.toLowerCase()
  const isEmailLookup = q.includes('@')
  const questions = (event.questions as EventQuestion[]) ?? []

  const registration = all.find((r) => {
    if (isEmailLookup) {
      return (r.attendeeEmail ?? '').toLowerCase() === q
    }

    const attendeeName = getAttendeeName(r.answers, questions).toLowerCase()
    if (!attendeeName) return false

    return attendeeName.includes(q)
  })

  if (!registration) {
    return NextResponse.json({
      found: false,
      status: 'NOT_REGISTERED',
      message: 'No registration found for this name or email.',
      ticketsEnabled: event.ticketsEnabled,
    })
  }

  const attendeeName = getAttendeeName(registration.answers, questions)
  const responseStatus = normalizeStatus(registration.status)

  if (responseStatus === 'CONFIRMED') {
    return NextResponse.json({
      found: true,
      status: 'CONFIRMED',
      attendeeName,
      registrationNumber: registration.registrationNumber,
      confirmationCode: registration.confirmationCode,
      ticketId: registration.confirmationCode ?? registration.id,
      ticketsEnabled: event.ticketsEnabled,
      canDownloadTicket: event.ticketsEnabled,
      ticketUrl: event.ticketsEnabled && registration.confirmationCode
        ? `/api/tickets/${registration.confirmationCode}`
        : null,
    })
  }

  if (responseStatus === 'WAITLISTED') {
    return NextResponse.json({
      found: true,
      status: 'WAITLISTED',
      attendeeName,
      registrationNumber: registration.registrationNumber,
      waitlistPosition: registration.waitlistPosition,
      ticketsEnabled: event.ticketsEnabled,
      canDownloadTicket: false,
      ticketUrl: null,
    })
  }

  return NextResponse.json({
    found: false,
    status: 'NOT_REGISTERED',
    message: 'No registration found for this name or email.',
    ticketsEnabled: event.ticketsEnabled,
  })
}
