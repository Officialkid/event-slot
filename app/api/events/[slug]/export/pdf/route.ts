import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { hasOrganiserAccess } from '@/lib/adminMode'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { RegistrationResponsesPdf } from '@/components/pdf/RegistrationResponsesPdf'

// Force Node.js runtime — @react-pdf/renderer is not Edge-compatible
export const dynamic = 'force-dynamic'

function cleanValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  return String(value)
}

/** First non-empty answer — conventionally the attendee's name. */
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

    // ── Transform for PDF component ───────────────────────────────────────────
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

    // ── Event metadata for PDF header ─────────────────────────────────────────
    const eatDate = (date: Date, opts: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'Africa/Nairobi' }).format(date)

    const eventDateStr = event.eventDate
      ? eatDate(event.eventDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'Date TBC'

    const exportedAt = eatDate(new Date(), {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    })

    // ── Render PDF ────────────────────────────────────────────────────────────
    const pdfBuffer = await renderToBuffer(
      React.createElement(RegistrationResponsesPdf, {
        eventTitle:    event.title,
        eventDate:     eventDateStr,
        exportedAt,
        registrations: pdfRegistrations,
      }) as React.ReactElement<Record<string, unknown>>,
    )

    const safeTitle    = (event.title as string).replace(/[^a-z0-9]/gi, '_').toLowerCase()
    const statusSuffix = statusWhere ? `_${statusWhere}` : '_all'
    const dateSuffix   = new Date().toISOString().slice(0, 10)
    const filename     = `eventslot_${safeTitle}${statusSuffix}_${dateSuffix}.pdf`

    return new Response(new Uint8Array(pdfBuffer), {
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
