import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { eventSlug, answers } = body

    if (!eventSlug || !Array.isArray(answers)) {
      return NextResponse.json({ success: false, error: 'Missing eventSlug or answers' }, { status: 400 })
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

    const registrationResult = await prisma.$transaction(async (tx): Promise<{ status: 'confirmed' | 'waitlist'; waitlistPosition?: number; eventTitle: string }> => {
      // 3. Re-fetch event inside transaction
      const freshEvent = await tx.event.findUnique({ where: { slug: eventSlug } })
      if (!freshEvent) throw new Error('Event not found')

      let status: 'confirmed' | 'waitlist'
      let waitlistPosition: number | undefined = undefined

      if (freshEvent.capacity == null) {
        status = 'confirmed'
      } else if (freshEvent.confirmedCount < freshEvent.capacity) {
        status = 'confirmed'
      } else {
        status = 'waitlist'
      }

      // 4. Create registration and update event counts
      if (status === 'confirmed') {
        await tx.registration.create({
          data: {
            eventId: freshEvent.id,
            answers,
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
        // Waitlist
        const updatedEvent = await tx.event.update({
          where: { id: freshEvent.id },
          data: { waitlistCount: { increment: 1 } },
        })
        waitlistPosition = updatedEvent.waitlistCount
        await tx.registration.create({
          data: {
            eventId: freshEvent.id,
            answers,
            status,
            waitlistPosition,
            submittedAt: new Date(),
            notified: false,
          },
        })
      }

      return {
        status,
        waitlistPosition,
        eventTitle: freshEvent.title,
      }
    })

    return NextResponse.json({
      success: true,
      status: registrationResult.status,
      waitlistPosition: registrationResult.waitlistPosition,
      eventTitle: registrationResult.eventTitle,
    }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
