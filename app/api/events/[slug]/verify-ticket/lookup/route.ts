import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { hasOrganiserAccess } from '@/lib/adminMode'

type EventQuestion = { id: string; type: string; label: string }

function getNameFromAnswers(answers: Array<{ questionId: string; value: string }>, questions: EventQuestion[]) {
  const nameQuestionIds = questions
    .filter((q) => q.type === 'text' && q.label.toLowerCase().includes('name'))
    .map((q) => q.id)

  const hit = answers.find((a) => nameQuestionIds.includes(a.questionId) && a.value?.trim())
  return hit?.value?.trim() ?? ''
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const token = req.nextUrl.searchParams.get('token')?.trim() ?? ''
  const query = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (query.length < 2) {
    return NextResponse.json({ error: 'Search query too short' }, { status: 400 })
  }

  const event = await prisma.event.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    select: { id: true, organizerId: true, dashboardToken: true, questions: true },
  })

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const session = await getServerSession(authOptions)
  const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
  const hasValidToken = !!(token && token === event.dashboardToken)
  const hasTeamAccess = !!(session?.user?.id && await hasTeamEventAccess({
    userId: session.user.id,
    organizerId: event.organizerId,
    eventId: event.id,
  }))
  const adminAccess = !!(session && await hasOrganiserAccess(session, event.id))

  if (!isOwner && !hasValidToken && !hasTeamAccess && !adminAccess) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const questions = (event.questions as EventQuestion[]) ?? []
  const normalizedQuery = query.toLowerCase()
  const looksLikeEmail = normalizedQuery.includes('@')
  const looksLikeTicketCode = /^[a-z0-9-]{6,}$/i.test(query)

  const registrations = await prisma.registration.findMany({
    where: {
      eventId: event.id,
      status: { in: ['confirmed', 'CONFIRMED', 'waitlist', 'WAITLISTED', 'waitlisted'] },
    },
    orderBy: { submittedAt: 'desc' },
    take: looksLikeEmail || looksLikeTicketCode ? 100 : 250,
    select: {
      id: true,
      status: true,
      attendeeEmail: true,
      checkedIn: true,
      checkedInAt: true,
      submittedAt: true,
      registrationNumber: true,
      waitlistPosition: true,
      confirmationCode: true,
      answers: true,
      ticket: {
        select: {
          code: true,
          scannedAt: true,
          admissionsTotal: true,
          admissionsUsed: true,
          verifiedEntries: true,
        },
      },
    },
  })

  const results = registrations.filter((registration) => {
    const attendeeName = getNameFromAnswers(
      registration.answers as Array<{ questionId: string; value: string }>,
      questions
    ).toLowerCase()

    if (looksLikeEmail) {
      return (registration.attendeeEmail ?? '').toLowerCase().includes(normalizedQuery)
    }

    if (looksLikeTicketCode) {
      return (
        (registration.confirmationCode ?? '').toLowerCase() === normalizedQuery ||
        (registration.ticket?.code ?? '').toLowerCase() === normalizedQuery
      )
    }

    return attendeeName.includes(normalizedQuery)
  }).map((registration) => {
    const attendeeName = getNameFromAnswers(
      registration.answers as Array<{ questionId: string; value: string }>,
      questions
    ) || 'Attendee'

    return {
      registrationId: registration.id,
      registrationNumber: registration.registrationNumber,
      attendeeName,
      attendeeEmail: registration.attendeeEmail,
      status: registration.status,
      submittedAt: registration.submittedAt,
      waitlistPosition: registration.waitlistPosition,
      confirmationCode: registration.confirmationCode,
      ticketCode: registration.ticket?.code ?? registration.confirmationCode ?? registration.id,
      alreadyVerified: Boolean(registration.ticket?.scannedAt ?? registration.checkedInAt),
      verifiedAt: registration.ticket?.scannedAt ?? registration.checkedInAt,
      admissionsTotal: registration.ticket?.admissionsTotal ?? 1,
      admissionsUsed: registration.ticket?.admissionsUsed ?? 0,
      admissionsRemaining: Math.max(0, (registration.ticket?.admissionsTotal ?? 1) - (registration.ticket?.admissionsUsed ?? 0)),
      verifiedEntries: Array.isArray(registration.ticket?.verifiedEntries) ? registration.ticket?.verifiedEntries : [],
    }
  })

  return NextResponse.json({ results })
}
