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
import { canCreateEvent } from '@/lib/planEnforcement'
import { validateAndEncodeEventContact } from '@/lib/eventContact'
import { normalizeTicketTiers, sumTierCapacity } from '@/lib/paidEvents'
import { getEffectivePlanPolicy, getNextPlanKey } from '@/lib/effectivePlanPolicy'
import { getPricingRolloutLabel } from '@/lib/pricingRollout'

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

function getDurationMins(startIso: string | null | undefined, endIso: string | null | undefined) {
  if (!startIso || !endIso) return 120
  const diff = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
  return diff > 0 ? diff : 120
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const enforcement = await canCreateEvent(session.user.id, session.user.email ?? '')
    if (!enforcement.allowed) {
      return NextResponse.json(
        { error: enforcement.reason, upgradeRequired: enforcement.upgradeRequired, code: 'PLAN_LIMIT_EVENTS' },
        { status: 403 }
      )
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
      accessType,
      eventType,
      virtualLink,
      capacity,
      deadline,
      eventDate,
      eventEndAt,
      joinOpensAt,
      location,
      isPaid,
      ticketPrice,
      ticketTiers,
      communityLink,
      whatsappNumber,
      contactMode,
      imageUrl,
      questions,
      organizerEmail,
      organizerName,
    } = parsed.data

    const normalizedTitle = title.trim()
    const normalizedOrganizerName = organizerName.trim()
    const normalizedOrganizerEmail = (organizerEmail ?? '').trim()
    const isWalkInEvent = accessType === 'WALK_IN'
    const isRegistrationEvent = !isWalkInEvent
    const rawVirtualLink = eventType === 'VIRTUAL' ? (virtualLink ?? '').trim() : ''
    // Accept links entered as meet.google.com/... (without protocol) or with http:// and normalise to https://.
    let normalizedVirtualLink = rawVirtualLink
    if (/^meet\.google\.com\//i.test(rawVirtualLink)) normalizedVirtualLink = `https://${rawVirtualLink}`
    else if (/^http:\/\/meet\.google\.com\//i.test(rawVirtualLink)) normalizedVirtualLink = rawVirtualLink.replace(/^http:\/\//i, 'https://')

    if (eventType === 'VIRTUAL') {
      if (!normalizedVirtualLink.toLowerCase().startsWith('https://meet.google.com/')) {
        return NextResponse.json(
          { success: false, error: 'Please provide a valid Google Meet link (e.g. meet.google.com/abc-defg-hij)' },
          { status: 400 }
        )
      }
    }

    const normalizedTicketTiers = isPaid && isRegistrationEvent
      ? normalizeTicketTiers(ticketTiers, { ticketPrice, capacity })
      : []

    if (isPaid && isRegistrationEvent && normalizedTicketTiers.length === 0) {
      return NextResponse.json({ success: false, error: 'At least one ticket tier is required for paid events' }, { status: 400 })
    }

    if (isPaid && isRegistrationEvent && normalizedTicketTiers.some((tier) => tier.priceKes < 50 || tier.priceKes > 500000)) {
      return NextResponse.json({ success: false, error: 'Each ticket tier must be between KSh 50 and KSh 500,000' }, { status: 400 })
    }

    if (isWalkInEvent && !imageUrl?.trim()) {
      return NextResponse.json(
        { success: false, error: 'Walk-in events need a poster image so the share card always includes one.' },
        { status: 400 }
      )
    }

    for (const question of isRegistrationEvent ? questions : []) {
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

    const effectivePlan = getEffectivePlanPolicy(organizer?.plan ?? 'free')
    const requestedCapacity = isWalkInEvent
      ? null
      : isPaid
        ? sumTierCapacity(normalizedTicketTiers)
        : capacity

    if (
      isRegistrationEvent &&
      !isPaid &&
      effectivePlan.maxAttendeesPerEvent !== -1 &&
      requestedCapacity &&
      requestedCapacity > effectivePlan.maxAttendeesPerEvent
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Your ${effectivePlan.displayName} plan currently includes up to ${effectivePlan.maxAttendeesPerEvent} attendees per event.`,
          code: 'PLAN_LIMIT_ATTENDEES',
          upgradeRequired: getNextPlanKey(organizer?.plan ?? 'free'),
          limit: effectivePlan.maxAttendeesPerEvent,
          pricingStartsAtLabel: getPricingRolloutLabel(),
        },
        { status: 403 }
      )
    }

    const slug = generateSlug(normalizedTitle)
    const dashboardToken = uuidv4()
    const eventOrganizerEmail = normalizedOrganizerEmail || sessionEmail || ''
    const encryptedVirtualLink = normalizedVirtualLink ? encrypt(normalizedVirtualLink) : null
    const eventCountryCode = await detectCountry(req).catch(() => null)
    let storedEventContact: string | null = null
    if (whatsappNumber?.trim()) {
      const validatedContact = validateAndEncodeEventContact(whatsappNumber, contactMode ?? 'WHATSAPP')
      if (!validatedContact.ok) {
        return NextResponse.json({ success: false, error: validatedContact.error }, { status: 400 })
      }
      storedEventContact = validatedContact.stored
    }

    const event = await prisma.event.create({
      data: {
        title: normalizedTitle,
        description,
        accessType,
        eventType,
        virtualLink: encryptedVirtualLink?.encrypted,
        virtualLinkIv: encryptedVirtualLink?.iv,
        capacity: isWalkInEvent ? null : isPaid ? sumTierCapacity(normalizedTicketTiers) : capacity,
        deadline: isWalkInEvent ? null : deadline ? new Date(deadline) : undefined,
        eventDate: eventDate ? new Date(eventDate) : undefined,
        eventEndAt: eventEndAt ? new Date(eventEndAt) : isWalkInEvent && eventDate ? new Date(eventDate) : undefined,
        joinOpensAt: joinOpensAt ? new Date(joinOpensAt) : undefined,
        location: eventType === 'VIRTUAL' ? 'Online - Google Meet' : location || undefined,
        isPaid: isWalkInEvent ? false : isPaid,
        ticketPrice: isWalkInEvent ? undefined : isPaid ? normalizedTicketTiers[0]?.priceKes ?? Number(ticketPrice) : undefined,
        paymentsLive: false,
        ticketsEnabled: true,
        communityLink: normalizeCommunityLink(communityLink) || undefined,
        whatsappNumber: storedEventContact || undefined,
        imageUrl: imageUrl || undefined,
        questions: isWalkInEvent ? [] : questions,
        organizerEmail: eventOrganizerEmail,
        slug,
        dashboardToken,
        organizerId,
        countryCode: eventCountryCode ?? undefined,
        ticketTiers: isPaid && isRegistrationEvent
          ? {
              create: normalizedTicketTiers.map((tier, index) => ({
                name: tier.name,
                presetKey: tier.presetKey ?? undefined,
                badgeColor: tier.badgeColor ?? undefined,
                textColor: tier.textColor ?? undefined,
                metallic: tier.metallic ?? undefined,
                prestige: tier.prestige ?? undefined,
                priceKes: tier.priceKes,
                currency: tier.currency ?? "KES",
                capacity: tier.capacity,
                description: tier.description ?? undefined,
                bundleSize: tier.bundleSize ?? 1,
                sortOrder: index,
              })),
            }
          : undefined,
      },
      select: {
        id: true,
        title: true,
        slug: true,
        dashboardToken: true,
        accessType: true,
        capacity: true,
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
        durationMins: getDurationMins(eventDate, eventEndAt),
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
