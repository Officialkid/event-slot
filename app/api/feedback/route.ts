import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { registrationId, rating, enjoyed, improve, complaint } = body

    if (!registrationId || typeof registrationId !== 'string') {
      return NextResponse.json({ error: 'Missing registrationId' }, { status: 400 })
    }
    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json({ error: 'Rating must be an integer between 1 and 5' }, { status: 400 })
    }

    const registration = await prisma.registration.findUnique({
      where: { id: registrationId },
      select: { id: true, status: true, eventId: true },
    })

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }
    if (registration.status !== 'confirmed') {
      return NextResponse.json({ error: 'Only confirmed attendees can submit feedback' }, { status: 403 })
    }

    const existing = await prisma.attendeeFeedback.findUnique({
      where: { registrationId },
      select: { id: true },
    })
    if (existing) {
      return NextResponse.json({ error: 'Feedback already submitted' }, { status: 409 })
    }

    await prisma.attendeeFeedback.create({
      data: {
        eventId: registration.eventId,
        registrationId,
        rating,
        enjoyed: enjoyed ?? null,
        improve: improve ?? null,
        complaint: complaint ?? null,
      },
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
