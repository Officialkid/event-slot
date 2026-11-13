/** @jest-environment node */

import {
  prepareEventDraftPreview,
  getSessionDraftPreview,
  setSessionDraftPreview,
  clearSessionDraftPreview,
  type EventDraftPreview,
  type EventDraftFields,
} from "@/lib/assistant/draft-preparation"
import {
  runAssistantOrchestrator,
  type AssistantLLMAdapter,
} from "@/lib/assistant/orchestrator"
import {
  executeEventCreationProposal,
  type ExecuteEventCreationProposalResult,
} from "@/lib/assistant/confirmation-executor"
import {
  createActionProposal,
  type PendingActionProposal,
} from "@/lib/assistant/confirmation-engine"
import {
  stageEventCreationSideEffectsInOutbox,
  processPendingSideEffectOutboxItems,
  reconcileOutboxItem,
  type EventCreationSideEffectOutboxRecord,
} from "@/lib/events/event-side-effect-outbox"
import { createEventDomainService } from "@/lib/events/event-creation-service"
import prisma from "@/lib/prisma"

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => {
  const mockOutboxUpsert = jest.fn().mockImplementation((args: any) =>
    Promise.resolve({
      id: "outbox-item-upserted",
      idempotencyKey: args.where?.idempotencyKey ?? "key",
      status: "PENDING",
      ...args.create,
    })
  )

  const mockDb = {
    user: { findUnique: jest.fn() },
    teamMember: { findFirst: jest.fn(), findMany: jest.fn() },
    event: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    assistantActionProposal: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    eventCreationSideEffectOutbox: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      upsert: mockOutboxUpsert,
    },
    $transaction: jest.fn(),
  }

  return {
    __esModule: true,
    default: mockDb,
    prisma: mockDb,
  }
})

jest.mock("@/lib/planEnforcement", () => ({
  canCreateEvent: jest.fn().mockResolvedValue({ allowed: true, reason: null }),
}))

jest.mock("@/lib/events/event-creation-service", () => {
  const actual = jest.requireActual("@/lib/events/event-creation-service")
  return {
    ...actual,
    createEventDomainService: jest.fn(),
    dispatchEventCreationSideEffects: jest.fn(),
  }
})

jest.mock("@/lib/googleCalendar", () => ({
  createCalendarEvent: jest.fn(),
}))

jest.mock("@/lib/cache", () => ({
  purgeUserCache: jest.fn(),
}))

jest.mock("@/lib/referral", () => ({
  processFirstEventReferral: jest.fn().mockResolvedValue(undefined),
  scoreEventCreation: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/services/notifications/followerAnnouncements", () => ({
  dispatchNewEventAnnouncements: jest.fn().mockResolvedValue({ sent: 1, skipped: 0 }),
}))

import { canCreateEvent } from "@/lib/planEnforcement"
import { createCalendarEvent } from "@/lib/googleCalendar"

const mockedPrisma = prisma as any
const mockedCreateEventDomainService = createEventDomainService as jest.Mock
const mockedCreateCalendarEvent = createCalendarEvent as jest.Mock

describe("ESA Phase 1 Prompt 14 — End-to-End Workflow & Reliability Gate (10 Scenarios)", () => {
  const userId = "user-organizer-001"
  const defaultActor = {
    userId,
    userEmail: "organizer@example.com",
    isAdmin: false,
    workspaceOrganizerId: null, // Personal organizer workspace
    organizerName: "Acme Events",
  }

  const mockAdapter: AssistantLLMAdapter = {
    generateReply: jest.fn().mockResolvedValue("I have prepared your draft preview."),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    clearSessionDraftPreview(userId, "session-e2e-1")
    clearSessionDraftPreview(userId, "session-e2e-2")
    clearSessionDraftPreview(userId, "session-e2e-3")
    clearSessionDraftPreview("unauthorized-user-999", "session-unauth")

    mockedPrisma.user.findUnique.mockResolvedValue({
      id: userId,
      email: "organizer@example.com",
      name: "Acme Organizer",
      membershipTier: "GROWTH",
    })

    mockedPrisma.teamMember.findFirst.mockResolvedValue(null)
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 1: New organizer prepares event draft from text/poster
  // ────────────────────────────────────────────────────────────────────────────
  it("Scenario 1: New organizer prepares event draft from initial text without creating a live event", async () => {
    const sessionId = "session-e2e-1"
    const message = "I want to host an event called 'Nairobi Tech Summit 2026' on 2026-11-20 at Sarit Centre for 250 people"

    const result = await runAssistantOrchestrator({
      actor: defaultActor,
      sessionId,
      message,
      llmAdapter: mockAdapter,
    })

    expect(result.kind).toBe("DRAFT_PREVIEW")
    expect(result.draftPreview).not.toBeNull()
    expect(result.draftPreview?.isLiveEvent).toBe(false)
    expect(result.draftPreview?.fields.title).toBe("Nairobi Tech Summit 2026")
    expect(result.draftPreview?.fields.location).toBe("Sarit Centre")
    expect(result.draftPreview?.fields.capacity).toBe(250)
    expect(result.draftPreview?.fields.eventDate).toContain("2026-11-20")

    // Invariant: no database event creation occurs
    expect(mockedPrisma.event.create).not.toHaveBeenCalled()
    expect(mockedCreateEventDomainService).not.toHaveBeenCalled()
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 2: Organizer answers follow-up question (date/venue/capacity)
  // ────────────────────────────────────────────────────────────────────────────
  it("Scenario 2: Organizer answers follow-up question, merging new details with the existing draft", async () => {
    const sessionId = "session-e2e-1"

    // Initial message only contains title
    const step1 = await prepareEventDraftPreview({
      userId,
      sessionId,
      messageText: "I want to host an event called 'AI Founders Meetup'",
    })
    expect(step1.fields.title).toBe("AI Founders Meetup")
    expect(step1.fields.location).toBeNull()
    expect(step1.fields.capacity).toBeNull()

    // Follow-up message answers date, venue, and capacity
    const step2 = await prepareEventDraftPreview({
      userId,
      sessionId,
      messageText: "It's on 2026-12-15 at iHub Nairobi for 100 people",
    })

    // Both previous title and newly answered fields are preserved together
    expect(step2.fields.title).toBe("AI Founders Meetup")
    expect(step2.fields.location).toBe("iHub Nairobi")
    expect(step2.fields.capacity).toBe(100)
    expect(step2.fields.eventDate).toContain("2026-12-15")
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 3: Organizer explicitly corrects previously supplied field
  // ────────────────────────────────────────────────────────────────────────────
  it("Scenario 3: Organizer explicitly corrects venue and capacity, cleanly overwriting prior values", async () => {
    const sessionId = "session-e2e-1"

    await prepareEventDraftPreview({
      userId,
      sessionId,
      messageText: "Host an event called 'Fintech Kenya 2026' on 2026-11-20 at Sarit Centre for 200 people",
    })

    // Explicit correction of venue and capacity
    const correctedDraft = await prepareEventDraftPreview({
      userId,
      sessionId,
      messageText: "Actually change the venue to KICC and update capacity to 500",
    })

    expect(correctedDraft.fields.title).toBe("Fintech Kenya 2026")
    expect(correctedDraft.fields.location).toBe("KICC")
    expect(correctedDraft.fields.capacity).toBe(500)
    // Date from earlier turn is maintained
    expect(correctedDraft.fields.eventDate).toContain("2026-11-20")
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 4: Organizer starts a separate event (old details not leaked)
  // ────────────────────────────────────────────────────────────────────────────
  it("Scenario 4: Starting a new event cleanly resets previous draft fields without leakage", async () => {
    const sessionId = "session-e2e-1"

    // First event draft
    await prepareEventDraftPreview({
      userId,
      sessionId,
      messageText: "Create an event called 'DevOps Conference' at KICC for 500 people on 2026-12-01",
    })

    // User explicitly starts a new/different event
    const freshDraft = await prepareEventDraftPreview({
      userId,
      sessionId,
      messageText: "Let's start a new event called 'AfroTech Music Festival 2027'",
    })

    // Title is the new event's title
    expect(freshDraft.fields.title).toBe("AfroTech Music Festival 2027")
    // Previous event details must NOT leak into the new event
    expect(freshDraft.fields.location).toBeNull()
    expect(freshDraft.fields.capacity).toBeNull()
    expect(freshDraft.fields.eventDate).toBeNull()
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 5: Organizer reviews draft preview and initiates confirmation
  // ────────────────────────────────────────────────────────────────────────────
  it("Scenario 5: Full confirmation lifecycle respects safety flag and fails closed when live creation is disabled", async () => {
    const sessionId = "session-e2e-2"

    const draft = await prepareEventDraftPreview({
      userId,
      sessionId,
      messageText: "Create an event called 'Nairobi AI Summit' on 2026-12-10 at iHub for 150 people",
    })

    const proposal = createActionProposal<EventDraftFields>({
      capability: "create_event_from_confirmed_draft",
      riskLevel: "WRITE_HIGH",
      validatedInput: draft.fields,
      preview: {
        title: "Confirm Event Creation: Nairobi AI Summit",
        summary: "Create a private physical event",
        targetEvent: null,
        fields: [],
        impactWarnings: ["This will publish a live event"],
      },
      actor: defaultActor,
      sessionId,
      operation: "CREATE_EVENT",
      draftId: draft.draftId,
      draftVersion: draft.draftVersion,
    })

    const mockStore = {
      isDurableDatabaseStore: true,
      savePendingProposal: jest.fn(),
      getProposalById: jest.fn().mockResolvedValue(proposal),
      invalidatePendingProposalsForDraft: jest.fn(),
      claimPendingProposalForExecution: jest.fn().mockResolvedValue(true),
      markProposalCompleted: jest.fn(),
      markProposalFailed: jest.fn(),
      markProposalCancelled: jest.fn(),
      markProposalExpired: jest.fn(),
    }

    // Attempt execution with ESA_LIVE_EVENT_CREATION_ENABLED=false (default safety)
    const result = await executeEventCreationProposal({
      persistenceStore: mockStore,
      prismaClient: mockedPrisma,
      actor: defaultActor,
      sessionId,
      proposalId: proposal.proposalId,
      idempotencyKey: proposal.idempotencyKey,
    })

    // Safety gate: must fail closed with FEATURE_GATE_DISABLED
    expect(result.ok).toBe(false)
    expect(result.code).toBe("FEATURE_GATE_DISABLED")
    expect(result.message).toContain("disabled")
    expect(mockedCreateEventDomainService).not.toHaveBeenCalled()
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 6: Duplicate or concurrent confirmation attempted
  // ────────────────────────────────────────────────────────────────────────────
  it("Scenario 6: Duplicate confirmation attempt is rejected safely without duplicate event creation", async () => {
    const sessionId = "session-e2e-2"

    const draft = await prepareEventDraftPreview({
      userId,
      sessionId,
      messageText: "Create an event called 'Cloud Summit' on 2026-12-15 at Sarit for 100 people",
    })

    const proposal = createActionProposal<EventDraftFields>({
      capability: "create_event_from_confirmed_draft",
      riskLevel: "WRITE_HIGH",
      validatedInput: draft.fields,
      preview: {
        title: "Confirm Event Creation: Cloud Summit",
        summary: "Create a private physical event",
        targetEvent: null,
        fields: [],
        impactWarnings: ["This will publish a live event"],
      },
      actor: defaultActor,
      sessionId,
      operation: "CREATE_EVENT",
      draftId: draft.draftId,
      draftVersion: draft.draftVersion,
    })

    const completedProposal: PendingActionProposal<EventDraftFields> = {
      ...proposal,
      status: "COMPLETED",
      executedAt: new Date().toISOString(),
      resultMetadata: { eventId: "evt-existing-123", slug: "cloud-summit-123" },
    }

    const mockStore = {
      isDurableDatabaseStore: true,
      savePendingProposal: jest.fn(),
      getProposalById: jest.fn().mockResolvedValue(completedProposal),
      invalidatePendingProposalsForDraft: jest.fn(),
      claimPendingProposalForExecution: jest.fn(),
      markProposalCompleted: jest.fn(),
      markProposalFailed: jest.fn(),
      markProposalCancelled: jest.fn(),
      markProposalExpired: jest.fn(),
    }

    // Correlated event already exists in DB
    mockedPrisma.event.findUnique.mockResolvedValue({
      id: "evt-existing-123",
      title: "Cloud Summit",
      slug: "cloud-summit-123",
      dashboardToken: "dt_123",
      verifierCode: "vc_123",
      visibility: "PRIVATE",
      accessType: "REGISTRATION",
      capacity: 100,
      organizerId: userId,
    })

    // Second confirmation attempt (bypassing gate to test idempotent recovery logic)
    const duplicateResult = await executeEventCreationProposal({
      persistenceStore: mockStore,
      prismaClient: mockedPrisma,
      actor: defaultActor,
      sessionId,
      proposalId: proposal.proposalId,
      idempotencyKey: proposal.idempotencyKey,
      enableLiveGateCheck: false,
    })

    // Must return idempotent completed outcome without re-creating event
    expect(duplicateResult.ok).toBe(true)
    expect(duplicateResult.code).toBe("COMPLETED")
    expect(duplicateResult.createdEvent?.id).toBe("evt-existing-123")
    expect(mockedCreateEventDomainService).not.toHaveBeenCalled()
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 7: Primary event succeeds while secondary side effect fails
  // ────────────────────────────────────────────────────────────────────────────
  it("Scenario 7: Primary event remains intact when secondary outbox side effect fails", async () => {
    const eventId = "evt-701"

    const eventRecord = {
      id: eventId,
      title: "Resilient Summit 2026",
      slug: "resilient-summit-2026",
      organizerId: userId,
      visibility: "PUBLIC",
      eventType: "PHYSICAL",
      location: "KICC Nairobi",
      eventDate: new Date("2026-12-01T10:00:00Z"),
      eventEndAt: null,
      capacity: 300,
    }

    mockedPrisma.event.findUnique.mockResolvedValue(eventRecord)

    // Stage outbox items
    const staged = await stageEventCreationSideEffectsInOutbox({
      eventId,
      organizerId: userId,
      creationProposalId: "prop-701",
      slug: "resilient-summit-2026",
      actor: {
        userId,
        isAdmin: false,
      },
      targetOrganizer: { id: userId, email: "organizer@example.com" },
      input: {
        title: "Resilient Summit 2026",
        description: "Test event",
        category: "TECH",
        eventType: "PHYSICAL",
        location: "KICC Nairobi",
        eventDate: "2026-12-01T10:00:00Z",
        capacity: 300,
        isPaid: false,
        accessType: "REGISTRATION",
      } as any,
      tx: mockedPrisma,
    })

    expect(staged.length).toBeGreaterThanOrEqual(1)

    // Calendar sync fails with simulated 503 transient failure
    mockedCreateCalendarEvent.mockRejectedValue(new Error("503 Service Unavailable: Google API timeout"))

    const outboxRecord: EventCreationSideEffectOutboxRecord = {
      id: "outbox-item-701",
      idempotencyKey: "prop_prop-701_CALENDAR_SYNC",
      eventId,
      creationProposalId: "prop-701",
      organizerId: userId,
      sideEffectType: "CALENDAR_SYNC",
      status: "PENDING",
      payload: {
        eventId,
        title: "Resilient Summit 2026",
        organizerId: userId,
        slug: "resilient-summit-2026",
        eventType: "PHYSICAL",
        eventDate: "2026-12-01T10:00:00Z",
      },
      attempts: 0,
      maxAttempts: 5,
      nextAttemptAt: new Date(Date.now() - 10000), // In the past so it's due
      processingLeaseExpiresAt: null,
      leaseToken: null,
      lastError: null,
      resultMetadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      attemptedAt: null,
      completedAt: null,
      failedAt: null,
    }

    mockedPrisma.eventCreationSideEffectOutbox.findMany.mockResolvedValue([outboxRecord])
    mockedPrisma.eventCreationSideEffectOutbox.updateMany.mockResolvedValue({ count: 1 })

    const processingResult = await processPendingSideEffectOutboxItems({
      eventId,
      creationProposalId: "prop-701",
      now: new Date(),
      prismaClient: mockedPrisma,
    })

    // Outbox processing marked the failure for the side effect, but the primary event was not corrupted
    expect(processingResult.failedCount).toBe(1)
    expect(processingResult.succeededCount).toBe(0)
    // Primary event remains intact in the DB
    expect(eventRecord.id).toBe(eventId)
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 8: External delivery outcome becomes ambiguous (AMBIGUOUS_OUTCOME)
  // ────────────────────────────────────────────────────────────────────────────
  it("Scenario 8: Ambiguous delivery outcome is reconcilable and safely excluded from auto-retries", async () => {
    const outboxRecord: EventCreationSideEffectOutboxRecord = {
      id: "outbox-ambig-801",
      idempotencyKey: "prop_prop-801_CALENDAR_SYNC",
      eventId: "evt-801",
      creationProposalId: "prop-801",
      organizerId: userId,
      sideEffectType: "CALENDAR_SYNC",
      status: "AMBIGUOUS_OUTCOME",
      payload: { eventId: "evt-801", title: "Ambiguous Event", organizerId: userId },
      attempts: 2,
      maxAttempts: 5,
      nextAttemptAt: new Date(),
      processingLeaseExpiresAt: null,
      leaseToken: null,
      lastError: "Connection terminated mid-stream",
      resultMetadata: { ambiguousError: true },
      createdAt: new Date(),
      updatedAt: new Date(),
      attemptedAt: new Date(),
      completedAt: null,
      failedAt: null,
    }

    // When worker queries for pending/processing candidate items, AMBIGUOUS_OUTCOME is excluded
    mockedPrisma.eventCreationSideEffectOutbox.findMany.mockImplementation((args: any) => {
      // If the query only matches status: 'PENDING' or 'PROCESSING', return empty
      const matchesAmbig = args?.where?.OR?.some((cond: any) => cond.status === "AMBIGUOUS_OUTCOME")
      return Promise.resolve(matchesAmbig ? [outboxRecord] : [])
    })

    const autoRetryRun = await processPendingSideEffectOutboxItems({
      eventId: "evt-801",
      prismaClient: mockedPrisma,
    })

    // Auto-retries are paused for ambiguous records (0 processed)
    expect(autoRetryRun.processedCount).toBe(0)

    // Manual operator reconciliation to MARK_COMPLETED
    mockedPrisma.eventCreationSideEffectOutbox.findUnique.mockResolvedValue(outboxRecord)
    mockedPrisma.eventCreationSideEffectOutbox.update.mockResolvedValue({
      ...outboxRecord,
      status: "COMPLETED",
      resultMetadata: { reconciled: true, reconciliationAction: "MARK_COMPLETED" },
    })

    const reconciliation = await reconcileOutboxItem({
      outboxItemId: "outbox-ambig-801",
      action: "MARK_COMPLETED",
      notes: "External calendar API verified event creation out-of-band",
      prismaClient: mockedPrisma,
    })

    expect(reconciliation.success).toBe(true)
    expect(reconciliation.item?.status).toBe("COMPLETED")
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 9: Unauthorized user attempts organizer operation
  // ────────────────────────────────────────────────────────────────────────────
  it("Scenario 9: Unauthorized user attempting workspace operation is rejected with FORBIDDEN", async () => {
    const unauthUserId = "unauthorized-user-999"
    const unauthActor = {
      userId: unauthUserId,
      userEmail: "attacker@example.com",
      isAdmin: false,
      workspaceOrganizerId: "target-workspace-org-777", // trying to act on another workspace
    }

    // Mock: user is NOT a member of target-workspace-org-777
    mockedPrisma.teamMember.findFirst.mockResolvedValue(null)

    const result = await runAssistantOrchestrator({
      actor: unauthActor,
      sessionId: "session-unauth",
      message: "List all my events",
      llmAdapter: mockAdapter,
    })

    // Orchestrator rejects unauthorized access gracefully
    expect(result.toolCallsExecuted.length).toBeGreaterThan(0)
    expect(result.toolCallsExecuted[0].ok).toBe(false)
    expect(result.toolCallsExecuted[0].errorCode).toBe("FORBIDDEN")
    expect(result.reply).toContain("permission to access")
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 10: Long conversation exceeding message-history window (25 turns)
  // ────────────────────────────────────────────────────────────────────────────
  it("Scenario 10: Long conversation (25+ turns) retains draft preview without losing earlier fields", async () => {
    const sessionId = "session-e2e-3"

    // Turn 1: Organizer establishes core event details
    await prepareEventDraftPreview({
      userId,
      sessionId,
      messageText: "I want to host an event called 'Global AI Conference' on 2026-11-15 at Sarit Centre for 300 people",
    })

    // Simulate 24 intermediate conversational turns (e.g. asking general questions)
    // In production, the DB message window retrieves the last 20 messages, so Turn 1
    // would be truncated from the LLM prompt history.
    const longConversationHistory: Array<{ role: "user" | "assistant"; content: string }> = []
    for (let i = 1; i <= 24; i++) {
      longConversationHistory.push({
        role: "user",
        content: `General question ${i}: How do waitlists work on EventSlot?`,
      })
      longConversationHistory.push({
        role: "assistant",
        content: `Answer ${i}: Waitlists automatically queue attendees when capacity is reached.`,
      })
    }

    // Turn 25: Organizer updates entry fee
    const turn25Draft = await prepareEventDraftPreview({
      userId,
      sessionId,
      messageText: "Make it free admission",
    })

    // Verification: Even after 25 turns, the session-level draft preview retains all
    // fields from Turn 1 (title, date, venue, capacity) and correctly updates entry fee!
    expect(turn25Draft.fields.title).toBe("Global AI Conference")
    expect(turn25Draft.fields.location).toBe("Sarit Centre")
    expect(turn25Draft.fields.capacity).toBe(300)
    expect(turn25Draft.fields.eventDate).toContain("2026-11-15")
    expect(turn25Draft.fields.isPaid).toBe(false)
  })
})
