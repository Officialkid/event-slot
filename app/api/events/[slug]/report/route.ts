import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { generateEventReport, IRegistration, ReportTheme } from '@/lib/generateEventReport'
import { generateAIReportContent } from '@/lib/generateAIReportContent'
import { REPORT_DOWNLOAD_PRICING } from '@/lib/plans'
import { isAdminEmail } from '@/lib/isAdmin'

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const { slug } = params
    const mode = req.nextUrl.searchParams.get('mode')
    const token = req.nextUrl.searchParams.get('token')
    const theme = (req.nextUrl.searchParams.get('theme') ?? 'navy') as ReportTheme

    const session = await getServerSession(authOptions)
    const isSuperAdmin = isAdminEmail(session?.user?.email)

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

    if (!isOwner && !hasValidToken && !isSuperAdmin) {
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
        submittedAt: r.submittedAt.toISOString(),
        waitlistPosition: r.waitlistPosition,
      }))

    const waitlist: IRegistration[] = registrations
      .filter(r => r.status === 'waitlist')
      .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0))
      .map(r => ({
        id: r.id,
        answers: r.answers as Array<{ questionId: string; value: string }>,
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

    const aiContent = await generateAIReportContent({ event: eventPayload, confirmed, waitlist })

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
        aiContent,
        confirmed,
        waitlist,
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

      if (!isSuperAdmin) {
        const downloadRecord = await prisma.reportDownload.findUnique({
          where: { userId: session.user.id },
        })

        if (!downloadRecord || downloadRecord.downloadsRemaining < 1) {
          return NextResponse.json(
            {
              error: 'No downloads remaining',
              code: 'PAYMENT_REQUIRED',
              pricing: REPORT_DOWNLOAD_PRICING,
            },
            { status: 402 }
          )
        }

        const updated = await prisma.reportDownload.updateMany({
          where: {
            userId: session.user.id,
            downloadsRemaining: { gte: 1 },
          },
          data: {
            downloadsRemaining: { decrement: 1 },
          },
        })

        if (updated.count < 1) {
          return NextResponse.json(
            {
              error: 'No downloads remaining',
              code: 'PAYMENT_REQUIRED',
              pricing: REPORT_DOWNLOAD_PRICING,
            },
            { status: 402 }
          )
        }
      }

      const buffer = await generateEventReport({
        event: eventPayload,
        confirmed,
        waitlist,
        theme,
        aiContent,
      })

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
