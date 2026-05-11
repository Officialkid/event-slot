import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { EventReportData, generateEventReport, IRegistration, ReportTheme } from '@/lib/generateEventReport'
import { REPORT_DOWNLOAD_PRICING } from '@/lib/plans'
import { isAdminEmail } from '@/lib/isAdmin'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { reportDownloadRatelimit } from '@/lib/ratelimit'
import { useFeature, creditTokens } from '@/lib/tokens'
import { PAYMENTS_ENABLED } from '@/lib/payments'
import { rateLimit } from '@/lib/rate-limit'

function extractDisplayNameFromEmail(email: string): string {
  const local = email.split('@')[0] || 'Organiser'
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function getRegistrationName(reg: IRegistration): string {
  const fromAnswer = reg.answers.find((answer) => answer.value && answer.value.trim().length > 0)?.value
  return (fromAnswer ?? '').trim() || 'Not provided'
}

function getRegistrationPhone(reg: IRegistration): string | undefined {
  const maybePhone = reg.answers.find((answer) => /\+?\d[\d\s-]{6,}/.test(answer.value ?? ''))?.value
  return maybePhone?.trim() || undefined
}

function buildDailyRegistrationCounts(regs: IRegistration[]): { date: string; count: number }[] {
  const byDay: Record<string, number> = {}
  for (const reg of regs) {
    const date = new Date(reg.submittedAt)
    if (Number.isNaN(date.getTime())) continue
    const key = date.toISOString().slice(0, 10)
    byDay[key] = (byDay[key] ?? 0) + 1
  }

  return Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([isoDate, count]) => {
      const date = new Date(isoDate)
      return {
        date: `${date.getUTCDate()} ${date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}`,
        count,
      }
    })
}

function buildEventReportData(eventPayload: {
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
}, confirmed: IRegistration[], waitlist: IRegistration[], theme: ReportTheme): EventReportData {
  const allRegistrations = [...confirmed, ...waitlist]
  const dailyRegistrationCounts = buildDailyRegistrationCounts(allRegistrations)
  const peak = dailyRegistrationCounts.reduce(
    (max, item) => (item.count > max.count ? item : max),
    { date: 'N/A', count: 0 },
  )

  return {
    title: eventPayload.title,
    slug: eventPayload.slug,
    organizerEmail: eventPayload.organizerEmail,
    organizerName: extractDisplayNameFromEmail(eventPayload.organizerEmail),
    eventDate: new Date(eventPayload.eventDate ?? eventPayload.createdAt),
    location: eventPayload.location ?? 'Not specified',
    registrationOpenDate: new Date(eventPayload.createdAt),
    registrationDeadline: new Date(eventPayload.deadline ?? eventPayload.eventDate ?? eventPayload.createdAt),
    capacity:
      eventPayload.capacity && eventPayload.capacity > 0
        ? eventPayload.capacity
        : Math.max(1, eventPayload.confirmedCount + eventPayload.waitlistCount),
    totalRegistrations: eventPayload.confirmedCount + eventPayload.waitlistCount,
    confirmedCount: eventPayload.confirmedCount,
    waitlistCount: eventPayload.waitlistCount,
    attendees: confirmed.map((registration, index) => ({
      name: getRegistrationName(registration),
      registrationNumber: registration.registrationNumber ?? index + 1,
      phone: getRegistrationPhone(registration),
      registeredAt: new Date(registration.submittedAt),
    })),
    waitlist: waitlist.map((registration, index) => ({
      name: getRegistrationName(registration),
      position: registration.waitlistPosition ?? index + 1,
      joinedAt: new Date(registration.submittedAt),
    })),
    dailyRegistrationCounts,
    peakDate: peak.date,
    peakDayCount: peak.count,
    customQuestionResponses: eventPayload.questions.map((question) => ({
      question: question.label,
      answers: allRegistrations
        .flatMap((registration) =>
          registration.answers
            .filter((answer) => answer.questionId === question.id)
            .map((answer) => answer.value.trim()),
        )
        .filter((value) => value.length > 0),
    })),
    theme,
  }
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const { slug } = params
    const mode = req.nextUrl.searchParams.get('mode')
    const token = req.nextUrl.searchParams.get('token')
    const theme = (req.nextUrl.searchParams.get('theme') ?? 'eventslot') as ReportTheme

    const session = await getServerSession(authOptions)
    const isSuperAdmin = isAdminEmail(session?.user?.email)

    // Rate limit report downloads (per user or IP)
    const rlKey = session?.user?.id ?? (req.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim()
    const { success: rlOk } = await reportDownloadRatelimit.limit(`report:${rlKey}`)
    if (!rlOk) {
      return NextResponse.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 })
    }

    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        organizer: { select: { id: true } },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Validate access
    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)
    const hasTeamAccess = !!(session?.user?.id && await hasTeamEventAccess({
      userId: session.user.id,
      organizerId: event.organizerId,
      eventId: event.id,
    }))

    if (!isOwner && !hasValidToken && !isSuperAdmin && !hasTeamAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all registrations
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

    if (mode === 'preview' || !mode) {
      const downloadBalance = session?.user?.id
        ? await prisma.reportDownload.findUnique({
            where: { userId: session.user.id },
            select: { downloadsRemaining: true },
          })
        : null

      return NextResponse.json({
        success: true,
        event: {
          title: event.title,
          slug: event.slug,
          confirmedCount: event.confirmedCount,
          waitlistCount: event.waitlistCount,
          capacity: event.capacity,
          eventDate: event.eventDate?.toISOString() ?? null,
          location: event.location,
          deadline: event.deadline?.toISOString() ?? null,
        },
        reportReady: true,
        generatedAt: new Date().toISOString(),
        message: 'Your professional report is ready.',
        isSuperAdmin,
        downloadsRemaining: downloadBalance?.downloadsRemaining ?? 0,
      })
    }

    if (mode === 'download') {
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Sign in to download', code: 'AUTH_REQUIRED' },
          { status: 401 }
        )
      }

      // ── Per-user document generation rate limit (10/hr) ─
      const docRl = await rateLimit(session.user.id, 'DOCUMENT_GENERATION', 10, 60)
      if (!docRl.allowed) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
      }

      // ── Token gate ──────────────────────────────────────
      const access = await useFeature(
        session.user.id,
        session.user.email!,
        'DOCUMENT_GENERATION',
        `Document report — event ${slug}`,
        slug
      )

      if (!access.allowed) {
        return NextResponse.json({
          error: 'INSUFFICIENT_TOKENS',
          message: PAYMENTS_ENABLED
            ? `Generating a report costs 20 tokens (KSh 100). Your current balance is ${
                access.newBalance ?? 0
              } tokens. Purchase tokens to continue.`
            : `Generating a report costs 20 tokens (KSh 100). Your current balance is ${
                access.newBalance ?? 0
              } tokens. Token purchases are coming very soon!`,
          required: 20,
          currentBalance: access.newBalance ?? 0,
          paymentsEnabled: PAYMENTS_ENABLED,
        }, { status: 402 })
      }

      const reportData = buildEventReportData(eventPayload, confirmed, waitlist, theme)
      let buffer: Buffer | ArrayBuffer
      try {
        buffer = await generateEventReport(reportData)
      } catch (genErr) {
        // Refund tokens if generation fails
        if (!isSuperAdmin) {
          await creditTokens(
            session.user.id,
            20,
            'REFUND',
            `Report generation failed — event ${slug}`,
            slug
          )
        }
        throw genErr
      }

      const reportBytes = new Uint8Array(buffer)

      return new Response(reportBytes, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="event-report-${slug}.docx"`,
        },
      })
    }

    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  } catch (err) {
    console.error('[report]', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
