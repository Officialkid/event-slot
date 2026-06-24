import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { hasOrganiserAccess } from '@/lib/adminMode'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { RegistrationResponsesPdf } from '@/components/pdf/RegistrationResponsesPdf'
import { jsPDF } from 'jspdf'

// Force Node.js runtime because @react-pdf/renderer is not Edge-compatible.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return String(value)
}

/** First non-empty answer, conventionally the attendee's name. */
function extractName(answers: Array<{ value?: unknown }>): string {
  for (const a of answers) {
    const v = cleanValue(a.value).trim()
    if (v) return v
  }
  return 'Attendee'
}

/** First answer that looks like a phone number. */
function extractPhone(answers: Array<{ value?: unknown }>): string | null {
  for (const a of answers) {
    const v = cleanValue(a.value).trim()
    if (v && /^\+?\d[\d\s\-().]{6,}$/.test(v)) return v
  }
  return null
}

function buildFallbackResponsesPdf(params: {
  eventTitle: string
  eventDate: string
  exportedAt: string
  registrations: Array<{
    index: number
    total: number
    name: string
    email: string
    phone: string | null
    status: 'confirmed' | 'waitlist'
    registeredAt: string
    ticketCode: string | null
    questionAnswers: Array<{
      questionId: string
      label: string
      type: string
      answer: string | null
    }>
  }>
}) {
  const { eventTitle, eventDate, exportedAt, registrations } = params
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const marginX = 42
  const topY = 42
  const lineHeight = 15

  const ensureSpace = (y: number, needed: number) => {
    if (y + needed <= pageHeight - 48) return y
    doc.addPage()
    return topY
  }

  registrations.forEach((reg, index) => {
    if (index > 0) doc.addPage()

    let y = topY
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(95, 99, 104)
    doc.text(`${eventTitle} - ${eventDate}`, marginX, y)
    doc.text(exportedAt, pageWidth - marginX, y, { align: 'right' })
    y += 16
    doc.setDrawColor(218, 220, 224)
    doc.line(marginX, y, pageWidth - marginX, y)
    y += 18

    doc.setFontSize(9)
    doc.text('Response', marginX, y)
    doc.setFont('helvetica', 'bold')
    doc.text(`${reg.index} / ${reg.total}`, pageWidth - marginX, y, { align: 'right' })
    y += 24

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor(32, 33, 36)
    doc.text(reg.name, marginX, y)
    y += 18

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(95, 99, 104)
    doc.text(reg.email || 'No email provided', marginX, y)
    y += 12
    if (reg.phone) {
      doc.text(reg.phone, marginX, y)
      y += 12
    }
    doc.text(`Registered: ${reg.registeredAt}`, marginX, y)
    y += 12
    if (reg.ticketCode) {
      doc.text(`Ticket: ${reg.ticketCode}`, marginX, y)
      y += 12
    }
    doc.setTextColor(reg.status === 'confirmed' ? 19 : 176, reg.status === 'confirmed' ? 115 : 96, reg.status === 'confirmed' ? 51 : 0)
    doc.text(reg.status.toUpperCase(), marginX, y)
    y += 18
    doc.setTextColor(189, 189, 189)
    doc.text('EventSlot - eventsslot.com', marginX, y)
    y += 14
    doc.setDrawColor(218, 220, 224)
    doc.line(marginX, y, pageWidth - marginX, y)
    y += 18

    if (reg.questionAnswers.length === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(11)
      doc.setTextColor(160, 160, 160)
      doc.text('No custom questions for this event.', marginX, y)
      y += 16
    } else {
      for (const qa of reg.questionAnswers) {
        y = ensureSpace(y, 56)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(95, 99, 104)
        const labelLines = doc.splitTextToSize(qa.label, pageWidth - marginX * 2)
        doc.text(labelLines, marginX, y)
        y += labelLines.length * 12

        doc.setFont('helvetica', qa.answer ? 'normal' : 'italic')
        doc.setFontSize(11)
        doc.setTextColor(32, 33, 36)
        const answerLines = doc.splitTextToSize(qa.answer?.trim() || 'No answer provided', pageWidth - marginX * 2)
        doc.text(answerLines, marginX, y)
        y += answerLines.length * lineHeight + 8

        doc.setDrawColor(218, 220, 224)
        doc.line(marginX, y, pageWidth - marginX, y)
        y += 14
      }
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(189, 189, 189)
    doc.text('Confidential - Personal data protected under Kenya Data Protection Act 2019', marginX, pageHeight - 24)
    doc.text(`Page ${index + 1} of ${registrations.length}`, pageWidth - marginX, pageHeight - 24, { align: 'right' })
  })

  return new Uint8Array(doc.output('arraybuffer'))
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ slug: string }> },
) {
  const { slug } = await props.params

  try {
    const token        = req.nextUrl.searchParams.get('token')
    const statusFilter = req.nextUrl.searchParams.get('status') ?? 'all'

    const session = await getServerSession(authOptions)

    const event = await prisma.event.findUnique({
      where: { slug },
      include: { organizer: { select: { id: true, plan: true } } },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Auth: owner | valid dashboard token | team member | super admin
    const isOwner       = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)
    const hasTeamAccess = !!(
      session?.user?.id &&
      (await hasTeamEventAccess({
        userId:      session.user.id,
        organizerId: event.organizerId,
        eventId:     event.id,
      }))
    )
    const adminAccess = !!(session && (await hasOrganiserAccess(session, event.id)))

    if (!isOwner && !hasValidToken && !hasTeamAccess && !adminAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Status: 'confirmed' | 'waitlist' | 'all'
    const statusWhere: string | null =
      statusFilter === 'confirmed' ? 'confirmed' :
      statusFilter === 'waitlist'  ? 'waitlist'  :
      null

    const registrations = await prisma.registration.findMany({
      where:   { eventId: event.id, ...(statusWhere ? { status: statusWhere } : {}) },
      orderBy: { submittedAt: 'asc' },
      include: { ticket: { select: { code: true } } },
    })

    const questions = (
      event.questions as Array<{ id: string; label: string; type: string; order?: number }>
    ).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

    const total = registrations.length

    // Transform for PDF component.
    const pdfRegistrations = registrations.map((reg, index) => {
      const rawAnswers = reg.answers as Array<{ questionId?: string; value?: unknown }>
      const sortedAnswers = Array.isArray(rawAnswers) ? rawAnswers : []

      // Answer map keyed by questionId
      const answerMap = new Map(
        sortedAnswers
          .filter(a => a.questionId)
          .map(a => [a.questionId as string, cleanValue(a.value)]),
      )

      // Extract contact details heuristically
      const name  = extractName(sortedAnswers)
      const email = reg.attendeeEmail ?? ''
      const phone = extractPhone(sortedAnswers)

      const eatFormatter = (opts: Intl.DateTimeFormatOptions) =>
        new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'Africa/Nairobi' })

      const registeredAt =
        eatFormatter({ day: '2-digit', month: 'short', year: 'numeric' }).format(reg.submittedAt) +
        ' ' +
        eatFormatter({ hour: '2-digit', minute: '2-digit', hour12: false }).format(reg.submittedAt)

      return {
        id:           reg.id,
        index:        reg.registrationNumber ?? index + 1,
        total,
        name,
        email,
        phone,
        status:       reg.status as 'confirmed' | 'waitlist',
        registeredAt,
        ticketCode:   reg.ticket?.code ?? null,
        questionAnswers: questions.map(q => ({
          questionId: q.id,
          label:      q.label,
          type:       q.type ?? 'text',
          answer:     answerMap.get(q.id) || null,
        })),
      }
    })

    // Event metadata for PDF header.
    const eatDate = (date: Date, opts: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'Africa/Nairobi' }).format(date)

    const eventDateStr = event.eventDate
      ? eatDate(event.eventDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'Date TBC'

    const exportedAt = eatDate(new Date(), {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })

    // Render PDF.
    let pdfBytes: Uint8Array
    try {
      const pdfBuffer = await renderToBuffer(
        React.createElement(RegistrationResponsesPdf, {
          eventTitle:    event.title,
          eventDate:     eventDateStr,
          exportedAt,
          registrations: pdfRegistrations,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as React.ReactElement<any>,
      )
      pdfBytes = new Uint8Array(pdfBuffer)
    } catch (error) {
      console.error('PDF export render fallback:', error)
      pdfBytes = buildFallbackResponsesPdf({
        eventTitle: event.title,
        eventDate: eventDateStr,
        exportedAt,
        registrations: pdfRegistrations,
      })
    }

    const safeTitle    = (event.title as string).replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const statusSuffix = statusWhere ? `_${statusWhere}` : '_all'
    const dateSuffix   = new Date().toISOString().slice(0, 10)
    const filename     = `eventslot_${safeTitle}${statusSuffix}_${dateSuffix}.pdf`

    return new Response(Buffer.from(pdfBytes), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('PDF export error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
