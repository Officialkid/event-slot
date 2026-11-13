import prisma from "@/lib/prisma"
import { Prisma, type AssistantActionProposal } from "@prisma/client"
import type {
  PendingActionPersistenceStore,
  PendingActionProposal,
  ActionPreviewCard,
  CapabilityRiskLevel,
  ActionProposalStatus as EngineActionProposalStatus,
} from "@/lib/assistant/confirmation-engine"

/**
 * Deterministically serializes any JSON value with recursively sorted object keys.
 * Ensures consistent comparison of payload structures regardless of object key insertion order.
 */
export function canonicalJsonStringify(val: unknown): string {
  if (val === null || val === undefined) return JSON.stringify(val ?? null)
  if (typeof val !== "object") return JSON.stringify(val)
  if (Array.isArray(val)) {
    return "[" + val.map((item) => canonicalJsonStringify(item)).join(",") + "]"
  }
  const obj = val as Record<string, unknown>
  const sortedKeys = Object.keys(obj).sort()
  const entries = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJsonStringify(obj[key])}`
  )
  return "{" + entries.join(",") + "}"
}

/**
 * Sanitizes an error message or failure reason to prevent leaking connection strings,
 * credentials, or internal query parameters to client-facing surfaces.
 */
export function sanitizeFailureReason(reason: string): string {
  if (!reason) return "Unknown execution failure"
  return reason
    .replace(/(postgres|postgresql|mysql|mongodb|redis):\/\/[^\s]+/gi, "[REDACTED_DB_URL]")
    .replace(/(bearer\s+|token=)[a-zA-Z0-9_\-\.]+/gi, "[REDACTED_AUTH]")
    .replace(/password(=|:\s*)[^\s,]+/gi, "password=[REDACTED]")
    .trim()
    .slice(0, 500)
}

/**
 * Maps a persisted Prisma AssistantActionProposal record to the typed
 * PendingActionProposal contract used throughout the confirmation engine.
 */
export function mapDbRecordToProposal<TInput = unknown>(
  record: AssistantActionProposal
): PendingActionProposal<TInput> {
  return {
    proposalId: record.id,
    idempotencyKey: record.idempotencyKey,
    capability: record.capability,
    riskLevel: record.riskLevel as CapabilityRiskLevel,
    requiresConfirmation: true,
    validatedInput: record.validatedInput as TInput,
    preview: record.previewCard as unknown as ActionPreviewCard,
    authorization: {
      actorId: record.actorId,
      workspaceOrganizerId: record.workspaceOrganizerId,
      targetEventId: record.targetEventId,
      sessionId: record.sessionId,
      operation: record.operation,
      draftId: record.draftId,
      draftVersion: record.draftVersion,
    },
    status: record.status as EngineActionProposalStatus,
    createdAt: record.createdAt.toISOString(),
    expiresAt: record.expiresAt.toISOString(),
    confirmedAt: record.confirmedAt?.toISOString() ?? null,
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    executedAt: (record.completedAt ?? record.executionStartedAt)?.toISOString() ?? null,
    failedAt: record.failedAt?.toISOString() ?? null,
    failureReason: record.failureReason ?? null,
    resultMetadata: (record.resultMetadata as Record<string, unknown>) ?? null,
  }
}

/**
 * Production-ready PostgreSQL/Prisma store for durable pending action proposals.
 * Guarantees persistence across container restarts, multi-instance Cloud Run scaling,
 * atomic compare-and-swap claims, and duplicate idempotency rejection.
 */
export class PrismaPendingActionStore implements PendingActionPersistenceStore {
  readonly isDurableDatabaseStore = true

  async savePendingProposal<TInput>(
    proposal: PendingActionProposal<TInput>
  ): Promise<PendingActionProposal<TInput>> {
    const actorId = proposal.authorization.actorId
    if (!actorId) {
      throw new Error("Cannot persist proposal without an authenticated actorId.")
    }

    const draftId = proposal.authorization.draftId?.trim() || "draft_default"
    const draftVersion = proposal.authorization.draftVersion?.trim() || "dv_default"
    const operation = proposal.authorization.operation?.trim() || "CREATE_EVENT"
    const workspaceOrganizerId = proposal.authorization.workspaceOrganizerId?.trim() || null
    const targetEventId = proposal.authorization.targetEventId?.trim() || null

    try {
      const created = await prisma.assistantActionProposal.create({
        data: {
          id: proposal.proposalId,
          idempotencyKey: proposal.idempotencyKey,
          capability: proposal.capability,
          operation,
          riskLevel: proposal.riskLevel,
          status: proposal.status as any,
          actorId,
          sessionId: proposal.authorization.sessionId?.trim() || null,
          workspaceOrganizerId,
          targetEventId,
          draftId,
          draftVersion,
          validatedInput: proposal.validatedInput as Prisma.InputJsonValue,
          previewCard: proposal.preview as unknown as Prisma.InputJsonValue,
          resultMetadata: (proposal.resultMetadata ?? undefined) as Prisma.InputJsonValue,
          failureReason: proposal.failureReason ? sanitizeFailureReason(proposal.failureReason) : null,
          createdAt: new Date(proposal.createdAt),
          expiresAt: new Date(proposal.expiresAt),
          confirmedAt: proposal.confirmedAt ? new Date(proposal.confirmedAt) : null,
          cancelledAt: proposal.cancelledAt ? new Date(proposal.cancelledAt) : null,
          completedAt: proposal.executedAt ? new Date(proposal.executedAt) : null,
          failedAt: proposal.failedAt ? new Date(proposal.failedAt) : null,
        },
      })

      return mapDbRecordToProposal<TInput>(created)
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        // Idempotency key conflict: perform comprehensive deterministic comparison of semantic fields
        const existing = await prisma.assistantActionProposal.findUnique({
          where: { idempotencyKey: proposal.idempotencyKey },
        })

        if (
          existing &&
          existing.actorId === actorId &&
          existing.capability === proposal.capability &&
          existing.operation === operation &&
          existing.draftId === draftId &&
          existing.draftVersion === draftVersion &&
          existing.workspaceOrganizerId === workspaceOrganizerId &&
          canonicalJsonStringify(existing.validatedInput) ===
            canonicalJsonStringify(proposal.validatedInput)
        ) {
          return mapDbRecordToProposal<TInput>(existing)
        }

        throw new Error(
          `Idempotency key collision: key "${proposal.idempotencyKey}" already exists for a different proposal.`
        )
      }

      throw err
    }
  }

  async getProposalById<TInput = unknown>(
    proposalId: string,
    actorId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<PendingActionProposal<TInput> | null> {
    if (!proposalId?.trim()) return null
    const db = tx ?? prisma

    const record = await db.assistantActionProposal.findUnique({
      where: { id: proposalId.trim() },
    })

    if (!record) return null

    // Enforce actor scoping if actorId is provided
    if (actorId && record.actorId !== actorId) {
      return null
    }

    return mapDbRecordToProposal<TInput>(record)
  }

  async invalidatePendingProposalsForDraft(params: {
    actorId: string
    sessionId: string
    draftId: string
    reason: string
    now?: Date
    tx?: Prisma.TransactionClient
  }): Promise<number> {
    const now = params.now ?? new Date()
    const db = params.tx ?? prisma

    const result = await db.assistantActionProposal.updateMany({
      where: {
        actorId: params.actorId,
        sessionId: params.sessionId,
        draftId: params.draftId,
        status: "PENDING",
      },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        failureReason: sanitizeFailureReason(params.reason),
        updatedAt: now,
      },
    })

    return result.count
  }

  /**
   * Atomically transitions a proposal from `PENDING` to `EXECUTING` with an execution lease.
   * Single SQL conditional update guarantees exactly one concurrent winner across multiple instances.
   */
  async claimPendingProposalForExecution(params: {
    proposalId: string
    idempotencyKey: string
    actorId: string
    now: Date
    tx?: Prisma.TransactionClient
  }): Promise<boolean> {
    const leaseDurationMs = 120_000 // 2-minute execution lease
    const executionLeaseExpiresAt = new Date(params.now.getTime() + leaseDurationMs)
    const db = params.tx ?? prisma

    const result = await db.assistantActionProposal.updateMany({
      where: {
        id: params.proposalId,
        idempotencyKey: params.idempotencyKey,
        actorId: params.actorId,
        status: "PENDING",
        expiresAt: { gt: params.now },
      },
      data: {
        status: "EXECUTING",
        executionStartedAt: params.now,
        executionLeaseExpiresAt,
        updatedAt: params.now,
      },
    })

    return result.count === 1
  }

  async markProposalCompleted<TInput = unknown>(params: {
    proposalId: string
    resultMetadata: Record<string, unknown>
    now: Date
    actorId?: string
    tx?: Prisma.TransactionClient
  }): Promise<PendingActionProposal<TInput> | null> {
    const db = params.tx ?? prisma

    const updateResult = await db.assistantActionProposal.updateMany({
      where: {
        id: params.proposalId,
        status: "EXECUTING",
        ...(params.actorId ? { actorId: params.actorId } : {}),
      },
      data: {
        status: "COMPLETED",
        completedAt: params.now,
        resultMetadata: params.resultMetadata as Prisma.InputJsonValue,
        updatedAt: params.now,
      },
    })

    // If 0 rows updated, verify if it was already COMPLETED (idempotent retry)
    if (updateResult.count === 0) {
      const existing = await this.getProposalById<TInput>(params.proposalId, params.actorId, db)
      if (existing?.status === "COMPLETED") {
        if (
          canonicalJsonStringify(existing.resultMetadata) ===
          canonicalJsonStringify(params.resultMetadata)
        ) {
          return existing
        }
        throw new Error(
          "Refusing to overwrite existing completed proposal result with conflicting outcome."
        )
      }
      return null
    }

    return this.getProposalById<TInput>(params.proposalId, params.actorId, db)
  }

  async markProposalFailed<TInput = unknown>(params: {
    proposalId: string
    failureReason: string
    now: Date
    actorId?: string
    tx?: Prisma.TransactionClient
  }): Promise<PendingActionProposal<TInput> | null> {
    const sanitized = sanitizeFailureReason(params.failureReason)
    const db = params.tx ?? prisma

    const updateResult = await db.assistantActionProposal.updateMany({
      where: {
        id: params.proposalId,
        status: "EXECUTING",
        ...(params.actorId ? { actorId: params.actorId } : {}),
      },
      data: {
        status: "FAILED",
        failedAt: params.now,
        failureReason: sanitized,
        updatedAt: params.now,
      },
    })

    if (updateResult.count === 0) {
      return null
    }

    return this.getProposalById<TInput>(params.proposalId, params.actorId, db)
  }

  async markProposalCancelled<TInput = unknown>(params: {
    proposalId: string
    now: Date
    actorId?: string
    tx?: Prisma.TransactionClient
  }): Promise<PendingActionProposal<TInput> | null> {
    const db = params.tx ?? prisma

    const updateResult = await db.assistantActionProposal.updateMany({
      where: {
        id: params.proposalId,
        status: "PENDING",
        ...(params.actorId ? { actorId: params.actorId } : {}),
      },
      data: {
        status: "CANCELLED",
        cancelledAt: params.now,
        updatedAt: params.now,
      },
    })

    if (updateResult.count === 0) {
      return null
    }

    return this.getProposalById<TInput>(params.proposalId, params.actorId, db)
  }

  async markProposalExpired<TInput = unknown>(params: {
    proposalId: string
    now: Date
    actorId?: string
    tx?: Prisma.TransactionClient
  }): Promise<PendingActionProposal<TInput> | null> {
    const db = params.tx ?? prisma

    const updateResult = await db.assistantActionProposal.updateMany({
      where: {
        id: params.proposalId,
        status: "PENDING",
        ...(params.actorId ? { actorId: params.actorId } : {}),
      },
      data: {
        status: "EXPIRED",
        updatedAt: params.now,
      },
    })

    if (updateResult.count === 0) {
      return null
    }

    return this.getProposalById<TInput>(params.proposalId, params.actorId, db)
  }
}
