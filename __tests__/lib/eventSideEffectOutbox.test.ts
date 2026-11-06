import {
  buildIdempotencyKey,
  sanitizeErrorMessage,
  isPermanentError,
  calculateNextAttempt,
  stageEventCreationSideEffectsInOutbox,
  processPendingSideEffectOutboxItems,
  reconcileOutboxItem,
  type EventCreationSideEffectOutboxRecord,
} from '@/lib/events/event-side-effect-outbox'
import * as referralModule from '@/lib/referral'
import * as googleCalendarModule from '@/lib/googleCalendar'
import * as cacheModule from '@/lib/cache'
import * as followerAnnouncementsModule from '@/services/notifications/followerAnnouncements'

jest.mock('@/lib/referral', () => ({
  processFirstEventReferral: jest.fn().mockResolvedValue(undefined),
  scoreEventCreation: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/googleCalendar', () => ({
  createCalendarEvent: jest.fn().mockResolvedValue({ success: true, googleEventId: 'mock-google-event-id' }),
}))

jest.mock('@/lib/cache', () => ({
  purgeUserCache: jest.fn(),
}))

jest.mock('@/services/notifications/followerAnnouncements', () => ({
  dispatchNewEventAnnouncements: jest.fn().mockResolvedValue({ sent: 5, skipped: 0, reason: 'DISPATCHED' }),
}))

describe('EventCreationSideEffectOutbox', () => {
  const baseNow = new Date('2026-10-28T12:00:00.000Z')

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('buildIdempotencyKey', () => {
    it('uses creationProposalId as priority prefix when present', () => {
      const key = buildIdempotencyKey(
        { creationProposalId: 'prop-123', eventId: 'evt-456' },
        'CALENDAR_SYNC'
      )
      expect(key).toBe('prop_prop-123_CALENDAR_SYNC')
    })

    it('falls back to eventId prefix when creationProposalId is null/undefined', () => {
      const key = buildIdempotencyKey(
        { creationProposalId: null, eventId: 'evt-456' },
        'COMMUNITY_REFERRAL'
      )
      expect(key).toBe('evt_evt-456_COMMUNITY_REFERRAL')
    })
  })

  describe('sanitizeErrorMessage', () => {
    it('redacts postgresql connection strings containing credentials', () => {
      const raw = 'Failed to connect: postgresql://admin_user:SuperSecretPassword123@db.prod.internal:5432/eventslot'
      const sanitized = sanitizeErrorMessage(raw)
      expect(sanitized).not.toContain('SuperSecretPassword123')
      expect(sanitized).toContain('postgresql://admin_user:***@db.prod.internal:5432/eventslot')
    })

    it('redacts authorization bearer tokens', () => {
      const raw = 'Google API error: Bearer ya29.a0AfH6SMAxyz123abc responded with 401'
      const sanitized = sanitizeErrorMessage(raw)
      expect(sanitized).not.toContain('ya29.a0AfH6SMAxyz123abc')
      expect(sanitized).toContain('Bearer ***')
    })

    it('redacts API key query parameters', () => {
      const raw = 'Failed request: https://api.service.com/v1?api_key=secret_key_abcdef9876'
      const sanitized = sanitizeErrorMessage(raw)
      expect(sanitized).not.toContain('secret_key_abcdef9876')
      expect(sanitized).toContain('api_key=***')
    })

    it('redacts attendee and user email addresses', () => {
      const raw = 'Failed to deliver notification to attendee.vip@domain.co.ke: mailbox full'
      const sanitized = sanitizeErrorMessage(raw)
      expect(sanitized).not.toContain('attendee.vip@domain.co.ke')
      expect(sanitized).toContain('[REDACTED_EMAIL]')
    })

    it('truncates excessively long error messages to 500 chars', () => {
      const veryLong = 'X'.repeat(600)
      const sanitized = sanitizeErrorMessage(veryLong)
      expect(sanitized.length).toBe(500)
      expect(sanitized.endsWith('...')).toBe(true)
    })
  })

  describe('isPermanentError classification', () => {
    it('identifies 4xx HTTP client errors (400, 403, 404) as permanent failures', () => {
      expect(isPermanentError({ status: 400, message: 'Bad Request' })).toBe(true)
      expect(isPermanentError({ status: 404, message: 'Resource not found' })).toBe(true)
      expect(isPermanentError({ statusCode: 403, message: 'Forbidden' })).toBe(true)
    })

    it('treats 429 rate limit errors as retryable (not permanent)', () => {
      expect(isPermanentError({ status: 429, message: 'Too Many Requests' })).toBe(false)
    })

    it('treats 408 request timeout as retryable (not permanent)', () => {
      expect(isPermanentError({ status: 408, message: 'Request Timeout' })).toBe(false)
    })

    it('treats 5xx server errors and network timeouts as retryable', () => {
      expect(isPermanentError({ status: 500, message: 'Internal Server Error' })).toBe(false)
      expect(isPermanentError({ status: 503, message: 'Service Unavailable' })).toBe(false)
      expect(isPermanentError(new Error('ETIMEDOUT connection failed'))).toBe(false)
      expect(isPermanentError(new Error('fetch failed: ECONNRESET'))).toBe(false)
    })

    it('classifies validation and unauthorized strings as permanent if non-network', () => {
      expect(isPermanentError(new Error('Validation failed: missing required parameter'))).toBe(true)
      expect(isPermanentError(new Error('Unauthorized access token invalid'))).toBe(true)
    })
  })

  describe('calculateNextAttempt exponential backoff', () => {
    it('calculates 1min, 2min, 4min, 8min, 16min bounded up to 60min', () => {
      const attempt1 = calculateNextAttempt(1, baseNow)
      expect(attempt1.getTime() - baseNow.getTime()).toBe(1 * 60 * 1000)

      const attempt2 = calculateNextAttempt(2, baseNow)
      expect(attempt2.getTime() - baseNow.getTime()).toBe(2 * 60 * 1000)

      const attempt3 = calculateNextAttempt(3, baseNow)
      expect(attempt3.getTime() - baseNow.getTime()).toBe(4 * 60 * 1000)

      const attempt4 = calculateNextAttempt(4, baseNow)
      expect(attempt4.getTime() - baseNow.getTime()).toBe(8 * 60 * 1000)

      const attempt5 = calculateNextAttempt(5, baseNow)
      expect(attempt5.getTime() - baseNow.getTime()).toBe(16 * 60 * 1000)

      const attempt10 = calculateNextAttempt(10, baseNow)
      expect(attempt10.getTime() - baseNow.getTime()).toBe(60 * 60 * 1000) // Capped at 60min
    })
  })

  describe('stageEventCreationSideEffectsInOutbox', () => {
    it('stages outbox items for all applicable side effects inside transaction tx', async () => {
      const upsertMock = jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'outbox-id-1', ...create }))
      const txMock = {
        eventCreationSideEffectOutbox: {
          upsert: upsertMock,
        },
      } as any

      const staged = await stageEventCreationSideEffectsInOutbox({
        eventId: 'evt-100',
        organizerId: 'org-200',
        creationProposalId: 'prop-300',
        slug: 'tech-summit-2026',
        actor: { userId: 'org-200', userEmail: 'org@eventslot.com' },
        targetOrganizer: { id: 'org-200', email: 'org@eventslot.com' },
        input: {
          title: 'Tech Summit 2026',
          visibility: 'PUBLIC',
          accessType: 'REGISTRATION',
          eventType: 'PHYSICAL',
          location: 'Nairobi',
          eventDate: '2026-11-01T09:00:00.000Z',
          ticketTiers: [],
          questions: [],
          hasSpecificTime: true,
          isMultiDay: false,
          isRecurring: false,
          timedDropEnabled: false,
          dropWaitlistOnExpire: true,
          showRemainingSpots: true,
          attendeeConsentEnabled: true,
          groupRegistrationEnabled: false,
          allowGroupSelfClaim: true,
        } as any,
        tx: txMock,
        now: baseNow,
      })

      expect(staged.length).toBe(4) // COMMUNITY_REFERRAL, CALENDAR_SYNC, USER_CACHE_PURGE, FOLLOWER_ANNOUNCEMENT
      expect(upsertMock).toHaveBeenCalledTimes(4)

      const types = staged.map((s) => s.sideEffectType)
      expect(types).toContain('COMMUNITY_REFERRAL')
      expect(types).toContain('CALENDAR_SYNC')
      expect(types).toContain('USER_CACHE_PURGE')
      expect(types).toContain('FOLLOWER_ANNOUNCEMENT')

      for (const item of staged) {
        expect(item.creationProposalId).toBe('prop-300')
        expect(item.eventId).toBe('evt-100')
        expect(item.status).toBe('PENDING')
      }
    })

    it('omits FOLLOWER_ANNOUNCEMENT for PRIVATE events', async () => {
      const upsertMock = jest.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'outbox-id-2', ...create }))
      const txMock = {
        eventCreationSideEffectOutbox: {
          upsert: upsertMock,
        },
      } as any

      const staged = await stageEventCreationSideEffectsInOutbox({
        eventId: 'evt-101',
        organizerId: 'org-200',
        slug: 'private-board-meeting',
        actor: { userId: 'org-200' },
        targetOrganizer: { id: 'org-200' },
        input: {
          title: 'Private Board Meeting',
          visibility: 'PRIVATE',
          accessType: 'REGISTRATION',
          eventType: 'PHYSICAL',
          ticketTiers: [],
          questions: [],
        } as any,
        tx: txMock,
      })

      const types = staged.map((s) => s.sideEffectType)
      expect(types).not.toContain('FOLLOWER_ANNOUNCEMENT')
    })
  })

  describe('processPendingSideEffectOutboxItems — Worker Lease Ownership & Safe Execution', () => {
    it('atomically claims lease and executes pending outbox items to COMPLETED with leaseToken', async () => {
      const mockRecord: EventCreationSideEffectOutboxRecord = {
        id: 'outbox-1',
        idempotencyKey: 'prop_p1_COMMUNITY_REFERRAL',
        eventId: 'evt-1',
        creationProposalId: 'p1',
        organizerId: 'org-1',
        sideEffectType: 'COMMUNITY_REFERRAL',
        status: 'PENDING',
        payload: { eventId: 'evt-1', organizerId: 'org-1' },
        attempts: 0,
        maxAttempts: 5,
        nextAttemptAt: baseNow,
        processingLeaseExpiresAt: null,
        leaseToken: null,
        lastError: null,
        resultMetadata: null,
        createdAt: baseNow,
        updatedAt: baseNow,
        attemptedAt: null,
        completedAt: null,
        failedAt: null,
      }

      const updateManyMock = jest.fn().mockResolvedValue({ count: 1 })
      const findManyMock = jest.fn()
        .mockResolvedValueOnce([mockRecord]) // candidate items
        .mockResolvedValueOnce([{ ...mockRecord, status: 'COMPLETED' }]) // completed query

      const mockDb = {
        eventCreationSideEffectOutbox: {
          findMany: findManyMock,
          updateMany: updateManyMock,
        },
        event: {
          count: jest.fn().mockResolvedValue(1),
        },
      }

      const result = await processPendingSideEffectOutboxItems({
        eventId: 'evt-1',
        now: baseNow,
        prismaClient: mockDb,
      })

      // Claim update + Completion update = 2 calls to updateMany
      expect(updateManyMock).toHaveBeenCalledTimes(2)
      // Check completion update is conditional on leaseToken
      expect(updateManyMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'outbox-1',
            status: 'PROCESSING',
            leaseToken: expect.any(String),
          }),
          data: expect.objectContaining({
            status: 'COMPLETED',
            leaseToken: null,
          }),
        })
      )
      expect(referralModule.processFirstEventReferral).toHaveBeenCalledWith('org-1')
      expect(referralModule.scoreEventCreation).toHaveBeenCalledWith('org-1')
      expect(result.processedCount).toBe(1)
      expect(result.succeededCount).toBe(1)
      expect(result.deliveryEvidence.referrals).toBe('CONFIRMED')
      expect(result.aggregateStatus).toBe('ALL_DISPATCHED')
    })

    it('enforces single-winner lease: skips execution when claim updateMany returns count: 0', async () => {
      const mockRecord: EventCreationSideEffectOutboxRecord = {
        id: 'outbox-2',
        idempotencyKey: 'prop_p2_CALENDAR_SYNC',
        eventId: 'evt-2',
        creationProposalId: 'p2',
        organizerId: 'org-2',
        sideEffectType: 'CALENDAR_SYNC',
        status: 'PENDING',
        payload: {
          eventId: 'evt-2',
          organizerId: 'org-2',
          title: 'Sync Meet',
          eventType: 'PHYSICAL',
          slug: 'sync-meet',
        },
        attempts: 0,
        maxAttempts: 5,
        nextAttemptAt: baseNow,
        processingLeaseExpiresAt: null,
        leaseToken: null,
        lastError: null,
        resultMetadata: null,
        createdAt: baseNow,
        updatedAt: baseNow,
        attemptedAt: null,
        completedAt: null,
        failedAt: null,
      }

      const updateManyMock = jest.fn().mockResolvedValue({ count: 0 }) // Another worker beat us!
      const mockDb = {
        eventCreationSideEffectOutbox: {
          findMany: jest.fn().mockResolvedValueOnce([mockRecord]).mockResolvedValueOnce([]),
          updateMany: updateManyMock,
        },
      }

      const result = await processPendingSideEffectOutboxItems({
        eventId: 'evt-2',
        now: baseNow,
        prismaClient: mockDb,
      })

      expect(updateManyMock).toHaveBeenCalledTimes(1)
      expect(googleCalendarModule.createCalendarEvent).not.toHaveBeenCalled()
      expect(result.skippedCount).toBe(1)
      expect(result.processedCount).toBe(0)
    })

    it('stale-worker rejection: worker that loses its lease during processing cannot complete record', async () => {
      const mockRecord: EventCreationSideEffectOutboxRecord = {
        id: 'outbox-stale',
        idempotencyKey: 'prop_stale_CACHE',
        eventId: 'evt-stale',
        creationProposalId: 'p-stale',
        organizerId: 'org-stale',
        sideEffectType: 'USER_CACHE_PURGE',
        status: 'PENDING',
        payload: { actorUserId: 'user-stale' },
        attempts: 0,
        maxAttempts: 5,
        nextAttemptAt: baseNow,
        processingLeaseExpiresAt: null,
        leaseToken: null,
        lastError: null,
        resultMetadata: null,
        createdAt: baseNow,
        updatedAt: baseNow,
        attemptedAt: null,
        completedAt: null,
        failedAt: null,
      }

      // Claim succeeds (count: 1), but completion write fails with count: 0 (lease taken over by another worker)
      const updateManyMock = jest.fn()
        .mockResolvedValueOnce({ count: 1 }) // Claim update succeeds
        .mockResolvedValueOnce({ count: 0 }) // Completion update fails because leaseToken was superseded!

      const mockDb = {
        eventCreationSideEffectOutbox: {
          findMany: jest.fn().mockResolvedValueOnce([mockRecord]).mockResolvedValueOnce([]),
          updateMany: updateManyMock,
        },
      }

      const result = await processPendingSideEffectOutboxItems({
        eventId: 'evt-stale',
        now: baseNow,
        prismaClient: mockDb,
      })

      expect(updateManyMock).toHaveBeenCalledTimes(2)
      expect(result.succeededCount).toBe(0)
      expect(result.skippedCount).toBe(1) // Lost lease treated as skipped/uncommitted
    })

    it('recovers expired lease: claims item stuck in PROCESSING whose lease expired', async () => {
      const expiredLeaseDate = new Date(baseNow.getTime() - 120_000) // Expired 2 minutes ago
      const mockRecord: EventCreationSideEffectOutboxRecord = {
        id: 'outbox-3',
        idempotencyKey: 'prop_p3_USER_CACHE_PURGE',
        eventId: 'evt-3',
        creationProposalId: 'p3',
        organizerId: 'org-3',
        sideEffectType: 'USER_CACHE_PURGE',
        status: 'PROCESSING',
        payload: { actorUserId: 'user-3', organizerId: 'org-3' },
        attempts: 1,
        maxAttempts: 5,
        nextAttemptAt: baseNow,
        processingLeaseExpiresAt: expiredLeaseDate,
        leaseToken: 'old-expired-token',
        lastError: null,
        resultMetadata: null,
        createdAt: baseNow,
        updatedAt: baseNow,
        attemptedAt: expiredLeaseDate,
        completedAt: null,
        failedAt: null,
      }

      const updateManyMock = jest.fn().mockResolvedValue({ count: 1 }) // Successfully claimed expired lease
      const mockDb = {
        eventCreationSideEffectOutbox: {
          findMany: jest.fn().mockResolvedValueOnce([mockRecord]).mockResolvedValueOnce([{ ...mockRecord, status: 'COMPLETED' }]),
          updateMany: updateManyMock,
        },
      }

      const result = await processPendingSideEffectOutboxItems({
        eventId: 'evt-3',
        now: baseNow,
        prismaClient: mockDb,
      })

      expect(cacheModule.purgeUserCache).toHaveBeenCalledWith('user-3', null)
      expect(result.succeededCount).toBe(1)
      expect(result.deliveryEvidence.cachePurge).toBe('CONFIRMED')
    })

    it('marks permanent failure immediately as FAILED conditional on leaseToken', async () => {
      const mockRecord: EventCreationSideEffectOutboxRecord = {
        id: 'outbox-4',
        idempotencyKey: 'prop_p4_CALENDAR_SYNC',
        eventId: 'evt-4',
        creationProposalId: 'p4',
        organizerId: 'org-4',
        sideEffectType: 'CALENDAR_SYNC',
        status: 'PENDING',
        payload: {
          eventId: 'evt-4',
          organizerId: 'org-4',
          title: 'Meet',
          eventType: 'PHYSICAL',
          eventDate: '2026-11-01T09:00:00.000Z',
          slug: 'meet',
        },
        attempts: 0,
        maxAttempts: 5,
        nextAttemptAt: baseNow,
        processingLeaseExpiresAt: null,
        leaseToken: null,
        lastError: null,
        resultMetadata: null,
        createdAt: baseNow,
        updatedAt: baseNow,
        attemptedAt: null,
        completedAt: null,
        failedAt: null,
      }

      ;(googleCalendarModule.createCalendarEvent as jest.Mock).mockResolvedValueOnce({
        success: false,
      })

      const updateManyMock = jest.fn().mockResolvedValue({ count: 1 })
      const mockDb = {
        eventCreationSideEffectOutbox: {
          findMany: jest.fn().mockResolvedValueOnce([mockRecord]).mockResolvedValueOnce([]),
          updateMany: updateManyMock,
        },
        calendarEventSync: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      }

      const result = await processPendingSideEffectOutboxItems({
        eventId: 'evt-4',
        now: baseNow,
        prismaClient: mockDb,
      })

      expect(result.failedCount).toBe(1)
      expect(updateManyMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'outbox-4',
            leaseToken: expect.any(String),
            status: 'PROCESSING',
          }),
          data: expect.objectContaining({
            status: 'PENDING', // retryable creation failure
            lastError: expect.stringContaining('Google Calendar event creation failed'),
          }),
        })
      )
      expect(result.deliveryEvidence.calendarSync).toBe('FAILED')
    })
  })

  describe('Follower Announcement Delivery Ambiguity State Machine', () => {
    it('Phase A & C: persists dispatch-attempt BEFORE invoking provider and completes with provider evidence', async () => {
      const mockRecord: EventCreationSideEffectOutboxRecord = {
        id: 'outbox-announcement-1',
        idempotencyKey: 'prop_ann_1_FOLLOWER_ANNOUNCEMENT',
        eventId: 'evt-ann-1',
        creationProposalId: 'prop-ann-1',
        organizerId: 'org-ann-1',
        sideEffectType: 'FOLLOWER_ANNOUNCEMENT',
        status: 'PENDING',
        payload: { eventId: 'evt-ann-1', organizerId: 'org-ann-1' },
        attempts: 0,
        maxAttempts: 3,
        nextAttemptAt: baseNow,
        processingLeaseExpiresAt: null,
        leaseToken: null,
        lastError: null,
        resultMetadata: null,
        createdAt: baseNow,
        updatedAt: baseNow,
        attemptedAt: null,
        completedAt: null,
        failedAt: null,
      }

      const updateManyMock = jest.fn().mockResolvedValue({ count: 1 })
      const mockDb = {
        eventCreationSideEffectOutbox: {
          findMany: jest.fn().mockResolvedValueOnce([mockRecord]).mockResolvedValueOnce([{ ...mockRecord, status: 'COMPLETED' }]),
          updateMany: updateManyMock,
        },
      }

      const result = await processPendingSideEffectOutboxItems({
        eventId: 'evt-ann-1',
        now: baseNow,
        prismaClient: mockDb,
      })

      // Claim (1) + Pre-dispatch attempt (2) + Completion write (3)
      expect(updateManyMock).toHaveBeenCalledTimes(3)

      // Verify Call 2: Pre-dispatch attempt recorded BEFORE provider call
      expect(updateManyMock).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({ id: 'outbox-announcement-1', status: 'PROCESSING' }),
          data: expect.objectContaining({
            resultMetadata: expect.objectContaining({
              dispatchState: 'DISPATCH_ATTEMPTED',
              attemptNumber: 1,
            }),
          }),
        })
      )

      expect(followerAnnouncementsModule.dispatchNewEventAnnouncements).toHaveBeenCalledWith('evt-ann-1')

      // Verify Call 3: Completed with provider evidence
      expect(updateManyMock).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          where: expect.objectContaining({ id: 'outbox-announcement-1', status: 'PROCESSING' }),
          data: expect.objectContaining({
            status: 'COMPLETED',
            resultMetadata: expect.objectContaining({
              dispatchState: 'CONFIRMED_ACCEPTED',
              sentCount: 5,
              reason: 'DISPATCHED',
            }),
          }),
        })
      )

      expect(result.deliveryEvidence.followerAnnouncements).toBe('CONFIRMED')
      expect(result.aggregateStatus).toBe('ALL_DISPATCHED')
    })

    it('Crash recovery ambiguity: suppresses re-blast and marks AMBIGUOUS_OUTCOME if previous dispatch was attempted', async () => {
      // Record has DISPATCH_ATTEMPTED persisted from a previous worker that crashed
      const mockInterruptedRecord: EventCreationSideEffectOutboxRecord = {
        id: 'outbox-interrupted',
        idempotencyKey: 'prop_ann_2_FOLLOWER_ANNOUNCEMENT',
        eventId: 'evt-ann-2',
        creationProposalId: 'prop-ann-2',
        organizerId: 'org-ann-2',
        sideEffectType: 'FOLLOWER_ANNOUNCEMENT',
        status: 'PROCESSING',
        payload: { eventId: 'evt-ann-2', organizerId: 'org-ann-2' },
        attempts: 1,
        maxAttempts: 3,
        nextAttemptAt: baseNow,
        processingLeaseExpiresAt: new Date(baseNow.getTime() - 60_000), // lease expired
        leaseToken: 'crashed-worker-lease',
        lastError: null,
        resultMetadata: {
          dispatchState: 'DISPATCH_ATTEMPTED',
          dispatchAttemptedAt: new Date(baseNow.getTime() - 90_000).toISOString(),
          attemptNumber: 1,
        },
        createdAt: baseNow,
        updatedAt: baseNow,
        attemptedAt: null,
        completedAt: null,
        failedAt: null,
      }

      const updateManyMock = jest.fn().mockResolvedValue({ count: 1 })
      const mockDb = {
        eventCreationSideEffectOutbox: {
          findMany: jest.fn().mockResolvedValueOnce([mockInterruptedRecord]).mockResolvedValueOnce([
            { ...mockInterruptedRecord, status: 'AMBIGUOUS_OUTCOME' },
          ]),
          updateMany: updateManyMock,
        },
      }

      const result = await processPendingSideEffectOutboxItems({
        eventId: 'evt-ann-2',
        now: baseNow,
        prismaClient: mockDb,
      })

      // The new worker MUST NOT call dispatchNewEventAnnouncements!
      expect(followerAnnouncementsModule.dispatchNewEventAnnouncements).not.toHaveBeenCalled()

      // The record must transition to AMBIGUOUS_OUTCOME with requiresReconciliation: true
      expect(updateManyMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'outbox-interrupted', status: 'PROCESSING' }),
          data: expect.objectContaining({
            status: 'AMBIGUOUS_OUTCOME',
            lastError: expect.stringContaining('outcome is ambiguous. Automatic retry suppressed'),
            resultMetadata: expect.objectContaining({
              dispatchState: 'AMBIGUOUS',
              requiresReconciliation: true,
            }),
          }),
        })
      )

      expect(result.ambiguousCount).toBe(1)
      expect(result.deliveryEvidence.followerAnnouncements).toBe('AMBIGUOUS')
      expect(result.aggregateStatus).toBe('AMBIGUOUS')
    })

    it('Provider throw during dispatch marks AMBIGUOUS_OUTCOME rather than scheduling automatic retry', async () => {
      const mockRecord: EventCreationSideEffectOutboxRecord = {
        id: 'outbox-throw',
        idempotencyKey: 'prop_ann_3_FOLLOWER_ANNOUNCEMENT',
        eventId: 'evt-ann-3',
        creationProposalId: 'prop-ann-3',
        organizerId: 'org-ann-3',
        sideEffectType: 'FOLLOWER_ANNOUNCEMENT',
        status: 'PENDING',
        payload: { eventId: 'evt-ann-3', organizerId: 'org-ann-3' },
        attempts: 0,
        maxAttempts: 3,
        nextAttemptAt: baseNow,
        processingLeaseExpiresAt: null,
        leaseToken: null,
        lastError: null,
        resultMetadata: null,
        createdAt: baseNow,
        updatedAt: baseNow,
        attemptedAt: null,
        completedAt: null,
        failedAt: null,
      }

      ;(followerAnnouncementsModule.dispatchNewEventAnnouncements as jest.Mock).mockRejectedValueOnce(
        new Error('SMTP socket reset during email delivery')
      )

      const updateManyMock = jest.fn().mockResolvedValue({ count: 1 })
      const mockDb = {
        eventCreationSideEffectOutbox: {
          findMany: jest.fn().mockResolvedValueOnce([mockRecord]).mockResolvedValueOnce([
            { ...mockRecord, status: 'AMBIGUOUS_OUTCOME' },
          ]),
          updateMany: updateManyMock,
        },
      }

      const result = await processPendingSideEffectOutboxItems({
        eventId: 'evt-ann-3',
        now: baseNow,
        prismaClient: mockDb,
      })

      expect(updateManyMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'outbox-throw', status: 'PROCESSING' }),
          data: expect.objectContaining({
            status: 'AMBIGUOUS_OUTCOME',
            lastError: expect.stringContaining('Ambiguous dispatch failure: SMTP socket reset'),
            resultMetadata: expect.objectContaining({
              dispatchState: 'AMBIGUOUS',
              requiresReconciliation: true,
            }),
          }),
        })
      )

      expect(result.ambiguousCount).toBe(1)
      expect(result.deliveryEvidence.followerAnnouncements).toBe('AMBIGUOUS')
      expect(result.aggregateStatus).toBe('AMBIGUOUS')
    })

    it('reconcileOutboxItem allows operator to safely MARK_COMPLETED, MARK_FAILED, or RETRY_FORCE', async () => {
      const mockAmbiguous: EventCreationSideEffectOutboxRecord = {
        id: 'outbox-rec-1',
        idempotencyKey: 'prop_rec_1_FOLLOWER_ANNOUNCEMENT',
        eventId: 'evt-rec-1',
        creationProposalId: 'prop-rec-1',
        organizerId: 'org-rec-1',
        sideEffectType: 'FOLLOWER_ANNOUNCEMENT',
        status: 'AMBIGUOUS_OUTCOME',
        payload: { eventId: 'evt-rec-1', organizerId: 'org-rec-1' },
        attempts: 1,
        maxAttempts: 3,
        nextAttemptAt: baseNow,
        processingLeaseExpiresAt: null,
        leaseToken: null,
        lastError: 'Ambiguous outcome',
        resultMetadata: { dispatchState: 'AMBIGUOUS', requiresReconciliation: true },
        createdAt: baseNow,
        updatedAt: baseNow,
        attemptedAt: null,
        completedAt: null,
        failedAt: null,
      }

      const updateMock = jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...mockAmbiguous, ...data }))
      const mockDb = {
        eventCreationSideEffectOutbox: {
          findUnique: jest.fn().mockResolvedValue(mockAmbiguous),
          update: updateMock,
        },
      }

      // 1. Reconcile: MARK_COMPLETED
      const recCompleted = await reconcileOutboxItem({
        outboxItemId: 'outbox-rec-1',
        action: 'MARK_COMPLETED',
        notes: 'Verified via Resend dashboard that emails delivered successfully',
        prismaClient: mockDb,
      })
      expect(recCompleted.success).toBe(true)
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
            resultMetadata: expect.objectContaining({
              reconciled: true,
              reconciliationAction: 'MARK_COMPLETED',
              notes: 'Verified via Resend dashboard that emails delivered successfully',
            }),
          }),
        })
      )

      // 2. Reconcile: RETRY_FORCE
      const recRetry = await reconcileOutboxItem({
        outboxItemId: 'outbox-rec-1',
        action: 'RETRY_FORCE',
        notes: 'Operator confirmed no emails reached followers; force resending',
        prismaClient: mockDb,
      })
      expect(recRetry.success).toBe(true)
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING',
            resultMetadata: expect.objectContaining({
              reconciled: true,
              reconciliationAction: 'RETRY_FORCE',
              dispatchState: 'NOT_ATTEMPTED',
            }),
          }),
        })
      )
    })
  })

  describe('Calendar Sync Retry Idempotency', () => {
    it('skips duplicate Google Calendar creation if existing sync record already holds googleEventId', async () => {
      const mockRecord: EventCreationSideEffectOutboxRecord = {
        id: 'outbox-cal-idemp',
        idempotencyKey: 'prop_cal_idemp_CALENDAR_SYNC',
        eventId: 'evt-cal-idemp',
        creationProposalId: 'prop-cal-idemp',
        organizerId: 'org-cal-1',
        sideEffectType: 'CALENDAR_SYNC',
        status: 'PENDING',
        payload: {
          eventId: 'evt-cal-idemp',
          organizerId: 'org-cal-1',
          title: 'Design Sync',
          eventType: 'PHYSICAL',
          eventDate: '2026-11-05T10:00:00.000Z',
          slug: 'design-sync',
        },
        attempts: 1,
        maxAttempts: 5,
        nextAttemptAt: baseNow,
        processingLeaseExpiresAt: null,
        leaseToken: null,
        lastError: null,
        resultMetadata: null,
        createdAt: baseNow,
        updatedAt: baseNow,
        attemptedAt: null,
        completedAt: null,
        failedAt: null,
      }

      const updateManyMock = jest.fn().mockResolvedValue({ count: 1 })
      const mockDb = {
        eventCreationSideEffectOutbox: {
          findMany: jest.fn().mockResolvedValueOnce([mockRecord]).mockResolvedValueOnce([{ ...mockRecord, status: 'COMPLETED' }]),
          updateMany: updateManyMock,
        },
        calendarEventSync: {
          findUnique: jest.fn().mockResolvedValue({
            googleEventId: 'already-existing-google-event-id',
          }),
        },
      }

      const result = await processPendingSideEffectOutboxItems({
        eventId: 'evt-cal-idemp',
        now: baseNow,
        prismaClient: mockDb,
      })

      // createCalendarEvent should NOT be called because existingSync already has googleEventId!
      expect(googleCalendarModule.createCalendarEvent).not.toHaveBeenCalled()
      expect(result.succeededCount).toBe(1)
      expect(result.deliveryEvidence.calendarSync).toBe('CONFIRMED')
    })

    it('tolerates malformed mock output where findMany returns undefined without crashing', async () => {
      const mockDb = {
        eventCreationSideEffectOutbox: {
          // First call for pending items returns empty list, second call (evidence lookup) returns undefined (malformed mock)
          findMany: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(undefined),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      }

      const result = await processPendingSideEffectOutboxItems({
        eventId: 'evt-undefined-mock',
        now: baseNow,
        prismaClient: mockDb,
      })

      expect(result.processedCount).toBe(0)
      expect(result.aggregateStatus).toBe('NONE')
      expect(result.deliveryEvidence.referrals).toBe('SKIPPED')
    })

    it('handles database rejection during evidence query gracefully without crashing process', async () => {
      const mockDb = {
        eventCreationSideEffectOutbox: {
          findMany: jest
            .fn()
            .mockResolvedValueOnce([]) // Pending items query
            .mockRejectedValueOnce(new Error('Connection terminated unexpectedly')), // Evidence query
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      }

      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await processPendingSideEffectOutboxItems({
        eventId: 'evt-db-error',
        now: baseNow,
        prismaClient: mockDb,
      })

      expect(result.processedCount).toBe(0)
      expect(result.aggregateStatus).toBe('NONE')
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[processPendingSideEffectOutboxItems] Warning querying persisted evidence items:'),
        expect.any(Error)
      )

      warnSpy.mockRestore()
    })
  })
})
