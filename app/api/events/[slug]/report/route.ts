import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getPlanLimits } from '@/lib/plans'
import { generateEventReport, IRegistration } from '@/lib/generateEventReport'

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')

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

    // Check organizer plan
    const plan = event.organizer?.plan ?? 'free'
    const limits = getPlanLimits(plan)
    if (!limits.canDownloadReport) {
      return NextResponse.json(
        { error: 'Report download is available on Pro and Business plans.', upgradeRequired: true },
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

    const buffer = await generateEventReport({
      event: {
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
      },
      confirmed,
      waitlist,
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
