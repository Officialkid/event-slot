import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normalizeCommunityLink } from '@/lib/communityLink'
import { createEventSchema } from '@/lib/schemas/event.schema'
import { encrypt } from '@/lib/encrypt'
import { processFirstEventReferral, scoreEventCreation } from '@/lib/referral'

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
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
    }

    const parsed = createEventSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const {
      title,
      description,
      eventType,
      virtualLink,
      capacity,
      deadline,
      eventDate,
      joinOpensAt,
      location,
      isPaid,
      ticketPrice,
      communityLink,
      imageUrl,
      questions,
      organizerEmail,
      organizerName,
    } = parsed.data

    const normalizedTitle = title.trim()
    const normalizedOrganizerName = organizerName.trim()
    const normalizedOrganizerEmail = (organizerEmail ?? '').trim()
    const normalizedVirtualLink = eventType === 'VIRTUAL' ? (virtualLink ?? '').trim() : ''

    if (eventType === 'VIRTUAL') {
      if (!normalizedVirtualLink.toLowerCase().startsWith('https://meet.google.com/')) {
        return NextResponse.json(
          { success: false, error: 'Please provide a valid Google Meet link (https://meet.google.com/...)' },
          { status: 400 }
        )
      }
    }

    if (isPaid) {
      if (!ticketPrice || ticketPrice < 50) {
        return NextResponse.json({ success: false, error: 'Minimum ticket price is KSh 50' }, { status: 400 })
      }

      if (ticketPrice > 500000) {
        return NextResponse.json({ success: false, error: 'Maximum ticket price is KSh 500,000' }, { status: 400 })
      }
    }

    for (const question of questions) {
      const usesOptions = question.type === 'select' || question.type === 'checkbox'
      if (usesOptions && (!Array.isArray(question.options) || question.options.length === 0)) {
        return NextResponse.json({ success: false, error: `Question "${question.label}" needs at least one option` }, { status: 400 })
      }
    }

    let organizerId: string | null = null
    let sessionEmail = session.user.email ?? ''

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

    const slug = generateSlug(normalizedTitle)
    const dashboardToken = uuidv4()
    const eventOrganizerEmail = normalizedOrganizerEmail || sessionEmail || ''
    const encryptedVirtualLink = normalizedVirtualLink ? encrypt(normalizedVirtualLink) : null

    const event = await prisma.event.create({
      data: {
        title: normalizedTitle,
        description,
        eventType,
        virtualLink: encryptedVirtualLink?.encrypted,
        virtualLinkIv: encryptedVirtualLink?.iv,
        capacity,
        deadline: deadline ? new Date(deadline) : undefined,
        eventDate: eventDate ? new Date(eventDate) : undefined,
        joinOpensAt: joinOpensAt ? new Date(joinOpensAt) : undefined,
        location: eventType === 'VIRTUAL' ? 'Online - Google Meet' : location || undefined,
        isPaid,
        ticketPrice: isPaid ? Number(ticketPrice) : undefined,
        paymentsLive: false,
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

    if (organizerId) {
      try {
        const existingEvents = await prisma.event.count({
          where: { organizerId },
        })

        if (existingEvents === 1) {
          await processFirstEventReferral(organizerId)
        }

        await scoreEventCreation(organizerId)
      } catch (rewardErr) {
        console.warn('[events][community-rewards] failed to process:', rewardErr)
      }
    }

    return NextResponse.json({ success: true, event }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
