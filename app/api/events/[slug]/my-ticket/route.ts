import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params

  try {
    const email = req.nextUrl.searchParams.get('email')
    const confirmationCode = req.nextUrl.searchParams.get('code')

    if (!email && !confirmationCode) {
      return NextResponse.json(
        { error: 'Provide email or confirmation code' },
        { status: 400 }
      )
    }

    const event = await prisma.event.findUnique({
      where: { slug },
      select: { id: true, title: true, eventDate: true, location: true, ticketsEnabled: true },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    if (!event.ticketsEnabled) {
      return NextResponse.json({
        available: false,
        message: 'Ticket not available for this event.',
      })
    }

    const registration = await prisma.registration.findFirst({
      where: confirmationCode
        ? { confirmationCode, eventId: event.id }
        : { attendeeEmail: email!, eventId: event.id, status: 'confirmed' },
      include: { ticket: true },
    })

    if (!registration || registration.status !== 'confirmed') {
      return NextResponse.json({ available: false, message: 'No confirmed registration found.' })
    }

    if (!registration.ticket) {
      return NextResponse.json({ available: false, message: 'Ticket not yet generated.' })
    }

    return NextResponse.json({
      available: true,
      code: registration.ticket.code,
      generatedAt: registration.ticket.generatedAt,
      scannedAt: registration.ticket.scannedAt,
      confirmationCode: registration.confirmationCode,
      event: event.title,
      date: event.eventDate,
      location: event.location,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
