import { Prisma } from '@prisma/client'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { processFirstEventReferral, scoreEventCreation } from '@/lib/referral'
import { createCalendarEvent } from '@/lib/googleCalendar'
import { purgeUserCache } from '@/lib/cache'
import { dispatchNewEventAnnouncements } from '@/services/notifications/followerAnnouncements'
import { APP_URL } from '@/lib/config'
import type {
  EventCreationActorContext,
  EventCreationInput,
  EventCreationSideEffectsOptions,
} from './event-creation-service'

export type SideEffectType =
  | 'CALENDAR_SYNC'
  | 'COMMUNITY_REFERRAL'
  | 'FOLLOWER_ANNOUNCEMENT'
  | 'USER_CACHE_PURGE'

export type SideEffectOutboxStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'AMBIGUOUS_OUTCOME'

export interface OutboxItemPayloadCalendarSync {
  eventId: string
  organizerId: string
  googleEventId?: string | null
  title: string
  description?: string | null
  location?: string | null
  eventDate?: string | null
  eventEndAt?: string | null
  eventType: string
  virtualLink?: string | null
  slug: string
}

export interface OutboxItemPayloadCommunityReferral {
  eventId: string
  organizerId: string
}

export interface OutboxItemPayloadFollowerAnnouncement {
  eventId: string
  organizerId: string
}

export interface OutboxItemPayloadUserCachePurge {
  actorUserId?: string
  actorUserEmail?: string | null
  organizerId?: string
  organizerEmail?: string | null
}

export type OutboxItemPayload =
  | OutboxItemPayloadCalendarSync
  | OutboxItemPayloadCommunityReferral
  | OutboxItemPayloadFollowerAnnouncement
  | OutboxItemPayloadUserCachePurge

export interface EventCreationSideEffectOutboxRecord {
  id: string
  idempotencyKey: string
  eventId: string
  creationProposalId: string | null
  organizerId: string
  sideEffectType: SideEffectType
  status: SideEffectOutboxStatus
  payload: Prisma.JsonValue
  attempts: number
  maxAttempts: number
  nextAttemptAt: Date
  processingLeaseExpiresAt: Date | null
  leaseToken: string | null
  lastError: string | null
  resultMetadata: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
  attemptedAt: Date | null
  completedAt: Date | null
  failedAt: Date | null
}

export interface StageOutboxItemsParams {
  eventId: string
  organizerId: string
  creationProposalId?: string | null
  slug: string
  actor: EventCreationActorContext
  targetOrganizer: {
    id: string
    email?: string | null
  }
  input: EventCreationInput
  googleEventId?: string | null
  normalizedVirtualLink?: string | null
  sideEffectsOptions?: EventCreationSideEffectsOptions
  tx?: Prisma.TransactionClient
  now?: Date
}

export interface ProcessOutboxParams {
  eventId?: string
  creationProposalId?: string | null
  outboxItemId?: string
  limit?: number
  leaseDurationMs?: number
  now?: Date
  prismaClient?: any
}

export interface ProcessOutboxSummary {
  processedCount: number
  succeededCount: number
  failedCount: number
  skippedCount: number
  ambiguousCount: number
  deliveryEvidence: {
    referrals: 'CONFIRMED' | 'FAILED' | 'SKIPPED'
    calendarSync: 'CONFIRMED' | 'FAILED' | 'SKIPPED'
    cachePurge: 'CONFIRMED' | 'FAILED' | 'SKIPPED'
    followerAnnouncements: 'CONFIRMED' | 'INITIATED_ASYNC' | 'FAILED' | 'AMBIGUOUS' | 'SKIPPED'
  }
  aggregateStatus: 'ALL_DISPATCHED' | 'PARTIALLY_DISPATCHED' | 'FAILED' | 'AMBIGUOUS' | 'NONE'
}

export interface ReconcileOutboxItemParams {
  outboxItemId: string
  action: 'MARK_COMPLETED' | 'MARK_FAILED' | 'RETRY_FORCE'
  notes?: string
  prismaClient?: any
  now?: Date
}

/**
 * Builds a deterministic, globally unique idempotency key for an outbox record.
 * Prioritizes creationProposalId if present to strictly correlate with the assistant proposal.
 */
export function buildIdempotencyKey(
  scope: { creationProposalId?: string | null; eventId: string },
  type: SideEffectType
): string {
  if (scope.creationProposalId) {
    return `prop_${scope.creationProposalId}_${type}`
  }
  return `evt_${scope.eventId}_${type}`
}

/**
 * Strips sensitive authorization tokens, database connection credentials,
 * and email addresses from error messages before persisting to the outbox table.
 * Truncates output to 500 characters.
 */
export function sanitizeErrorMessage(err: unknown): string {
  if (!err) return 'Unknown error'
  let msg = ''
  if (err instanceof Error) {
    msg = err.message
  } else if (typeof err === 'object' && err !== null && 'message' in err && typeof (err as any).message === 'string') {
    msg = (err as any).message
  } else {
    msg = String(err)
  }
  // Mask connection strings (e.g. postgresql://user:pass@host)
  msg = msg.replace(/(postgres(?:ql)?:\/\/[^:\s]+:)[^@\s]+(@)/gi, '$1***$2')
  // Mask authorization bearer tokens
  msg = msg.replace(/(bearer\s+)[a-z0-9_\-\.]+/gi, '$1***')
  // Mask API key query strings
  msg = msg.replace(/([?&](?:key|api_key|token|secret)=)[^&\s]+/gi, '$1***')
  // Mask email addresses
  msg = msg.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]')
  // Truncate to 500 characters
  return msg.length > 500 ? msg.substring(0, 497) + '...' : msg
}

/**
 * Evaluates whether an error represents a permanent, non-retryable condition
 * (such as 4xx HTTP client errors, invalid schema, or missing foreign entities)
 * versus a transient retryable error (such as network timeouts, 5xx server errors, or 429 rate limits).
 */
export function isPermanentError(err: unknown): boolean {
  if (!err) return false
  if (typeof err === 'object' && err !== null) {
    const status =
      (err as { status?: unknown; statusCode?: unknown }).status ??
      (err as { status?: unknown; statusCode?: unknown }).statusCode
    if (typeof status === 'number') {
      // 4xx errors are permanent client/precondition errors, with exceptions for rate-limiting and timeouts
      if (status >= 400 && status < 500 && status !== 429 && status !== 408) {
        return true
      }
    }
    const code = (err as { code?: unknown }).code
    if (typeof code === 'string') {
      if (['ERR_INVALID_ARG_VALUE', 'INVALID_EMAIL', 'P2002', 'P2025', 'UNAUTHORIZED'].includes(code)) {
        return true
      }
    }
  }
  const msg = err instanceof Error ? err.message : String(err)
  if (
    /invalid input|validation failed|unauthorized|forbidden|not found/i.test(msg) &&
    !/network|timeout|connection|econnrefused|etimedout|5\d\d|429/i.test(msg)
  ) {
    return true
  }
  return false
}

/**
 * Calculates bounded exponential backoff for retries:
 * attempt 1: +1 min, attempt 2: +2 min, attempt 3: +4 min, attempt 4: +8 min, attempt 5: +16 min (max 60 min).
 */
export function calculateNextAttempt(attempts: number, now: Date = new Date()): Date {
  const baseMinutes = Math.min(Math.pow(2, Math.max(0, attempts - 1)), 60)
  return new Date(now.getTime() + baseMinutes * 60 * 1000)
}

function getDurationMinutes(startIso: string | null | undefined, endIso: string | null | undefined): number {
  if (!startIso || !endIso) return 120
  const diff = Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
  return diff > 0 ? diff : 120
}

/**
 * Atomically stages pending side effects inside the transactional boundary.
 * If called within a Prisma transaction (`tx`), all outbox entries roll back if event creation fails.
 * Uses idempotent upserts to ensure repeat calls never produce duplicate records.
 */
export async function stageEventCreationSideEffectsInOutbox(
  params: StageOutboxItemsParams
): Promise<EventCreationSideEffectOutboxRecord[]> {
  const {
    eventId,
    organizerId,
    creationProposalId = null,
    slug,
    actor,
    targetOrganizer,
    input,
    googleEventId = null,
    normalizedVirtualLink = null,
    sideEffectsOptions = {},
    tx,
    now = new Date(),
  } = params

  const client: any = tx ?? prisma
  const {
    enableReferrals = true,
    enableCalendarSync = true,
    enableFollowerAnnouncements = true,
    enableCachePurge = true,
  } = sideEffectsOptions

  const stagedRecords: EventCreationSideEffectOutboxRecord[] = []

  // 1. Referral & Community scoring
  if (enableReferrals && targetOrganizer.id) {
    const key = buildIdempotencyKey({ creationProposalId, eventId }, 'COMMUNITY_REFERRAL')
    const payload: OutboxItemPayloadCommunityReferral = {
      eventId,
      organizerId: targetOrganizer.id,
    }
    const item = await client.eventCreationSideEffectOutbox.upsert({
      where: { idempotencyKey: key },
      update: {},
      create: {
        idempotencyKey: key,
        eventId,
        creationProposalId,
        organizerId: targetOrganizer.id,
        sideEffectType: 'COMMUNITY_REFERRAL',
        status: 'PENDING',
        payload: payload as unknown as Prisma.InputJsonValue,
        attempts: 0,
        maxAttempts: 5,
        nextAttemptAt: now,
      },
    })
    stagedRecords.push(item as unknown as EventCreationSideEffectOutboxRecord)
  }

  // 2. Google Calendar Sync
  if (enableCalendarSync && targetOrganizer.id && (googleEventId || input.eventDate)) {
    const key = buildIdempotencyKey({ creationProposalId, eventId }, 'CALENDAR_SYNC')
    const payload: OutboxItemPayloadCalendarSync = {
      eventId,
      organizerId: targetOrganizer.id,
      googleEventId,
      title: input.title,
      description: input.description,
      location: input.location,
      eventDate: input.eventDate,
      eventEndAt: input.eventEndAt,
      eventType: input.eventType,
      virtualLink: normalizedVirtualLink,
      slug,
    }
    const item = await client.eventCreationSideEffectOutbox.upsert({
      where: { idempotencyKey: key },
      update: {},
      create: {
        idempotencyKey: key,
        eventId,
        creationProposalId,
        organizerId: targetOrganizer.id,
        sideEffectType: 'CALENDAR_SYNC',
        status: 'PENDING',
        payload: payload as unknown as Prisma.InputJsonValue,
        attempts: 0,
        maxAttempts: 5,
        nextAttemptAt: now,
      },
    })
    stagedRecords.push(item as unknown as EventCreationSideEffectOutboxRecord)
  }

  // 3. User Cache Purge
  if (enableCachePurge) {
    const key = buildIdempotencyKey({ creationProposalId, eventId }, 'USER_CACHE_PURGE')
    const payload: OutboxItemPayloadUserCachePurge = {
      actorUserId: actor.userId,
      actorUserEmail: actor.userEmail ?? null,
      organizerId: targetOrganizer.id,
      organizerEmail: targetOrganizer.email ?? null,
    }
    const item = await client.eventCreationSideEffectOutbox.upsert({
      where: { idempotencyKey: key },
      update: {},
      create: {
        idempotencyKey: key,
        eventId,
        creationProposalId,
        organizerId: targetOrganizer.id,
        sideEffectType: 'USER_CACHE_PURGE',
        status: 'PENDING',
        payload: payload as unknown as Prisma.InputJsonValue,
        attempts: 0,
        maxAttempts: 5,
        nextAttemptAt: now,
      },
    })
    stagedRecords.push(item as unknown as EventCreationSideEffectOutboxRecord)
  }

  // 4. Follower announcement dispatch (only for public events)
  if (enableFollowerAnnouncements && input.visibility === 'PUBLIC') {
    const key = buildIdempotencyKey({ creationProposalId, eventId }, 'FOLLOWER_ANNOUNCEMENT')
    const payload: OutboxItemPayloadFollowerAnnouncement = {
      eventId,
      organizerId: targetOrganizer.id,
    }
    const item = await client.eventCreationSideEffectOutbox.upsert({
      where: { idempotencyKey: key },
      update: {},
      create: {
        idempotencyKey: key,
        eventId,
        creationProposalId,
        organizerId: targetOrganizer.id,
        sideEffectType: 'FOLLOWER_ANNOUNCEMENT',
        status: 'PENDING',
        payload: payload as unknown as Prisma.InputJsonValue,
        attempts: 0,
        maxAttempts: 3, // Lower attempt count for email broadcasts to prevent duplicate blasts
        nextAttemptAt: now,
      },
    })
    stagedRecords.push(item as unknown as EventCreationSideEffectOutboxRecord)
  }

  return stagedRecords
}

/**
 * Attempts to atomically claim an outbox item for processing using an atomic conditional update.
 * Assigns a unique leaseToken to enforce worker ownership on all subsequent transitions.
 * If another worker already holds an active lease or updated the record, returns null.
 */
async function claimOutboxItem(
  db: any,
  item: EventCreationSideEffectOutboxRecord,
  now: Date,
  leaseDurationMs: number
): Promise<string | null> {
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs)
  const leaseToken = crypto.randomUUID()

  // Atomic conditional update ensures only one concurrent worker acquires the lease
  const result = await db.eventCreationSideEffectOutbox.updateMany({
    where: {
      id: item.id,
      status: item.status,
      // If it was in PROCESSING state, verify the previous lease has genuinely expired
      ...(item.status === 'PROCESSING'
        ? {
            OR: [
              { processingLeaseExpiresAt: { lte: now } },
              { processingLeaseExpiresAt: null },
            ],
          }
        : {}),
    },
    data: {
      status: 'PROCESSING',
      leaseToken,
      processingLeaseExpiresAt: leaseExpiresAt,
      attempts: { increment: 1 },
      attemptedAt: now,
    },
  })

  return result.count > 0 ? leaseToken : null
}

/**
 * Executes a single outbox item against its external or domain service handler.
 * Requires the active leaseToken on all updates. If the worker lost ownership, aborts cleanly.
 */
async function executeSingleOutboxItem(
  db: any,
  item: EventCreationSideEffectOutboxRecord,
  currentLeaseToken: string,
  now: Date
): Promise<{
  success: boolean
  lostLease?: boolean
  ambiguous?: boolean
  evidenceStatus: 'CONFIRMED' | 'FAILED' | 'AMBIGUOUS' | 'INITIATED_ASYNC'
}> {
  try {
    switch (item.sideEffectType) {
      case 'COMMUNITY_REFERRAL': {
        const payload = item.payload as unknown as OutboxItemPayloadCommunityReferral
        const existingEvents = await db.event.count({
          where: { organizerId: payload.organizerId },
        })
        if (existingEvents === 1) {
          await processFirstEventReferral(payload.organizerId)
        }
        await scoreEventCreation(payload.organizerId)

        const updateResult = await db.eventCreationSideEffectOutbox.updateMany({
          where: {
            id: item.id,
            leaseToken: currentLeaseToken,
            status: 'PROCESSING',
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            processingLeaseExpiresAt: null,
            leaseToken: null,
            lastError: null,
            resultMetadata: { scored: true, isFirstEvent: existingEvents === 1 },
          },
        })

        if (updateResult.count === 0) {
          return { success: false, lostLease: true, evidenceStatus: 'FAILED' }
        }
        return { success: true, evidenceStatus: 'CONFIRMED' }
      }

      case 'CALENDAR_SYNC': {
        const payload = item.payload as unknown as OutboxItemPayloadCalendarSync
        if (payload.googleEventId) {
          await db.calendarEventSync.upsert({
            where: {
              userId_eventId_role: {
                userId: payload.organizerId,
                eventId: payload.eventId,
                role: 'organiser',
              },
            },
            update: {
              googleEventId: payload.googleEventId,
              syncStatus: 'synced',
              lastSyncedAt: new Date(),
            },
            create: {
              userId: payload.organizerId,
              eventId: payload.eventId,
              googleEventId: payload.googleEventId,
              role: 'organiser',
              syncStatus: 'synced',
            },
          })
        } else if (payload.eventDate) {
          // Check if an existing sync record already holds a googleEventId to avoid duplicate creation on retry
          let existingGoogleEventId: string | null = null
          try {
            const existingSync = await db.calendarEventSync.findUnique({
              where: {
                userId_eventId_role: {
                  userId: payload.organizerId,
                  eventId: payload.eventId,
                  role: 'organiser',
                },
              },
              select: { googleEventId: true },
            })
            existingGoogleEventId = existingSync?.googleEventId ?? null
          } catch {
            // Non-fatal if query fails; proceed to create
          }

          if (!existingGoogleEventId) {
            const calResult = await createCalendarEvent({
              userId: payload.organizerId,
              eventSlotId: payload.eventId,
              role: 'organiser',
              title: `[EventSlot] ${payload.title.trim()}`,
              description: `${payload.description ?? ''}\n\nManage event: ${APP_URL}/dashboard/events/${payload.slug}`,
              location: payload.eventType === 'VIRTUAL' ? 'Online - Google Meet' : payload.location || null,
              startDate: new Date(payload.eventDate),
              durationMins: getDurationMinutes(payload.eventDate, payload.eventEndAt),
              eventUrl: `${APP_URL}/dashboard/events/${payload.slug}`,
              isVirtual: payload.eventType === 'VIRTUAL',
              meetingLink: payload.eventType === 'VIRTUAL' ? payload.virtualLink || null : null,
            })
            if (!calResult.success) {
              throw new Error('Google Calendar event creation failed')
            }
          }
        }

        const updateResult = await db.eventCreationSideEffectOutbox.updateMany({
          where: {
            id: item.id,
            leaseToken: currentLeaseToken,
            status: 'PROCESSING',
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            processingLeaseExpiresAt: null,
            leaseToken: null,
            lastError: null,
            resultMetadata: { synced: true },
          },
        })

        if (updateResult.count === 0) {
          return { success: false, lostLease: true, evidenceStatus: 'FAILED' }
        }
        return { success: true, evidenceStatus: 'CONFIRMED' }
      }

      case 'USER_CACHE_PURGE': {
        const payload = item.payload as unknown as OutboxItemPayloadUserCachePurge
        if (payload.actorUserId) {
          purgeUserCache(payload.actorUserId, payload.actorUserEmail ?? null)
        }
        if (payload.organizerId && payload.organizerId !== payload.actorUserId) {
          purgeUserCache(payload.organizerId, payload.organizerEmail ?? null)
        }

        const updateResult = await db.eventCreationSideEffectOutbox.updateMany({
          where: {
            id: item.id,
            leaseToken: currentLeaseToken,
            status: 'PROCESSING',
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            processingLeaseExpiresAt: null,
            leaseToken: null,
            lastError: null,
            resultMetadata: { purged: true },
          },
        })

        if (updateResult.count === 0) {
          return { success: false, lostLease: true, evidenceStatus: 'FAILED' }
        }
        return { success: true, evidenceStatus: 'CONFIRMED' }
      }

      case 'FOLLOWER_ANNOUNCEMENT': {
        const payload = item.payload as unknown as OutboxItemPayloadFollowerAnnouncement
        const metadata = (item.resultMetadata as Record<string, unknown> | null) ?? {}

        // 1. If previously confirmed, complete without re-dispatch
        if (metadata.dispatchState === 'CONFIRMED_ACCEPTED' || metadata.dispatched === true) {
          const updateResult = await db.eventCreationSideEffectOutbox.updateMany({
            where: {
              id: item.id,
              leaseToken: currentLeaseToken,
              status: 'PROCESSING',
            },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              processingLeaseExpiresAt: null,
              leaseToken: null,
              lastError: null,
            },
          })
          if (updateResult.count === 0) {
            return { success: false, lostLease: true, evidenceStatus: 'FAILED' }
          }
          return { success: true, evidenceStatus: 'CONFIRMED' }
        }

        // 2. Interruption recovery: If dispatch was previously attempted but not confirmed,
        // the external provider is non-idempotent. Resending risks duplicate email blasts!
        // Transition to AMBIGUOUS_OUTCOME requiring manual reconciliation.
        if (metadata.dispatchState === 'DISPATCH_ATTEMPTED') {
          const ambiguousUpdate = await db.eventCreationSideEffectOutbox.updateMany({
            where: {
              id: item.id,
              leaseToken: currentLeaseToken,
              status: 'PROCESSING',
            },
            data: {
              status: 'AMBIGUOUS_OUTCOME',
              processingLeaseExpiresAt: null,
              leaseToken: null,
              lastError:
                'External announcement delivery outcome is ambiguous. Automatic retry suppressed to avoid duplicate follower blasts.',
              resultMetadata: {
                ...metadata,
                dispatchState: 'AMBIGUOUS',
                ambiguityReason:
                  'Interrupted during or after external email dispatch. Automatic retry suppressed.',
                requiresReconciliation: true,
                interruptedAt: now.toISOString(),
              },
            },
          })
          if (ambiguousUpdate.count === 0) {
            return { success: false, lostLease: true, evidenceStatus: 'FAILED' }
          }
          return { success: false, ambiguous: true, evidenceStatus: 'AMBIGUOUS' }
        }

        // 3. Phase A: Persist dispatch-attempt marker BEFORE calling the external provider
        const preDispatchUpdate = await db.eventCreationSideEffectOutbox.updateMany({
          where: {
            id: item.id,
            leaseToken: currentLeaseToken,
            status: 'PROCESSING',
          },
          data: {
            resultMetadata: {
              ...metadata,
              dispatchState: 'DISPATCH_ATTEMPTED',
              dispatchAttemptedAt: now.toISOString(),
              attemptNumber: item.attempts + 1,
            },
          },
        })

        if (preDispatchUpdate.count === 0) {
          // Lost lease before pre-dispatch; abort without invoking external email service!
          return { success: false, lostLease: true, evidenceStatus: 'FAILED' }
        }

        // 4. Phase B: Invoke external provider (fire announcement emails)
        let dispatchResult: any
        try {
          dispatchResult = await dispatchNewEventAnnouncements(payload.eventId)
        } catch (dispatchErr) {
          // Failure during external call: because dispatch was already attempted,
          // we do not know if some emails were accepted before the error. Mark ambiguous.
          const sanitized = sanitizeErrorMessage(dispatchErr)
          await db.eventCreationSideEffectOutbox.updateMany({
            where: {
              id: item.id,
              leaseToken: currentLeaseToken,
              status: 'PROCESSING',
            },
            data: {
              status: 'AMBIGUOUS_OUTCOME',
              processingLeaseExpiresAt: null,
              leaseToken: null,
              lastError: `Ambiguous dispatch failure: ${sanitized}`,
              resultMetadata: {
                ...metadata,
                dispatchState: 'AMBIGUOUS',
                ambiguityReason: 'External provider call threw after dispatch was initiated.',
                requiresReconciliation: true,
                error: sanitized,
              },
            },
          })
          return { success: false, ambiguous: true, evidenceStatus: 'AMBIGUOUS' }
        }

        // 5. Phase C: Provider returned successfully: record CONFIRMED_ACCEPTED
        const confirmedUpdate = await db.eventCreationSideEffectOutbox.updateMany({
          where: {
            id: item.id,
            leaseToken: currentLeaseToken,
            status: 'PROCESSING',
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            processingLeaseExpiresAt: null,
            leaseToken: null,
            lastError: null,
            resultMetadata: {
              ...metadata,
              dispatchState: 'CONFIRMED_ACCEPTED',
              sentCount: dispatchResult?.sent ?? 0,
              skippedCount: dispatchResult?.skipped ?? 0,
              reason: dispatchResult?.reason ?? 'DISPATCHED',
              acceptedAt: new Date().toISOString(),
            },
          },
        })

        if (confirmedUpdate.count === 0) {
          // Stale worker lost lease before writing completion
          return { success: false, lostLease: true, evidenceStatus: 'FAILED' }
        }
        return { success: true, evidenceStatus: 'CONFIRMED' }
      }

      default: {
        throw new Error(`Unsupported sideEffectType: ${(item as any).sideEffectType}`)
      }
    }
  } catch (err) {
    const sanitized = sanitizeErrorMessage(err)
    const permanent = isPermanentError(err)
    const nextAttempts = item.attempts + 1
    const isExhausted = nextAttempts >= item.maxAttempts

    if (permanent || isExhausted) {
      await db.eventCreationSideEffectOutbox.updateMany({
        where: {
          id: item.id,
          leaseToken: currentLeaseToken,
          status: 'PROCESSING',
        },
        data: {
          status: 'FAILED',
          failedAt: new Date(),
          processingLeaseExpiresAt: null,
          leaseToken: null,
          lastError: sanitized,
          resultMetadata: {
            permanentFailure: permanent,
            attemptsExhausted: isExhausted,
          },
        },
      })
    } else {
      const nextAttemptAt = calculateNextAttempt(nextAttempts, now)
      await db.eventCreationSideEffectOutbox.updateMany({
        where: {
          id: item.id,
          leaseToken: currentLeaseToken,
          status: 'PROCESSING',
        },
        data: {
          status: 'PENDING',
          nextAttemptAt,
          processingLeaseExpiresAt: null,
          leaseToken: null,
          lastError: sanitized,
        },
      })
    }

    return { success: false, evidenceStatus: 'FAILED' }
  }
}

/**
 * Authoritative Outbox Processing Service.
 * Safely processes pending or recovered outbox items outside any database transaction.
 * Supports individual event/proposal targeting, atomic lease tokens, retry backoff, and error sanitization.
 */
export async function processPendingSideEffectOutboxItems(
  params: ProcessOutboxParams = {}
): Promise<ProcessOutboxSummary> {
  const {
    eventId,
    creationProposalId,
    outboxItemId,
    limit = 20,
    leaseDurationMs = 60_000,
    now = new Date(),
    prismaClient = prisma,
  } = params

  const db = prismaClient

  const whereClause: any = {
    attempts: { lt: 10 },
    ...(eventId ? { eventId } : {}),
    ...(creationProposalId ? { creationProposalId } : {}),
    ...(outboxItemId ? { id: outboxItemId } : {}),
  }

  // Fetch candidates: items that are either PENDING and due, or PROCESSING with an expired lease
  // Terminal states (COMPLETED, FAILED, CANCELLED, AMBIGUOUS_OUTCOME) are excluded
  const candidateItems =
    (await db.eventCreationSideEffectOutbox.findMany({
      where: {
        ...whereClause,
        OR: [
          {
            status: 'PENDING',
            nextAttemptAt: { lte: now },
          },
          {
            status: 'PROCESSING',
            OR: [
              { processingLeaseExpiresAt: { lte: now } },
              { processingLeaseExpiresAt: null },
            ],
            nextAttemptAt: { lte: now },
          },
        ],
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
    })) ?? []

  const evidenceMap: ProcessOutboxSummary['deliveryEvidence'] = {
    referrals: 'SKIPPED',
    calendarSync: 'SKIPPED',
    cachePurge: 'SKIPPED',
    followerAnnouncements: 'SKIPPED',
  }

  let processedCount = 0
  let succeededCount = 0
  let failedCount = 0
  let skippedCount = 0
  let ambiguousCount = 0

  for (const item of candidateItems) {
    const typedItem = item as EventCreationSideEffectOutboxRecord
    const leaseToken = await claimOutboxItem(db, typedItem, now, leaseDurationMs)
    if (!leaseToken) {
      skippedCount++
      continue
    }

    processedCount++
    const executionResult = await executeSingleOutboxItem(db, typedItem, leaseToken, now)

    if (executionResult.success) {
      succeededCount++
    } else if (executionResult.ambiguous) {
      ambiguousCount++
    } else if (!executionResult.lostLease) {
      failedCount++
    } else {
      skippedCount++
    }

    switch (typedItem.sideEffectType) {
      case 'COMMUNITY_REFERRAL':
        evidenceMap.referrals = executionResult.evidenceStatus as any
        break
      case 'CALENDAR_SYNC':
        evidenceMap.calendarSync = executionResult.evidenceStatus as any
        break
      case 'USER_CACHE_PURGE':
        evidenceMap.cachePurge = executionResult.evidenceStatus as any
        break
      case 'FOLLOWER_ANNOUNCEMENT':
        evidenceMap.followerAnnouncements = executionResult.evidenceStatus as any
        break
    }
  }

  // Query completed or ambiguous items for this event/proposal to provide accurate delivery evidence
  if (eventId || creationProposalId) {
    try {
      const persistedItems = await db.eventCreationSideEffectOutbox.findMany({
        where: {
          ...(eventId ? { eventId } : {}),
          ...(creationProposalId ? { creationProposalId } : {}),
          status: { in: ['COMPLETED', 'AMBIGUOUS_OUTCOME'] },
        },
      })

      for (const item of Array.isArray(persistedItems) ? persistedItems : []) {
        switch (item.sideEffectType) {
          case 'COMMUNITY_REFERRAL':
            if (evidenceMap.referrals === 'SKIPPED' && item.status === 'COMPLETED') evidenceMap.referrals = 'CONFIRMED'
            break
          case 'CALENDAR_SYNC':
            if (evidenceMap.calendarSync === 'SKIPPED' && item.status === 'COMPLETED') evidenceMap.calendarSync = 'CONFIRMED'
            break
          case 'USER_CACHE_PURGE':
            if (evidenceMap.cachePurge === 'SKIPPED' && item.status === 'COMPLETED') evidenceMap.cachePurge = 'CONFIRMED'
            break
          case 'FOLLOWER_ANNOUNCEMENT':
            if (item.status === 'AMBIGUOUS_OUTCOME') {
              evidenceMap.followerAnnouncements = 'AMBIGUOUS'
            } else if (evidenceMap.followerAnnouncements === 'SKIPPED' && item.status === 'COMPLETED') {
              evidenceMap.followerAnnouncements = 'CONFIRMED'
            }
            break
        }
      }
    } catch (err) {
      console.warn('[processPendingSideEffectOutboxItems] Warning querying persisted evidence items:', err)
    }
  }

  const attemptedItems = [
    evidenceMap.referrals,
    evidenceMap.calendarSync,
    evidenceMap.cachePurge,
  ].filter((s) => s !== 'SKIPPED')

  let aggregateStatus: ProcessOutboxSummary['aggregateStatus'] = 'NONE'
  const failedItemsCount = attemptedItems.filter((s) => s === 'FAILED').length
  const confirmedItemsCount = attemptedItems.filter((s) => s === 'CONFIRMED').length
  const hasAmbiguity = evidenceMap.followerAnnouncements === 'AMBIGUOUS'

  if (hasAmbiguity) {
    aggregateStatus = 'AMBIGUOUS'
  } else if (attemptedItems.length === 0) {
    aggregateStatus =
      evidenceMap.followerAnnouncements === 'INITIATED_ASYNC' ||
      evidenceMap.followerAnnouncements === 'CONFIRMED'
        ? 'ALL_DISPATCHED'
        : 'NONE'
  } else if (failedItemsCount === 0 && confirmedItemsCount === attemptedItems.length) {
    aggregateStatus = 'ALL_DISPATCHED'
  } else if (failedItemsCount === attemptedItems.length) {
    aggregateStatus = 'FAILED'
  } else {
    aggregateStatus = 'PARTIALLY_DISPATCHED'
  }

  return {
    processedCount,
    succeededCount,
    failedCount,
    skippedCount,
    ambiguousCount,
    deliveryEvidence: evidenceMap,
    aggregateStatus,
  }
}

/**
 * Reconciliation helper for ambiguous or stranded outbox records.
 * Allows safe operator-driven or automated state transitions without duplicate processing.
 */
export async function reconcileOutboxItem(
  params: ReconcileOutboxItemParams
): Promise<{ success: boolean; item?: EventCreationSideEffectOutboxRecord | null; error?: string }> {
  const db = params.prismaClient ?? prisma
  const now = params.now ?? new Date()

  const existing = await db.eventCreationSideEffectOutbox.findUnique({
    where: { id: params.outboxItemId },
  })
  if (!existing) {
    return { success: false, error: 'Outbox item not found' }
  }

  const existingMetadata = (existing.resultMetadata as Record<string, unknown> | null) ?? {}

  if (params.action === 'MARK_COMPLETED') {
    const updated = await db.eventCreationSideEffectOutbox.update({
      where: { id: existing.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        processingLeaseExpiresAt: null,
        leaseToken: null,
        resultMetadata: {
          ...existingMetadata,
          reconciled: true,
          reconciliationAction: 'MARK_COMPLETED',
          reconciledAt: now.toISOString(),
          notes: params.notes ?? null,
        },
      },
    })
    return { success: true, item: updated as unknown as EventCreationSideEffectOutboxRecord }
  }

  if (params.action === 'MARK_FAILED') {
    const updated = await db.eventCreationSideEffectOutbox.update({
      where: { id: existing.id },
      data: {
        status: 'FAILED',
        failedAt: now,
        processingLeaseExpiresAt: null,
        leaseToken: null,
        resultMetadata: {
          ...existingMetadata,
          reconciled: true,
          reconciliationAction: 'MARK_FAILED',
          reconciledAt: now.toISOString(),
          notes: params.notes ?? null,
        },
      },
    })
    return { success: true, item: updated as unknown as EventCreationSideEffectOutboxRecord }
  }

  if (params.action === 'RETRY_FORCE') {
    const updated = await db.eventCreationSideEffectOutbox.update({
      where: { id: existing.id },
      data: {
        status: 'PENDING',
        nextAttemptAt: now,
        processingLeaseExpiresAt: null,
        leaseToken: null,
        resultMetadata: {
          ...existingMetadata,
          reconciled: true,
          reconciliationAction: 'RETRY_FORCE',
          dispatchState: 'NOT_ATTEMPTED',
          reconciledAt: now.toISOString(),
          notes: params.notes ?? null,
        },
      },
    })
    return { success: true, item: updated as unknown as EventCreationSideEffectOutboxRecord }
  }

  return { success: false, error: 'Invalid reconciliation action' }
}
