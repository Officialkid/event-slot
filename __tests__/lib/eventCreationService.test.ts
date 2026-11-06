import {
  createEventDomainService,
  generateSlug,
  getDurationMins,
  dispatchEventCreationSideEffects,
  EventCreationActorContext,
  EventCreationInput,
} from '@/lib/events/event-creation-service'
import prisma from '@/lib/prisma'
import { canCreateEvent } from '@/lib/planEnforcement'
import { processFirstEventReferral, scoreEventCreation } from '@/lib/referral'
import { createCalendarEvent } from '@/lib/googleCalendar'
import { dispatchNewEventAnnouncements } from '@/services/notifications/followerAnnouncements'
import { purgeUserCache } from '@/lib/cache'
import { Prisma } from '@prisma/client'

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    teamMember: {
      findFirst: jest.fn(),
    },
    event: {
      create: jest.fn(),
      count: jest.fn(),
    },
    calendarEventSync: {
      upsert: jest.fn(),
    },
  },
}))

jest.mock('@/lib/planEnforcement', () => ({
  canCreateEvent: jest.fn(),
}))

jest.mock('@/lib/effectivePlanPolicy', () => {
  const actual = jest.requireActual('@/lib/effectivePlanPolicy')
  return {
    ...actual,
    getEffectivePlanPolicy: jest.fn((plan: string) => {
      if (plan === 'free') {
        return {
          key: 'free',
          displayName: 'Free',
          maxAttendeesPerEvent: 55,
          maxActiveEvents: 1,
          maxWaitlistPerEvent: 0,
          hasWaitlist: false,
          hasPayg: true,
          pricingActive: true,
        }
      }
      return {
        key: 'pro',
        displayName: 'Pro',
        maxAttendeesPerEvent: 1000,
        maxActiveEvents: 20,
        maxWaitlistPerEvent: 500,
        hasWaitlist: true,
        hasPayg: true,
        pricingActive: true,
      }
    }),
    getNextPlanKey: jest.fn((plan: string) => (plan === 'free' ? 'standard' : 'pro')),
  }
})

jest.mock('@/lib/referral', () => ({
  processFirstEventReferral: jest.fn(),
  scoreEventCreation: jest.fn(),
}))

jest.mock('@/lib/googleCalendar', () => ({
  createCalendarEvent: jest.fn(),
}))

jest.mock('@/services/notifications/followerAnnouncements', () => ({
  dispatchNewEventAnnouncements: jest.fn(),
}))

jest.mock('@/lib/cache', () => ({
  purgeUserCache: jest.fn(),
}))

const mockedPrisma = prisma as unknown as {
  user: {
    findUnique: jest.Mock
    findFirst: jest.Mock
  }
  teamMember: {
    findFirst: jest.Mock
  }
  event: {
    create: jest.Mock
    count: jest.Mock
  }
  calendarEventSync: {
    upsert: jest.Mock
  }
}

const mockedCanCreateEvent = canCreateEvent as jest.Mock
const mockedProcessFirstEventReferral = processFirstEventReferral as jest.Mock
const mockedScoreEventCreation = scoreEventCreation as jest.Mock
const mockedCreateCalendarEvent = createCalendarEvent as jest.Mock
const mockedDispatchNewEventAnnouncements = dispatchNewEventAnnouncements as jest.Mock
const mockedPurgeUserCache = purgeUserCache as jest.Mock

describe('event-creation-service', () => {
  const baseActor: EventCreationActorContext = {
    userId: 'user-actor-1',
    userEmail: 'actor@example.com',
    isAdmin: false,
  }

  const baseInput: EventCreationInput = {
    title: 'Tech Meetup 2026',
    description: 'A great meetup for builders',
    visibility: 'PRIVATE',
    accessType: 'REGISTRATION',
    eventType: 'PHYSICAL',
    location: 'Nairobi Garage, Kilimani',
    capacity: 50,
    hasSpecificTime: true,
    isMultiDay: false,
    isRecurring: false,
    showRemainingSpots: true,
    attendeeConsentEnabled: true,
    contactMode: 'WHATSAPP',
    isPaid: false,
    ticketTiers: [],
    questions: [],
    organizerName: 'Tech Community',
    organizerEmail: 'organizer@example.com',
    groupRegistrationEnabled: false,
    allowGroupSelfClaim: true,
    timedDropEnabled: false,
    dropWaitlistOnExpire: true,
  }

  beforeEach(() => {
    jest.clearAllMocks()

    mockedPrisma.user.findUnique.mockResolvedValue({
      id: 'user-actor-1',
      email: 'actor@example.com',
      plan: 'free',
      name: 'Actor Name',
    })

    mockedCanCreateEvent.mockResolvedValue({ allowed: true })

    mockedPrisma.event.create.mockImplementation(async ({ data }: any) => ({
      id: 'event-uuid-1',
      title: data.title,
      slug: data.slug,
      dashboardToken: data.dashboardToken,
      verifierCode: data.verifierCode,
      visibility: data.visibility,
      accessType: data.accessType,
      capacity: data.capacity,
    }))

    mockedPrisma.event.count.mockResolvedValue(1)
    mockedPrisma.calendarEventSync.upsert.mockResolvedValue({})
    mockedProcessFirstEventReferral.mockResolvedValue(undefined)
    mockedScoreEventCreation.mockResolvedValue(undefined)
    mockedCreateCalendarEvent.mockResolvedValue({})
    mockedDispatchNewEventAnnouncements.mockResolvedValue({ sent: 0, skipped: 0 })
  })

  describe('slug generation & duration helpers', () => {
    it('generates a clean slug with random suffix', () => {
      const slug = generateSlug('Annual Hackathon 2026!')
      expect(slug).toMatch(/^annual-hackathon-2026-[a-z0-9]{4}$/)
    })

    it('calculates duration in minutes properly', () => {
      const start = '2026-11-01T10:00:00.000Z'
      const end = '2026-11-01T12:30:00.000Z'
      expect(getDurationMins(start, end)).toBe(150)
      expect(getDurationMins(null, null)).toBe(120)
    })
  })

  describe('personal event creation', () => {
    it('creates an event under the personal account when asOrganizationId is omitted', async () => {
      const result = await createEventDomainService({
        actor: baseActor,
        input: baseInput,
        sideEffects: false,
      })

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.event.title).toBe('Tech Meetup 2026')
        expect(result.event.slug).toBeTruthy()
      }

      expect(mockedPrisma.event.create).toHaveBeenCalledTimes(1)
      const createData = mockedPrisma.event.create.mock.calls[0][0].data
      expect(createData.organizerId).toBe('user-actor-1')
      expect(createData.organizerEmail).toBe('organizer@example.com')
      expect(mockedCanCreateEvent).toHaveBeenCalledWith('user-actor-1', 'actor@example.com')
    })
  })

  describe('workspace authorization & unsafe fallback elimination', () => {
    it('creates an event in a workspace when the actor is an accepted team member', async () => {
      mockedPrisma.teamMember.findFirst.mockResolvedValue({
        id: 'tm-1',
        memberId: 'user-actor-1',
        ownerId: 'org-123',
        status: 'accepted',
      })

      mockedPrisma.user.findFirst.mockResolvedValue({
        id: 'org-123',
        email: 'workspace@example.com',
        plan: 'pro',
        name: 'Workspace Inc',
      })

      const result = await createEventDomainService({
        actor: baseActor,
        input: {
          ...baseInput,
          asOrganizationId: 'org-123',
          organizerEmail: '',
        },
        sideEffects: false,
      })

      expect(result.success).toBe(true)
      expect(mockedPrisma.teamMember.findFirst).toHaveBeenCalledWith({
        where: {
          memberId: 'user-actor-1',
          ownerId: 'org-123',
          status: 'accepted',
        },
      })
      expect(mockedCanCreateEvent).toHaveBeenCalledWith('org-123', 'workspace@example.com')
      const createData = mockedPrisma.event.create.mock.calls[0][0].data
      expect(createData.organizerId).toBe('org-123')
      expect(createData.organizerEmail).toBe('workspace@example.com')
    })

    it('allows a super-admin to create an event in any workspace without team membership', async () => {
      mockedPrisma.teamMember.findFirst.mockResolvedValue(null)
      mockedPrisma.user.findFirst.mockResolvedValue({
        id: 'org-target-99',
        email: 'target@org.com',
        plan: 'pro',
        name: 'Target Org',
      })

      const adminActor: EventCreationActorContext = {
        userId: 'admin-user-id',
        userEmail: 'admin@event-slot.com',
        isAdmin: true,
      }

      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 'admin-user-id',
        email: 'admin@event-slot.com',
        plan: 'pro',
        name: 'Admin',
      })

      const result = await createEventDomainService({
        actor: adminActor,
        input: {
          ...baseInput,
          asOrganizationId: 'org-target-99',
        },
        sideEffects: false,
      })

      expect(result.success).toBe(true)
      const createData = mockedPrisma.event.create.mock.calls[0][0].data
      expect(createData.organizerId).toBe('org-target-99')
    })

    it('STRICT SECURITY: rejects unauthorized workspace selection with 403 Forbidden without falling back to personal account', async () => {
      mockedPrisma.teamMember.findFirst.mockResolvedValue(null) // Not a team member

      const result = await createEventDomainService({
        actor: baseActor, // Non-admin
        input: {
          ...baseInput,
          asOrganizationId: 'secret-unauthorized-org',
        },
        sideEffects: false,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(403)
        expect(result.code).toBe('FORBIDDEN')
        expect(result.error).toBe('You are not authorized to create events in this workspace.')
      }

      // CRITICAL: Ensure event was NEVER created in personal account!
      expect(mockedPrisma.event.create).not.toHaveBeenCalled()
    })

    it('rejects pending or non-accepted workspace memberships with 403 Forbidden', async () => {
      // Prisma query specifically checks status: 'accepted', so findFirst returns null for pending/rejected
      mockedPrisma.teamMember.findFirst.mockResolvedValue(null)

      const result = await createEventDomainService({
        actor: baseActor,
        input: {
          ...baseInput,
          asOrganizationId: 'pending-invite-org',
        },
        sideEffects: false,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(403)
        expect(result.code).toBe('FORBIDDEN')
      }
      expect(mockedPrisma.event.create).not.toHaveBeenCalled()
    })

    it('returns 404 when authorized workspace account does not exist', async () => {
      mockedPrisma.teamMember.findFirst.mockResolvedValue({
        id: 'tm-1',
        memberId: 'user-actor-1',
        ownerId: 'deleted-org',
        status: 'accepted',
      })
      mockedPrisma.user.findFirst.mockResolvedValue(null) // Target org not found

      const result = await createEventDomainService({
        actor: baseActor,
        input: {
          ...baseInput,
          asOrganizationId: 'deleted-org',
        },
        sideEffects: false,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(404)
        expect(result.code).toBe('WORKSPACE_NOT_FOUND')
      }
      expect(mockedPrisma.event.create).not.toHaveBeenCalled()
    })
  })

  describe('plan enforcement', () => {
    it('evaluates plan creation cap on the workspace owner and rejects with PLAN_LIMIT_EVENTS', async () => {
      mockedPrisma.teamMember.findFirst.mockResolvedValue({
        id: 'tm-1',
        memberId: 'user-actor-1',
        ownerId: 'org-capped',
        status: 'accepted',
      })
      mockedPrisma.user.findFirst.mockResolvedValue({
        id: 'org-capped',
        email: 'capped@org.com',
        plan: 'free',
        name: 'Capped Org',
      })

      mockedCanCreateEvent.mockResolvedValue({
        allowed: false,
        reason: 'Monthly event limit reached for this workspace.',
        upgradeRequired: 'pro',
      })

      const result = await createEventDomainService({
        actor: baseActor,
        input: {
          ...baseInput,
          asOrganizationId: 'org-capped',
        },
        sideEffects: false,
      })

      expect(mockedCanCreateEvent).toHaveBeenCalledWith('org-capped', 'capped@org.com')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(403)
        expect(result.code).toBe('PLAN_LIMIT_EVENTS')
        expect(result.upgradeRequired).toBe('pro')
      }
      expect(mockedPrisma.event.create).not.toHaveBeenCalled()
    })

    it('enforces attendee capacity limit based on effective plan policy', async () => {
      mockedPrisma.user.findUnique.mockResolvedValue({
        id: 'user-actor-1',
        email: 'actor@example.com',
        plan: 'free', // Free plan has attendee cap (e.g. 100)
        name: 'Actor',
      })

      const result = await createEventDomainService({
        actor: baseActor,
        input: {
          ...baseInput,
          capacity: 5000, // Exceeds free plan
        },
        sideEffects: false,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(403)
        expect(result.code).toBe('PLAN_LIMIT_ATTENDEES')
        expect(result.limit).toBeDefined()
      }
      expect(mockedPrisma.event.create).not.toHaveBeenCalled()
    })
  })

  describe('domain rules & validations', () => {
    it('validates and encrypts meeting link for virtual events', async () => {
      const result = await createEventDomainService({
        actor: baseActor,
        input: {
          ...baseInput,
          eventType: 'VIRTUAL',
          virtualLink: 'https://meet.google.com/abc-defg-hij',
        },
        sideEffects: false,
      })

      expect(result.success).toBe(true)
      const createData = mockedPrisma.event.create.mock.calls[0][0].data
      expect(createData.virtualLink).toBeDefined()
      expect(createData.virtualLinkIv).toBeDefined()
      expect(createData.location).toBe('Online - Google Meet')
    })

    it('rejects virtual events without a valid meeting link', async () => {
      const result = await createEventDomainService({
        actor: baseActor,
        input: {
          ...baseInput,
          eventType: 'VIRTUAL',
          virtualLink: '',
        },
        sideEffects: false,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
        expect(result.field).toBe('virtualLink')
      }
    })

    it('rejects walk-in events without a poster image', async () => {
      const result = await createEventDomainService({
        actor: baseActor,
        input: {
          ...baseInput,
          accessType: 'WALK_IN',
          imageUrl: undefined,
        },
        sideEffects: false,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
        expect(result.error).toContain('Walk-in events need a poster image')
      }
    })

    it('rejects public events without a poster image', async () => {
      const result = await createEventDomainService({
        actor: baseActor,
        input: {
          ...baseInput,
          visibility: 'PUBLIC',
          imageUrl: undefined,
        },
        sideEffects: false,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
        expect(result.error).toContain('Public events require a poster image')
      }
    })

    it('validates registration questions requiring options', async () => {
      const result = await createEventDomainService({
        actor: baseActor,
        input: {
          ...baseInput,
          questions: [
            {
              id: 'q1',
              label: 'Dietary preference',
              type: 'select',
              options: [], // Missing options
            },
          ],
        },
        sideEffects: false,
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(400)
        expect(result.error).toContain('needs at least one option')
      }
    })
  })

  describe('proposal correlation and transaction client', () => {
    it('passes creationProposalId to event.create when provided', async () => {
      const result = await createEventDomainService({
        actor: baseActor,
        input: baseInput,
        sideEffects: false,
        creationProposalId: 'prop_999888',
      })

      expect(result.success).toBe(true)
      expect(mockedPrisma.event.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creationProposalId: 'prop_999888',
          }),
        })
      )
    })

    it('uses provided tx transaction client for all database operations', async () => {
      const mockTx = {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'user-actor-1',
            email: 'actor@example.com',
            plan: 'free',
            name: 'Actor User',
          }),
        },
        event: {
          create: jest.fn().mockResolvedValue({
            id: 'event-uuid-tx',
            title: baseInput.title,
            slug: 'tech-meetup-2026-tx',
            dashboardToken: 'token-tx',
            verifierCode: 'V123',
            visibility: 'PRIVATE',
            accessType: 'REGISTRATION',
            capacity: 50,
          }),
        },
      }

      const result = await createEventDomainService({
        actor: baseActor,
        input: baseInput,
        sideEffects: false,
        tx: mockTx as any,
      })

      expect(result.success).toBe(true)
      expect(mockTx.user.findUnique).toHaveBeenCalled()
      expect(mockTx.event.create).toHaveBeenCalled()
      // Global prisma.event.create should NOT have been called
      expect(mockedPrisma.event.create).not.toHaveBeenCalled()
    })

    it('catches P2002 conflict on creationProposalId and returns 409 PROPOSAL_ALREADY_EXECUTED', async () => {
      const p2002ProposalError = new Prisma.PrismaClientKnownRequestError('Proposal unique conflict', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['creationProposalId'] },
      })

      mockedPrisma.event.create.mockRejectedValueOnce(p2002ProposalError)

      const result = await createEventDomainService({
        actor: baseActor,
        input: baseInput,
        sideEffects: false,
        creationProposalId: 'prop_already_executed',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.status).toBe(409)
        expect(result.code).toBe('PROPOSAL_ALREADY_EXECUTED')
        expect(result.error).toContain('already been created for this confirmation proposal')
      }
    })
  })

  describe('slug collision retry loop', () => {
    it('retries slug allocation on unique constraint conflict', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['slug'] },
      })

      mockedPrisma.event.create
        .mockRejectedValueOnce(p2002Error)
        .mockResolvedValueOnce({
          id: 'event-uuid-retry',
          title: baseInput.title,
          slug: 'tech-meetup-2026-retry',
          dashboardToken: 'token-retry',
          verifierCode: 'V123',
          visibility: 'PRIVATE',
          accessType: 'REGISTRATION',
          capacity: 50,
        })

      const result = await createEventDomainService({
        actor: baseActor,
        input: baseInput,
        sideEffects: false,
      })

      expect(result.success).toBe(true)
      expect(mockedPrisma.event.create).toHaveBeenCalledTimes(2)
    })
  })

  describe('side effects decoupling', () => {
    it('does not execute external side effects when sideEffects is false', async () => {
      const result = await createEventDomainService({
        actor: baseActor,
        input: baseInput,
        sideEffects: false,
      })

      expect(result.success).toBe(true)
      expect(mockedProcessFirstEventReferral).not.toHaveBeenCalled()
      expect(mockedScoreEventCreation).not.toHaveBeenCalled()
      expect(mockedCreateCalendarEvent).not.toHaveBeenCalled()
      expect(mockedDispatchNewEventAnnouncements).not.toHaveBeenCalled()
    })

    it('executes side effects safely when sideEffects is true and tolerates side effect errors', async () => {
      mockedCreateCalendarEvent.mockRejectedValueOnce(new Error('Google Calendar API rate limit'))
      mockedScoreEventCreation.mockRejectedValueOnce(new Error('Scoring redis error'))

      const result = await createEventDomainService({
        actor: baseActor,
        input: {
          ...baseInput,
          eventDate: '2026-11-01T10:00:00.000Z',
        },
        sideEffects: true,
      })

      // Creation still succeeds despite side effect errors
      expect(result.success).toBe(true)
      expect(mockedPurgeUserCache).toHaveBeenCalledWith('user-actor-1', 'actor@example.com')
      if (result.success) {
        expect(result.sideEffectsSummary).toBeDefined()
        expect(result.sideEffectsSummary?.cachePurged).toBe(true)
      }
    })
  })
})
