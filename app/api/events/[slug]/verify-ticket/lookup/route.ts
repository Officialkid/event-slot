import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { hasOrganiserAccess } from '@/lib/adminMode'
import { hasDashboardOrVerifierToken } from '@/lib/eventVerifierAccess'

type EventQuestion = { id: string; type: string; label: string }

function extractAttendeeName(answers: unknown, questions: EventQuestion[], fallbackEmail?: string | null): string {
  if (Array.isArray(answers)) {
    const nameQuestionIds = questions
      .filter((q) => q.label && q.label.toLowerCase().includes('name'))
      .map((q) => q.id)

    const hit = answers.find((a: any) => nameQuestionIds.includes(a.questionId) && typeof a.value === 'string' && a.value.trim())
    if (hit?.value?.trim()) return hit.value.trim()

    const anyNameHit = answers.find((a: any) =>
      ((a.label && a.label.toLowerCase().includes('name')) || (a.questionId && a.questionId.toLowerCase().includes('name'))) &&
      typeof a.value === 'string' && a.value.trim()
    )
    if (anyNameHit?.value?.trim()) return anyNameHit.value.trim()

    const firstTextHit = answers.find((a: any) =>
      typeof a.value === 'string' &&
      a.value.trim() &&
      !a.value.includes('@') &&
      !/^\+?[0-9\s-]{7,}$/.test(a.value.trim()) &&
      a.value.length < 60
    )
    if (firstTextHit?.value?.trim()) return firstTextHit.value.trim()
  } else if (answers && typeof answers === 'object') {
    const obj = answers as Record<string, unknown>
    for (const [k, v] of Object.entries(obj)) {
      if (k.toLowerCase().includes('name') && typeof v === 'string' && v.trim()) {
        return v.trim()
      }
    }
  }

  if (fallbackEmail) {
    const local = fallbackEmail.split('@')[0]
    return local.charAt(0).toUpperCase() + local.slice(1)
  }
  return 'Attendee'
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const token = req.nextUrl.searchParams.get('token')?.trim() ?? ''
  const query = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  if (query.length < 1) {
    return NextResponse.json({ error: 'Search query too short' }, { status: 400 })
  }

  const event = await prisma.event.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    select: { id: true, organizerId: true, dashboardToken: true, verifierCode: true, verifierCodeEnabled: true, questions: true },
  })

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const session = await getServerSession(authOptions)
  const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
  const hasValidToken = hasDashboardOrVerifierToken(token, event)
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

  const registrations = await prisma.registration.findMany({
    where: {
      eventId: event.id,
      status: { in: ['confirmed', 'CONFIRMED', 'waitlist', 'WAITLISTED', 'waitlisted'] },
    },
    orderBy: { submittedAt: 'desc' },
    take: 500,
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
          id: true,
          code: true,
          scannedAt: true,
          admissionsTotal: true,
          admissionsUsed: true,
          verifiedEntries: true,
        },
      },
    },
  })

  const matchedRegistrations = registrations.filter((registration) => {
    const attendeeName = extractAttendeeName(registration.answers, questions, registration.attendeeEmail).toLowerCase()
    const email = (registration.attendeeEmail ?? '').toLowerCase()
    const ticketCode = (registration.ticket?.code ?? '').toLowerCase()
    const confirmation = (registration.confirmationCode ?? '').toLowerCase()
    const regNumStr = registration.registrationNumber ? String(registration.registrationNumber) : ''

    // Match name, email, ticket code, confirmation code, or registration number
    if (attendeeName.includes(normalizedQuery)) return true
    if (email.includes(normalizedQuery)) return true
    if (ticketCode.includes(normalizedQuery)) return true
    if (confirmation.includes(normalizedQuery)) return true
    if (regNumStr && regNumStr.includes(normalizedQuery)) return true

    // Check individual name parts (e.g. typing "Jam" matches "James Kariuki")
    const words = attendeeName.split(/\s+/)
    if (words.some(w => w.startsWith(normalizedQuery))) return true

    return false
  })

  const matchedTicketIds = matchedRegistrations
    .map((r) => r.ticket?.id)
    .filter((id): id is string => Boolean(id))

  const groupSlots = matchedTicketIds.length > 0
    ? await prisma.groupTicketSlot.findMany({
        where: { ticketId: { in: matchedTicketIds } },
        select: {
          ticketId: true,
          booking: {
            select: {
              orgName: true,
            },
          },
        },
      })
    : []

  const orgByTicketId = new Map(
    groupSlots
      .filter((s) => s.ticketId && s.booking?.orgName)
      .map((s) => [s.ticketId!, s.booking.orgName])
  )

  const results = matchedRegistrations.map((registration) => {
    const attendeeName = extractAttendeeName(registration.answers, questions, registration.attendeeEmail)
    const organizationName = registration.ticket?.id ? orgByTicketId.get(registration.ticket.id) ?? null : null

    return {
      registrationId: registration.id,
      registrationNumber: registration.registrationNumber,
      attendeeName,
      attendeeEmail: registration.attendeeEmail,
      organizationName,
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
