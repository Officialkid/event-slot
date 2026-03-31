import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { ratelimit } from '@/lib/ratelimit'
import { createNotification } from '@/lib/notifications'

type AttendeePayload = { answers: Array<{ questionId: string; value: string }> }
type EventQuestion = { id: string; type: string; label: string; required?: boolean }
type AttendeeResult = { status: 'confirmed' | 'waitlist'; waitlistPosition?: number; registrationId: string }

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? '127.0.0.1'
  const { success } = await ratelimit.limit(ip)
  if (!success) {
    return NextResponse.json(
      { success: false, error: 'Too many requests. Please try again shortly.' },
      { status: 429 }
    )
  }

  try {
    const body = await req.json()
    const { eventSlug, attendees } = body as { eventSlug: string; attendees: AttendeePayload[] }

    if (!eventSlug || !Array.isArray(attendees) || attendees.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing eventSlug or attendees' }, { status: 400 })
    }
    if (attendees.length > 20) {
      return NextResponse.json({ success: false, error: 'Maximum 20 attendees per submission' }, { status: 400 })
    }

    // 1. Find event by slug
    const event = await prisma.event.findUnique({ where: { slug: eventSlug } })
    const eventQuestions = (event?.questions as EventQuestion[] | null) ?? []
    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    // 2. Check deadline
    if (event.deadline && new Date(event.deadline) < new Date()) {
      return NextResponse.json({ success: false, error: 'Registration is closed' }, { status: 400 })
    }

    // 3. Process each attendee sequentially inside a transaction
    const results = await prisma.$transaction(async (tx): Promise<AttendeeResult[]> => {
      const attendeeResults: AttendeeResult[] = []

      for (const attendee of attendees) {
        const freshEvent = await tx.event.findUnique({ where: { slug: eventSlug } })
        if (!freshEvent) throw new Error('Event not found')

        let status: 'confirmed' | 'waitlist'
        let waitlistPosition: number | undefined = undefined

        if (freshEvent.capacity == null || freshEvent.confirmedCount < freshEvent.capacity) {
          status = 'confirmed'
        } else {
          status = 'waitlist'
        }

        const emailAnswer = attendee.answers.find(a => {
          const question = eventQuestions.find(q => q.id === a.questionId)
          return question?.type === 'email'
        })
        const attendeeEmail = emailAnswer?.value ?? null

        let registrationId: string

        if (status === 'confirmed') {
          const reg = await tx.registration.create({
            data: {
              eventId: freshEvent.id,
              answers: attendee.answers,
              status,
              submittedAt: new Date(),
              notified: false,
              attendeeEmail,
            },
          })
          registrationId = reg.id
          await tx.event.update({
            where: { id: freshEvent.id },
            data: { confirmedCount: { increment: 1 } },
          })
        } else {
          const updatedEvent = await tx.event.update({
            where: { id: freshEvent.id },
            data: { waitlistCount: { increment: 1 } },
          })
          waitlistPosition = updatedEvent.waitlistCount
          const reg = await tx.registration.create({
            data: {
              eventId: freshEvent.id,
              answers: attendee.answers,
              status,
              waitlistPosition,
              submittedAt: new Date(),
              notified: false,
              attendeeEmail,
            },
          })
          registrationId = reg.id
        }

        attendeeResults.push({ status, waitlistPosition, registrationId })
      }

      return attendeeResults
    })

    // Trigger fill-rate notifications (non-blocking, best-effort)
    if (event.capacity && event.organizerId) {
      try {
        const updatedEvent = await prisma.event.findUnique({ where: { slug: eventSlug } })
        if (updatedEvent) {
          const oldFill = event.confirmedCount / event.capacity
          const newFill = updatedEvent.confirmedCount / event.capacity
          if (newFill >= 1.0 && oldFill < 1.0) {
            await createNotification({
              userId: event.organizerId,
              type: "full",
              message: `Your event "${event.title}" is now full. ${updatedEvent.waitlistCount} ${updatedEvent.waitlistCount === 1 ? "person is" : "people are"} on the waitlist.`,
              eventId: event.id,
            })
          } else if (newFill >= 0.8 && oldFill < 0.8) {
            await createNotification({
              userId: event.organizerId,
              type: "info",
              message: `Your event "${event.title}" is 80% full. Consider increasing capacity.`,
              eventId: event.id,
            })
          }
        }
      } catch {
        // Notifications are non-critical; do not fail the registration
      }
    }

    return NextResponse.json({
      success: true,
      results,
      eventTitle: event.title,
    }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

