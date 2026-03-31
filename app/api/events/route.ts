import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPlanLimits } from '@/lib/plans'

function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  const suffix = Math.random().toString(36).substring(2, 6)
  return `${base}-${suffix}`
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const body = await req.json()
    const { title, description, capacity, deadline, eventDate, location, communityLink, imageUrl, questions, organizerEmail } = body

    if (!title || !organizerEmail) {
      return NextResponse.json({ success: false, error: 'Missing title or organizerEmail' }, { status: 400 })
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one question is required' }, { status: 400 })
    }

    // Plan limit: max active events
    if (session?.user?.id) {
      const organizer = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { plan: true },
      })
      const plan = organizer?.plan ?? 'free'
      const limits = getPlanLimits(plan)

      if (limits.maxActiveEvents !== Infinity) {
        const activeEvents = await prisma.event.count({
          where: {
            organizerId: session.user.id,
            archived: false,
            status: { not: 'closed' },
          },
        })
        if (activeEvents >= limits.maxActiveEvents) {
          return NextResponse.json(
            {
              success: false,
              error: 'You have reached the limit for active events on your plan.',
              upgradeRequired: true,
            },
            { status: 403 }
          )
        }
      }
    }

    const slug = generateSlug(title)
    const dashboardToken = uuidv4()

    const event = await prisma.event.create({
      data: {
        title,
        description,
        capacity,
        deadline: deadline ? new Date(deadline) : undefined,
        eventDate: eventDate ? new Date(eventDate) : undefined,
        location: location || undefined,
        communityLink: communityLink || undefined,
        imageUrl: imageUrl || undefined,
        questions,
        organizerEmail,
        slug,
        dashboardToken,
        organizerId: session?.user?.id ?? null,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        dashboardToken: true,
      },
    })

    return NextResponse.json({ success: true, event }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
