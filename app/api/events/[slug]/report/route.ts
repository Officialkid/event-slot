import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { generateEventReport, IRegistration, ReportTheme } from '@/lib/generateEventReport'
import { CREDIT_COSTS, hasFeatureAccess } from '@/lib/credits'
import { generateAIReportContent } from '@/lib/generateAIReportContent'

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')
    const theme = (req.nextUrl.searchParams.get('theme') ?? 'navy') as ReportTheme

    const session = await getServerSession(authOptions)

    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        organizer: { select: { plan: true } },
      },
    })

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Validate access
    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)

    if (!isOwner && !hasValidToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const plan = event.organizer?.plan ?? 'free'
    const userId = session?.user?.id ?? event.organizerId
    if (!userId) {
      return NextResponse.json(
        { error: 'Report download is available on Pro and Business plans, or can be unlocked with credits.', upgradeRequired: true },
        { status: 401 }
      )
    }

    const canAccess = await hasFeatureAccess({ userId, feature: 'ai_report', eventId: event.id, plan })
    if (!canAccess) {
      return NextResponse.json(
        { error: 'Report download is available on Pro and Business plans, or can be unlocked with credits.', upgradeRequired: true, creditsRequired: CREDIT_COSTS.ai_report, eventId: event.id },
        { status: 403 }
      )
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

    // Determine AI eligibility and generate AI content
    let aiContent = undefined
    try {
      aiContent = await generateAIReportContent({ event: eventPayload, confirmed, waitlist })
    } catch { /* skip AI on error */ }

    const buffer = await generateEventReport({
      event: eventPayload,
      confirmed,
      waitlist,
      theme,
      aiContent,
    })

    return new Response(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="event-report-${slug}.docx"`,
      },
    })
  } catch (err) {
    console.error('[report]', err)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}
