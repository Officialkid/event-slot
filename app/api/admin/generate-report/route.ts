import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import prisma from '@/lib/prisma'
import { authOptions } from '@/lib/auth'
import { isAdminEmail } from '@/lib/isAdmin'
import { generateEventReport, IRegistration } from '@/lib/generateEventReport'

function extractSlugFromInput(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw)
      const parts = url.pathname.split('/').filter(Boolean)
      if (parts.length === 0) return null
      if (parts[0] === 'events' && parts[1]) return parts[1]
      return parts[parts.length - 1] || null
    } catch {
      return null
    }
  }

  return raw
}

type PreparedReportData = {
  slug: string
  eventPayload: {
    title: string
    slug: string
    organizerEmail: string
    confirmedCount: number
    waitlistCount: number
    capacity: number | null
    eventDate: string | null
    location: string | null
    deadline: string | null
    createdAt: string
    questions: Array<{ id: string; label: string; type: string }>
  }
  confirmed: IRegistration[]
  waitlist: IRegistration[]
}

async function prepareReportDataFromSlug(slugInput: string): Promise<PreparedReportData | null> {
  const slug = extractSlugFromInput(slugInput)
  if (!slug) return null

  const event = await prisma.event.findFirst({
    where: {
      slug,
      archived: false,
      status: 'active',
    },
    include: {
      organizer: { select: { id: true, email: true } },
    },
  })

  if (!event) return null

  const registrations = await prisma.registration.findMany({
    where: { eventId: event.id },
    orderBy: [{ submittedAt: 'asc' }, { waitlistPosition: 'asc' }],
  })

  const confirmed: IRegistration[] = registrations
    .filter(r => r.status === 'confirmed')
    .map(r => ({
      id: r.id,
      answers: r.answers as Array<{ questionId: string; value: string }>,
      registrationNumber: r.registrationNumber,
      submittedAt: r.submittedAt.toISOString(),
      waitlistPosition: r.waitlistPosition,
    }))

  const waitlist: IRegistration[] = registrations
    .filter(r => r.status === 'waitlist')
    .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0))
    .map(r => ({
      id: r.id,
      answers: r.answers as Array<{ questionId: string; value: string }>,
      registrationNumber: r.registrationNumber,
      submittedAt: r.submittedAt.toISOString(),
      waitlistPosition: r.waitlistPosition,
    }))

  const eventPayload = {
    title: event.title,
    slug: event.slug,
    organizerEmail: event.organizerEmail,
    confirmedCount: event.confirmedCount,
    waitlistCount: event.waitlistCount,
    capacity: event.capacity,
    eventDate: event.eventDate?.toISOString() ?? null,
    location: event.location,
    deadline: event.deadline?.toISOString() ?? null,
    createdAt: event.createdAt.toISOString(),
    questions: (event.questions as Array<{ id: string; label: string; type: string }>).map(q => ({
      id: q.id,
      label: q.label,
      type: q.type,
    })),
  }

  return {
    slug: event.slug,
    eventPayload,
    confirmed,
    waitlist,
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({} as { eventUrl?: string }))
    const eventUrl = (body.eventUrl || '').trim()
    if (!eventUrl) {
      return NextResponse.json({ error: 'eventUrl is required' }, { status: 400 })
    }

    const prepared = await prepareReportDataFromSlug(eventUrl)
    if (!prepared) {
      return NextResponse.json(
        { error: 'Event not found, unpublished, or unavailable for report generation.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      event: {
        title: prepared.eventPayload.title,
        slug: prepared.eventPayload.slug,
        confirmedCount: prepared.eventPayload.confirmedCount,
        waitlistCount: prepared.eventPayload.waitlistCount,
        capacity: prepared.eventPayload.capacity,
        eventDate: prepared.eventPayload.eventDate,
        location: prepared.eventPayload.location,
      },
      reportReady: true,
      message: 'Basic Word report is ready for download.',
      downloadUrl: `/api/admin/generate-report?slug=${encodeURIComponent(prepared.slug)}`,
    })
  } catch (error) {
    console.error('[admin/generate-report][POST]', error)
    return NextResponse.json({ error: 'Failed to generate report preview.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!isAdminEmail(session?.user?.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const slug = req.nextUrl.searchParams.get('slug')?.trim() || ''
    if (!slug) {
      return NextResponse.json({ error: 'slug is required' }, { status: 400 })
    }

    const prepared = await prepareReportDataFromSlug(slug)
    if (!prepared) {
      return NextResponse.json(
        { error: 'Event not found, unpublished, or unavailable for report generation.' },
        { status: 404 }
      )
    }

    const buffer = await generateEventReport({
      event: prepared.eventPayload,
      confirmed: prepared.confirmed,
      waitlist: prepared.waitlist,
    })

    const reportBytes = new Uint8Array(buffer)
    return new Response(reportBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="admin-event-report-${prepared.slug}.docx"`,
      },
    })
  } catch (error) {
    console.error('[admin/generate-report][GET]', error)
    return NextResponse.json({ error: 'Failed to download report.' }, { status: 500 })
  }
}
