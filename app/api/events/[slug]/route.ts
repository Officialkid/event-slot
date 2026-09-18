import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { normalizeCommunityLink } from '@/lib/communityLink'
import { hasTeamEventAccess } from '@/lib/eventAccess'
import { purgeUserCache } from '@/lib/cache'
import { hasOrganiserAccess } from '@/lib/adminMode'
import { updateCalendarEvent, cancelCalendarEvent } from '@/lib/googleCalendar'
import { decrypt } from '@/lib/encrypt'
import { APP_URL } from '@/lib/config'
import { parseEventContact, validateAndEncodeEventContact } from '@/lib/eventContact'
import { getEffectiveEventPlan, syncEventPassStatusForEvent } from '@/lib/eventPasses'
import { computeNextOccurrenceDate, computeOccurrenceEnd } from '@/lib/recurringEvents'

const CONFIRMED_STATUSES = new Set(['confirmed', 'CONFIRMED'])
const WAITLIST_STATUSES = new Set(['waitlist', 'WAITLISTED', 'waitlisted'])

function getDurationMins(startIso: string | Date | null | undefined, endIso: string | Date | null | undefined) {
  if (!startIso || !endIso) return 120
  const diff = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
  return diff > 0 ? diff : 120
}

export async function GET(req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const { slug } = params
    const token = req.nextUrl.searchParams.get('token')

    const session = await getServerSession(authOptions)

    const event = await prisma.event.findUnique({
      where: { slug },
      include: {
        organizer: { select: { plan: true } },
        ticketTiers: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            presetKey: true,
            badgeColor: true,
            textColor: true,
            metallic: true,
            prestige: true,
            priceKes: true,
            currency: true,
            capacity: true,
            description: true,
            bundleSize: true,
            sortOrder: true,
            soldCount: true,
            waitlistCount: true,
            status: true,
          },
        },
      },
    })

    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    await syncEventPassStatusForEvent(event.id)
    const effectiveEventPlan = await getEffectiveEventPlan(event.id, event.organizerId)

    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const hasValidToken = !!(token && event.dashboardToken === token)
    const adminAccess = !!(session && await hasOrganiserAccess(session, event.id))
    const hasTeamAccess = !!(session?.user?.id && await hasTeamEventAccess({
      userId: session.user.id,
      organizerId: event.organizerId,
      eventId: event.id,
    }))

    if (!adminAccess && !hasValidToken && !hasTeamAccess) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 })
    }

    // Fetch organizer calendar sync status for the owner only
    let calendarSynced = false
    let googleCalendarConnected = false
    if (isOwner && session?.user?.id) {
      const [syncRecord, organizer] = await Promise.all([
        prisma.calendarEventSync.findUnique({
          where: { userId_eventId_role: { userId: session.user.id, eventId: event.id, role: 'organiser' } },
          select: { syncStatus: true },
        }),
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: { googleCalendarConnected: true },
        }),
      ])
      calendarSynced = syncRecord?.syncStatus === 'synced'
      googleCalendarConnected = !!organizer?.googleCalendarConnected
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
        occurrenceDate: true,
        attendeeEmail: true,
        registrationNumber: true,
      },
      orderBy: [
        { submittedAt: 'asc' },
        { waitlistPosition: 'asc' },
      ],
    })

    const confirmed = registrations
      .filter(r => CONFIRMED_STATUSES.has(r.status))
      .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
      .map(r => ({
        id: r.id,
        answers: r.answers,
        submittedAt: r.submittedAt,
        source: r.source,
        occurrenceDate: r.occurrenceDate,
        attendeeEmail: r.attendeeEmail,
        registrationNumber: r.registrationNumber,
      }))

    const waitlist = registrations
      .filter(r => WAITLIST_STATUSES.has(r.status))
      .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0))
      .map(r => ({
        id: r.id,
        answers: r.answers,
        waitlistPosition: r.waitlistPosition,
        submittedAt: r.submittedAt,
        source: r.source,
        occurrenceDate: r.occurrenceDate,
        attendeeEmail: r.attendeeEmail,
        registrationNumber: r.registrationNumber,
      }))

    return NextResponse.json({
      success: true,
      confirmed,
      waitlist,
      event: {
        ...(() => {
          const parsedContact = parseEventContact(event.whatsappNumber)
          return {
            whatsappNumber: parsedContact?.number ?? null,
            contactMode: parsedContact?.mode ?? 'WHATSAPP',
          }
        })(),
        id: event.id,
        title: event.title,
        description: event.description,
        visibility: event.visibility,
        accessType: event.accessType,
        eventType: event.eventType,
        isPaid: event.isPaid,
        capacity: event.capacity,
        deadline: event.deadline,
        confirmedCount: event.confirmedCount,
        waitlistCount: event.waitlistCount,
        slug: event.slug,
        questions: event.questions,
        eventDate: event.eventDate,
        eventEndAt: event.eventEndAt,
        hasSpecificTime: event.hasSpecificTime,
        isRecurring: event.isRecurring,
        recurrenceFrequency: event.recurrenceFrequency,
        recurrenceDayOfWeek: event.recurrenceDayOfWeek,
        registrationOpensDays: event.registrationOpensDays,
        registrationOpensTime: event.registrationOpensTime,
        joinOpensAt: event.joinOpensAt,
        location: event.location,
        mapDirectionsUrl: event.mapDirectionsUrl,
        entryFeeLabel: event.entryFeeLabel,
        showRemainingSpots: event.showRemainingSpots,
        attendeeConsentEnabled: event.attendeeConsentEnabled,
        attendeeConsentText: event.attendeeConsentText,
        communityLink: normalizeCommunityLink(event.communityLink) ?? event.communityLink,
        archived: event.archived,
        status: event.status,
        ticketsEnabled: event.ticketsEnabled,
        expiresAt: event.expiresAt,
        dashboardToken: event.dashboardToken,
        verifierCode: event.verifierCode,
        verifierCodeEnabled: event.verifierCodeEnabled,
        organizerPlan: event.organizer?.plan ?? 'free',
        eventEffectivePlan: effectiveEventPlan.planKey,
        eventEffectivePlanSource: effectiveEventPlan.source,
        eventPassTier: effectiveEventPlan.eventPassTier,
        eventPassStatus: effectiveEventPlan.eventPassStatus,
        eventPassExpiresAt: effectiveEventPlan.eventPassExpiresAt,
        eventEffectiveCommissionRate: effectiveEventPlan.commissionRate,
        imageUrl: event.imageUrl ?? null,
        organizerName: event.organizerName ?? null,
        groupRegistrationEnabled: event.groupRegistrationEnabled ?? false,
        allowGroupSelfClaim: event.allowGroupSelfClaim ?? true,
        ticketTiers: event.ticketTiers,
        canEdit: adminAccess || hasTeamAccess,
        calendarSynced,
        googleCalendarConnected,
      },
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

    if (event.organizerId !== session.user.id && !(await hasOrganiserAccess(session, event.id))) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { action, title, organizerName, description, visibility, capacity, deadline, eventDate, eventEndAt, hasSpecificTime, isRecurring, recurrenceFrequency, recurrenceDayOfWeek, registrationOpensDays, registrationOpensTime, joinOpensAt, location, mapDirectionsUrl, entryFeeLabel, showRemainingSpots, attendeeConsentEnabled, attendeeConsentText, communityLink, questions, imageUrl, archived, category, whatsappNumber, contactMode, questionChangeMode, groupRegistrationEnabled, allowGroupSelfClaim } = body

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
      await syncEventPassStatusForEvent(event.id)

      // Cancel calendar entries when archiving
      if (archived === true && event.organizerId) {
        cancelCalendarEvent({
          userId:      event.organizerId,
          eventSlotId: event.id,
          role:        'organiser',
          eventTitle:  event.title,
        }).catch(console.error)

        const attendeesSynced = await prisma.calendarEventSync.findMany({
          where:  { eventId: event.id, role: 'attendee' },
          select: { userId: true },
        })
        for (const { userId } of attendeesSynced) {
          cancelCalendarEvent({
            userId,
            eventSlotId: event.id,
            role:        'attendee',
            eventTitle:  event.title,
          }).catch(console.error)
        }
      }

      return NextResponse.json({ success: true })
    }

    // Full update (existing edit flow)
    if (!title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })
    }
    const normalizedOrganizerName =
      typeof organizerName === 'string' && organizerName.trim().length > 0
        ? organizerName.trim()
        : event.organizerName ?? session.user.name?.trim() ?? 'Organizer'
    const isWalkInEvent = event.accessType === 'WALK_IN'

    if (!isWalkInEvent && (!Array.isArray(questions) || questions.length === 0)) {
      return NextResponse.json({ success: false, error: 'At least one question is required' }, { status: 400 })
    }

    const nextImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : ''
    if (isWalkInEvent && !nextImageUrl) {
      return NextResponse.json(
        { success: false, error: 'Walk-in events need a poster image so the share card always includes one.' },
        { status: 400 }
      )
    }

    if (isWalkInEvent && visibility === 'PUBLIC') {
      return NextResponse.json(
        { success: false, error: 'Walk-in events stay private in this version.' },
        { status: 400 }
      )
    }

    if (visibility === 'PUBLIC' && !nextImageUrl) {
      return NextResponse.json(
        { success: false, error: 'Public events require a poster image so they can appear on the Events page.' },
        { status: 400 }
      )
    }

    for (const question of isWalkInEvent ? [] : questions) {
      const usesOptions = question?.type === 'select' || question?.type === 'checkbox'
      if (usesOptions && (!Array.isArray(question.options) || question.options.length === 0)) {
        return NextResponse.json({ success: false, error: `Question "${question?.label || 'Untitled'}" needs at least one option` }, { status: 400 })
      }
    }

    let storedEventContact: string | null = null
    if (whatsappNumber?.trim()) {
      const validatedContact = validateAndEncodeEventContact(String(whatsappNumber), contactMode === 'CALL' ? 'CALL' : 'WHATSAPP')
      if (!validatedContact.ok) {
        return NextResponse.json({ success: false, error: validatedContact.error }, { status: 400 })
      }
      storedEventContact = validatedContact.stored
    }

    const shouldResetRegistrationsForQuestionChange =
      !isWalkInEvent &&
      questionChangeMode === 'RESET_EXISTING' &&
      event.confirmedCount + event.waitlistCount > 0

    if (shouldResetRegistrationsForQuestionChange && event.isPaid) {
      return NextResponse.json(
        { success: false, error: 'Paid events cannot reset existing registrations from this question-change flow yet.' },
        { status: 400 }
      )
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (shouldResetRegistrationsForQuestionChange) {
        await tx.registrationDraft.deleteMany({ where: { eventId: event.id } })
        await tx.registration.deleteMany({ where: { eventId: event.id } })
      }

      let finalEventDate = eventDate ? new Date(eventDate) : event.eventDate
      let finalEventEndAt = eventEndAt ? new Date(eventEndAt) : event.eventEndAt

      if (isRecurring) {
        const calculatedNextDate = computeNextOccurrenceDate({
          eventDate: finalEventDate,
          isRecurring: true,
          recurrenceFrequency: recurrenceFrequency || event.recurrenceFrequency,
          recurrenceDayOfWeek: typeof recurrenceDayOfWeek === 'number' ? recurrenceDayOfWeek : event.recurrenceDayOfWeek,
        })
        finalEventEndAt = computeOccurrenceEnd(calculatedNextDate, finalEventDate, finalEventEndAt)
        finalEventDate = calculatedNextDate
      }

      return tx.event.update({
        where: { slug },
        data: {
          title,
          organizerName: normalizedOrganizerName,
          description: description || null,
          visibility: visibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
          capacity: capacity ? Number(capacity) : null,
          deadline: deadline ? new Date(deadline) : null,
          eventDate: finalEventDate,
          eventEndAt: finalEventEndAt,
          hasSpecificTime: typeof hasSpecificTime === 'boolean' ? hasSpecificTime : undefined,
          isRecurring: typeof isRecurring === 'boolean' ? isRecurring : undefined,
          recurrenceFrequency: isRecurring ? (recurrenceFrequency || 'WEEKLY') : isRecurring === false ? null : undefined,
          recurrenceDayOfWeek: isRecurring ? recurrenceDayOfWeek : isRecurring === false ? null : undefined,
          registrationOpensDays: isRecurring ? (registrationOpensDays || 4) : isRecurring === false ? null : undefined,
          registrationOpensTime: isRecurring ? (registrationOpensTime || '08:00') : isRecurring === false ? null : undefined,
          joinOpensAt: joinOpensAt ? new Date(joinOpensAt) : null,
          location: location || null,
          mapDirectionsUrl: typeof mapDirectionsUrl === 'string' ? mapDirectionsUrl.trim() || null : null,
          entryFeeLabel: typeof entryFeeLabel === 'string' ? entryFeeLabel.trim() || null : null,
          showRemainingSpots: typeof showRemainingSpots === 'boolean' ? showRemainingSpots : undefined,
          attendeeConsentEnabled: typeof attendeeConsentEnabled === 'boolean' ? attendeeConsentEnabled : undefined,
          attendeeConsentText: typeof attendeeConsentText === 'string' ? attendeeConsentText.trim() || null : undefined,
          communityLink: normalizeCommunityLink(communityLink),
          imageUrl: nextImageUrl || null,
          questions: isWalkInEvent ? [] : questions,
          category: category ? String(category).toUpperCase() : null,
          whatsappNumber: whatsappNumber !== undefined ? storedEventContact : undefined,
          groupRegistrationEnabled: typeof groupRegistrationEnabled === 'boolean' ? groupRegistrationEnabled : undefined,
          allowGroupSelfClaim: typeof allowGroupSelfClaim === 'boolean' ? allowGroupSelfClaim : undefined,
          ...(shouldResetRegistrationsForQuestionChange ? { confirmedCount: 0, waitlistCount: 0 } : {}),
        },
        select: { id: true, title: true, slug: true, confirmedCount: true, waitlistCount: true },
      })
    })

    await syncEventPassStatusForEvent(event.id)

    // Sync changes to organiser's Google Calendar (fire-and-forget)
    if (event.organizerId) {
      const calendarStartDate = eventDate ? new Date(eventDate) : event.eventDate
      if (calendarStartDate) {
        const isVirtual = event.eventType === 'VIRTUAL'
        const meetingLink = isVirtual && event.virtualLink
          ? decrypt(event.virtualLink, event.virtualLinkIv ?? '')
          : null
        updateCalendarEvent({
          userId:       event.organizerId,
          eventSlotId:  event.id,
          role:         'organiser',
          title:        `[EventSlot] ${title}`,
          description:  `${description ?? ''}\n\nManage: ${APP_URL}/dashboard/events/${updated.slug}`,
          location:     location || null,
          startDate:    calendarStartDate,
          durationMins: getDurationMins(calendarStartDate, eventEndAt ? new Date(eventEndAt) : event.eventEndAt),
          eventUrl:     `${APP_URL}/dashboard/events/${updated.slug}`,
          isVirtual,
          meetingLink,
        }).catch(console.error)
      }
    }

    return NextResponse.json({ success: true, event: updated, registrationsReset: shouldResetRegistrationsForQuestionChange })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions)
    const { slug } = params

    const event = await prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        organizerId: true,
      },
    })
    if (!event) {
      return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 })
    }

    const isOwner = !!(session?.user?.id && event.organizerId === session.user.id)
    const adminAccess = !!(session && await hasOrganiserAccess(session, event.id))

    if (!isOwner && !adminAccess) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    // Cancel Google Calendar events if connected
    if (event.organizerId) {
      cancelCalendarEvent({
        userId:      event.organizerId,
        eventSlotId: event.id,
        role:        'organiser',
        eventTitle:  event.title,
      }).catch(console.error)

      const attendeesSynced = await prisma.calendarEventSync.findMany({
        where:  { eventId: event.id, role: 'attendee' },
        select: { userId: true },
      })
      for (const { userId } of attendeesSynced) {
        cancelCalendarEvent({
          userId,
          eventSlotId: event.id,
          role:        'attendee',
          eventTitle:  event.title,
        }).catch(console.error)
      }
    }

    // Atomic cascade transaction: purge all child tables in strict dependency order before deleting Event
    await prisma.$transaction(async (tx) => {
      // 1. Group bookings & ticket slots
      const groupBookings = await tx.groupBooking.findMany({
        where: { eventId: event.id },
        select: { id: true },
      })
      if (groupBookings.length > 0) {
        const bookingIds = groupBookings.map((b) => b.id)
        await tx.groupTicketSlot.deleteMany({
          where: { bookingId: { in: bookingIds } },
        })
        await tx.groupBooking.deleteMany({
          where: { id: { in: bookingIds } },
        })
      }

      // 2. Attendee feedbacks & entry logs
      await tx.attendeeFeedback.deleteMany({ where: { eventId: event.id } })
      await tx.entryLog.deleteMany({ where: { eventId: event.id } })

      // 3. Tickets linked to registrations for this event
      const registrations = await tx.registration.findMany({
        where: { eventId: event.id },
        select: { id: true },
      })
      if (registrations.length > 0) {
        const registrationIds = registrations.map((r) => r.id)
        await tx.ticket.deleteMany({
          where: { registrationId: { in: registrationIds } },
        })
      }

      // 4. Payments
      await tx.payment.deleteMany({ where: { eventId: event.id } })

      // 5. PaidEventOrders (restricts TicketTier deletion, must be deleted before TicketTier)
      await tx.paidEventOrder.deleteMany({ where: { eventId: event.id } })

      // 6. Registrations & Drafts
      await tx.registrationDraft.deleteMany({ where: { eventId: event.id } })
      await tx.registration.deleteMany({ where: { eventId: event.id } })

      // 7. Ticket tiers
      await tx.ticketTier.deleteMany({ where: { eventId: event.id } })

      // 8. Event passes & pass payments
      const eventPass = await tx.eventPass.findUnique({
        where: { eventId: event.id },
        select: { id: true },
      })
      if (eventPass) {
        await tx.eventPassPayment.deleteMany({
          where: { eventPassId: eventPass.id },
        })
        await tx.eventPass.delete({
          where: { id: eventPass.id },
        })
      }

      // 9. Walk-in checkins
      await tx.walkInCheckin.deleteMany({ where: { eventId: event.id } })

      // 10. Analytics & Insights
      await tx.eventView.deleteMany({ where: { eventId: event.id } })
      await tx.eventUnlock.deleteMany({ where: { eventId: event.id } })
      await tx.eventInsight.deleteMany({ where: { eventId: event.id } })

      // 11. Collaboration, campaigns, FAQs & calendar syncs
      await tx.teamMemberEvent.deleteMany({ where: { eventId: event.id } })
      await tx.emailCampaign.deleteMany({ where: { eventId: event.id } })
      await tx.eventFAQ.deleteMany({ where: { eventId: event.id } })
      await tx.calendarEventSync.deleteMany({ where: { eventId: event.id } })

      // 12. Nullify optional loose foreign key references
      await tx.creditTransaction.updateMany({
        where: { eventId: event.id },
        data: { eventId: null },
      })
      await tx.featureAccess.updateMany({
        where: { eventId: event.id },
        data: { eventId: null },
      })

      // 13. Finally delete the Event record itself
      await tx.event.delete({ where: { id: event.id } })
    })

    // Purge cached event lists and dashboard stats so the deletion is reflected immediately
    if (session?.user?.id) {
      purgeUserCache(session.user.id, session.user.email ?? null)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[DELETE EVENT ERROR]', err)
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
