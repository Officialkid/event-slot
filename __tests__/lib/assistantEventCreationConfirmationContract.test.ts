/** @jest-environment node */

import {
  prepareEventCreationProposalFromDraft,
  executeConfirmedEventCreationProposal,
  validateDraftReadyForCreationConfirmation,
  type PendingActionPersistenceStore,
  type PendingActionProposal,
  type EventCreationDomainService,
} from "@/lib/assistant/confirmation-engine"
import {
  prepareEventDraftPreview,
  clearSessionDraftPreview,
  type EventDraftPreview,
} from "@/lib/assistant/draft-preparation"

const mockEventCreate = jest.fn()
const mockEventUpdate = jest.fn()

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    event: {
      create: (...args: unknown[]) => mockEventCreate(...args),
      update: (...args: unknown[]) => mockEventUpdate(...args),
    },
  },
  prisma: {
    event: {
      create: (...args: unknown[]) => mockEventCreate(...args),
      update: (...args: unknown[]) => mockEventUpdate(...args),
    },
  },
}))

/**
 * Creates an in-memory transactional mock of `PendingActionPersistenceStore` for testing
 * the confirmation lifecycle, atomic CAS state transitions, and concurrency guarantees.
 */
function createMockDurablePersistenceStore(): PendingActionPersistenceStore {
  const store = new Map<string, PendingActionProposal<any>>()

  return {
    isDurableDatabaseStore: true,

    async savePendingProposal(proposal) {
      store.set(proposal.proposalId, { ...proposal })
      return { ...proposal }
    },

    async getProposalById(proposalId) {
      const found = store.get(proposalId)
      return found ? ({ ...found } as any) : null
    },

    async invalidatePendingProposalsForDraft(params) {
      let count = 0
      for (const [id, prop] of store.entries()) {
        if (
          prop.authorization.actorId === params.actorId &&
          prop.authorization.draftId === params.draftId &&
          prop.status === "PENDING"
        ) {
          store.set(id, {
            ...prop,
            status: "CANCELLED",
            cancelledAt: (params.now ?? new Date()).toISOString(),
            failureReason: params.reason,
          })
          count += 1
        }
      }
      return count
    },

    async claimPendingProposalForExecution(params) {
      const prop = store.get(params.proposalId)
      if (
        !prop ||
        prop.status !== "PENDING" ||
        prop.idempotencyKey !== params.idempotencyKey
      ) {
        return false
      }
      // Atomic compare-and-swap simulation
      store.set(params.proposalId, {
        ...prop,
        status: "EXECUTING",
      })
      return true
    },

    async markProposalCompleted(params) {
      const prop = store.get(params.proposalId)
      if (!prop) return null
      const updated = {
        ...prop,
        status: "COMPLETED" as const,
        executedAt: params.now.toISOString(),
        resultMetadata: params.resultMetadata,
      }
      store.set(params.proposalId, updated)
      return updated as any
    },

    async markProposalFailed(params) {
      const prop = store.get(params.proposalId)
      if (!prop) return null
      const updated = {
        ...prop,
        status: "FAILED" as const,
        failedAt: params.now.toISOString(),
        failureReason: params.failureReason,
      }
      store.set(params.proposalId, updated)
      return updated as any
    },

    async markProposalCancelled(params) {
      const prop = store.get(params.proposalId)
      if (!prop) return null
      const updated = {
        ...prop,
        status: "CANCELLED" as const,
        cancelledAt: params.now.toISOString(),
      }
      store.set(params.proposalId, updated)
      return updated as any
    },

    async markProposalExpired(params) {
      const prop = store.get(params.proposalId)
      if (!prop) return null
      const updated = {
        ...prop,
        status: "EXPIRED" as const,
      }
      store.set(params.proposalId, updated)
      return updated as any
    },
  }
}

describe("ESA Phase 1, Prompt 2 — Confirmation-Gated Event Creation Lifecycle Contract", () => {
  const actor = {
    userId: "user-organizer-1",
    userEmail: "organizer@example.com",
    userRole: "organizer",
    workspaceOrganizerId: null,
    organizerName: "Kenya Tech Founders",
  }

  let mockCreationService: EventCreationDomainService

  beforeEach(() => {
    jest.clearAllMocks()
    clearSessionDraftPreview("user-organizer-1", "sess-test-1")
    mockCreationService = {
      createEventFromValidatedDraft: jest.fn().mockResolvedValue({
        eventId: "evt_created_123",
        slug: "nairobi-founders-summit-f4k1",
        title: "Nairobi Founders Summit",
        visibility: "PRIVATE",
        accessType: "REGISTRATION",
        status: "active",
        capacity: 200,
      }),
    }
  })

  describe("1. Persistence Availability & Fail-Closed Guard", () => {
    it("fails closed with PERSISTENCE_UNAVAILABLE when durable persistence is null or not a verified database store", async () => {
      const completeDraft = await prepareEventDraftPreview({
        userId: actor.userId,
        sessionId: "sess-test-1",
        defaultOrganizerName: actor.organizerName,
        messageText:
          "Create event: Title: Nairobi Founders Summit, Date: 2026-11-20 09:00, Venue: Radisson Blu, capacity: 200",
      })

      // 1. Without persistence store
      const prepWithoutDb = await prepareEventCreationProposalFromDraft({
        actor,
        sessionId: "sess-test-1",
        draft: completeDraft,
        persistenceStore: null,
      })
      expect(prepWithoutDb.ok).toBe(false)
      expect(prepWithoutDb.code).toBe("PERSISTENCE_UNAVAILABLE")

      // 2. Execution without persistence store
      const execWithoutDb = await executeConfirmedEventCreationProposal({
        proposalId: "prop_123",
        idempotencyKey: "key_123",
        confirmingActor: actor,
        sessionId: "sess-test-1",
        currentDraft: completeDraft,
        persistenceStore: null,
        revalidatePermissionsAndState: async () => ({ allowed: true }),
        creationService: mockCreationService,
      })
      expect(execWithoutDb.ok).toBe(false)
      expect(execWithoutDb.code).toBe("PERSISTENCE_UNAVAILABLE")
      expect(mockCreationService.createEventFromValidatedDraft).not.toHaveBeenCalled()
    })
  })

  describe("2. Draft Completeness & Business Validation", () => {
    it("rejects proposal preparation and execution for incomplete, contradictory, or schema-invalid drafts", async () => {
      const persistenceStore = createMockDurablePersistenceStore()

      // Incomplete draft (missing eventDate and venue)
      const incompleteDraft = await prepareEventDraftPreview({
        userId: actor.userId,
        sessionId: "sess-test-1",
        defaultOrganizerName: actor.organizerName,
        messageText: "Prepare draft for 'Founders Dinner'",
      })

      expect(incompleteDraft.schemaValid).toBe(false)
      expect(incompleteDraft.missingFields.length).toBeGreaterThan(0)

      const prepIncomplete = await prepareEventCreationProposalFromDraft({
        actor,
        sessionId: "sess-test-1",
        draft: incompleteDraft,
        persistenceStore,
      })
      expect(prepIncomplete.ok).toBe(false)
      expect(prepIncomplete.code).toBe("INVALID_DRAFT")

      // Contradictory draft (free + paid conflict)
      const contradictoryDraft = await prepareEventDraftPreview({
        userId: actor.userId,
        sessionId: "sess-test-1",
        defaultOrganizerName: actor.organizerName,
        messageText:
          "Title: Free Conference, Date: 2026-12-01 10:00, Venue: KICC, Free event, Ticket Price: KES 2000",
      })
      expect(contradictoryDraft.uncertainFields.length).toBeGreaterThan(0)

      const prepContradictory = await prepareEventCreationProposalFromDraft({
        actor,
        sessionId: "sess-test-1",
        draft: contradictoryDraft,
        persistenceStore,
      })
      expect(prepContradictory.ok).toBe(false)
      expect(prepContradictory.code).toBe("INVALID_DRAFT")
    })
  })

  describe("3. Draft Version Binding & Invalidation on Edit", () => {
    it("binds confirmation to the exact draftVersion and invalidates old proposals when the draft is modified", async () => {
      const persistenceStore = createMockDurablePersistenceStore()

      // Version 1 of draft
      const draftV1 = await prepareEventDraftPreview({
        userId: actor.userId,
        sessionId: "sess-test-1",
        defaultOrganizerName: actor.organizerName,
        messageText:
          "Title: Nairobi Founders Summit, Date: 2026-11-20 09:00, Venue: Radisson Blu, capacity: 200",
      })
      expect(draftV1.schemaValid).toBe(true)

      const prepV1 = await prepareEventCreationProposalFromDraft({
        actor,
        sessionId: "sess-test-1",
        draft: draftV1,
        persistenceStore,
      })
      expect(prepV1.ok).toBe(true)
      const proposalV1 = prepV1.proposal!
      expect(proposalV1.authorization.draftVersion).toBe(draftV1.draftVersion)

      // Organizer edits the draft (changes capacity to 350) -> creates Version 2
      const draftV2 = await prepareEventDraftPreview({
        userId: actor.userId,
        sessionId: "sess-test-1",
        defaultOrganizerName: actor.organizerName,
        messageText: "Update draft: capacity: 350",
      })
      expect(draftV2.draftVersion).not.toBe(draftV1.draftVersion)

      // Attempting to confirm proposalV1 with the modified draft is rejected
      const execMismatch = await executeConfirmedEventCreationProposal({
        proposalId: proposalV1.proposalId,
        idempotencyKey: proposalV1.idempotencyKey,
        confirmingActor: actor,
        sessionId: "sess-test-1",
        currentDraft: draftV2,
        persistenceStore,
        revalidatePermissionsAndState: async () => ({ allowed: true }),
        creationService: mockCreationService,
      })

      expect(execMismatch.ok).toBe(false)
      expect(execMismatch.code).toBe("DRAFT_VERSION_MISMATCH")
      expect(mockCreationService.createEventFromValidatedDraft).not.toHaveBeenCalled()
    })
  })

  describe("4. Actor, Session, and Workspace Authorization Guards", () => {
    it("blocks confirmation from a different user, mismatched session, or mismatched workspace context", async () => {
      const persistenceStore = createMockDurablePersistenceStore()

      const draft = await prepareEventDraftPreview({
        userId: actor.userId,
        sessionId: "sess-test-1",
        defaultOrganizerName: actor.organizerName,
        messageText:
          "Title: Nairobi Tech Mixer, Date: 2026-11-25 18:00, Venue: iHub, capacity: 80",
      })

      const prep = await prepareEventCreationProposalFromDraft({
        actor,
        sessionId: "sess-test-1",
        draft,
        persistenceStore,
      })
      const proposal = prep.proposal!

      // 1. Different actor
      const wrongActor = await executeConfirmedEventCreationProposal({
        proposalId: proposal.proposalId,
        idempotencyKey: proposal.idempotencyKey,
        confirmingActor: { ...actor, userId: "malicious-user-999" },
        sessionId: "sess-test-1",
        currentDraft: draft,
        persistenceStore,
        revalidatePermissionsAndState: async () => ({ allowed: true }),
        creationService: mockCreationService,
      })
      expect(wrongActor.ok).toBe(false)
      expect(wrongActor.code).toBe("ACTOR_MISMATCH")

      // 2. Mismatched session
      const wrongSession = await executeConfirmedEventCreationProposal({
        proposalId: proposal.proposalId,
        idempotencyKey: proposal.idempotencyKey,
        confirmingActor: actor,
        sessionId: "sess-other-device-456",
        currentDraft: draft,
        persistenceStore,
        revalidatePermissionsAndState: async () => ({ allowed: true }),
        creationService: mockCreationService,
      })
      expect(wrongSession.ok).toBe(false)
      expect(wrongSession.code).toBe("SESSION_MISMATCH")

      // 3. Mismatched workspace
      const wrongWorkspace = await executeConfirmedEventCreationProposal({
        proposalId: proposal.proposalId,
        idempotencyKey: proposal.idempotencyKey,
        confirmingActor: { ...actor, workspaceOrganizerId: "org-foreign-corp" },
        sessionId: "sess-test-1",
        currentDraft: draft,
        persistenceStore,
        revalidatePermissionsAndState: async () => ({ allowed: true }),
        creationService: mockCreationService,
      })
      expect(wrongWorkspace.ok).toBe(false)
      expect(wrongWorkspace.code).toBe("WORKSPACE_MISMATCH")

      // 4. Permission revalidation failure immediately before execution
      const revalDenied = await executeConfirmedEventCreationProposal({
        proposalId: proposal.proposalId,
        idempotencyKey: proposal.idempotencyKey,
        confirmingActor: actor,
        sessionId: "sess-test-1",
        currentDraft: draft,
        persistenceStore,
        revalidatePermissionsAndState: async () => ({
          allowed: false,
          reason: "Plan limit reached: maximum active events exceeded.",
        }),
        creationService: mockCreationService,
      })
      expect(revalDenied.ok).toBe(false)
      expect(revalDenied.code).toBe("REVALIDATION_FAILED")
      expect(mockCreationService.createEventFromValidatedDraft).not.toHaveBeenCalled()
    })
  })

  describe("5. Expiry, Idempotency, and Concurrency Serialization", () => {
    it("rejects expired proposals, prevents duplicate execution, and serializes concurrent requests without creating duplicate events", async () => {
      const persistenceStore = createMockDurablePersistenceStore()
      const baseTime = new Date("2026-10-27T10:00:00Z")

      const draft = await prepareEventDraftPreview({
        userId: actor.userId,
        sessionId: "sess-test-1",
        defaultOrganizerName: actor.organizerName,
        messageText:
          "Title: East Africa Cloud Days, Date: 2026-12-05 09:00, Venue: Trademark Hotel, capacity: 150",
      })

      const prep = await prepareEventCreationProposalFromDraft({
        actor,
        sessionId: "sess-test-1",
        draft,
        persistenceStore,
        ttlSeconds: 300,
        now: baseTime,
      })
      const proposal = prep.proposal!

      // 1. Expired proposal (after 10 minutes)
      const expiredTime = new Date(baseTime.getTime() + 600 * 1000)
      const expiredExec = await executeConfirmedEventCreationProposal({
        proposalId: proposal.proposalId,
        idempotencyKey: proposal.idempotencyKey,
        confirmingActor: actor,
        sessionId: "sess-test-1",
        currentDraft: draft,
        persistenceStore,
        revalidatePermissionsAndState: async () => ({ allowed: true }),
        creationService: mockCreationService,
        now: expiredTime,
      })
      expect(expiredExec.ok).toBe(false)
      expect(expiredExec.code).toBe("PROPOSAL_EXPIRED")
      expect(mockCreationService.createEventFromValidatedDraft).not.toHaveBeenCalled()

      // 2. Fresh proposal executed concurrently (double-click simulation)
      const prepFresh = await prepareEventCreationProposalFromDraft({
        actor,
        sessionId: "sess-test-1",
        draft,
        persistenceStore,
        now: baseTime,
      })
      const freshProposal = prepFresh.proposal!

      const [res1, res2] = await Promise.all([
        executeConfirmedEventCreationProposal({
          proposalId: freshProposal.proposalId,
          idempotencyKey: freshProposal.idempotencyKey,
          confirmingActor: actor,
          sessionId: "sess-test-1",
          currentDraft: draft,
          persistenceStore,
          revalidatePermissionsAndState: async () => ({ allowed: true }),
          creationService: mockCreationService,
          now: baseTime,
        }),
        executeConfirmedEventCreationProposal({
          proposalId: freshProposal.proposalId,
          idempotencyKey: freshProposal.idempotencyKey,
          confirmingActor: actor,
          sessionId: "sess-test-1",
          currentDraft: draft,
          persistenceStore,
          revalidatePermissionsAndState: async () => ({ allowed: true }),
          creationService: mockCreationService,
          now: baseTime,
        }),
      ])

      // Exactly one succeeds and creates the event; the concurrent replay is safely rejected
      const successes = [res1, res2].filter((r) => r.ok && r.code === "COMPLETED")
      const rejections = [res1, res2].filter((r) => !r.ok && r.code === "PROPOSAL_NOT_PENDING")

      expect(successes).toHaveLength(1)
      expect(rejections).toHaveLength(1)
      expect(mockCreationService.createEventFromValidatedDraft).toHaveBeenCalledTimes(1)
      expect(successes[0].createdEvent?.eventId).toBe("evt_created_123")

      // 3. Repeated post-completion replay attempt is also rejected
      const replay = await executeConfirmedEventCreationProposal({
        proposalId: freshProposal.proposalId,
        idempotencyKey: freshProposal.idempotencyKey,
        confirmingActor: actor,
        sessionId: "sess-test-1",
        currentDraft: draft,
        persistenceStore,
        revalidatePermissionsAndState: async () => ({ allowed: true }),
        creationService: mockCreationService,
        now: baseTime,
      })
      expect(replay.ok).toBe(false)
      expect(replay.code).toBe("PROPOSAL_NOT_PENDING")
      expect(mockCreationService.createEventFromValidatedDraft).toHaveBeenCalledTimes(1)
    })
  })

  describe("6. Domain Service Failure & Truthful Non-Fabrication", () => {
    it("transitions proposal to FAILED and returns EXECUTION_FAILED if domain service throws, never fabricating success", async () => {
      const persistenceStore = createMockDurablePersistenceStore()

      const failingCreationService: EventCreationDomainService = {
        createEventFromValidatedDraft: jest
          .fn()
          .mockRejectedValue(new Error("Slug collision after maximum retries.")),
      }

      const draft = await prepareEventDraftPreview({
        userId: actor.userId,
        sessionId: "sess-test-1",
        defaultOrganizerName: actor.organizerName,
        messageText:
          "Title: DevOps Safari, Date: 2026-11-28 10:00, Venue: Serena Hotel, capacity: 100",
      })

      const prep = await prepareEventCreationProposalFromDraft({
        actor,
        sessionId: "sess-test-1",
        draft,
        persistenceStore,
      })
      const proposal = prep.proposal!

      const execFail = await executeConfirmedEventCreationProposal({
        proposalId: proposal.proposalId,
        idempotencyKey: proposal.idempotencyKey,
        confirmingActor: actor,
        sessionId: "sess-test-1",
        currentDraft: draft,
        persistenceStore,
        revalidatePermissionsAndState: async () => ({ allowed: true }),
        creationService: failingCreationService,
      })

      expect(execFail.ok).toBe(false)
      expect(execFail.code).toBe("EXECUTION_FAILED")
      expect(execFail.createdEvent).toBeNull()
      expect(execFail.proposal?.status).toBe("FAILED")
      expect(execFail.proposal?.failureReason).toContain("Slug collision")
    })
  })
})

export {}
