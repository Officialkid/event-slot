import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type AttendeePayload = { answers: Array<{ questionId: string; value: string }> }
type AttendeeResult = { status: 'confirmed' | 'waitlist'; waitlistPosition?: number }

export async function POST(req: NextRequest) {
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

        if (status === 'confirmed') {
          await tx.registration.create({
            data: {
              eventId: freshEvent.id,
              answers: attendee.answers,
              status,
              submittedAt: new Date(),
              notified: false,
            },
          })
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
          await tx.registration.create({
            data: {
              eventId: freshEvent.id,
              answers: attendee.answers,
              status,
              waitlistPosition,
              submittedAt: new Date(),
              notified: false,
            },
          })
        }

        attendeeResults.push({ status, waitlistPosition })
      }

      return attendeeResults
    })

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

