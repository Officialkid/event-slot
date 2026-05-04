import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normalizeCommunityLink } from '@/lib/communityLink'

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
    const { title, description, capacity, deadline, eventDate, location, communityLink, imageUrl, questions, organizerEmail, organizerName } = body

    const normalizedTitle = String(title ?? '').trim()
    const normalizedOrganizerName = String(organizerName ?? '').trim()
    const normalizedOrganizerEmail = String(organizerEmail ?? '').trim()

    if (!normalizedTitle || !normalizedOrganizerName) {
      return NextResponse.json({ success: false, error: 'Missing title or organizerName' }, { status: 400 })
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

    let organizerId: string | null = null
    let sessionEmail = session?.user?.email ?? ''

    if (session?.user?.id) {
      const organizer = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, plan: true, name: true },
      })

      if (organizer) {
        organizerId = organizer.id
        sessionEmail = organizer.email ?? sessionEmail

        if ((organizer.name ?? '').trim() !== normalizedOrganizerName) {
          await prisma.user.update({
            where: { id: organizer.id },
            data: { name: normalizedOrganizerName },
          })
        }
      }
    }

    const slug = generateSlug(normalizedTitle)
    const dashboardToken = uuidv4()
    const eventOrganizerEmail = normalizedOrganizerEmail || sessionEmail || ''

    const event = await prisma.event.create({
      data: {
        title: normalizedTitle,
        description,
        capacity,
        deadline: deadline ? new Date(deadline) : undefined,
        eventDate: eventDate ? new Date(eventDate) : undefined,
        location: location || undefined,
        communityLink: normalizeCommunityLink(communityLink) || undefined,
        imageUrl: imageUrl || undefined,
        questions,
        organizerEmail: eventOrganizerEmail,
        slug,
        dashboardToken,
        organizerId,
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
