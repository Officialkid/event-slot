import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { verifyQRPayload } from '@/lib/ticket-qr'
import { decrypt } from '@/lib/encrypt'

type EventQuestion = { id: string; type: string; label: string }
type Answer = { questionId: string; value: string }

function getNameFromAnswers(answers: Answer[], questions: EventQuestion[]): string {
  const nameQuestionIds = questions
    .filter((question) => question.type === 'text' && question.label.toLowerCase().includes('name'))
    .map((question) => question.id)

  if (nameQuestionIds.length === 0) return ''

  const match = answers.find(
    (answer) => nameQuestionIds.includes(answer.questionId) && answer.value?.trim()
  )

  return match?.value?.trim() ?? ''
}

export async function POST(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> }
) {
  const { slug } = await props.params
  const eventId = slug
  const body = (await req.json().catch(() => null)) as { qrPayload?: string; lookupTicketId?: string } | null
  const qrPayload = body?.qrPayload?.trim()
  const lookupTicketId = body?.lookupTicketId?.trim()

  // Phase 8 fallback: direct lookup by ticket id from name/email flow.
  if (lookupTicketId && !qrPayload) {
    const registration = await prisma.registration.findFirst({
      where: {
        eventId,
        OR: [{ confirmationCode: lookupTicketId }, { id: lookupTicketId }],
      },
      select: {
        id: true,
        status: true,
        confirmationCode: true,
        answers: true,
        ticket: {
          select: {
            ticketTierName: true,
            amountPaidKes: true,
            scannedAt: true,
          },
        },
        event: {
          select: {
            id: true,
            title: true,
            eventDate: true,
            eventEndAt: true,
            joinOpensAt: true,
            eventType: true,
            virtualLink: true,
            virtualLinkIv: true,
            isPaid: true,
            ticketPrice: true,
            questions: true,
          },
        },
      },
    })

    if (!registration || registration.event.id !== eventId) {
      await logEntry(eventId, lookupTicketId, null, false, 'TICKET_NOT_FOUND')
      return NextResponse.json({ success: false, message: 'Not found.' }, { status: 404 })
    }

    const questions = (registration.event.questions as EventQuestion[]) ?? []
    const answers = (registration.answers as Answer[]) ?? []
    const attendeeName = getNameFromAnswers(answers, questions) || 'Attendee'

    if (registration.status !== 'confirmed') {
      await logEntry(eventId, lookupTicketId, attendeeName, false, 'NOT_CONFIRMED')
      return NextResponse.json(
        {
          success: false,
          reason: 'NOT_CONFIRMED',
          message: 'Your registration is not confirmed.',
        },
        { status: 403 }
      )
    }

    const now = new Date()
    const eventStart = registration.event.eventDate

    if (!eventStart) {
      await logEntry(eventId, lookupTicketId, attendeeName, false, 'EVENT_DATE_MISSING')
      return NextResponse.json(
        {
          success: false,
          reason: 'EVENT_DATE_MISSING',
          message: 'This event does not have a start time configured yet.',
        },
        { status: 400 }
      )
    }

    const openWindow = registration.event.joinOpensAt ?? new Date(eventStart.getTime() - 30 * 60 * 1000)
    const eventEnd = registration.event.eventEndAt
      ? new Date(registration.event.eventEndAt)
      : new Date(eventStart.getTime() + 4 * 60 * 60 * 1000)

    if (now < openWindow) {
      const minutesUntil = Math.ceil((openWindow.getTime() - now.getTime()) / 60000)
      await logEntry(eventId, lookupTicketId, attendeeName, false, 'TOO_EARLY')
      return NextResponse.json(
        {
          success: false,
          reason: 'TOO_EARLY',
          message: `Event access opens in ${minutesUntil} minutes.`,
          minutesUntil,
          opensAt: openWindow.toISOString(),
        },
        { status: 403 }
      )
    }

    if (now > eventEnd) {
      await logEntry(eventId, lookupTicketId, attendeeName, false, 'EVENT_ENDED')
      return NextResponse.json(
        {
          success: false,
          reason: 'EVENT_ENDED',
          message: 'Event has ended.',
        },
        { status: 403 }
      )
    }

    let meetingLink: string | null = null
    if (registration.event.eventType === 'VIRTUAL' && registration.event.virtualLink) {
      meetingLink = decrypt(registration.event.virtualLink, registration.event.virtualLinkIv ?? '')
    }

    const canonicalTicketId = registration.confirmationCode ?? registration.id
    await logEntry(eventId, canonicalTicketId, attendeeName, true, 'FALLBACK_LOOKUP')

    return NextResponse.json({
      success: true,
      attendeeName,
      ticketId: canonicalTicketId,
      meetingLink,
      eventType: registration.event.eventType,
      message:
        registration.event.eventType === 'VIRTUAL' && !meetingLink
          ? 'Meeting link is being set up. Please check back shortly or contact the organiser.'
          : `Welcome, ${attendeeName}!`,
    })
  }

  if (!qrPayload) {
    return NextResponse.json({ error: 'No QR data provided' }, { status: 400 })
  }

  const isLookupFallback = qrPayload.startsWith('LOOKUP:')
  const legacyLookupTicketId = isLookupFallback ? qrPayload.slice('LOOKUP:'.length).trim() : ''

  let qrTicketId: string | null = null
  let qrUserId: string | null = null

  if (!isLookupFallback) {
    const qr = verifyQRPayload(qrPayload)

    if (!qr.valid) {
      await logEntry(eventId, null, null, false, 'INVALID_SIGNATURE')
      return NextResponse.json(
        {
          success: false,
          reason: 'INVALID_TICKET',
          message: 'This ticket is not valid. Please contact the event organiser.',
        },
        { status: 403 }
      )
    }

    if (qr.eventId !== eventId) {
      await logEntry(eventId, qr.ticketId, null, false, 'WRONG_EVENT')
      return NextResponse.json(
        {
          success: false,
          reason: 'WRONG_EVENT',
          message: 'This ticket is for a different event.',
        },
        { status: 403 }
      )
    }

    qrTicketId = qr.ticketId ?? null
    qrUserId = qr.userId ?? null
  }

  if (isLookupFallback && !legacyLookupTicketId) {
    await logEntry(eventId, null, null, false, 'LOOKUP_TICKET_MISSING')
    return NextResponse.json(
      {
        success: false,
        reason: 'INVALID_LOOKUP',
        message: 'Lookup ticket could not be verified.',
      },
      { status: 400 }
    )
  }

  const registration = await prisma.registration.findFirst({
    where: isLookupFallback
      ? {
          eventId,
          OR: [{ confirmationCode: legacyLookupTicketId }, { id: legacyLookupTicketId }],
        }
      : {
          eventId,
          id: qrUserId!,
          OR: [{ confirmationCode: qrTicketId! }, { id: qrTicketId! }],
        },
    select: {
      id: true,
      status: true,
      confirmationCode: true,
      answers: true,
      ticket: {
        select: {
          ticketTierName: true,
          amountPaidKes: true,
          scannedAt: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          eventDate: true,
          eventEndAt: true,
          joinOpensAt: true,
          eventType: true,
          virtualLink: true,
          virtualLinkIv: true,
          isPaid: true,
          ticketPrice: true,
          questions: true,
        },
      },
    },
  })

  if (!registration) {
    await logEntry(eventId, legacyLookupTicketId || qrTicketId, null, false, 'TICKET_NOT_FOUND')
    return NextResponse.json(
      {
        success: false,
        reason: 'TICKET_NOT_FOUND',
        message: 'No registration found for this ticket.',
      },
      { status: 404 }
    )
  }

  const questions = (registration.event.questions as EventQuestion[]) ?? []
  const answers = (registration.answers as Answer[]) ?? []
  const attendeeName = getNameFromAnswers(answers, questions) || 'Attendee'

  if (registration.status !== 'confirmed') {
    await logEntry(eventId, legacyLookupTicketId || qrTicketId, attendeeName, false, 'NOT_CONFIRMED')
    return NextResponse.json(
      {
        success: false,
        reason: 'NOT_CONFIRMED',
        message: `Your registration status is ${registration.status}. Only confirmed attendees can join.`,
      },
      { status: 403 }
    )
  }

  const now = new Date()
  const eventStart = registration.event.eventDate

  if (!eventStart) {
    await logEntry(eventId, legacyLookupTicketId || qrTicketId, attendeeName, false, 'EVENT_DATE_MISSING')
    return NextResponse.json(
      {
        success: false,
        reason: 'EVENT_DATE_MISSING',
        message: 'This event does not have a start time configured yet.',
      },
      { status: 400 }
    )
  }

  const eventEnd = registration.event.eventEndAt
    ? new Date(registration.event.eventEndAt)
    : new Date(eventStart.getTime() + 4 * 60 * 60 * 1000)
  const openWindow = registration.event.joinOpensAt ?? new Date(eventStart.getTime() - 30 * 60 * 1000)

  if (now < openWindow) {
    const minutesUntil = Math.ceil((openWindow.getTime() - now.getTime()) / 60000)
    await logEntry(eventId, legacyLookupTicketId || qrTicketId, attendeeName, false, 'TOO_EARLY')
    return NextResponse.json(
      {
        success: false,
        reason: 'TOO_EARLY',
        message: `Event access opens in ${minutesUntil} minutes.`,
        opensAt: openWindow.toISOString(),
        minutesUntil,
      },
      { status: 403 }
    )
  }

  if (now > eventEnd) {
    await logEntry(eventId, legacyLookupTicketId || qrTicketId, attendeeName, false, 'EVENT_ENDED')
    return NextResponse.json(
      {
        success: false,
        reason: 'EVENT_ENDED',
        message: 'This event has ended.',
      },
      { status: 403 }
    )
  }

  const canonicalTicketId = registration.confirmationCode ?? registration.id
  const alreadyScanned = await prisma.entryLog.findFirst({
    where: {
      eventId,
      ticketId: canonicalTicketId,
      success: true,
    },
  })

  const isDuplicateScan = !!alreadyScanned

  let meetingLink: string | null = null
  if (registration.event.eventType === 'VIRTUAL' && registration.event.virtualLink) {
    meetingLink = decrypt(registration.event.virtualLink, registration.event.virtualLinkIv ?? '')
  }

  const successMessage =
    registration.event.eventType === 'VIRTUAL'
      ? meetingLink
        ? `Welcome, ${attendeeName}! Your meeting link is ready.`
        : 'Meeting link is being set up. Please check back shortly or contact the organiser.'
      : `Welcome, ${attendeeName}! Enjoy the event!`

  await logEntry(
    eventId,
    canonicalTicketId,
    attendeeName,
    true,
    isDuplicateScan ? 'DUPLICATE_SCAN_ALLOWED' : undefined
  )

  return NextResponse.json({
    success: true,
    attendeeName,
    ticketId: canonicalTicketId,
    eventTitle: registration.event.title,
    eventType: registration.event.eventType,
    meetingLink,
    isPaid: registration.event.isPaid,
    ticketPrice: registration.ticket?.amountPaidKes ?? registration.event.ticketPrice,
    ticketTierName: registration.ticket?.ticketTierName ?? null,
    alreadyVerifiedAt: registration.ticket?.scannedAt?.toISOString() ?? alreadyScanned?.scannedAt?.toISOString() ?? null,
    isDuplicateScan,
    message: successMessage,
  })
}

async function logEntry(
  eventId: string,
  ticketId: string | null,
  attendeeName: string | null,
  success: boolean,
  failReason?: string
) {
  await prisma.entryLog
    .create({
      data: {
        eventId,
        ticketId: ticketId ?? 'unknown',
        attendeeName: attendeeName ?? 'Unknown',
        success,
        failReason: failReason ?? null,
      },
    })
    .catch(console.error)
}
