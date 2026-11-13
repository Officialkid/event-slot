import {
  PrismaPendingActionStore,
  mapDbRecordToProposal,
  canonicalJsonStringify,
  sanitizeFailureReason,
} from "@/lib/assistant/prisma-pending-action-store"
import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import type { PendingActionProposal } from "@/lib/assistant/confirmation-engine"

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    assistantActionProposal: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    event: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}))

const mockedPrisma = prisma as unknown as {
  assistantActionProposal: {
    create: jest.Mock
    findUnique: jest.Mock
    updateMany: jest.Mock
  }
  event: {
    findUnique: jest.Mock
    create: jest.Mock
  }
}

describe("PrismaPendingActionStore", () => {
  let store: PrismaPendingActionStore

  const sampleProposal: PendingActionProposal = {
    proposalId: "prop_12345",
    idempotencyKey: "idem_key_abcdef123456",
    capability: "create_event_from_confirmed_draft",
    riskLevel: "WRITE_HIGH",
    requiresConfirmation: true,
    validatedInput: {
      title: "Tech Summit 2026",
      visibility: "PRIVATE",
      accessType: "REGISTRATION",
      eventType: "PHYSICAL",
      capacity: 100,
    },
    preview: {
      title: "Confirm Event Creation: Tech Summit 2026",
      summary: "Create a private physical event.",
      targetEvent: null,
      fields: [
        { key: "title", label: "Title", proposedValue: "Tech Summit 2026" },
      ],
      impactWarnings: ["This will create a live event record."],
    },
    authorization: {
      actorId: "user_actor_1",
      workspaceOrganizerId: "org_workspace_1",
      targetEventId: null,
      sessionId: "session_abc",
      operation: "CREATE_EVENT",
      draftId: "draft_001",
      draftVersion: "dv_9876543210",
    },
    status: "PENDING",
    createdAt: "2026-10-27T10:00:00.000Z",
    expiresAt: "2026-10-27T10:15:00.000Z",
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    failedAt: null,
    failureReason: null,
    resultMetadata: null,
  }

  const sampleDbRecord = {
    id: "prop_12345",
    idempotencyKey: "idem_key_abcdef123456",
    capability: "create_event_from_confirmed_draft",
    operation: "CREATE_EVENT",
    riskLevel: "WRITE_HIGH",
    status: "PENDING",
    actorId: "user_actor_1",
    sessionId: "session_abc",
    workspaceOrganizerId: "org_workspace_1",
    targetEventId: null,
    draftId: "draft_001",
    draftVersion: "dv_9876543210",
    validatedInput: sampleProposal.validatedInput,
    previewCard: sampleProposal.preview,
    resultMetadata: null,
    failureReason: null,
    createdAt: new Date("2026-10-27T10:00:00.000Z"),
    updatedAt: new Date("2026-10-27T10:00:00.000Z"),
    expiresAt: new Date("2026-10-27T10:15:00.000Z"),
    confirmedAt: null,
    executionStartedAt: null,
    executionLeaseExpiresAt: null,
    completedAt: null,
    failedAt: null,
    cancelledAt: null,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    store = new PrismaPendingActionStore()
  })

  describe("Deterministic Serialization and Sanitization Helpers", () => {
    it("canonicalJsonStringify produces identical output regardless of object key order", () => {
      const objA = { z: 1, a: 2, m: { y: "hello", b: true } }
      const objB = { a: 2, m: { b: true, y: "hello" }, z: 1 }

      expect(canonicalJsonStringify(objA)).toBe(canonicalJsonStringify(objB))
      expect(canonicalJsonStringify(objA)).toBe('{"a":2,"m":{"b":true,"y":"hello"},"z":1}')
    })

    it("sanitizeFailureReason redacts connection strings and tokens and bounds length", () => {
      const sensitive = "Failed to connect to postgresql://user:supersecret@db.internal:5432/eventslot?ssl=true with Bearer abc123def456."
      const sanitized = sanitizeFailureReason(sensitive)

      expect(sanitized).not.toContain("supersecret")
      expect(sanitized).toContain("[REDACTED_DB_URL]")
      expect(sanitized).toContain("[REDACTED_AUTH]")

      const superLong = "A".repeat(800)
      expect(sanitizeFailureReason(superLong).length).toBe(500)
    })
  })

  describe("Store Contract Properties", () => {
    it("declares isDurableDatabaseStore as true", () => {
      expect(store.isDurableDatabaseStore).toBe(true)
    })
  })

  describe("savePendingProposal", () => {
    it("persists a valid proposal and maps returned fields", async () => {
      mockedPrisma.assistantActionProposal.create.mockResolvedValueOnce(sampleDbRecord)

      const result = await store.savePendingProposal(sampleProposal)

      expect(result.proposalId).toBe("prop_12345")
      expect(result.idempotencyKey).toBe("idem_key_abcdef123456")
      expect(result.status).toBe("PENDING")
      expect(result.authorization.actorId).toBe("user_actor_1")
      expect(result.authorization.draftVersion).toBe("dv_9876543210")
      expect(mockedPrisma.assistantActionProposal.create).toHaveBeenCalledTimes(1)
    })

    it("rejects proposal creation without an authenticated actorId", async () => {
      const invalidProposal = {
        ...sampleProposal,
        authorization: {
          ...sampleProposal.authorization,
          actorId: "",
        },
      }

      await expect(store.savePendingProposal(invalidProposal)).rejects.toThrow(
        "Cannot persist proposal without an authenticated actorId."
      )
    })

    it("handles idempotency key collision safely by returning existing matching proposal", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError("Duplicate key", {
        code: "P2002",
        clientVersion: "5.22.0",
        meta: { target: ["idempotencyKey"] },
      })

      mockedPrisma.assistantActionProposal.create.mockRejectedValueOnce(p2002Error)
      mockedPrisma.assistantActionProposal.findUnique.mockResolvedValueOnce(sampleDbRecord)

      const result = await store.savePendingProposal(sampleProposal)

      expect(result.proposalId).toBe("prop_12345")
      expect(mockedPrisma.assistantActionProposal.findUnique).toHaveBeenCalledWith({
        where: { idempotencyKey: sampleProposal.idempotencyKey },
      })
    })

    it("throws collision error when key exists for a different actor or draft version", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError("Duplicate key", {
        code: "P2002",
        clientVersion: "5.22.0",
        meta: { target: ["idempotencyKey"] },
      })

      mockedPrisma.assistantActionProposal.create.mockRejectedValueOnce(p2002Error)
      mockedPrisma.assistantActionProposal.findUnique.mockResolvedValueOnce({
        ...sampleDbRecord,
        actorId: "different_user",
        draftVersion: "dv_different_version",
      })

      await expect(store.savePendingProposal(sampleProposal)).rejects.toThrow(
        /Idempotency key collision/
      )
    })

    it("accepts replay when validatedInput has reversed property key order but identical values", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError("Duplicate key", {
        code: "P2002",
        clientVersion: "5.22.0",
        meta: { target: ["idempotencyKey"] },
      })

      // Existing record has reversed keys in validatedInput
      const reversedInputRecord = {
        ...sampleDbRecord,
        validatedInput: {
          capacity: 100,
          eventType: "PHYSICAL",
          accessType: "REGISTRATION",
          visibility: "PRIVATE",
          title: "Tech Summit 2026",
        },
      }

      mockedPrisma.assistantActionProposal.create.mockRejectedValueOnce(p2002Error)
      mockedPrisma.assistantActionProposal.findUnique.mockResolvedValueOnce(reversedInputRecord)

      const result = await store.savePendingProposal(sampleProposal)
      expect(result.proposalId).toBe("prop_12345")
    })

    it("throws collision error when validatedInput values differ on replay", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError("Duplicate key", {
        code: "P2002",
        clientVersion: "5.22.0",
        meta: { target: ["idempotencyKey"] },
      })

      const conflictingInputRecord = {
        ...sampleDbRecord,
        validatedInput: {
          ...(sampleDbRecord.validatedInput as Record<string, unknown>),
          title: "Conflicting Event Title",
        },
      }

      mockedPrisma.assistantActionProposal.create.mockRejectedValueOnce(p2002Error)
      mockedPrisma.assistantActionProposal.findUnique.mockResolvedValueOnce(conflictingInputRecord)

      await expect(store.savePendingProposal(sampleProposal)).rejects.toThrow(
        /Idempotency key collision/
      )
    })
  })

  describe("getProposalById", () => {
    it("returns null for non-existent proposal ID", async () => {
      mockedPrisma.assistantActionProposal.findUnique.mockResolvedValueOnce(null)

      const result = await store.getProposalById("non_existent_id")
      expect(result).toBeNull()
      expect(mockedPrisma.assistantActionProposal.findUnique).toHaveBeenCalledWith({
        where: { id: "non_existent_id" },
      })
    })

    it("returns mapped proposal when found", async () => {
      mockedPrisma.assistantActionProposal.findUnique.mockResolvedValueOnce(sampleDbRecord)

      const result = await store.getProposalById("prop_12345")
      expect(result).not.toBeNull()
      expect(result?.proposalId).toBe("prop_12345")
      expect(result?.authorization.workspaceOrganizerId).toBe("org_workspace_1")
    })

    it("enforces actor scoping: returns null if actorId does not match proposal owner", async () => {
      mockedPrisma.assistantActionProposal.findUnique.mockResolvedValueOnce(sampleDbRecord)

      const result = await store.getProposalById("prop_12345", "different_actor_456")
      expect(result).toBeNull()
    })

    it("enforces actor scoping: returns proposal if actorId matches proposal owner", async () => {
      mockedPrisma.assistantActionProposal.findUnique.mockResolvedValueOnce(sampleDbRecord)

      const result = await store.getProposalById("prop_12345", "user_actor_1")
      expect(result).not.toBeNull()
      expect(result?.proposalId).toBe("prop_12345")
    })
  })

  describe("claimPendingProposalForExecution (Atomic CAS)", () => {
    const claimParams = {
      proposalId: "prop_12345",
      idempotencyKey: "idem_key_abcdef123456",
      actorId: "user_actor_1",
      now: new Date("2026-10-27T10:05:00.000Z"),
    }

    it("successfully claims proposal when status is PENDING and not expired", async () => {
      mockedPrisma.assistantActionProposal.updateMany.mockResolvedValueOnce({ count: 1 })

      const claimed = await store.claimPendingProposalForExecution(claimParams)

      expect(claimed).toBe(true)
      expect(mockedPrisma.assistantActionProposal.updateMany).toHaveBeenCalledWith({
        where: {
          id: "prop_12345",
          idempotencyKey: "idem_key_abcdef123456",
          actorId: "user_actor_1",
          status: "PENDING",
          expiresAt: { gt: claimParams.now },
        },
        data: expect.objectContaining({
          status: "EXECUTING",
          executionStartedAt: claimParams.now,
          executionLeaseExpiresAt: new Date(claimParams.now.getTime() + 120_000),
        }),
      })
    })

    it("fails claim when another request already transitioned proposal out of PENDING", async () => {
      mockedPrisma.assistantActionProposal.updateMany.mockResolvedValueOnce({ count: 0 })

      const claimed = await store.claimPendingProposalForExecution(claimParams)

      expect(claimed).toBe(false)
    })

    it("fails claim when proposal has expired", async () => {
      // In PostgreSQL query: `expiresAt: { gt: now }` matches 0 rows when now >= expiresAt
      mockedPrisma.assistantActionProposal.updateMany.mockResolvedValueOnce({ count: 0 })

      const expiredClaim = {
        ...claimParams,
        now: new Date("2026-10-27T10:20:00.000Z"), // Past expiresAt (10:15)
      }

      const claimed = await store.claimPendingProposalForExecution(expiredClaim)
      expect(claimed).toBe(false)
    })

    it("fails claim when actor ID does not match proposal owner", async () => {
      mockedPrisma.assistantActionProposal.updateMany.mockResolvedValueOnce({ count: 0 })

      const wrongActorClaim = {
        ...claimParams,
        actorId: "malicious_user_id",
      }

      const claimed = await store.claimPendingProposalForExecution(wrongActorClaim)
      expect(claimed).toBe(false)
    })
  })

  describe("invalidatePendingProposalsForDraft", () => {
    it("cancels only pending proposals matching the specified draft ID", async () => {
      mockedPrisma.assistantActionProposal.updateMany.mockResolvedValueOnce({ count: 2 })

      const invalidatedCount = await store.invalidatePendingProposalsForDraft({
        actorId: "user_actor_1",
        sessionId: "session_abc",
        draftId: "draft_001",
        reason: "Superseded by updated draftVersion",
      })

      expect(invalidatedCount).toBe(2)
      expect(mockedPrisma.assistantActionProposal.updateMany).toHaveBeenCalledWith({
        where: {
          actorId: "user_actor_1",
          sessionId: "session_abc",
          draftId: "draft_001",
          status: "PENDING",
        },
        data: expect.objectContaining({
          status: "CANCELLED",
          failureReason: "Superseded by updated draftVersion",
        }),
      })
    })
  })

  describe("markProposalCompleted", () => {
    it("marks EXECUTING proposal as COMPLETED and records verified resultMetadata", async () => {
      mockedPrisma.assistantActionProposal.updateMany.mockResolvedValueOnce({ count: 1 })
      mockedPrisma.assistantActionProposal.findUnique.mockResolvedValueOnce({
        ...sampleDbRecord,
        status: "COMPLETED",
        completedAt: new Date("2026-10-27T10:06:00.000Z"),
        resultMetadata: { eventId: "evt_created_1", slug: "tech-summit-2026-ab12" },
      })

      const now = new Date("2026-10-27T10:06:00.000Z")
      const result = await store.markProposalCompleted({
        proposalId: "prop_12345",
        resultMetadata: { eventId: "evt_created_1", slug: "tech-summit-2026-ab12" },
        now,
      })

      expect(result?.status).toBe("COMPLETED")
      expect(result?.resultMetadata).toEqual({
        eventId: "evt_created_1",
        slug: "tech-summit-2026-ab12",
      })
      expect(mockedPrisma.assistantActionProposal.updateMany).toHaveBeenCalledWith({
        where: {
          id: "prop_12345",
          status: "EXECUTING",
        },
        data: expect.objectContaining({
          status: "COMPLETED",
          completedAt: now,
        }),
      })
    })

    it("returns existing completed proposal on idempotent retry without overwriting", async () => {
      mockedPrisma.assistantActionProposal.updateMany.mockResolvedValueOnce({ count: 0 })
      mockedPrisma.assistantActionProposal.findUnique.mockResolvedValueOnce({
        ...sampleDbRecord,
        status: "COMPLETED",
        completedAt: new Date("2026-10-27T10:06:00.000Z"),
        resultMetadata: { eventId: "evt_created_1", slug: "tech-summit-2026-ab12" },
      })

      const result = await store.markProposalCompleted({
        proposalId: "prop_12345",
        resultMetadata: { eventId: "evt_created_1", slug: "tech-summit-2026-ab12" },
        now: new Date(),
      })

      expect(result?.status).toBe("COMPLETED")
    })

    it("throws error on retry when completed proposal has conflicting resultMetadata", async () => {
      mockedPrisma.assistantActionProposal.updateMany.mockResolvedValueOnce({ count: 0 })
      mockedPrisma.assistantActionProposal.findUnique.mockResolvedValueOnce({
        ...sampleDbRecord,
        status: "COMPLETED",
        completedAt: new Date("2026-10-27T10:06:00.000Z"),
        resultMetadata: { eventId: "evt_created_1", slug: "tech-summit-2026-ab12" },
      })

      await expect(
        store.markProposalCompleted({
          proposalId: "prop_12345",
          resultMetadata: { eventId: "evt_different_event", slug: "different-slug" },
          now: new Date(),
        })
      ).rejects.toThrow(/Refusing to overwrite existing completed proposal result/)
    })

    it("scopes update to actorId when provided", async () => {
      mockedPrisma.assistantActionProposal.updateMany.mockResolvedValueOnce({ count: 1 })
      mockedPrisma.assistantActionProposal.findUnique.mockResolvedValueOnce({
        ...sampleDbRecord,
        status: "COMPLETED",
      })

      await store.markProposalCompleted({
        proposalId: "prop_12345",
        resultMetadata: { eventId: "evt_created_1" },
        now: new Date(),
        actorId: "user_actor_1",
      })

      expect(mockedPrisma.assistantActionProposal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: "prop_12345",
            status: "EXECUTING",
            actorId: "user_actor_1",
          },
        })
      )
    })
  })

  describe("markProposalFailed & markProposalCancelled", () => {
    it("marks proposal FAILED and stores safe failure reason", async () => {
      mockedPrisma.assistantActionProposal.updateMany.mockResolvedValueOnce({ count: 1 })
      mockedPrisma.assistantActionProposal.findUnique.mockResolvedValueOnce({
        ...sampleDbRecord,
        status: "FAILED",
        failedAt: new Date("2026-10-27T10:07:00.000Z"),
        failureReason: "Database connection timeout during event create",
      })

      const now = new Date("2026-10-27T10:07:00.000Z")
      const result = await store.markProposalFailed({
        proposalId: "prop_12345",
        failureReason: "Database connection timeout during event create",
        now,
      })

      expect(result?.status).toBe("FAILED")
      expect(result?.failureReason).toBe("Database connection timeout during event create")
    })

    it("sanitizes sensitive secrets in failureReason before persisting", async () => {
      mockedPrisma.assistantActionProposal.updateMany.mockResolvedValueOnce({ count: 1 })
      mockedPrisma.assistantActionProposal.findUnique.mockResolvedValueOnce({
        ...sampleDbRecord,
        status: "FAILED",
      })

      await store.markProposalFailed({
        proposalId: "prop_12345",
        failureReason: "Error at postgres://admin:secretPass@localhost:5432/db with token=xyzSecretToken",
        now: new Date(),
      })

      expect(mockedPrisma.assistantActionProposal.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failureReason: expect.not.stringContaining("secretPass"),
          }),
        })
      )
    })

    it("marks proposal CANCELLED from PENDING status", async () => {
      mockedPrisma.assistantActionProposal.updateMany.mockResolvedValueOnce({ count: 1 })
      mockedPrisma.assistantActionProposal.findUnique.mockResolvedValueOnce({
        ...sampleDbRecord,
        status: "CANCELLED",
        cancelledAt: new Date("2026-10-27T10:08:00.000Z"),
      })

      const now = new Date("2026-10-27T10:08:00.000Z")
      const result = await store.markProposalCancelled({
        proposalId: "prop_12345",
        now,
      })

      expect(result?.status).toBe("CANCELLED")
      expect(mockedPrisma.assistantActionProposal.updateMany).toHaveBeenCalledWith({
        where: {
          id: "prop_12345",
          status: "PENDING",
        },
        data: expect.objectContaining({
          status: "CANCELLED",
          cancelledAt: now,
        }),
      })
    })
  })

  describe("Event Correlation and Null Compatibility", () => {
    it("supports ordinary web-created events having null creationProposalId", async () => {
      const ordinaryEvent = {
        id: "evt_web_1",
        title: "Web Created Event",
        slug: "web-created-event-1234",
        creationProposalId: null, // Ordinary events have no proposal correlation
      }

      mockedPrisma.event.create.mockResolvedValueOnce(ordinaryEvent)

      const created = await prisma.event.create({
        data: {
          title: "Web Created Event",
          slug: "web-created-event-1234",
          creationProposalId: null,
        } as any,
      })

      expect(created.creationProposalId).toBeNull()
    })

    it("supports ESA created events having unique creationProposalId", async () => {
      const esaEvent = {
        id: "evt_esa_1",
        title: "ESA Created Event",
        slug: "esa-created-event-5678",
        creationProposalId: "prop_12345",
      }

      mockedPrisma.event.findUnique.mockResolvedValueOnce(esaEvent)

      const found = await prisma.event.findUnique({
        where: { creationProposalId: "prop_12345" } as any,
      })

      expect(found).not.toBeNull()
      expect(found?.creationProposalId).toBe("prop_12345")
    })
  })

  describe("Database Failure Containment (Fail Closed)", () => {
    it("fails closed when database operations throw unexpected errors", async () => {
      mockedPrisma.assistantActionProposal.create.mockRejectedValueOnce(
        new Error("Connection terminated unexpectedly")
      )

      await expect(store.savePendingProposal(sampleProposal)).rejects.toThrow(
        "Connection terminated unexpectedly"
      )
    })
  })
})
