import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'
import { isAdminEmail } from '@/lib/isAdmin'
import { normalizeCommunityLink } from '@/lib/communityLink'
import { encrypt } from '@/lib/encrypt'
import { processFirstEventReferral, scoreEventCreation } from '@/lib/referral'
import { createCalendarEvent } from '@/lib/googleCalendar'
import { APP_URL } from '@/lib/config'
import { canCreateEvent } from '@/lib/planEnforcement'
import { validateAndEncodeEventContact } from '@/lib/eventContact'
import { normalizeTicketTiers, sumTierCapacity } from '@/lib/paidEvents'
import { getEffectivePlanPolicy, getNextPlanKey } from '@/lib/effectivePlanPolicy'
import { getPricingRolloutLabel } from '@/lib/pricingRollout'
import { generateVerifierCode } from '@/lib/verifierCode'
import { purgeUserCache } from '@/lib/cache'
import { dispatchNewEventAnnouncements } from '@/services/notifications/followerAnnouncements'
import type { createEventSchema } from '@/lib/schemas/event.schema'
import { z } from 'zod'

export type EventCreationInput = z.infer<typeof createEventSchema>

export interface EventCreationActorContext {
  userId: string
  userEmail?: string | null
  isAdmin?: boolean | null
}

export interface EventCreationSideEffectsOptions {
  enableReferrals?: boolean
  enableCalendarSync?: boolean
  enableFollowerAnnouncements?: boolean
  enableCachePurge?: boolean
}

export interface CreateEventServiceParams {
  actor: EventCreationActorContext
  input: EventCreationInput
  googleEventId?: string | null
  countryCode?: string | null
  sideEffects?: boolean | EventCreationSideEffectsOptions
  creationProposalId?: string | null
  tx?: Prisma.TransactionClient
}

export interface CreatedEventSummary {
  id: string
  title: string
  slug: string
  dashboardToken: string
  verifierCode: string | null
  visibility: string
  accessType: string
  capacity: number | null
}

export interface EventSideEffectsSummary {
  referralsProcessed: boolean
  calendarSyncDispatched: boolean
  followerAnnouncementsDispatched: boolean
  cachePurged: boolean
  deliveryEvidence?: {
    referrals: "CONFIRMED" | "FAILED" | "SKIPPED"
    calendarSync: "CONFIRMED" | "FAILED" | "SKIPPED"
    cachePurge: "CONFIRMED" | "FAILED" | "SKIPPED"
    followerAnnouncements: "INITIATED_ASYNC" | "CONFIRMED" | "FAILED" | "AMBIGUOUS" | "SKIPPED"
  }
}

export interface EventCreationSuccessResult {
  success: true
  event: CreatedEventSummary
  sideEffectsSummary?: EventSideEffectsSummary
}

export interface EventCreationFailureResult {
  success: false
  status: number
  error: string
  code?: string
  field?: string
  upgradeRequired?: string
  limit?: number
  pricingStartsAtLabel?: string
  details?: unknown
}

export type EventCreationResult = EventCreationSuccessResult | EventCreationFailureResult

export function generateSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  const suffix = Math.random().toString(36).substring(2, 6)
  return `${base || 'event'}-${suffix}`
}

export function getDurationMins(startIso: string | null | undefined, endIso: string | null | undefined): number {
  if (!startIso || !endIso) return 120
  const diff = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
  return diff > 0 ? diff : 120
}

/**
 * Dispatches optional external side effects safely.
 * Failures in any side effect are logged and never throw or revert the database transaction.
 */
export async function dispatchEventCreationSideEffects(params: {
  event: CreatedEventSummary
  actor: EventCreationActorContext
  targetOrganizer: { id: string; email?: string | null }
  input: EventCreationInput
  googleEventId?: string | null
  normalizedVirtualLink?: string
  sideEffectsOptions?: EventCreationSideEffectsOptions
}): Promise<EventSideEffectsSummary> {
  const {
    event,
    actor,
    targetOrganizer,
    input,
    googleEventId,
    normalizedVirtualLink,
    sideEffectsOptions = {},
  } = params

  const {
    enableReferrals = true,
    enableCalendarSync = true,
    enableFollowerAnnouncements = true,
    enableCachePurge = true,
  } = sideEffectsOptions

  const summary: EventSideEffectsSummary = {
    referralsProcessed: false,
    calendarSyncDispatched: false,
    followerAnnouncementsDispatched: false,
    cachePurged: false,
  }

  let referralsAttempted = false
  let referralsSucceeded = false
  let calendarSyncAttempted = false
  let calendarSyncSucceeded = false
  let cachePurgeAttempted = false
  let cachePurgeSucceeded = false
  let followerAnnouncementsAttempted = false

  // 1. Referral & Community scoring
  if (enableReferrals && targetOrganizer.id) {
    referralsAttempted = true
    try {
      const existingEvents = await prisma.event.count({
        where: { organizerId: targetOrganizer.id },
      })

      if (existingEvents === 1) {
        await processFirstEventReferral(targetOrganizer.id)
      }

      await scoreEventCreation(targetOrganizer.id)
      referralsSucceeded = true
      summary.referralsProcessed = true
    } catch (rewardErr) {
      console.warn('[event-creation-service][community-rewards] failed to process:', rewardErr)
    }
  }

  // 2. Google Calendar sync
  if (enableCalendarSync && targetOrganizer.id) {
    if (googleEventId) {
      calendarSyncAttempted = true
      try {
        await prisma.calendarEventSync.upsert({
          where: {
            userId_eventId_role: {
              userId: targetOrganizer.id,
              eventId: event.id,
              role: 'organiser',
            },
          },
          update: {
            googleEventId,
            syncStatus: 'synced',
            lastSyncedAt: new Date(),
          },
          create: {
            userId: targetOrganizer.id,
            eventId: event.id,
            googleEventId,
            role: 'organiser',
            syncStatus: 'synced',
          },
        })
        calendarSyncSucceeded = true
        summary.calendarSyncDispatched = true
      } catch (calErr) {
        console.error('[event-creation-service][calendarSync] upsert failed:', calErr)
      }
    } else if (input.eventDate) {
      calendarSyncAttempted = true
      try {
        await createCalendarEvent({
          userId: targetOrganizer.id,
          eventSlotId: event.id,
          role: 'organiser',
          title: `[EventSlot] ${input.title.trim()}`,
          description: `${input.description ?? ''}\n\nManage event: ${APP_URL}/dashboard/events/${event.slug}`,
          location: input.eventType === 'VIRTUAL' ? 'Online - Google Meet' : input.location || null,
          startDate: new Date(input.eventDate),
          durationMins: getDurationMins(input.eventDate, input.eventEndAt),
          eventUrl: `${APP_URL}/dashboard/events/${event.slug}`,
          isVirtual: input.eventType === 'VIRTUAL',
          meetingLink: input.eventType === 'VIRTUAL' ? normalizedVirtualLink || null : null,
        })
        calendarSyncSucceeded = true
        summary.calendarSyncDispatched = true
      } catch (calErr) {
        console.error('[event-creation-service][calendarEvent] create failed:', calErr)
      }
    }
  }

  // 3. User Cache Purge
  if (enableCachePurge) {
    cachePurgeAttempted = true
    try {
      if (actor.userId) {
        purgeUserCache(actor.userId, actor.userEmail ?? null)
      }
      if (targetOrganizer.id && targetOrganizer.id !== actor.userId) {
        purgeUserCache(targetOrganizer.id, targetOrganizer.email ?? null)
      }
      cachePurgeSucceeded = true
      summary.cachePurged = true
    } catch (cacheErr) {
      console.warn('[event-creation-service] cache purge warning:', cacheErr)
    }
  }

  // 4. Follower announcement dispatch (fire-and-forget email blast for public events)
  if (enableFollowerAnnouncements) {
    followerAnnouncementsAttempted = true
    void dispatchNewEventAnnouncements(event.id)
      .then(() => {
        summary.followerAnnouncementsDispatched = true
      })
      .catch((announcementErr) => {
        console.error('[event-creation-service] follower announcement failed:', announcementErr)
      })
  }

  summary.deliveryEvidence = {
    referrals: !referralsAttempted ? "SKIPPED" : referralsSucceeded ? "CONFIRMED" : "FAILED",
    calendarSync: !calendarSyncAttempted ? "SKIPPED" : calendarSyncSucceeded ? "CONFIRMED" : "FAILED",
    cachePurge: !cachePurgeAttempted ? "SKIPPED" : cachePurgeSucceeded ? "CONFIRMED" : "FAILED",
    followerAnnouncements: followerAnnouncementsAttempted ? "INITIATED_ASYNC" : "SKIPPED",
  }

  return summary
}

/**
 * Domain service for event creation.
 * Encapsulates actor authorization, workspace ownership resolution,
 * plan limit enforcement, data normalization, database insertion, and side-effect segregation.
 */
export async function createEventDomainService(params: CreateEventServiceParams): Promise<EventCreationResult> {
  const { actor, input, googleEventId, countryCode, sideEffects = true, creationProposalId, tx } = params
  const db = tx ?? prisma

  if (!actor?.userId) {
    return { success: false, status: 401, error: 'Unauthorized' }
  }

  const {
    asOrganizationId,
    timedDropEnabled,
    ticketDropOpensAt,
    ticketDropClosesAt,
    dropWaitlistOnExpire,
    title,
    description,
    visibility,
    accessType,
    eventType,
    virtualLink,
    capacity,
    deadline,
    eventDate,
    eventEndAt,
    hasSpecificTime,
    isMultiDay,
    multiDaySchedule,
    isRecurring,
    recurrenceFrequency,
    recurrenceDayOfWeek,
    registrationOpensDays,
    registrationOpensTime,
    joinOpensAt,
    location,
    mapDirectionsUrl,
    entryFeeLabel,
    showRemainingSpots,
    attendeeConsentEnabled,
    attendeeConsentText,
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
    groupRegistrationEnabled,
    allowGroupSelfClaim,
  } = input

  const normalizedTitle = title.trim()
  const normalizedOrganizerName = organizerName.trim()
  const normalizedOrganizerEmail = (organizerEmail ?? '').trim()
  const isWalkInEvent = accessType === 'WALK_IN'
  const isRegistrationEvent = !isWalkInEvent

  // 1. Virtual event link normalization & protocol validation
  const rawVirtualLink = eventType === 'VIRTUAL' ? (virtualLink ?? '').trim() : ''
  const isVirtualLinkPending = Boolean((input as any).virtualLinkPending) ||
    rawVirtualLink.toLowerCase() === 'pending' ||
    rawVirtualLink.toLowerCase() === 'to be announced'
  let normalizedVirtualLink = isVirtualLinkPending ? '' : rawVirtualLink
  if (rawVirtualLink && !isVirtualLinkPending && !/^https?:\/\//i.test(rawVirtualLink)) {
    normalizedVirtualLink = `https://${rawVirtualLink}`
  }

  if (eventType === 'VIRTUAL') {
    if (!isVirtualLinkPending && !normalizedVirtualLink) {
      return {
        success: false,
        status: 400,
        error: 'A meeting link is required for virtual events.',
        field: 'virtualLink',
      }
    }
    if (normalizedVirtualLink) {
      try {
        const parsedUrl = new URL(normalizedVirtualLink)
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error('Invalid protocol')
        }
      } catch {
        return {
          success: false,
          status: 400,
          error: 'Please provide a valid meeting URL (e.g. Google Meet, Zoom, Microsoft Teams, or YouTube Live).',
          field: 'virtualLink',
        }
      }
    }
  }

  // 2. Ticket tiers normalization
  const normalizedTicketTiers = isPaid && isRegistrationEvent
    ? normalizeTicketTiers(ticketTiers, { ticketPrice, capacity })
    : []

  if (isPaid && isRegistrationEvent && normalizedTicketTiers.length === 0) {
    return {
      success: false,
      status: 400,
      error: 'At least one ticket tier is required for paid events',
    }
  }

  if (isPaid && isRegistrationEvent && normalizedTicketTiers.some((tier) => tier.priceKes < 50 || tier.priceKes > 500000)) {
    return {
      success: false,
      status: 400,
      error: 'Each ticket tier must be between KSh 50 and KSh 500,000',
    }
  }

  // 3. Walk-in and Visibility rules
  if (isWalkInEvent && !imageUrl?.trim()) {
    return {
      success: false,
      status: 400,
      error: 'Walk-in events need a poster image so the share card always includes one.',
    }
  }

  if (isWalkInEvent && visibility === 'PUBLIC') {
    return {
      success: false,
      status: 400,
      error: 'Walk-in events stay private in this version.',
    }
  }

  if (visibility === 'PUBLIC' && !imageUrl?.trim()) {
    return {
      success: false,
      status: 400,
      error: 'Public events require a poster image so they can appear on the Events page.',
    }
  }

  // 4. Custom registration questions validation
  for (const question of isRegistrationEvent ? questions : []) {
    const usesOptions = question.type === 'select' || question.type === 'checkbox'
    if (usesOptions && (!Array.isArray(question.options) || question.options.length === 0)) {
      return {
        success: false,
        status: 400,
        error: `Question "${question.label}" needs at least one option`,
      }
    }
  }

  // 5. Target Organizer & Workspace Authorization Check
  let targetOrganizer: { id: string; email: string | null; plan: string | null; name: string | null }

  const actorUser = await db.user.findUnique({
    where: { id: actor.userId },
    select: { id: true, email: true, plan: true, name: true },
  })

  if (!actorUser) {
    return {
      success: false,
      status: 404,
      code: 'USER_NOT_FOUND',
      error: 'Organizer account not found.',
    }
  }

  if (asOrganizationId && asOrganizationId !== actor.userId) {
    const isCallerAdmin = Boolean(
      actor.isAdmin || (actor.userEmail && isAdminEmail(actor.userEmail))
    )

    const membership = await db.teamMember.findFirst({
      where: {
        memberId: actor.userId,
        ownerId: asOrganizationId,
        status: 'accepted',
      },
    })

    // Strict security boundary: caller MUST be an admin or an accepted team member of this workspace.
    // If not, reject with 403 Forbidden. NEVER silently fall back to personal account!
    if (!isCallerAdmin && !membership) {
      return {
        success: false,
        status: 403,
        code: 'FORBIDDEN',
        error: 'You are not authorized to create events in this workspace.',
      }
    }

    const targetOrg = await db.user.findFirst({
      where: {
        OR: [
          { id: asOrganizationId },
          { email: { equals: asOrganizationId.toLowerCase().trim(), mode: 'insensitive' } },
          { username: { equals: asOrganizationId.toLowerCase().trim(), mode: 'insensitive' } },
        ],
      },
      select: { id: true, email: true, plan: true, name: true },
    })

    if (!targetOrg) {
      return {
        success: false,
        status: 404,
        code: 'WORKSPACE_NOT_FOUND',
        error: 'Workspace organization not found.',
      }
    }

    targetOrganizer = targetOrg
  } else {
    targetOrganizer = actorUser
  }

  // 6. Plan Limit Enforcement on the Target Organizer
  const enforcement = await canCreateEvent(targetOrganizer.id, targetOrganizer.email ?? '')
  if (!enforcement.allowed) {
    return {
      success: false,
      status: 403,
      code: 'PLAN_LIMIT_EVENTS',
      error: enforcement.reason || 'Event creation limit reached.',
      upgradeRequired: enforcement.upgradeRequired || undefined,
    }
  }

  const effectivePlan = getEffectivePlanPolicy(targetOrganizer.plan ?? 'free')
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
    return {
      success: false,
      status: 403,
      code: 'PLAN_LIMIT_ATTENDEES',
      error: `Your ${effectivePlan.displayName} plan currently includes up to ${effectivePlan.maxAttendeesPerEvent} attendees per event.`,
      upgradeRequired: getNextPlanKey(targetOrganizer.plan ?? 'free') ?? undefined,
      limit: effectivePlan.maxAttendeesPerEvent,
      pricingStartsAtLabel: getPricingRolloutLabel(),
    }
  }

  // 7. Resolve effective organizer contact email
  let eventOrganizerEmail = normalizedOrganizerEmail
  if (!eventOrganizerEmail) {
    if (targetOrganizer.id !== actor.userId) {
      eventOrganizerEmail = targetOrgEmailOrFallback(targetOrganizer.email, actor.userEmail || actorUser.email)
    } else {
      eventOrganizerEmail = actor.userEmail || actorUser.email || ''
    }
  }

  function targetOrgEmailOrFallback(orgEmail: string | null, fallbackEmail?: string | null): string {
    return orgEmail || fallbackEmail || ''
  }

  // 8. Contact & WhatsApp validation
  let storedEventContact: string | null = null
  if (whatsappNumber?.trim()) {
    const validatedContact = validateAndEncodeEventContact(whatsappNumber, contactMode ?? 'WHATSAPP')
    if (!validatedContact.ok) {
      return { success: false, status: 400, error: validatedContact.error }
    }
    storedEventContact = validatedContact.stored
  }

  // 9. Crypto & Dates
  const encryptedVirtualLink = normalizedVirtualLink ? encrypt(normalizedVirtualLink) : null

  const computedJoinOpensAt =
    eventType === 'VIRTUAL'
      ? joinOpensAt
        ? new Date(joinOpensAt)
        : eventDate
        ? new Date(new Date(eventDate).getTime() - 30 * 60 * 1000)
        : undefined
      : joinOpensAt
      ? new Date(joinOpensAt)
      : undefined

  const dashboardToken = uuidv4()
  const verifierCode = generateVerifierCode()

  // 10. Database write with slug collision retry loop
  let createdEvent: CreatedEventSummary | null = null
  const maxSlugAttempts = 3

  for (let attempt = 0; attempt < maxSlugAttempts; attempt++) {
    const slug = generateSlug(normalizedTitle)
    try {
      const dbEvent = await db.event.create({
        data: {
          title: normalizedTitle,
          description,
          visibility,
          accessType,
          eventType,
          virtualLink: encryptedVirtualLink?.encrypted,
          virtualLinkIv: encryptedVirtualLink?.iv,
          capacity: isWalkInEvent ? null : isPaid ? sumTierCapacity(normalizedTicketTiers) : capacity,
          deadline: isWalkInEvent ? null : deadline ? new Date(deadline) : undefined,
          eventDate: eventDate ? new Date(eventDate) : undefined,
          eventEndAt: eventEndAt ? new Date(eventEndAt) : isWalkInEvent && eventDate ? new Date(eventDate) : undefined,
          hasSpecificTime: hasSpecificTime ?? true,
          isMultiDay: isMultiDay ?? false,
          multiDaySchedule: isMultiDay && Array.isArray(multiDaySchedule) ? multiDaySchedule : undefined,
          isRecurring: isRecurring ?? false,
          recurrenceFrequency: isRecurring ? (recurrenceFrequency || 'WEEKLY') : undefined,
          recurrenceDayOfWeek: isRecurring ? recurrenceDayOfWeek : undefined,
          registrationOpensDays: isRecurring ? (registrationOpensDays || 4) : undefined,
          registrationOpensTime: isRecurring ? (registrationOpensTime || '08:00') : undefined,
          joinOpensAt: computedJoinOpensAt,
          location: eventType === 'VIRTUAL'
            ? (normalizedVirtualLink.includes('meet.google.com')
                ? 'Online - Google Meet'
                : normalizedVirtualLink.includes('zoom.us')
                ? 'Online - Zoom'
                : normalizedVirtualLink.includes('teams.microsoft')
                ? 'Online - Microsoft Teams'
                : 'Online - Virtual Event')
            : location || undefined,
          mapDirectionsUrl: eventType === 'VIRTUAL' ? undefined : mapDirectionsUrl?.trim() || undefined,
          entryFeeLabel: entryFeeLabel?.trim() || undefined,
          showRemainingSpots: showRemainingSpots ?? true,
          attendeeConsentEnabled: attendeeConsentEnabled ?? true,
          attendeeConsentText: attendeeConsentText?.trim() || undefined,
          isPaid: isWalkInEvent ? false : isPaid,
          ticketPrice: isWalkInEvent ? undefined : isPaid ? normalizedTicketTiers[0]?.priceKes ?? Number(ticketPrice) : undefined,
          paymentsLive: false,
          ticketsEnabled: true,
          communityLink: normalizeCommunityLink(communityLink) || undefined,
          whatsappNumber: storedEventContact || undefined,
          imageUrl: imageUrl || undefined,
          groupRegistrationEnabled: groupRegistrationEnabled ?? false,
          allowGroupSelfClaim: allowGroupSelfClaim ?? true,
          questions: isWalkInEvent ? [] : questions,
          organizerEmail: eventOrganizerEmail,
          organizerName: normalizedOrganizerName,
          slug,
          dashboardToken,
          verifierCode,
          organizerId: targetOrganizer.id,
          countryCode: countryCode ?? undefined,
          timedDropEnabled: timedDropEnabled ?? false,
          ticketDropOpensAt: ticketDropOpensAt ? new Date(ticketDropOpensAt) : null,
          ticketDropClosesAt: ticketDropClosesAt ? new Date(ticketDropClosesAt) : null,
          dropWaitlistOnExpire: dropWaitlistOnExpire ?? true,
          creationProposalId: creationProposalId?.trim() || undefined,
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
                  currency: tier.currency ?? 'KES',
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
          verifierCode: true,
          visibility: true,
          accessType: true,
          capacity: true,
        },
      })

      createdEvent = dbEvent
      break
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const metaTarget = (err.meta as { target?: string[] | string } | undefined)?.target
        const isProposalConflict = Array.isArray(metaTarget)
          ? metaTarget.includes('creationProposalId')
          : typeof metaTarget === 'string' && metaTarget.includes('creationProposalId')

        if (isProposalConflict) {
          return {
            success: false,
            status: 409,
            code: 'PROPOSAL_ALREADY_EXECUTED',
            error: 'An event has already been created for this confirmation proposal.',
          }
        }

        const isSlugConflict = Array.isArray(metaTarget)
          ? metaTarget.includes('slug')
          : typeof metaTarget === 'string' && metaTarget.includes('slug')
        if ((isSlugConflict || !metaTarget) && attempt < maxSlugAttempts - 1) {
          continue
        }
        return {
          success: false,
          status: 409,
          error: 'A similar event already exists. Please retry.',
        }
      }

      if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P1001' || err.code === 'P1002')) {
        return {
          success: false,
          status: 503,
          error: 'Database is temporarily unavailable. Please try again shortly.',
        }
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to create event. Please try again.'
      return {
        success: false,
        status: 500,
        error: errorMessage,
      }
    }
  }

  if (!createdEvent) {
    return {
      success: false,
      status: 500,
      error: 'Failed to create event record after slug allocation attempts.',
    }
  }

  // 11. Side Effects Dispatch (controlled)
  let sideEffectsSummary: EventSideEffectsSummary | undefined
  if (sideEffects) {
    const sideEffectsOptions = typeof sideEffects === 'object' ? sideEffects : undefined
    sideEffectsSummary = await dispatchEventCreationSideEffects({
      event: createdEvent,
      actor,
      targetOrganizer,
      input,
      googleEventId,
      normalizedVirtualLink,
      sideEffectsOptions,
    })
  }

  return {
    success: true,
    event: createdEvent,
    sideEffectsSummary,
  }
}
