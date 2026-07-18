import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { EventReportData, generateEventReport, IRegistration, ReportTheme } from '@/lib/generateEventReport'
import { isAdminEmail } from '@/lib/isAdmin'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { reportDownloadRatelimit } from '@/lib/ratelimit'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
  isPaid: boolean
  currency: string
  eventDate: string | null
  location: string | null
  deadline: string | null
  createdAt: string
  questions: Array<{ id: string; label: string; type: string }>
  paymentSummary?: EventReportData["paymentSummary"]
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
    paymentSummary: eventPayload.paymentSummary,
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

function buildReportPreviewPaymentSummary(paymentSummary: EventReportData["paymentSummary"]) {
  if (!paymentSummary) return undefined
  return {
    currency: paymentSummary.currency,
    grossRevenue: paymentSummary.grossRevenue,
    commissionTotal: paymentSummary.commissionTotal,
    netRevenue: paymentSummary.netRevenue,
    successfulPayments: paymentSummary.successfulPayments,
    pendingPayments: paymentSummary.pendingPayments,
    failedPayments: paymentSummary.failedPayments,
    ticketsSold: paymentSummary.ticketsSold,
    paymentMethodBreakdown: paymentSummary.paymentMethodBreakdown,
  }
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params
  try {
    const { slug } = params
    const mode = req.nextUrl.searchParams.get('mode')
    const token = req.nextUrl.searchParams.get('token')
    const theme = (req.nextUrl.searchParams.get('theme') ?? 'eventslot') as ReportTheme

    const session = await getServerSession(authOptions)
    const isSuperAdmin = isAdminEmail(session?.user?.email)

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

    const registrations = await prisma.registration.findMany({
      where: { eventId: event.id },
      orderBy: [{ submittedAt: 'asc' }, { waitlistPosition: 'asc' }],
      select: {
        id: true,
        status: true,
        answers: true,
        registrationNumber: true,
        submittedAt: true,
        waitlistPosition: true,
      },
    })

    const [payments, paidOrders] = event.isPaid
      ? await Promise.all([
          prisma.payment.findMany({
            where: { eventId: event.id },
            select: {
              amount: true,
              commissionAmount: true,
              organizerAmount: true,
              status: true,
              method: true,
            },
          }),
          prisma.paidEventOrder.findMany({
            where: { eventId: event.id },
            select: {
              status: true,
            },
          }),
        ])
      : [[], []]

    const confirmed: IRegistration[] = registrations
      .filter((registration) => registration.status === 'confirmed')
      .map((registration) => ({
        id: registration.id,
        answers: registration.answers as Array<{ questionId: string; value: string }>,
        registrationNumber: registration.registrationNumber,
        submittedAt: registration.submittedAt.toISOString(),
        waitlistPosition: registration.waitlistPosition,
      }))

    const waitlist: IRegistration[] = registrations
      .filter((registration) => registration.status === 'waitlist')
      .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0))
      .map((registration) => ({
        id: registration.id,
        answers: registration.answers as Array<{ questionId: string; value: string }>,
        registrationNumber: registration.registrationNumber,
        submittedAt: registration.submittedAt.toISOString(),
        waitlistPosition: registration.waitlistPosition,
      }))

    const eventPayload = {
      title: event.title,
      slug: event.slug,
      organizerEmail: event.organizerEmail,
      confirmedCount: event.confirmedCount,
      waitlistCount: event.waitlistCount,
      capacity: event.capacity,
      isPaid: event.isPaid,
      currency: event.currency,
      eventDate: event.eventDate?.toISOString() ?? null,
      location: event.location,
      deadline: event.deadline?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
      questions: (event.questions as Array<{ id: string; label: string; type: string }>).map((question) => ({
        id: question.id,
        label: question.label,
        type: question.type,
      })),
      paymentSummary: (() => {
        if (!event.isPaid) return undefined
        const successfulPayments = payments.filter((payment) => payment.status === 'SUCCESS')
        const pendingPayments = paidOrders.filter((order) => order.status === 'PENDING' || order.status === 'PAYMENT_PENDING')
        const failedPayments = paidOrders.filter((order) => order.status === 'FAILED' || order.status === 'EXPIRED' || order.status === 'CANCELLED')
        const methodTotals = new Map<string, { count: number; grossRevenue: number }>()

        for (const payment of successfulPayments) {
          const key = payment.method
          const current = methodTotals.get(key) ?? { count: 0, grossRevenue: 0 }
          current.count += 1
          current.grossRevenue += payment.amount
          methodTotals.set(key, current)
        }

        return {
          currency: event.currency,
          grossRevenue: successfulPayments.reduce((sum, payment) => sum + payment.amount, 0),
          commissionTotal: successfulPayments.reduce((sum, payment) => sum + payment.commissionAmount, 0),
          netRevenue: successfulPayments.reduce((sum, payment) => sum + payment.organizerAmount, 0),
          successfulPayments: successfulPayments.length,
          pendingPayments: pendingPayments.length,
          failedPayments: failedPayments.length,
          ticketsSold: successfulPayments.length,
          paymentMethodBreakdown: Array.from(methodTotals.entries()).map(([method, value]) => ({
            method,
            count: value.count,
            grossRevenue: value.grossRevenue,
          })),
        }
      })(),
    }

    if (mode === 'preview' || !mode) {
      const requiresSignIn = !session?.user?.id && !hasValidToken
      const accessNote = requiresSignIn
        ? 'Preview is ready. Sign in as the organiser or an approved team member to download the full report.'
        : 'Preview and download are free while EventSlot completes the premium report rollout.'

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
        paymentSummary: buildReportPreviewPaymentSummary(eventPayload.paymentSummary),
        reportReady: true,
        generatedAt: new Date().toISOString(),
        message: 'Your professional report is ready.',
        isSuperAdmin,
        downloadsRemaining: null,
        requiresSignIn,
        downloadCostDownloads: 0,
        downloadPriceKsh: 0,
        accessNote,
      })
    }

    if (mode === 'download') {
      const downloadAccessKey =
        session?.user?.id
          ? session.user.id
          : hasValidToken
            ? `event-report-token:${event.id}:${token}`
            : null

      if (!downloadAccessKey) {
        return NextResponse.json(
          { error: 'Sign in to download', code: 'AUTH_REQUIRED' },
          { status: 401 },
        )
      }

      const docRl = await rateLimit(downloadAccessKey, 'DOCUMENT_GENERATION', 10, 60)
      if (!docRl.allowed) {
        return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
      }

      const reportData = buildEventReportData(eventPayload, confirmed, waitlist, theme)
      let buffer: Buffer | ArrayBuffer
      try {
        buffer = await generateEventReport(reportData)
      } catch (error) {
        throw error
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
  } catch (error) {
    console.error('[report]', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
