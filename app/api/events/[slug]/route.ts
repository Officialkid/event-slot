import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normalizeCommunityLink } from '@/lib/communityLink'
import { hasTeamEventAccess } from '@/lib/eventAccess'

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')

    const session = await getServerSession(authOptions)

    const event = await prisma.event.findUnique({
      where: { slug },
      include: { organizer: { select: { plan: true } } },
    })

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)
    const hasTeamAccess = !!(session?.user?.id && await hasTeamEventAccess({
      userId: session.user.id,
      organizerId: event.organizerId,
      eventId: event.id,
    }))

    if (!isOwner && !hasValidToken && !hasTeamAccess) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const registrations = await prisma.registration.findMany({
      where: { eventId: event.id },
      select: {
        id: true,
        answers: true,
        submittedAt: true,
        source: true,
        status: true,
        waitlistPosition: true,
      },
      orderBy: [
        { submittedAt: 'asc' },
        { waitlistPosition: 'asc' },
      ],
    })

    const confirmed = registrations
      .filter(r => r.status === 'confirmed')
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
      .map(r => ({ id: r.id, answers: r.answers, submittedAt: r.submittedAt, source: r.source }))

    const waitlist = registrations
      .filter(r => r.status === 'waitlist')
      .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0))
      .map(r => ({ id: r.id, answers: r.answers, waitlistPosition: r.waitlistPosition, submittedAt: r.submittedAt, source: r.source }))

    return NextResponse.json({
      success: true,
      event: {
        title: event.title,
        description: event.description,
        capacity: event.capacity,
        deadline: event.deadline,
        confirmedCount: event.confirmedCount,
        waitlistCount: event.waitlistCount,
        slug: event.slug,
        questions: event.questions,
        eventDate: event.eventDate,
        location: event.location,
        communityLink: normalizeCommunityLink(event.communityLink) ?? event.communityLink,
        archived: event.archived,
        status: event.status,
        dashboardToken: event.dashboardToken,
        organizerPlan: event.organizer?.plan ?? 'free',
        imageUrl: event.imageUrl ?? null,
        canEdit: isOwner,
      },
      confirmed,
      waitlist,
    })
  } catch (err) {
    console.error('[EVENT API ERROR]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = params
    const event = await prisma.event.findUnique({ where: { slug } })

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    if (event.organizerId !== session.user.id) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { action, title, description, capacity, deadline, eventDate, location, communityLink, questions, imageUrl, archived } = body

    // Lightweight actions: rename or archive
    if (action === 'rename') {
      if (!title?.trim()) {
        return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })
      }
      await prisma.event.update({ where: { slug }, data: { title: title.trim() } })
      return NextResponse.json({ success: true })
    }

    if (action === 'archive') {
      await prisma.event.update({ where: { slug }, data: { archived: !!archived } })
      return NextResponse.json({ success: true })
    }

    // Full update (existing edit flow)
    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one question is required' }, { status: 400 })
    }

    for (const question of questions) {
      const usesOptions = question?.type === 'select' || question?.type === 'checkbox'
      if (usesOptions && (!Array.isArray(question.options) || question.options.length === 0)) {
        return NextResponse.json({ success: false, error: `Question "${question?.label || 'Untitled'}" needs at least one option` }, { status: 400 })
      }
    }

    const updated = await prisma.event.update({
      where: { slug },
      data: {
        title,
        description: description || null,
        capacity: capacity ? Number(capacity) : null,
        deadline: deadline ? new Date(deadline) : null,
        eventDate: eventDate ? new Date(eventDate) : null,
        location: location || null,
        communityLink: normalizeCommunityLink(communityLink),
        imageUrl: imageUrl || null,
        questions,
      },
      select: { id: true, title: true, slug: true },
    })

    return NextResponse.json({ success: true, event: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    const { slug } = params

    const event = await prisma.event.findUnique({ where: { slug } })
    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)

    if (!isOwner) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    await prisma.event.delete({ where: { slug } })
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
