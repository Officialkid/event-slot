import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normalizeCommunityLink } from '@/lib/communityLink'
import { createEventSchema } from '@/lib/schemas/event.schema'
import { encrypt } from '@/lib/encrypt'
import { processFirstEventReferral, scoreEventCreation } from '@/lib/referral'
import { detectCountry } from '@/lib/geoip'
import { createCalendarEvent } from '@/lib/googleCalendar'
import { APP_URL } from '@/lib/config'

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
      whatsappNumber,
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
    const eventCountryCode = await detectCountry(req).catch(() => null)
    const cleanWhatsappNumber = whatsappNumber ? whatsappNumber.replace(/\D/g, '') : null

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
        ticketsEnabled: true,
        communityLink: normalizeCommunityLink(communityLink) || undefined,
        whatsappNumber: cleanWhatsappNumber || undefined,
        imageUrl: imageUrl || undefined,
        questions,
        organizerEmail: eventOrganizerEmail,
        slug,
        dashboardToken,
        organizerId,
        countryCode: eventCountryCode ?? undefined,
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

    // Auto-push to organiser's Google Calendar (fire-and-forget)
    if (organizerId && eventDate) {
      createCalendarEvent({
        userId:       organizerId,
        eventSlotId:  event.id,
        role:         'organiser',
        title:        `[EventSlot] ${normalizedTitle}`,
        description:  `${description ?? ''}\n\nManage event: ${APP_URL}/dashboard/events/${event.slug}`,
        location:     eventType === 'VIRTUAL' ? 'Online - Google Meet' : location || null,
        startDate:    new Date(eventDate),
        durationMins: 120,
        eventUrl:     `${APP_URL}/dashboard/events/${event.slug}`,
        isVirtual:    eventType === 'VIRTUAL',
        meetingLink:  eventType === 'VIRTUAL' ? normalizedVirtualLink : null,
      }).catch(console.error)
    }

    return NextResponse.json({ success: true, event }, { status: 201 })
  } catch (err) {
    console.error('[events/POST] Error creating event:', err)

    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        return NextResponse.json(
          { success: false, error: 'A similar event already exists. Please retry.' },
          { status: 409 }
        )
      }

      if (err.code === 'P1001' || err.code === 'P1002') {
        return NextResponse.json(
          { success: false, error: 'Database is temporarily unavailable. Please try again shortly.' },
          { status: 503 }
        )
      }
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create event. Please try again.' },
      { status: 500 }
    )
  }
}
