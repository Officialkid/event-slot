/** @jest-environment node */

import {
  executeEventCreationProposal,
  cancelEventCreationProposal,
  convertDraftFieldsToCreationInput,
} from "@/lib/assistant/confirmation-executor"
import { isEsaLiveEventCreationEnabled } from "@/lib/assistant/feature-flags"
import type { PendingActionProposal } from "@/lib/assistant/confirmation-engine"
import type { EventDraftFields } from "@/lib/assistant/draft-preparation"
import { canCreateEvent } from "@/lib/planEnforcement"
import prisma from "@/lib/prisma"

jest.mock("@/lib/planEnforcement", () => ({
  canCreateEvent: jest.fn(),
}))

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    teamMember: {
      findFirst: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    assistantActionProposal: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock("@/lib/events/event-creation-service", () => {
  const actual = jest.requireActual("@/lib/events/event-creation-service")
  return {
    ...actual,
    createEventDomainService: jest.fn(),
    dispatchEventCreationSideEffects: jest.fn(),
  }
})

import {
  createEventDomainService,
  dispatchEventCreationSideEffects,
} from "@/lib/events/event-creation-service"

const mockedPrisma = prisma as unknown as {
  user: { findUnique: jest.Mock }
  teamMember: { findFirst: jest.Mock }
  event: { findUnique: jest.Mock; create: jest.Mock }
  assistantActionProposal: {
    findUnique: jest.Mock
    update: jest.Mock
    updateMany: jest.Mock
  }
  $transaction: jest.Mock
}

const mockedCanCreateEvent = canCreateEvent as jest.Mock
const mockedCreateEventDomainService = createEventDomainService as jest.Mock
const mockedDispatchSideEffects = dispatchEventCreationSideEffects as jest.Mock

describe("Confirmation Executor", () => {
  const originalEnv = process.env

  const validDraftFields: EventDraftFields = {
    title: "AI Workshop 2026",
    description: "Hands-on generative AI session",
    category: "Technology",
    visibility: "PRIVATE",
    accessType: "REGISTRATION",
    eventType: "PHYSICAL",
    eventDate: "2026-11-15T09:00:00.000Z",
    eventEndAt: "2026-11-15T17:00:00.000Z",
    deadline: "2026-11-14T23:59:59.000Z",
    location: "Nairobi Innovation Hub",
    virtualLink: null,
    capacity: 100,
    isPaid: false,
    ticketPrice: null,
    currency: "KES",
    organizerName: "Tech Nairobi",
    whatsappNumber: "+254712345678",
    entryFeeLabel: null,
  }

  const sampleProposal: PendingActionProposal<EventDraftFields> = {
    proposalId: "prop_exec_123",
    idempotencyKey: "idem_key_xyz789",
    capability: "create_event_from_confirmed_draft",
    riskLevel: "WRITE_HIGH",
    requiresConfirmation: true,
    validatedInput: validDraftFields,
    preview: {
      title: "Confirm Event Creation: AI Workshop 2026",
      summary: "Create a public physical event",
      targetEvent: null,
      fields: [],
      impactWarnings: ["This will publish a live event"],
    },
    authorization: {
      actorId: "actor_user_1",
      workspaceOrganizerId: null,
      targetEventId: null,
      sessionId: "session_abc",
      operation: "CREATE_EVENT",
      draftId: "draft_001",
      draftVersion: "dv_1234567890",
    },
    status: "PENDING",
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    expiresAt: new Date(Date.now() + 25 * 60 * 1000).toISOString(),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    failedAt: null,
    failureReason: null,
    resultMetadata: null,
  }

  const sampleActor = {
    userId: "actor_user_1",
    userEmail: "actor@example.com",
    isAdmin: false,
    workspaceOrganizerId: null,
  }

  const mockStore = {
    isDurableDatabaseStore: true,
    savePendingProposal: jest.fn(),
    getProposalById: jest.fn(),
    invalidatePendingProposalsForDraft: jest.fn(),
    claimPendingProposalForExecution: jest.fn(),
    markProposalCompleted: jest.fn(),
    markProposalFailed: jest.fn(),
    markProposalCancelled: jest.fn(),
    markProposalExpired: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.ESA_LIVE_EVENT_CREATION_ENABLED

    mockStore.getProposalById.mockResolvedValue(sampleProposal)
    mockStore.claimPendingProposalForExecution.mockResolvedValue(true)
    mockStore.markProposalCompleted.mockResolvedValue({
      ...sampleProposal,
      status: "COMPLETED",
    })

    mockedPrisma.user.findUnique.mockResolvedValue({
      id: "actor_user_1",
      email: "actor@example.com",
    })

    mockedCanCreateEvent.mockResolvedValue({ allowed: true })

    mockedCreateEventDomainService.mockResolvedValue({
      success: true,
      event: {
        id: "evt_live_123",
        title: "AI Workshop 2026",
        slug: "ai-workshop-2026-ab12",
        dashboardToken: "token_123",
        verifierCode: "V123",
        visibility: "PUBLIC",
        accessType: "REGISTRATION",
        capacity: 100,
      },
    })

    mockedDispatchSideEffects.mockResolvedValue({
      referralsProcessed: true,
      calendarSyncDispatched: true,
      followerAnnouncementsDispatched: false,
      cachePurged: true,
    })

    // Simulated transactional execution
    mockedPrisma.$transaction.mockImplementation(async (callback) => {
      const mockTx = {
        assistantActionProposal: {
          update: jest.fn().mockResolvedValue({ ...sampleProposal, status: "COMPLETED" }),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      }
      return callback(mockTx)
    })
  })

  afterAll(() => {
    process.env = originalEnv
  })

  describe("Server-Side Feature Gate", () => {
    it("is disabled by default (fails closed)", () => {
      delete process.env.ESA_LIVE_EVENT_CREATION_ENABLED
      expect(isEsaLiveEventCreationEnabled()).toBe(false)

      process.env.ESA_LIVE_EVENT_CREATION_ENABLED = ""
      expect(isEsaLiveEventCreationEnabled()).toBe(false)

      process.env.ESA_LIVE_EVENT_CREATION_ENABLED = "disabled"
      expect(isEsaLiveEventCreationEnabled()).toBe(false)
    })

    it("enables only when explicitly set to 'true'", () => {
      process.env.ESA_LIVE_EVENT_CREATION_ENABLED = "true"
      expect(isEsaLiveEventCreationEnabled()).toBe(true)

      process.env.ESA_LIVE_EVENT_CREATION_ENABLED = "TRUE"
      expect(isEsaLiveEventCreationEnabled()).toBe(true)
    })

    it("rejects confirmation when feature gate is disabled without attempting DB transaction", async () => {
      delete process.env.ESA_LIVE_EVENT_CREATION_ENABLED

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("FEATURE_GATE_DISABLED")
      expect(result.message).toContain("disabled")
      expect(mockedPrisma.$transaction).not.toHaveBeenCalled()
      expect(mockedCreateEventDomainService).not.toHaveBeenCalled()
    })
  })

  describe("Authentication and Actor Authorization", () => {
    it("rejects unauthenticated confirmation attempts", async () => {
      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: { ...sampleActor, userId: "" },
        sessionId: "session_abc",
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("ACTOR_MISMATCH")
    })

    it("rejects confirmation if actor ID does not match proposal owner", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        authorization: {
          ...sampleProposal.authorization,
          actorId: "different_owner_user",
        },
      })

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("ACTOR_MISMATCH")
    })

    it("rejects confirmation when session does not match", async () => {
      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "wrong_session_xyz",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("SESSION_MISMATCH")
    })

    it("rejects confirmation when workspace context does not match proposal", async () => {
      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        workspaceOrganizerId: "org_mismatched_workspace",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("WORKSPACE_MISMATCH")
    })

    it("rejects non-member actor creating in an organization workspace without fallback", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        authorization: {
          ...sampleProposal.authorization,
          workspaceOrganizerId: "org_workspace_alpha",
        },
      })

      mockedPrisma.teamMember.findFirst.mockResolvedValueOnce(null) // Not a team member

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: { ...sampleActor, workspaceOrganizerId: "org_workspace_alpha" },
        sessionId: "session_abc",
        workspaceOrganizerId: "org_workspace_alpha",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("REVALIDATION_FAILED")
      expect(result.message).toContain("not authorized")
    })

    it("rejects execution if organizer exceeds plan limits at confirmation time", async () => {
      mockedCanCreateEvent.mockResolvedValueOnce({
        allowed: false,
        reason: "You have reached your active event limit on the Free plan.",
      })

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("REVALIDATION_FAILED")
      expect(result.message).toContain("active event limit")
    })
  })

  describe("Proposal Validation and State Safety", () => {
    it("rejects non-existent proposal", async () => {
      mockStore.getProposalById.mockResolvedValueOnce(null)

      const result = await executeEventCreationProposal({
        proposalId: "prop_missing",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("PROPOSAL_NOT_FOUND")
    })

    it("rejects proposal with mismatched idempotency key", async () => {
      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "conflicting_idem_key",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("IDEMPOTENCY_CONFLICT")
    })

    it("rejects cancelled proposal", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        status: "CANCELLED",
      })

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("PROPOSAL_CANCELLED")
    })

    it("rejects expired proposal and marks it expired", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        status: "EXPIRED",
      })

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("PROPOSAL_EXPIRED")
    })

    it("rejects proposal when validatedInput fails createEventSchema", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        validatedInput: {
          ...sampleProposal.validatedInput,
          title: "", // Empty title invalidates schema
        },
      })

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("INVALID_DRAFT")
    })
  })

  describe("Atomic Database Transaction and Single-Winner Concurrency", () => {
    it("successfully creates event and completes proposal in a single transaction", async () => {
      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(true)
      expect(result.code).toBe("COMPLETED")
      expect(result.createdEvent?.id).toBe("evt_live_123")
      expect(result.createdEvent?.slug).toBe("ai-workshop-2026-ab12")
      expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1)
      expect(mockedCreateEventDomainService).toHaveBeenCalledWith(
        expect.objectContaining({
          creationProposalId: "prop_exec_123",
          sideEffects: false, // Segregated inside the transaction
        })
      )
      expect(mockStore.claimPendingProposalForExecution).toHaveBeenCalled()
      expect(mockStore.markProposalCompleted).toHaveBeenCalled()
    })

    it("aborts execution if claiming proposal fails (another caller won claim)", async () => {
      mockStore.claimPendingProposalForExecution.mockResolvedValueOnce(false)

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("CLAIM_FAILED")
      // Domain service must never have been called
      expect(mockedCreateEventDomainService).not.toHaveBeenCalled()
    })

    it("marks proposal FAILED when event creation domain service encounters an error", async () => {
      mockedCreateEventDomainService.mockResolvedValueOnce({
        success: false,
        status: 400,
        error: "Poster image is required for public events",
      })

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("EXECUTION_FAILED")
      expect(result.message).toContain("Poster image is required")
      expect(mockStore.markProposalFailed).toHaveBeenCalledWith(
        expect.objectContaining({
          proposalId: "prop_exec_123",
          failureReason: "Poster image is required for public events",
        })
      )
    })
  })

  describe("Safe Crash and Retry Recovery Behavior", () => {
    it("returns verified existing event on retry when proposal is already COMPLETED", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        status: "COMPLETED",
      })

      mockedPrisma.event.findUnique.mockResolvedValueOnce({
        id: "evt_live_123",
        title: "AI Workshop 2026",
        slug: "ai-workshop-2026-ab12",
        dashboardToken: "token_123",
        verifierCode: "V123",
        visibility: "PUBLIC",
        accessType: "REGISTRATION",
        capacity: 100,
        organizerId: "actor_user_1",
      })

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(true)
      expect(result.code).toBe("COMPLETED")
      expect(result.createdEvent?.id).toBe("evt_live_123")
      // Must not create another event
      expect(mockedCreateEventDomainService).not.toHaveBeenCalled()
    })

    it("returns RECOVERY_REQUIRED if proposal is COMPLETED but correlated event is missing", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        status: "COMPLETED",
      })

      mockedPrisma.event.findUnique.mockResolvedValueOnce(null) // Missing from DB

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("RECOVERY_REQUIRED")
      expect(result.recoveryRequired).toBe(true)
      expect(mockedCreateEventDomainService).not.toHaveBeenCalled()
    })

    it("recovers and completes proposal if event was committed during an interrupted EXECUTING state", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        status: "EXECUTING",
      })

      mockedPrisma.event.findUnique.mockResolvedValueOnce({
        id: "evt_live_123",
        title: "AI Workshop 2026",
        slug: "ai-workshop-2026-ab12",
        dashboardToken: "token_123",
        verifierCode: "V123",
        visibility: "PUBLIC",
        accessType: "REGISTRATION",
        capacity: 100,
        organizerId: "actor_user_1",
      })

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(true)
      expect(result.code).toBe("COMPLETED")
      expect(result.createdEvent?.slug).toBe("ai-workshop-2026-ab12")
      expect(mockStore.markProposalCompleted).toHaveBeenCalled()
      expect(mockedCreateEventDomainService).not.toHaveBeenCalled()
    })

    it("blocks retry with RECOVERY_REQUIRED if EXECUTING proposal has no correlated event", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        status: "EXECUTING",
      })

      mockedPrisma.event.findUnique.mockResolvedValueOnce(null)

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("RECOVERY_REQUIRED")
      expect(result.recoveryRequired).toBe(true)
      expect(mockedCreateEventDomainService).not.toHaveBeenCalled()
    })
  })

  describe("Post-Commit Side Effects Segregation", () => {
    it("executes side effects only after database transaction commits", async () => {
      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(true)
      expect(mockedDispatchSideEffects).toHaveBeenCalledTimes(1)
      expect(result.sideEffectsSummary?.cachePurged).toBe(true)
    })

    it("tolerates side-effect warning/failure without rolling back committed event", async () => {
      mockedDispatchSideEffects.mockRejectedValueOnce(
        new Error("External calendar API unreachable")
      )

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      // Creation still succeeded
      expect(result.ok).toBe(true)
      expect(result.createdEvent?.id).toBe("evt_live_123")
    })
  })

  describe("cancelEventCreationProposal", () => {
    it("cancels pending proposal when requested by owning actor", async () => {
      mockStore.markProposalCancelled.mockResolvedValueOnce({
        ...sampleProposal,
        status: "CANCELLED",
      })

      const result = await cancelEventCreationProposal({
        proposalId: "prop_exec_123",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
      })

      expect(result.ok).toBe(true)
      expect(result.code).toBe("CANCELLED")
      expect(mockStore.markProposalCancelled).toHaveBeenCalledWith(
        expect.objectContaining({
          proposalId: "prop_exec_123",
          actorId: "actor_user_1",
        })
      )
    })

    it("rejects cancellation if actor is not the proposal owner", async () => {
      const result = await cancelEventCreationProposal({
        proposalId: "prop_exec_123",
        actor: { ...sampleActor, userId: "another_user" },
        sessionId: "session_abc",
        persistenceStore: mockStore,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("ACTOR_MISMATCH")
    })

    it("rejects cancellation if proposal is already COMPLETED", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        status: "COMPLETED",
      })

      const result = await cancelEventCreationProposal({
        proposalId: "prop_exec_123",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("PROPOSAL_ALREADY_COMPLETED")
      expect(mockStore.markProposalCancelled).not.toHaveBeenCalled()
    })

    it("rejects cancellation if proposal is currently EXECUTING", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        status: "EXECUTING",
      })

      const result = await cancelEventCreationProposal({
        proposalId: "prop_exec_123",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("PROPOSAL_EXECUTING")
      expect(mockStore.markProposalCancelled).not.toHaveBeenCalled()
    })

    it("rejects cancellation with PROPOSAL_NOT_PENDING if markProposalCancelled returns null", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        status: "PENDING",
      })
      mockStore.markProposalCancelled.mockResolvedValueOnce(null)

      const result = await cancelEventCreationProposal({
        proposalId: "prop_exec_123",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("PROPOSAL_NOT_PENDING")
    })
  })

  describe("Hardened Recovery and Transaction Invariants", () => {
    it("rejects recovery if existing correlated event organizer does not match expected organizer", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        status: "COMPLETED",
      })

      mockedPrisma.event.findUnique.mockResolvedValueOnce({
        id: "evt_live_123",
        title: "AI Workshop 2026",
        slug: "ai-workshop-2026-ab12",
        organizerId: "different_unauthorized_user",
      })

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("RECOVERY_REQUIRED")
      expect(result.message).toContain("organizer ownership does not match")
    })

    it("rolls back transaction if markProposalCompleted returns null inside transaction", async () => {
      mockStore.markProposalCompleted.mockResolvedValueOnce(null)

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("EXECUTION_FAILED")
      expect(result.message).toContain("Failed to mark proposal completed inside transaction")
    })

    it("computes sideEffectsDeliveryStatus as ALL_DISPATCHED when all effects succeed", async () => {
      mockedDispatchSideEffects.mockResolvedValueOnce({
        cachePurged: true,
        calendarSyncDispatched: true,
        referralsProcessed: true,
        followerAnnouncementsDispatched: false,
      })

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(true)
      expect(result.sideEffectsDeliveryStatus).toBe("ALL_DISPATCHED")
    })

    it("computes sideEffectsDeliveryStatus as PARTIALLY_DISPATCHED when some effects succeed", async () => {
      mockedDispatchSideEffects.mockResolvedValueOnce({
        cachePurged: true,
        calendarSyncDispatched: false,
        referralsProcessed: false,
        followerAnnouncementsDispatched: false,
      })

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(true)
      expect(result.sideEffectsDeliveryStatus).toBe("PARTIALLY_DISPATCHED")
    })

    it("computes sideEffectsDeliveryStatus as FAILED when dispatch throws", async () => {
      mockedDispatchSideEffects.mockRejectedValueOnce(new Error("External service network timeout"))

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(true)
      expect(result.sideEffectsDeliveryStatus).toBe("FAILED")
    })

    it("does not re-dispatch side effects on duplicate confirmation of already COMPLETED proposal", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        status: "COMPLETED",
      })

      mockedPrisma.event.findUnique.mockResolvedValueOnce({
        id: "evt_live_123",
        title: "AI Workshop 2026",
        slug: "ai-workshop-2026-ab12",
        organizerId: "actor_user_1",
      })

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(true)
      expect(result.code).toBe("COMPLETED")
      expect(mockedDispatchSideEffects).not.toHaveBeenCalled()
    })

    it("rejects recovery if existing correlated event ID does not match proposal result metadata eventId", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        status: "COMPLETED",
        resultMetadata: { eventId: "evt_expected_original" },
      })

      mockedPrisma.event.findUnique.mockResolvedValueOnce({
        id: "evt_different_unrelated",
        title: "AI Workshop 2026",
        slug: "ai-workshop-2026-ab12",
        organizerId: "actor_user_1",
      })

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("RECOVERY_REQUIRED")
      expect(result.message).toContain("Correlated event ID does not match persisted proposal result metadata")
    })

    it("rejects EXECUTING recovery if proposal completion fails due to concurrent race", async () => {
      mockStore.getProposalById.mockResolvedValueOnce({
        ...sampleProposal,
        status: "EXECUTING",
      })

      mockedPrisma.event.findUnique.mockResolvedValueOnce({
        id: "evt_live_123",
        title: "AI Workshop 2026",
        slug: "ai-workshop-2026-ab12",
        organizerId: "actor_user_1",
      })

      mockStore.markProposalCompleted.mockResolvedValueOnce(null)

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(false)
      expect(result.code).toBe("RECOVERY_REQUIRED")
      expect(result.message).toContain("Proposal could not be finalized to completed status")
    })

    it("computes sideEffectsDeliveryStatus as ALL_DISPATCHED using deliveryEvidence", async () => {
      mockedDispatchSideEffects.mockResolvedValueOnce({
        referralsProcessed: true,
        calendarSyncDispatched: true,
        followerAnnouncementsDispatched: true,
        cachePurged: true,
        deliveryEvidence: {
          referrals: "CONFIRMED",
          calendarSync: "CONFIRMED",
          cachePurge: "CONFIRMED",
          followerAnnouncements: "INITIATED_ASYNC",
        },
      })

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(true)
      expect(result.sideEffectsDeliveryStatus).toBe("ALL_DISPATCHED")
    })

    it("computes sideEffectsDeliveryStatus as NONE when all side effects are SKIPPED", async () => {
      mockedDispatchSideEffects.mockResolvedValueOnce({
        referralsProcessed: false,
        calendarSyncDispatched: false,
        followerAnnouncementsDispatched: false,
        cachePurged: false,
        deliveryEvidence: {
          referrals: "SKIPPED",
          calendarSync: "SKIPPED",
          cachePurge: "SKIPPED",
          followerAnnouncements: "SKIPPED",
        },
      })

      const result = await executeEventCreationProposal({
        proposalId: "prop_exec_123",
        idempotencyKey: "idem_key_xyz789",
        actor: sampleActor,
        sessionId: "session_abc",
        persistenceStore: mockStore,
        enableLiveGateCheck: false,
      })

      expect(result.ok).toBe(true)
      expect(result.sideEffectsDeliveryStatus).toBe("NONE")
    })
  })
})
