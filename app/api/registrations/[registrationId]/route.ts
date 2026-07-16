import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { cancelCalendarEvent, removeCalendarEvent } from '@/lib/googleCalendar'
import { offerNextPaidWaitlistSpot } from '@/lib/paidEventWaitlist'
import { promoteNextFreeWaitlistSpot } from '@/lib/freeEventWaitlist'
import { sendWaitlistPromotedEmail } from '@/lib/email'
import { APP_URL } from '@/lib/config'
import { getFullOptions } from '@/lib/registrationQuestionOptions'

type EventQuestion = {
  id: string
  type: string
  label: string
  required?: boolean
  options?: string[]
  optionLimits?: Record<string, number | null | undefined>
  allowMultiple?: boolean
}

export async function GET(_req: NextRequest, props: { params: Promise<{ registrationId: string }> }) {
  const params = await props.params;
  try {
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
  } catch (err) {
    console.error('[registrations/[registrationId]] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ registrationId: string }> }) {
  const params = await props.params;
  try {
    const registration = await prisma.registration.findUnique({
      where: { id: params.registrationId },
      include: { event: { select: { id: true, status: true, archived: true, deadline: true, questions: true } } },
    })

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }

    // Check if event is still open for edits
    if (registration.event.status === 'archived' || registration.event.archived) {
      return NextResponse.json(
        { error: 'This event is closed. Registrations cannot be edited.' },
        { status: 400 }
      )
    }

    if (
      registration.event.deadline &&
      new Date(registration.event.deadline) < new Date()
    ) {
      return NextResponse.json(
        { error: 'Registration deadline has passed.' },
        { status: 400 }
      )
    }

    // NO session check — attendees are unauthenticated.
    // The registrationId itself is the auth token (it is a CUID, unguessable).
    const body = await req.json()
    const { answers, attendeeEmail } = body as {
      answers?: Array<{ questionId: string; value: string }>
      attendeeEmail?: string
    }

    // Waitlist email-capture path: attendee provides contact email for slot notifications
    if (attendeeEmail !== undefined) {
      if (registration.status !== 'waitlist') {
        return NextResponse.json({ error: 'Only waitlisted registrations can set a notification email' }, { status: 400 })
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(attendeeEmail)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
      }
      const updated = await prisma.registration.update({
        where: { id: params.registrationId },
        data: { attendeeEmail, consentTransactional: true },
      })
      return NextResponse.json({ success: true, registration: updated })
    }

    if (!answers || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'Invalid answers format' }, { status: 400 })
    }

    // Server-side required field validation
    const questions = (registration.event.questions as EventQuestion[]) ?? []
    for (const q of questions) {
      if (q.required) {
        const answer = answers.find(a => a.questionId === q.id)
        if (!answer?.value?.trim()) {
          return NextResponse.json({ error: `"${q.label}" is required` }, { status: 400 })
        }
      }
    }

    const limitedQuestions = questions.filter((question) => {
      const limits = question.optionLimits ?? {}
      return (question.type === 'select' || question.type === 'checkbox') && Object.keys(limits).length > 0
    })

    if (limitedQuestions.length > 0) {
      const peerRegistrations = await prisma.registration.findMany({
        where: {
          eventId: registration.eventId,
          id: { not: registration.id },
          status: { in: ['confirmed', 'waitlist'] },
        },
        select: { answers: true },
      })

      const queuedRegistrations = peerRegistrations.map((item) => ({
        answers: item.answers as Array<{ questionId: string; value: string }>,
      }))

      for (const question of limitedQuestions) {
        const fullOptions = new Set(getFullOptions(question, queuedRegistrations))
        if (fullOptions.size === 0) continue

        const rawAnswer = answers.find((answer) => answer.questionId === question.id)?.value ?? ''
        const selectedValues = question.type === 'checkbox'
          ? (() => {
              try {
                const parsed = JSON.parse(rawAnswer)
                return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : []
              } catch {
                return rawAnswer.split('|').map((value) => value.trim()).filter(Boolean)
              }
            })()
          : [rawAnswer]

        const blockedOption = selectedValues.find((value) => fullOptions.has(value))
        if (blockedOption) {
          return NextResponse.json(
            { error: `"${blockedOption}" is already full for ${question.label}. Please choose another option.` },
            { status: 409 }
          )
        }
      }
    }

    const updated = await prisma.registration.update({
      where: { id: params.registrationId },
      data: { answers },
    })

    return NextResponse.json({ success: true, registration: updated })
  } catch (err) {
    console.error('[registrations/[registrationId]] PATCH error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ registrationId: string }> }) {
  const params = await props.params;
  try {
    const token = new URL(req.url).searchParams.get('token')

    const registration = await prisma.registration.findUnique({
      where: { id: params.registrationId },
      include: {
        event: {
          select: {
            dashboardToken: true,
            id: true,
            title: true,
            isPaid: true,
            eventDate: true,
            eventEndAt: true,
            location: true,
            communityLink: true,
            slug: true,
          },
        },
      },
    })

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }

    if (!token || registration.event.dashboardToken !== token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const waitlistPosition = registration.waitlistPosition
    await prisma.registration.delete({ where: { id: params.registrationId } })

    // Update attendee's Google Calendar entry based on registration status
    if (registration.attendeeEmail) {
      const attendeeUser = await prisma.user.findUnique({
        where:  { email: registration.attendeeEmail.toLowerCase() },
        select: { id: true },
      })
      if (attendeeUser?.id) {
        if (registration.status === 'waitlist') {
          // Remove the [Waitlisted] entry entirely — they were never confirmed
          removeCalendarEvent({
            userId:      attendeeUser.id,
            eventSlotId: registration.eventId,
            role:        'attendee',
          }).catch(console.error)
        } else {
          cancelCalendarEvent({
            userId:      attendeeUser.id,
            eventSlotId: registration.eventId,
            role:        'attendee',
            eventTitle:  registration.event.title,
          }).catch(console.error)
        }
      }
    }

    // Keep event counts accurate
    if (registration.status === 'confirmed') {
      await prisma.event.update({
        where: { id: registration.eventId },
        data: { confirmedCount: { decrement: 1 } },
      })
      if (registration.ticketTierId) {
        await prisma.ticketTier.update({
          where: { id: registration.ticketTierId },
          data: { soldCount: { decrement: 1 } },
        }).catch(() => {})
      }
    } else if (registration.status === 'waitlist') {
      await prisma.event.update({
        where: { id: registration.eventId },
        data: { waitlistCount: { decrement: 1 } },
      })
      if (registration.ticketTierId) {
        await prisma.ticketTier.update({
          where: { id: registration.ticketTierId },
          data: { waitlistCount: { decrement: 1 } },
        }).catch(() => {})
      }

      await prisma.registration.updateMany({
        where: {
          eventId: registration.eventId,
          status: 'waitlist',
          ...(registration.ticketTierId
            ? { ticketTierId: registration.ticketTierId }
            : { ticketTierId: null }),
          waitlistPosition: { gt: waitlistPosition ?? 0 },
        },
        data: {
          waitlistPosition: { decrement: 1 },
        },
      }).catch(() => {})
    }

    if (registration.event.isPaid && registration.ticketTierId && registration.status === 'confirmed') {
      await offerNextPaidWaitlistSpot(registration.eventId, registration.ticketTierId).catch(() => {})
    } else if (!registration.event.isPaid && registration.status === 'confirmed') {
      const promoted = await promoteNextFreeWaitlistSpot(registration.eventId).catch(() => null)

      if (promoted?.attendeeEmail && promoted.consentTransactional) {
        await sendWaitlistPromotedEmail({
          to: promoted.attendeeEmail,
          eventTitle: registration.event.title,
          eventDate: registration.event.eventDate,
          eventEndAt: registration.event.eventEndAt,
          eventLocation: registration.event.location,
          communityLink: registration.event.communityLink,
          ticketUrl: promoted.confirmationCode ? `${APP_URL}/register/success/${promoted.confirmationCode}` : null,
          eventSlug: registration.event.slug,
        }).catch(() => {})
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[registrations/[registrationId]] DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

