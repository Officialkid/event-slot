import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const event = await prisma.event.findUnique({
      where: { slug },
    })

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    if (event.dashboardToken !== token) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    const registrations = await prisma.registration.findMany({
      where: { eventId: event.id },
      orderBy: [
        { submittedAt: 'asc' },
        { waitlistPosition: 'asc' },
      ],
    })

    const confirmed = registrations
      .filter(r => r.status === 'confirmed')
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
      .map(r => ({ id: r.id, answers: r.answers, submittedAt: r.submittedAt }))

    const waitlist = registrations
      .filter(r => r.status === 'waitlist')
      .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0))
      .map(r => ({ id: r.id, answers: r.answers, waitlistPosition: r.waitlistPosition, submittedAt: r.submittedAt }))

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
      },
      confirmed,
      waitlist,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { slug: string } }) {
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
    const { title, description, capacity, deadline, eventDate, location, communityLink, questions, imageUrl } = body

    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one question is required' }, { status: 400 })
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
        communityLink: communityLink || null,
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
