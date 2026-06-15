import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { generateTicketPDF } from '@/lib/ticket'

type EventQuestion = { id: string; type: string; label: string }
type Answer = { questionId: string; value: string }

function extractField(answers: Answer[], questions: EventQuestion[], types: string[], labelHints: string[]): string | null {
  for (const type of types) {
    const q = questions.find((question) => question.type === type)
    if (q) {
      const value = answers.find((a) => a.questionId === q.id)?.value?.trim()
      if (value) return value
    }
  }

  for (const hint of labelHints) {
    const q = questions.find((question) => question.label.toLowerCase().includes(hint))
    if (q) {
      const value = answers.find((a) => a.questionId === q.id)?.value?.trim()
      if (value) return value
    }
  }

  return null
}

export async function GET(_req: NextRequest, props: { params: Promise<{ confirmationCode: string }> }) {
  const { confirmationCode } = await props.params

  const registration = await prisma.registration.findUnique({
    where: { confirmationCode },
    include: {
      ticket: true,
      event: {
        select: {
          id: true,
          title: true,
          eventDate: true,
          location: true,
          questions: true,
          ticketsEnabled: true,
          isPaid: true,
          organizer: {
            select: { name: true },
          },
        },
      },
    },
  })

  if (!registration) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
  }

  if (registration.status !== 'confirmed') {
    return NextResponse.json(
      { error: 'Ticket only available for confirmed registrations' },
      { status: 403 }
    )
  }

  if (!registration.event.ticketsEnabled) {
    return NextResponse.json(
      { error: 'Tickets are not enabled for this event' },
      { status: 403 }
    )
  }

  const questions = (registration.event.questions as EventQuestion[]) ?? []
  const answers = (registration.answers as Answer[]) ?? []

  const attendeeName = extractField(answers, questions, ['text'], ['name']) || 'Attendee'

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generateTicketPDF({
      eventTitle: registration.event.title,
      attendeeName,
      ticketId: registration.confirmationCode ?? registration.id,
      eventId: registration.event.id,
      userId: registration.id,
      eventDate: registration.event.eventDate,
      location: registration.event.location,
      organizerName: registration.event.organizer?.name ?? 'Organizer',
      isPaid: registration.event.isPaid,
      ticketPrice: registration.ticket?.amountPaidKes ?? undefined,
      ticketTierName: registration.ticket?.ticketTierName ?? undefined,
    })
  } catch (err) {
    console.error('[ticket-api] PDF generation failed:', err)
    return NextResponse.json({ error: 'Failed to generate ticket PDF' }, { status: 500 })
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ticket-${registration.confirmationCode}.pdf"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
