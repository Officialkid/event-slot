import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { attendanceLookupRatelimit } from '@/lib/ratelimit'
import { APP_URL } from '@/lib/config'

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  return forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'
}

const BASE_URL = APP_URL

type EventQuestion = { id: string; type: string; label: string }
type Answer = { questionId: string; value: string }

function extractField(
  answers: Answer[],
  questions: EventQuestion[],
  types: string[],
  labelHints: string[]
): string | null {
  for (const type of types) {
    const q = questions.find((q) => q.type === type)
    if (q) {
      const val = answers.find((a) => a.questionId === q.id)?.value?.trim()
      if (val) return val
    }
  }
  for (const hint of labelHints) {
    const q = questions.find((q) => q.label.toLowerCase().includes(hint))
    if (q) {
      const val = answers.find((a) => a.questionId === q.id)?.value?.trim()
      if (val) return val
    }
  }
  return null
}

export async function POST(req: NextRequest) {
  // Rate limit by IP: 5 lookups per 10 minutes
  const ip = getClientIp(req)
  const { success } = await attendanceLookupRatelimit.limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many lookup attempts. Please wait a few minutes and try again.' },
      { status: 429 }
    )
  }

  let body: { email?: string; eventId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { email, eventId } = body

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
  }
  if (!eventId || typeof eventId !== 'string') {
    return NextResponse.json({ error: 'Event ID is required.' }, { status: 400 })
  }

  // Fetch the event to ensure it exists
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, title: true, eventDate: true, location: true, questions: true, ticketsEnabled: true },
  })
  if (!event) {
    return NextResponse.json({ error: 'Event not found.' }, { status: 404 })
  }

  // Case-insensitive email match — pull all registrations for this event
  // then filter in JS to avoid DB-level collation issues
  const registration = await prisma.registration.findFirst({
    where: {
      eventId: event.id,
      attendeeEmail: { equals: email.trim(), mode: 'insensitive' },
    },
    select: {
      id: true,
      status: true,
      waitlistPosition: true,
      answers: true,
      confirmationCode: true,
    },
  })

  if (!registration) {
    return NextResponse.json({ found: false, message: 'No registration found for this event with those details.' })
  }

  if (registration.status === 'waitlisted') {
    const pos = registration.waitlistPosition
    return NextResponse.json({
      found: true,
      status: 'waitlisted',
      message: pos
        ? `You are #${pos} on the waitlist. You will be notified when a slot opens.`
        : 'You are on the waitlist. You will be notified when a slot opens.',
    })
  }

  if (registration.status !== 'confirmed') {
    return NextResponse.json({ found: false, message: 'No confirmed registration found for this event with those details.' })
  }

  // Build ticket data from stored answers
  const questions = (event.questions as EventQuestion[]) ?? []
  const answers = (registration.answers as Answer[]) ?? []

  const attendeeName = extractField(answers, questions, ['text'], ['name']) ?? ''
  const attendeeEmail = extractField(answers, questions, ['email'], ['email']) ?? email.trim()
  const attendeePhone = extractField(answers, questions, ['tel'], ['phone', 'mobile'])

  const eventDate = event.eventDate
    ? new Date(event.eventDate).toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    : null

  return NextResponse.json({
    found: true,
    status: 'confirmed',
    canDownloadTicket: event.ticketsEnabled,
    ticket: event.ticketsEnabled
      ? {
          confirmationCode: registration.confirmationCode,
          eventTitle: event.title,
          eventDate,
          eventLocation: event.location,
          attendeeName,
          attendeeEmail,
          attendeePhone: attendeePhone ?? null,
          verifyUrl: `${BASE_URL}/verify/${registration.confirmationCode}`,
        }
      : null,
  })
}
