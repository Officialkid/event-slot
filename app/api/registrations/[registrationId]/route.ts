import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

type EventQuestion = { id: string; type: string; label: string; required?: boolean }

export async function GET(
  _req: NextRequest,
  { params }: { params: { registrationId: string } }
) {
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: { registrationId: string } }
) {
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
        data: { attendeeEmail },
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: { registrationId: string } }
) {
  try {
    const token = new URL(req.url).searchParams.get('token')

    const registration = await prisma.registration.findUnique({
      where: { id: params.registrationId },
      include: { event: { select: { dashboardToken: true, id: true } } },
    })

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }

    if (!token || registration.event.dashboardToken !== token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.registration.delete({ where: { id: params.registrationId } })

    // Keep event counts accurate
    if (registration.status === 'confirmed') {
      await prisma.event.update({
        where: { id: registration.eventId },
        data: { confirmedCount: { decrement: 1 } },
      })
    } else if (registration.status === 'waitlist') {
      await prisma.event.update({
        where: { id: registration.eventId },
        data: { waitlistCount: { decrement: 1 } },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[registrations/[registrationId]] DELETE error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

