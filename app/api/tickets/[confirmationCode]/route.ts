import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { generateTicketPDF } from '@/lib/ticket'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

function extractAttendanceDays(answers: Answer[], questions: EventQuestion[]): string | null {
  const dayQuestion = questions.find((question) => {
    const label = question.label.toLowerCase()
    return label.includes("day") && (label.includes("attend") || label.includes("coming") || label.includes("which"))
  })

  if (!dayQuestion) return null

  const raw = answers.find((answer) => answer.questionId === dayQuestion.id)?.value?.trim()
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(", ")
    }
  } catch {
    return raw.split("|").map((value) => value.trim()).filter(Boolean).join(", ")
  }

  return null
}

export async function GET(_req: NextRequest, props: { params: Promise<{ confirmationCode: string }> }) {
  const { confirmationCode } = await props.params

  const registration: any = await prisma.registration.findUnique({
    where: { confirmationCode },
    include: {
      ticket: true,
      ticketTier: true,
      event: {
        select: {
          id: true,
          title: true,
          eventDate: true,
          eventEndAt: true,
          location: true,
          organizerName: true,
          questions: true,
          ticketsEnabled: true,
          isPaid: true,
          organizer: {
            select: { name: true },
          },
        },
      },
    },
  } as any)

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
  const attendanceDays = extractAttendanceDays(answers, questions)

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generateTicketPDF({
      eventTitle: registration.event.title,
      attendeeName,
      ticketId: registration.confirmationCode ?? registration.id,
      eventId: registration.event.id,
      userId: registration.id,
      eventDate: registration.event.eventDate,
      eventEndAt: registration.event.eventEndAt,
      attendanceDays,
      location: registration.event.location,
      organizerName: registration.event.organizerName ?? registration.event.organizer?.name ?? 'Organizer',
      isPaid: registration.event.isPaid,
      ticketPrice: registration.ticket?.amountPaidKes ?? undefined,
      ticketTierName: registration.ticket?.ticketTierName ?? registration.ticketTier?.name ?? undefined,
      ticketTierBadgeColor: registration.ticketTier?.badgeColor ?? undefined,
      ticketTierTextColor: registration.ticketTier?.textColor ?? undefined,
      ticketTierMetallic: registration.ticketTier?.metallic ?? undefined,
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
