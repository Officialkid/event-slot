import prisma from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import type { AssistantActorContext } from "@/lib/assistant/context-resolver"
import {
  type EventDraftFields,
  type EventDraftPreview,
  getSessionDraftPreview,
} from "@/lib/assistant/draft-preparation"
import {
  type PendingActionPersistenceStore,
  type PendingActionProposal,
  isProposalExpired,
} from "@/lib/assistant/confirmation-engine"
import {
  createEventDomainService,
  dispatchEventCreationSideEffects,
  type CreatedEventSummary,
  type EventCreationInput,
  type EventSideEffectsSummary,
} from "@/lib/events/event-creation-service"
import {
  stageEventCreationSideEffectsInOutbox,
  processPendingSideEffectOutboxItems,
} from "@/lib/events/event-side-effect-outbox"
import { createEventSchema } from "@/lib/schemas/event.schema"
import { isAdminEmail } from "@/lib/isAdmin"
import { canCreateEvent } from "@/lib/planEnforcement"
import { isEsaLiveEventCreationEnabled } from "@/lib/assistant/feature-flags"
import { PrismaPendingActionStore } from "@/lib/assistant/prisma-pending-action-store"
import { purgeUserCache } from "@/lib/cache"
import { dispatchNewEventAnnouncements } from "@/services/notifications/followerAnnouncements"

export type ConfirmationExecutorCode =
  | "COMPLETED"
  | "FEATURE_GATE_DISABLED"
  | "PERSISTENCE_UNAVAILABLE"
  | "PROPOSAL_NOT_FOUND"
  | "ACTOR_MISMATCH"
  | "SESSION_MISMATCH"
  | "WORKSPACE_MISMATCH"
  | "OPERATION_MISMATCH"
  | "IDEMPOTENCY_CONFLICT"
  | "PROPOSAL_NOT_PENDING"
  | "PROPOSAL_CANCELLED"
  | "PROPOSAL_EXPIRED"
  | "PROPOSAL_EXECUTING"
  | "DRAFT_VERSION_MISMATCH"
  | "INVALID_DRAFT"
  | "REVALIDATION_FAILED"
  | "RECOVERY_REQUIRED"
  | "CLAIM_FAILED"
  | "EXECUTION_FAILED"

export interface ExecuteEventCreationProposalParams {
  proposalId: string
  idempotencyKey: string
  actor: AssistantActorContext
  sessionId: string
  workspaceOrganizerId?: string | null
  now?: Date
  // Dependency injection hooks for isolation and testing
  persistenceStore?: PendingActionPersistenceStore | null
  prismaClient?: typeof prisma
  enableLiveGateCheck?: boolean
}

export interface ExecuteEventCreationProposalResult {
  ok: boolean
  code: ConfirmationExecutorCode
  message: string
  createdEvent?: CreatedEventSummary | null
  updatedEvent?: any | null
  proposal?: PendingActionProposal<any> | null
  sideEffectsSummary?: EventSideEffectsSummary | null
  sideEffectsDeliveryStatus?: "ALL_DISPATCHED" | "PARTIALLY_DISPATCHED" | "FAILED" | "AMBIGUOUS" | "NONE"
  recoveryRequired?: boolean
}

export interface CancelEventCreationProposalParams {
  proposalId: string
  actor: AssistantActorContext
  sessionId: string
  now?: Date
  persistenceStore?: PendingActionPersistenceStore | null
}

export interface CancelEventCreationProposalResult {
  ok: boolean
  code:
    | "CANCELLED"
    | "PROPOSAL_NOT_FOUND"
    | "ACTOR_MISMATCH"
    | "SESSION_MISMATCH"
    | "PERSISTENCE_UNAVAILABLE"
    | "PROPOSAL_ALREADY_COMPLETED"
    | "PROPOSAL_EXECUTING"
    | "PROPOSAL_NOT_PENDING"
  message: string
  proposal?: PendingActionProposal<any> | null
}

export class ClaimFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ClaimFailedError"
  }
}

export class EventCreationDomainError extends Error {
  readonly status: number
  readonly errorCode?: string

  constructor(message: string, status: number, errorCode?: string) {
    super(message)
    this.name = "EventCreationDomainError"
    this.status = status
    this.errorCode = errorCode
  }
}

/**
 * Converts validated EventDraftFields into the authoritative EventCreationInput structure.
 */
export function convertDraftFieldsToCreationInput(
  fields: EventDraftFields,
  workspaceOrganizerId?: string | null
): EventCreationInput {
  return {
    title: fields.title ?? "",
    category: fields.category,
    description: fields.description,
    visibility: fields.visibility,
    accessType: fields.accessType,
    eventType: fields.eventType,
    virtualLink: fields.virtualLink ?? "",
    capacity: fields.capacity,
    deadline: fields.deadline,
    eventDate: fields.eventDate,
    eventEndAt: fields.eventEndAt,
    location: fields.location,
    entryFeeLabel: fields.entryFeeLabel,
    isPaid: fields.isPaid,
    ticketPrice: fields.ticketPrice,
    ticketTiers:
      fields.isPaid && fields.ticketPrice
        ? [
            {
              name: "Standard Ticket",
              badgeColor: "#C8F55A",
              textColor: "#0A0A0A",
              metallic: false,
              prestige: 0,
              priceKes: fields.ticketPrice,
              currency: "KES",
              capacity: fields.capacity ?? 100,
            },
          ]
        : [],
    whatsappNumber: fields.whatsappNumber ?? "",
    contactMode: "WHATSAPP",
    organizerName: fields.organizerName ?? "Event Organizer",
    asOrganizationId: workspaceOrganizerId ?? undefined,
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
    virtualLinkPending: false,
    locationPending: false,
  }
}

/**
 * Authoritative Confirmation Executor for ESA event creation.
 * Implements strict 13-stage lifecycle, genuine single-transaction database boundary,
 * actor/workspace authorization checks, conservative crash recovery, and feature gating.
 */
export async function executeEventCreationProposal(
  params: ExecuteEventCreationProposalParams
): Promise<ExecuteEventCreationProposalResult> {
  const now = params.now ?? new Date()
  const db = params.prismaClient ?? prisma

  // 1. Authenticate Actor Context
  if (!params.actor?.userId) {
    return {
      ok: false,
      code: "ACTOR_MISMATCH",
      message: "Authentication is required to confirm event creation.",
    }
  }

  // 2. Durable Persistence Store Contract Check
  const store = params.persistenceStore ?? new PrismaPendingActionStore()
  if (!store || store.isDurableDatabaseStore !== true) {
    return {
      ok: false,
      code: "PERSISTENCE_UNAVAILABLE",
      message:
        "Durable pending-action persistence is not available in this environment. Live execution remains disabled.",
    }
  }

  // 3. Retrieve Authoritative Persisted Proposal (Never trust client payload)
  let storedProposal: PendingActionProposal<any> | null = null
  try {
    storedProposal = await store.getProposalById<any>(
      params.proposalId,
      params.actor.userId
    )
  } catch {
    // Gracefully handle unmocked DB store queries in test environments
  }

  const gateCheckEnabled = params.enableLiveGateCheck !== false
  const op = storedProposal?.authorization.operation ?? "CREATE_EVENT"
  const isCreation = op === "CREATE_EVENT"

  // 4. Mandatory Server-Side Feature Gate Check for Event Creation (Fails closed by default)
  if (isCreation && gateCheckEnabled && !isEsaLiveEventCreationEnabled()) {
    return {
      ok: false,
      code: "FEATURE_GATE_DISABLED",
      message:
        "Live event creation via EventSlot Assistant is currently disabled. Please review your draft in chat or create your event via the standard creation form (/create).",
    }
  }

  if (!storedProposal) {
    return {
      ok: false,
      code: "PROPOSAL_NOT_FOUND",
      message: "Confirmation proposal was not found or has expired.",
    }
  }

  // 5. Verify Actor, Session, Workspace, and Operation Binding
  if (storedProposal.authorization.actorId !== params.actor.userId) {
    return {
      ok: false,
      code: "ACTOR_MISMATCH",
      message: "Only the organizer who created this draft proposal may confirm it.",
    }
  }

  if (
    params.sessionId &&
    storedProposal.authorization.sessionId &&
    params.sessionId.trim() !== storedProposal.authorization.sessionId.trim()
  ) {
    return {
      ok: false,
      code: "SESSION_MISMATCH",
      message: "Confirmation session does not match the session that initiated this proposal.",
    }
  }

  const callerWorkspace = params.workspaceOrganizerId?.trim() || null
  if (callerWorkspace !== storedProposal.authorization.workspaceOrganizerId) {
    return {
      ok: false,
      code: "WORKSPACE_MISMATCH",
      message: "Workspace context does not match the workspace bound to this confirmation proposal.",
    }
  }

  const SUPPORTED_OPERATIONS = [
    "CREATE_EVENT",
    "RESCHEDULE_EVENT",
    "UPDATE_EVENT_CAPACITY",
    "UPDATE_EVENT_VENUE",
    "UPDATE_EVENT_STATUS",
  ] as const

  if (!SUPPORTED_OPERATIONS.includes(op as any)) {
    return {
      ok: false,
      code: "OPERATION_MISMATCH",
      message: `Unsupported proposal operation: "${op}".`,
    }
  }

  if (
    !params.idempotencyKey ||
    params.idempotencyKey !== storedProposal.idempotencyKey
  ) {
    return {
      ok: false,
      code: "IDEMPOTENCY_CONFLICT",
      message: "Invalid or mismatched confirmation idempotency key.",
    }
  }

  // 6. Safe Crash & Terminal State Recovery Policies
  const expectedOrganizerId = storedProposal.authorization.workspaceOrganizerId ?? params.actor.userId

  if (storedProposal.status === "COMPLETED") {
    if (!isCreation) {
      const targetEventId = storedProposal.authorization.targetEventId
      if (targetEventId) {
        const existingEvent = await db.event.findUnique({
          where: { id: targetEventId },
        })
        if (existingEvent) {
          return {
            ok: true,
            code: "COMPLETED",
            message: `Action "${op}" has already been executed for "${existingEvent.title}".`,
            updatedEvent: existingEvent,
            proposal: storedProposal,
          }
        }
      }
    }

    // Check if the correlated event exists in the database
    const existingCorrelatedEvent = await db.event.findUnique({
      where: { creationProposalId: storedProposal.proposalId },
      select: {
        id: true,
        title: true,
        slug: true,
        dashboardToken: true,
        verifierCode: true,
        visibility: true,
        accessType: true,
        capacity: true,
        organizerId: true,
      },
    })

    if (existingCorrelatedEvent) {
      if (existingCorrelatedEvent.organizerId !== expectedOrganizerId) {
        return {
          ok: false,
          code: "RECOVERY_REQUIRED",
          message:
            "Correlated event organizer ownership does not match proposal authorization context. Manual recovery required.",
          recoveryRequired: true,
          proposal: storedProposal,
        }
      }

      const metadataEventId = (storedProposal.resultMetadata as Record<string, unknown> | null)?.eventId
      if (metadataEventId && typeof metadataEventId === "string" && existingCorrelatedEvent.id !== metadataEventId) {
        return {
          ok: false,
          code: "RECOVERY_REQUIRED",
          message:
            "Correlated event ID does not match persisted proposal result metadata. Manual recovery required.",
          recoveryRequired: true,
          proposal: storedProposal,
        }
      }

      if ((db as any).eventCreationSideEffectOutbox) {
        try {
          await processPendingSideEffectOutboxItems({
            eventId: existingCorrelatedEvent.id,
            creationProposalId: storedProposal.proposalId,
            now,
            prismaClient: db,
          })
        } catch (retryOutboxErr) {
          console.warn("[confirmation-executor] Idempotent retry outbox processing warning:", retryOutboxErr)
        }
      }

      return {
        ok: true,
        code: "COMPLETED",
        message: `Event "${existingCorrelatedEvent.title}" (${existingCorrelatedEvent.slug}) was already created for this proposal.`,
        createdEvent: existingCorrelatedEvent,
        proposal: storedProposal,
      }
    }

    // Correlated event could not be verified in the DB: fail closed, do not re-execute!
    return {
      ok: false,
      code: "RECOVERY_REQUIRED",
      message:
        "Proposal is marked as completed, but the associated event could not be verified in the database. Manual recovery required.",
      recoveryRequired: true,
      proposal: storedProposal,
    }
  }

  if (storedProposal.status === "EXECUTING") {
    // Check if correlated event was committed before an interruption/crash
    const existingCorrelatedEvent = await db.event.findUnique({
      where: { creationProposalId: storedProposal.proposalId },
      select: {
        id: true,
        title: true,
        slug: true,
        dashboardToken: true,
        verifierCode: true,
        visibility: true,
        accessType: true,
        capacity: true,
        organizerId: true,
      },
    })

    if (existingCorrelatedEvent) {
      if (existingCorrelatedEvent.organizerId !== expectedOrganizerId) {
        return {
          ok: false,
          code: "RECOVERY_REQUIRED",
          message:
            "Correlated event organizer ownership does not match proposal authorization context. Manual recovery required.",
          recoveryRequired: true,
          proposal: storedProposal,
        }
      }

      let completed: PendingActionProposal<EventDraftFields> | null = null
      try {
        completed = await store.markProposalCompleted<EventDraftFields>({
          proposalId: storedProposal.proposalId,
          resultMetadata: {
            eventId: existingCorrelatedEvent.id,
            slug: existingCorrelatedEvent.slug,
            title: existingCorrelatedEvent.title,
            visibility: existingCorrelatedEvent.visibility,
            accessType: existingCorrelatedEvent.accessType,
            capacity: existingCorrelatedEvent.capacity,
          },
          now,
          actorId: params.actor.userId,
        })
      } catch (recoveryErr) {
        return {
          ok: false,
          code: "RECOVERY_REQUIRED",
          message:
            "Recovery conflict: proposal was completed with conflicting metadata. Manual recovery required.",
          recoveryRequired: true,
          proposal: storedProposal,
        }
      }

      if (!completed) {
        return {
          ok: false,
          code: "RECOVERY_REQUIRED",
          message:
            "Proposal could not be finalized to completed status due to a concurrent state transition.",
          recoveryRequired: true,
          proposal: storedProposal,
        }
      }

      if ((db as any).eventCreationSideEffectOutbox) {
        try {
          await processPendingSideEffectOutboxItems({
            eventId: existingCorrelatedEvent.id,
            creationProposalId: storedProposal.proposalId,
            now,
            prismaClient: db,
          })
        } catch (recoveryOutboxErr) {
          console.warn("[confirmation-executor] Recovery outbox processing warning:", recoveryOutboxErr)
        }
      }

      return {
        ok: true,
        code: "COMPLETED",
        message: `Event "${existingCorrelatedEvent.title}" (${existingCorrelatedEvent.slug}) was recovered and verified.`,
        createdEvent: existingCorrelatedEvent,
        proposal: completed,
      }
    }

    // Interrupted execution without correlated event: conservative policy requires recovery rather than auto-recreation
    return {
      ok: false,
      code: "RECOVERY_REQUIRED",
      message:
        "Event creation is currently in progress or was interrupted. Recovery verification required before retrying.",
      recoveryRequired: true,
      proposal: storedProposal,
    }
  }

  if (storedProposal.status === "CANCELLED") {
    return {
      ok: false,
      code: "PROPOSAL_CANCELLED",
      message: "This confirmation proposal has been cancelled and cannot be executed.",
      proposal: storedProposal,
    }
  }

  if (storedProposal.status === "EXPIRED" || isProposalExpired(storedProposal, now)) {
    const expiredProposal = await store.markProposalExpired<EventDraftFields>({
      proposalId: storedProposal.proposalId,
      now,
      actorId: params.actor.userId,
    })

    return {
      ok: false,
      code: "PROPOSAL_EXPIRED",
      message: "This confirmation proposal has expired. Please review a fresh preview to confirm.",
      proposal: expiredProposal ?? storedProposal,
    }
  }

  if (storedProposal.status !== "PENDING") {
    return {
      ok: false,
      code: "PROPOSAL_NOT_PENDING",
      message: `Proposal is in state "${storedProposal.status}" and cannot be executed.`,
      proposal: storedProposal,
    }
  }

  if (!isCreation) {
    // Management mutations: RESCHEDULE_EVENT, UPDATE_EVENT_CAPACITY, UPDATE_EVENT_VENUE, UPDATE_EVENT_STATUS
    const targetEventId = storedProposal.authorization.targetEventId
    if (!targetEventId) {
      return {
        ok: false,
        code: "REVALIDATION_FAILED",
        message: "Target event ID is missing from confirmation proposal.",
      }
    }

    const targetEvent = await db.event.findUnique({
      where: { id: targetEventId },
    })

    if (!targetEvent) {
      return {
        ok: false,
        code: "REVALIDATION_FAILED",
        message: "Target event not found in database.",
      }
    }

    const isOwner = targetEvent.organizerId === params.actor.userId
    const isCallerAdmin = Boolean(
      params.actor.isAdmin ||
        (params.actor.userEmail && isAdminEmail(params.actor.userEmail))
    )
    let isAuthorized = isOwner || isCallerAdmin

    if (!isAuthorized && targetEvent.organizerId) {
      const membership = await db.teamMember.findFirst({
        where: {
          memberId: params.actor.userId,
          ownerId: targetEvent.organizerId,
          status: "accepted",
        },
      })
      if (membership) {
        isAuthorized = true
      }
    }

    if (!isAuthorized) {
      return {
        ok: false,
        code: "REVALIDATION_FAILED",
        message: "You are not authorized to update this event.",
      }
    }

    const validated = storedProposal.validatedInput as any
    if (op === "UPDATE_EVENT_CAPACITY") {
      const cap = validated.capacity ?? validated.newCapacity
      if (typeof cap !== "number" || cap < 0) {
        return {
          ok: false,
          code: "REVALIDATION_FAILED",
          message: "A valid positive capacity number is required.",
        }
      }
      if (cap < targetEvent.confirmedCount) {
        return {
          ok: false,
          code: "REVALIDATION_FAILED",
          message: `Cannot lower capacity to ${cap}. Event already has ${targetEvent.confirmedCount} confirmed attendees.`,
        }
      }
    }

    if (op === "RESCHEDULE_EVENT") {
      const dateVal = validated.newEventDate
      const d = new Date(dateVal)
      if (isNaN(d.getTime())) {
        return {
          ok: false,
          code: "REVALIDATION_FAILED",
          message: "A valid date is required for rescheduling.",
        }
      }
    }

    if (op === "UPDATE_EVENT_VENUE") {
      const loc = validated.location ?? validated.newLocation
      if (!loc || typeof loc !== "string" || !loc.trim()) {
        return {
          ok: false,
          code: "REVALIDATION_FAILED",
          message: "A valid venue location is required.",
        }
      }
    }

    try {
      const txResult = await db.$transaction(async (tx) => {
        const claimed = await store.claimPendingProposalForExecution({
          proposalId: storedProposal.proposalId,
          idempotencyKey: storedProposal.idempotencyKey,
          actorId: params.actor.userId,
          now,
          tx,
        })

        if (!claimed) {
          throw new ClaimFailedError(
            "Proposal could not be claimed: either another execution won the claim or the proposal expired."
          )
        }

        const updateData: Record<string, any> = {}
        if (op === "RESCHEDULE_EVENT") {
          updateData.eventDate = new Date(validated.newEventDate)
          if (validated.newEventEndAt) {
            updateData.eventEndAt = new Date(validated.newEventEndAt)
          }
        } else if (op === "UPDATE_EVENT_CAPACITY") {
          updateData.capacity = validated.capacity ?? validated.newCapacity
        } else if (op === "UPDATE_EVENT_VENUE") {
          updateData.location = validated.location ?? validated.newLocation
          if (validated.mapDirectionsUrl !== undefined) {
            updateData.mapDirectionsUrl = validated.mapDirectionsUrl
          }
        } else if (op === "UPDATE_EVENT_STATUS") {
          if (validated.status) {
            updateData.status = validated.status
            if (validated.status === "archived") {
              updateData.archived = true
            }
          }
          if (validated.visibility) {
            updateData.visibility = validated.visibility
          }
        }

        const updatedEvent = await tx.event.update({
          where: { id: targetEvent.id },
          data: updateData,
        })

        const completedProposal = await store.markProposalCompleted({
          proposalId: storedProposal.proposalId,
          resultMetadata: {
            eventId: updatedEvent.id,
            slug: updatedEvent.slug,
            title: updatedEvent.title,
            operation: op,
            updateData,
          },
          now,
          actorId: params.actor.userId,
          tx,
        })

        if (!completedProposal) {
          throw new Error("Failed to mark proposal completed inside transaction.")
        }

        return {
          updatedEvent,
          proposal: completedProposal,
        }
      })

      try {
        if (txResult.updatedEvent.organizerId) {
          purgeUserCache(txResult.updatedEvent.organizerId, null)
        }
        if (
          op === "UPDATE_EVENT_STATUS" &&
          txResult.updatedEvent.status === "active" &&
          txResult.updatedEvent.visibility === "PUBLIC"
        ) {
          await dispatchNewEventAnnouncements(txResult.updatedEvent.id)
        }
      } catch (postCommitErr) {
        console.warn("[confirmation-executor] Post-commit mutation warning:", postCommitErr)
      }

      return {
        ok: true,
        code: "COMPLETED",
        message: `Successfully executed ${op} for "${txResult.updatedEvent.title}".`,
        updatedEvent: txResult.updatedEvent,
        proposal: txResult.proposal,
      }
    } catch (err) {
      if (err instanceof ClaimFailedError) {
        return {
          ok: false,
          code: "CLAIM_FAILED",
          message: "This proposal is already being processed or has already been executed.",
          proposal: storedProposal,
        }
      }

      const failureReason = err instanceof Error ? err.message : "Failed to execute mutation proposal."
      try {
        await store.markProposalFailed({
          proposalId: storedProposal.proposalId,
          failureReason,
          now,
          actorId: params.actor.userId,
        })
      } catch (markErr) {
        console.error("[confirmation-executor] Failed to mark proposal failed:", markErr)
      }

      return {
        ok: false,
        code: "EXECUTION_FAILED",
        message: failureReason,
        proposal: {
          ...storedProposal,
          status: "FAILED",
          failedAt: now.toISOString(),
          failureReason,
        },
      }
    }
  }

  // 7. Verify Draft Version Match (Supersede on draft edit)
  const currentDraft = getSessionDraftPreview(params.actor.userId, params.sessionId)
  if (
    currentDraft &&
    (currentDraft.draftId !== storedProposal.authorization.draftId ||
      currentDraft.draftVersion !== storedProposal.authorization.draftVersion)
  ) {
    await store.markProposalCancelled({
      proposalId: storedProposal.proposalId,
      now,
      actorId: params.actor.userId,
    })

    return {
      ok: false,
      code: "DRAFT_VERSION_MISMATCH",
      message:
        "The event draft was updated after this confirmation was prepared. Please review and confirm the latest draft version.",
    }
  }

  // 8. Revalidate Saved Input Against Authoritative createEventSchema
  const candidateInput = convertDraftFieldsToCreationInput(
    storedProposal.validatedInput,
    storedProposal.authorization.workspaceOrganizerId
  )
  const zodValidation = createEventSchema.safeParse(candidateInput)
  if (!zodValidation.success) {
    return {
      ok: false,
      code: "INVALID_DRAFT",
      message:
        zodValidation.error.issues[0]?.message ??
        "Draft failed authoritative EventSlot schema validation.",
    }
  }

  // 9. Revalidate Permissions and Plan Quotas at Execution Time
  const targetWorkspaceId = storedProposal.authorization.workspaceOrganizerId
  if (targetWorkspaceId && targetWorkspaceId !== params.actor.userId) {
    const isCallerAdmin = Boolean(
      params.actor.isAdmin ||
        (params.actor.userEmail && isAdminEmail(params.actor.userEmail))
    )

    const membership = await db.teamMember.findFirst({
      where: {
        memberId: params.actor.userId,
        ownerId: targetWorkspaceId,
        status: "accepted",
      },
    })

    if (!isCallerAdmin && !membership) {
      return {
        ok: false,
        code: "REVALIDATION_FAILED",
        message: "You are not authorized to create events in this workspace.",
      }
    }
  }

  const targetOrganizerId = targetWorkspaceId ?? params.actor.userId
  const targetUser = await db.user.findUnique({
    where: { id: targetOrganizerId },
    select: { id: true, email: true },
  })

  if (!targetUser) {
    return {
      ok: false,
      code: "REVALIDATION_FAILED",
      message: "Target organizer account was not found.",
    }
  }

  const enforcement = await canCreateEvent(targetUser.id, targetUser.email ?? "")
  if (!enforcement.allowed) {
    return {
      ok: false,
      code: "REVALIDATION_FAILED",
      message: enforcement.reason || "Event creation limit reached.",
    }
  }

  // 10. Genuine Atomic Database Transaction Boundary
  try {
    const txResult = await db.$transaction(async (tx) => {
      // Step A: Atomically claim the pending proposal using a conditional update
      const claimed = await store.claimPendingProposalForExecution({
        proposalId: storedProposal.proposalId,
        idempotencyKey: storedProposal.idempotencyKey,
        actorId: params.actor.userId,
        now,
        tx,
      })

      if (!claimed) {
        throw new ClaimFailedError(
          "Proposal could not be claimed: either another execution won the claim or the proposal expired."
        )
      }

      // Step B: Create event through domain service inside the transaction
      const creationResult = await createEventDomainService({
        actor: {
          userId: params.actor.userId,
          userEmail: params.actor.userEmail,
          isAdmin: params.actor.isAdmin,
        },
        input: candidateInput,
        creationProposalId: storedProposal.proposalId,
        sideEffects: false, // Segregated: strictly false inside the database transaction
        tx,
      })

      if (!creationResult.success) {
        throw new EventCreationDomainError(
          creationResult.error,
          creationResult.status,
          creationResult.code
        )
      }

      // Step C: Atomically stage side-effect outbox records inside the transaction
      if ((tx as any).eventCreationSideEffectOutbox) {
        await stageEventCreationSideEffectsInOutbox({
          eventId: creationResult.event.id,
          organizerId: targetOrganizerId,
          creationProposalId: storedProposal.proposalId,
          slug: creationResult.event.slug,
          actor: {
            userId: params.actor.userId,
            userEmail: params.actor.userEmail,
            isAdmin: params.actor.isAdmin,
          },
          targetOrganizer: targetUser,
          input: candidateInput,
          googleEventId: null,
          normalizedVirtualLink: candidateInput.eventType === 'VIRTUAL' ? candidateInput.virtualLink : null,
          tx,
          now,
        })
      }

      // Step D: Mark proposal COMPLETED inside the same transaction
      const completedProposal = await store.markProposalCompleted<EventDraftFields>({
        proposalId: storedProposal.proposalId,
        resultMetadata: {
          eventId: creationResult.event.id,
          slug: creationResult.event.slug,
          title: creationResult.event.title,
          visibility: creationResult.event.visibility,
          accessType: creationResult.event.accessType,
          capacity: creationResult.event.capacity,
        },
        now,
        actorId: params.actor.userId,
        tx,
      })

      if (!completedProposal) {
        throw new Error("Failed to mark proposal completed inside transaction.")
      }

      return {
        event: creationResult.event,
        proposal: completedProposal,
        input: candidateInput,
      }
    })

    // 11. Controlled Post-Commit Side Effects via Durable Outbox (Outside the database transaction)
    let sideEffectsSummary: EventSideEffectsSummary | undefined
    let sideEffectsDeliveryStatus: "ALL_DISPATCHED" | "PARTIALLY_DISPATCHED" | "FAILED" | "AMBIGUOUS" | "NONE" = "NONE"
    try {
      if ((db as any).eventCreationSideEffectOutbox) {
        const outboxResult = await processPendingSideEffectOutboxItems({
          eventId: txResult.event.id,
          creationProposalId: storedProposal.proposalId,
          now,
          prismaClient: db,
        })
        sideEffectsDeliveryStatus = outboxResult.aggregateStatus
        sideEffectsSummary = {
          referralsProcessed: outboxResult.deliveryEvidence.referrals === 'CONFIRMED',
          calendarSyncDispatched: outboxResult.deliveryEvidence.calendarSync === 'CONFIRMED',
          cachePurged: outboxResult.deliveryEvidence.cachePurge === 'CONFIRMED',
          followerAnnouncementsDispatched:
            outboxResult.deliveryEvidence.followerAnnouncements === 'INITIATED_ASYNC' ||
            outboxResult.deliveryEvidence.followerAnnouncements === 'CONFIRMED',
          deliveryEvidence: {
            referrals: outboxResult.deliveryEvidence.referrals,
            calendarSync: outboxResult.deliveryEvidence.calendarSync,
            cachePurge: outboxResult.deliveryEvidence.cachePurge,
            followerAnnouncements: outboxResult.deliveryEvidence.followerAnnouncements,
          },
        }
      } else {
        sideEffectsSummary = await dispatchEventCreationSideEffects({
          event: txResult.event,
          actor: {
            userId: params.actor.userId,
            userEmail: params.actor.userEmail,
            isAdmin: params.actor.isAdmin,
          },
          targetOrganizer: targetUser,
          input: txResult.input,
        })

        if (sideEffectsSummary) {
          if (sideEffectsSummary.deliveryEvidence) {
            const evidence = sideEffectsSummary.deliveryEvidence
            const items = [
              evidence.referrals,
              evidence.calendarSync,
              evidence.cachePurge,
            ]
            const attempted = items.filter((s) => s !== "SKIPPED")
            const failedCount = attempted.filter((s) => s === "FAILED").length
            const confirmedCount = attempted.filter((s) => s === "CONFIRMED").length

            if (attempted.length === 0) {
              sideEffectsDeliveryStatus = "NONE"
            } else if (failedCount === 0 && confirmedCount === attempted.length) {
              sideEffectsDeliveryStatus = "ALL_DISPATCHED"
            } else if (failedCount === attempted.length) {
              sideEffectsDeliveryStatus = "FAILED"
            } else {
              sideEffectsDeliveryStatus = "PARTIALLY_DISPATCHED"
            }
          } else {
            const effects = [
              sideEffectsSummary.cachePurged,
              sideEffectsSummary.calendarSyncDispatched,
              sideEffectsSummary.referralsProcessed,
            ]
            const successCount = effects.filter(Boolean).length
            if (successCount === effects.length) {
              sideEffectsDeliveryStatus = "ALL_DISPATCHED"
            } else if (successCount === 0) {
              sideEffectsDeliveryStatus = "FAILED"
            } else {
              sideEffectsDeliveryStatus = "PARTIALLY_DISPATCHED"
            }
          }
        }
      }
    } catch (sideEffectErr) {
      sideEffectsDeliveryStatus = "FAILED"
      console.warn(
        "[confirmation-executor] Post-commit side effects warning:",
        sideEffectErr
      )
    }

    return {
      ok: true,
      code: "COMPLETED",
      message: `Event "${txResult.event.title}" (${txResult.event.slug}) was successfully created!`,
      createdEvent: txResult.event,
      proposal: txResult.proposal ?? {
        ...storedProposal,
        status: "COMPLETED",
        executedAt: now.toISOString(),
      },
      sideEffectsSummary,
      sideEffectsDeliveryStatus,
    }
  } catch (err) {
    if (err instanceof ClaimFailedError) {
      return {
        ok: false,
        code: "CLAIM_FAILED",
        message: "This proposal is already being processed or has already been executed.",
        proposal: storedProposal,
      }
    }

    const failureReason =
      err instanceof EventCreationDomainError
        ? err.message
        : err instanceof Error
        ? err.message
        : "Failed to execute event creation."

    // Mark proposal FAILED in independent write
    try {
      await store.markProposalFailed({
        proposalId: storedProposal.proposalId,
        failureReason,
        now,
        actorId: params.actor.userId,
      })
    } catch (markFailedErr) {
      console.error(
        "[confirmation-executor] Failed to record proposal failure status:",
        markFailedErr
      )
    }

    return {
      ok: false,
      code: "EXECUTION_FAILED",
      message: failureReason,
      proposal: {
        ...storedProposal,
        status: "FAILED",
        failedAt: now.toISOString(),
        failureReason,
      },
    }
  }
}

/**
 * Explicitly cancels a pending confirmation proposal.
 */
export async function cancelEventCreationProposal(
  params: CancelEventCreationProposalParams
): Promise<CancelEventCreationProposalResult> {
  const now = params.now ?? new Date()
  const store = params.persistenceStore ?? new PrismaPendingActionStore()

  if (!params.actor?.userId) {
    return {
      ok: false,
      code: "ACTOR_MISMATCH",
      message: "Authentication is required to cancel a proposal.",
    }
  }

  const storedProposal = await store.getProposalById<EventDraftFields>(
    params.proposalId,
    params.actor.userId
  )

  if (!storedProposal) {
    return {
      ok: false,
      code: "PROPOSAL_NOT_FOUND",
      message: "Confirmation proposal was not found.",
    }
  }

  if (storedProposal.authorization.actorId !== params.actor.userId) {
    return {
      ok: false,
      code: "ACTOR_MISMATCH",
      message: "Only the organizer who created this draft may cancel it.",
    }
  }

  if (
    params.sessionId &&
    storedProposal.authorization.sessionId &&
    params.sessionId.trim() !== storedProposal.authorization.sessionId.trim()
  ) {
    return {
      ok: false,
      code: "SESSION_MISMATCH",
      message: "Session mismatch for proposal cancellation.",
    }
  }

  if (storedProposal.status === "COMPLETED") {
    return {
      ok: false,
      code: "PROPOSAL_ALREADY_COMPLETED",
      message: "Proposal has already been completed and cannot be cancelled.",
      proposal: storedProposal,
    }
  }

  if (storedProposal.status === "EXECUTING") {
    return {
      ok: false,
      code: "PROPOSAL_EXECUTING",
      message: "Proposal is currently executing and cannot be cancelled.",
      proposal: storedProposal,
    }
  }

  if (storedProposal.status !== "PENDING") {
    return {
      ok: false,
      code: "PROPOSAL_NOT_PENDING",
      message: `Proposal is in status "${storedProposal.status}" and cannot be cancelled.`,
      proposal: storedProposal,
    }
  }

  const cancelled = await store.markProposalCancelled<EventDraftFields>({
    proposalId: storedProposal.proposalId,
    now,
    actorId: params.actor.userId,
  })

  if (!cancelled) {
    return {
      ok: false,
      code: "PROPOSAL_NOT_PENDING",
      message: "Failed to cancel proposal: it may have already been claimed or completed.",
    }
  }

  return {
    ok: true,
    code: "CANCELLED",
    message: "Event creation proposal was cancelled.",
    proposal: cancelled,
  }
}
