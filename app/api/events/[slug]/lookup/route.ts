import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ratelimit } from '@/lib/ratelimit'

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

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1'
  const { success } = await ratelimit.limit(`lookup:${ip}`)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many lookup requests. Please try again shortly.' },
      { status: 429 }
    )
  }

  const { slug } = await props.params
  const query = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (query.length < 3) {
    return NextResponse.json({ error: 'Search query must be at least 3 characters' }, { status: 400 })
  }

  const event = await prisma.event.findUnique({
    where: { slug },
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

  const q = query.toLowerCase()
  const isEmailLookup = q.includes('@')
  const isEvtPrefixed = q.startsWith('evt-')
  const isAlphaNumeric8 = /^[a-z0-9]{8}$/i.test(query)
  const questions = (event.questions as EventQuestion[]) ?? []

  let registration: RegistrationLookup | null = null

  if (isEmailLookup) {
    // 1. Selective indexed lookup by eventId + attendeeEmail
    registration = (await prisma.registration.findFirst({
      where: {
        eventId: event.id,
        status: { in: ['confirmed', 'waitlist'] },
        attendeeEmail: { equals: query, mode: 'insensitive' },
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
    })) as RegistrationLookup | null
  } else if (isEvtPrefixed || isAlphaNumeric8) {
    // 2. Direct selective lookup by unique confirmationCode
    const codeVariants = [query.toUpperCase()]
    if (!isEvtPrefixed) {
      codeVariants.push(`EVT-${query.toUpperCase()}`)
    }

    registration = (await prisma.registration.findFirst({
      where: {
        eventId: event.id,
        status: { in: ['confirmed', 'waitlist'] },
        confirmationCode: { in: codeVariants, mode: 'insensitive' },
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
    })) as RegistrationLookup | null

    // If an 8-character string didn't match any confirmation code,
    // it could still be an 8-character attendee name (e.g., "Benjamin"). Fall through to name check below.
  }

  // 3. Exact name lookup (if not already found and not an email lookup or evt-prefixed code)
  if (!registration && !isEmailLookup && !isEvtPrefixed) {
    const textQuestionIds = questions
      .filter((q) => q.type === 'text' && q.label.toLowerCase().includes('name'))
      .map((q) => q.id)

    if (textQuestionIds.length > 0) {
      // Check database via selective jsonb query if $queryRaw is available in Postgres runtime
      if (typeof (prisma as any).$queryRaw === 'function') {
        try {
          const rows = await (prisma as any).$queryRaw`
            SELECT id, status, "registrationNumber", "waitlistPosition", "attendeeEmail", "confirmationCode", answers
            FROM "Registration"
            WHERE "eventId" = ${event.id}
              AND status IN ('confirmed', 'waitlist')
              AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(answers) AS elem
                WHERE elem->>'questionId' = ANY(${textQuestionIds})
                  AND LOWER(TRIM(elem->>'value')) = ${q}
              )
            ORDER BY "submittedAt" DESC
            LIMIT 1;
          `
          if (rows && rows.length > 0) {
            registration = rows[0]
          }
        } catch {
          // If $queryRaw fails or is running in a mock test harness, fall back safely
        }
      }

      // If not resolved via $queryRaw (or in mock test environment), query candidate registrations
      if (!registration) {
        const candidates = (await prisma.registration.findMany({
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
        })) as RegistrationLookup[]

        registration = candidates.find((r) => {
          const attendeeName = getAttendeeName(r.answers, questions).toLowerCase()
          return attendeeName === q
        }) ?? null
      }
    }
  }

  if (!registration) {
    return NextResponse.json({
      found: false,
      status: 'NOT_REGISTERED',
      message: 'No registration found for this exact name, email, or confirmation code.',
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
