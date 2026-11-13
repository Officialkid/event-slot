import crypto from "crypto"
import type { Prisma } from "@prisma/client"
import type { AssistantActorContext } from "@/lib/assistant/context-resolver"
import {
  computeDraftVersion,
  type EventDraftFields,
  type EventDraftPreview,
} from "@/lib/assistant/draft-preparation"
import { createEventSchema } from "@/lib/schemas/event.schema"

export const CAPABILITY_RISK_LEVELS = [
  "READ",
  "DRAFT",
  "WRITE_LOW",
  "WRITE_HIGH",
  "CRITICAL",
] as const

export type CapabilityRiskLevel = (typeof CAPABILITY_RISK_LEVELS)[number]

export type ActionProposalStatus =
  | "PENDING"
  | "CONFIRMED"
  | "EXECUTING"
  | "COMPLETED"
  | "CANCELLED"
  | "EXPIRED"
  | "FAILED"
  | "EXECUTED"

export type PendingActionOperation = "CREATE_EVENT" | (string & {})

export interface ActionPreviewField {
  key: string
  label: string
  previousValue?: string | number | boolean | null
  proposedValue: string | number | boolean | null
}

export interface ActionPreviewCard {
  title: string
  summary: string
  targetEvent?: {
    id: string
    slug: string
    title: string
  } | null
  fields: ActionPreviewField[]
  impactWarnings: string[]
}

export interface ActionAuthorizationSnapshot {
  actorId: string
  workspaceOrganizerId: string | null
  targetEventId: string | null
  sessionId?: string | null
  operation?: PendingActionOperation | null
  draftId?: string | null
  draftVersion?: string | null
}

export interface PendingActionProposal<TInput = unknown> {
  proposalId: string
  idempotencyKey: string
  capability: string
  riskLevel: CapabilityRiskLevel
  requiresConfirmation: true
  validatedInput: TInput
  preview: ActionPreviewCard
  authorization: ActionAuthorizationSnapshot
  status: ActionProposalStatus
  createdAt: string
  expiresAt: string
  confirmedAt?: string | null
  cancelledAt?: string | null
  executedAt?: string | null
  failedAt?: string | null
  failureReason?: string | null
  resultMetadata?: Record<string, unknown> | null
}

export type ConfirmationDecisionCode =
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "PROPOSAL_EXPIRED"
  | "PROPOSAL_NOT_PENDING"
  | "PROPOSAL_NOT_FOUND"
  | "ACTOR_MISMATCH"
  | "SESSION_MISMATCH"
  | "WORKSPACE_MISMATCH"
  | "OPERATION_MISMATCH"
  | "DRAFT_VERSION_MISMATCH"
  | "INVALID_DRAFT"
  | "REVALIDATION_FAILED"
  | "IDEMPOTENCY_CONFLICT"
  | "PERSISTENCE_UNAVAILABLE"
  | "EXECUTION_FAILED"

export interface ConfirmationDecisionResult<TInput = unknown> {
  ok: boolean
  code: ConfirmationDecisionCode
  message: string
  proposal?: PendingActionProposal<TInput>
}

export interface CreatedEventExecutionOutcome {
  eventId: string
  slug: string
  title: string
  visibility: "PUBLIC" | "PRIVATE"
  accessType: "REGISTRATION" | "WALK_IN"
  status: string
  capacity: number | null
}

export interface EventCreationConfirmationResult {
  ok: boolean
  code: ConfirmationDecisionCode
  message: string
  proposal?: PendingActionProposal<EventDraftFields>
  createdEvent?: CreatedEventExecutionOutcome | null
}

/**
 * Durable persistence store contract required before any live write capability
 * (`create_event_from_confirmed_draft`) is enabled in production.
 *
 * SECURITY RULE:
 * Never substitute an in-memory cache for durable confirmation state in production.
 * Must be backed by PostgreSQL with a `@unique` constraint on `idempotencyKey` and
 * atomic compare-and-swap transitions (`updateMany` where `id = proposalId AND status = 'PENDING'`).
 */
export interface PendingActionPersistenceStore {
  isDurableDatabaseStore: boolean

  savePendingProposal<TInput>(
    proposal: PendingActionProposal<TInput>
  ): Promise<PendingActionProposal<TInput>>

  getProposalById<TInput = unknown>(
    proposalId: string,
    actorId?: string
  ): Promise<PendingActionProposal<TInput> | null>

  invalidatePendingProposalsForDraft(params: {
    actorId: string
    sessionId: string
    draftId: string
    reason: string
    now?: Date
  }): Promise<number>

  /**
   * Atomically transitions a proposal from `PENDING` to `EXECUTING` only if its current
   * status in durable storage is `PENDING` and its `idempotencyKey` matches.
   * Returns `true` for the single winning caller and `false` for all concurrent/replay callers.
   */
  claimPendingProposalForExecution(params: {
    proposalId: string
    idempotencyKey: string
    actorId: string
    now: Date
    tx?: Prisma.TransactionClient
  }): Promise<boolean>

  markProposalCompleted<TInput = unknown>(params: {
    proposalId: string
    resultMetadata: Record<string, unknown>
    now: Date
    actorId?: string
    tx?: Prisma.TransactionClient
  }): Promise<PendingActionProposal<TInput> | null>

  markProposalFailed<TInput = unknown>(params: {
    proposalId: string
    failureReason: string
    now: Date
    actorId?: string
    tx?: Prisma.TransactionClient
  }): Promise<PendingActionProposal<TInput> | null>

  markProposalCancelled<TInput = unknown>(params: {
    proposalId: string
    now: Date
    actorId?: string
    tx?: Prisma.TransactionClient
  }): Promise<PendingActionProposal<TInput> | null>

  markProposalExpired<TInput = unknown>(params: {
    proposalId: string
    now: Date
    actorId?: string
    tx?: Prisma.TransactionClient
  }): Promise<PendingActionProposal<TInput> | null>
}

export interface EventCreationDomainService {
  createEventFromValidatedDraft(params: {
    actor: AssistantActorContext
    workspaceOrganizerId: string | null
    draftId: string
    draftVersion: string
    idempotencyKey: string
    fields: EventDraftFields
  }): Promise<CreatedEventExecutionOutcome>
}

export interface ConfirmationEngineContract {
  doesRiskRequireConfirmation(
    riskLevel: CapabilityRiskLevel,
    untrustedModelDirectives?: unknown
  ): boolean

  createProposal<TInput>(params: {
    capability: string
    riskLevel: CapabilityRiskLevel
    validatedInput: TInput
    preview: ActionPreviewCard
    actor: AssistantActorContext
    targetEventId?: string | null
    sessionId?: string | null
    operation?: PendingActionOperation | null
    draftId?: string | null
    draftVersion?: string | null
    ttlSeconds?: number
    now?: Date
  }): PendingActionProposal<TInput>

  confirmProposal<TInput>(params: {
    proposal: PendingActionProposal<TInput>
    confirmingActor: AssistantActorContext
    idempotencyKey: string
    revalidatePermissionsAndState: (
      proposal: PendingActionProposal<TInput>,
      actor: AssistantActorContext
    ) => Promise<{ allowed: boolean; reason?: string }>
    now?: Date
  }): Promise<ConfirmationDecisionResult<TInput>>

  cancelProposal<TInput>(params: {
    proposal: PendingActionProposal<TInput>
    cancellingActor: AssistantActorContext
    now?: Date
  }): ConfirmationDecisionResult<TInput>
}

export const DEFAULT_PROPOSAL_TTL_SECONDS = 15 * 60 // 15 minutes

/**
 * Deterministic policy: any write-capable risk level (`WRITE_LOW`, `WRITE_HIGH`, `CRITICAL`)
 * unconditionally requires explicit user confirmation.
 * Model-supplied flags (`skipConfirmation`, `autoConfirm`, prompt overrides, etc.) are ignored.
 */
export function doesRiskRequireConfirmation(
  riskLevel: CapabilityRiskLevel,
  _untrustedModelDirectives?: unknown
): boolean {
  switch (riskLevel) {
    case "READ":
    case "DRAFT":
      return false
    case "WRITE_LOW":
    case "WRITE_HIGH":
    case "CRITICAL":
      return true
    default: {
      // Fail-closed for any unknown risk classification
      return true
    }
  }
}

/**
 * Validates that a capability's declared `requiresConfirmation` metadata obeys the platform risk policy.
 */
export function assertValidRiskConfirmationPolicy(
  capability: string,
  riskLevel: CapabilityRiskLevel,
  declaredRequiresConfirmation: boolean
): void {
  const requiredByPolicy = doesRiskRequireConfirmation(riskLevel)
  if (requiredByPolicy && !declaredRequiresConfirmation) {
    throw new Error(
      `Capability "${capability}" has risk level "${riskLevel}" and must require explicit confirmation.`
    )
  }
}

export function generateDeterministicIdempotencyKey(params: {
  actorId: string
  capability: string
  targetEventId: string | null
  proposalId: string
  draftVersion?: string | null
}): string {
  const versionSuffix = params.draftVersion ? `:${params.draftVersion}` : ""
  return crypto
    .createHash("sha256")
    .update(
      `${params.actorId}:${params.capability}:${params.targetEventId ?? "global"}:${params.proposalId}${versionSuffix}`
    )
    .digest("hex")
}

export function isProposalExpired(
  proposal: Pick<PendingActionProposal, "expiresAt">,
  now: Date = new Date()
): boolean {
  const expiresMs = new Date(proposal.expiresAt).getTime()
  if (Number.isNaN(expiresMs)) return true
  return now.getTime() >= expiresMs
}

export function createActionProposal<TInput>(params: {
  capability: string
  riskLevel: CapabilityRiskLevel
  validatedInput: TInput
  preview: ActionPreviewCard
  actor: AssistantActorContext
  targetEventId?: string | null
  sessionId?: string | null
  operation?: PendingActionOperation | null
  draftId?: string | null
  draftVersion?: string | null
  ttlSeconds?: number
  now?: Date
}): PendingActionProposal<TInput> {
  if (!params.actor.userId) {
    throw new Error(
      "Authenticated actor.userId is required to create an action proposal."
    )
  }

  if (!doesRiskRequireConfirmation(params.riskLevel)) {
    throw new Error(
      `Capability "${params.capability}" with risk level "${params.riskLevel}" does not use a confirmation proposal.`
    )
  }

  const now = params.now ?? new Date()
  const ttlSeconds = Math.min(
    Math.max(params.ttlSeconds ?? DEFAULT_PROPOSAL_TTL_SECONDS, 60),
    3600
  )
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)
  const proposalId = `prop_${crypto.randomUUID()}`
  const targetEventId =
    params.targetEventId ?? params.preview.targetEvent?.id ?? null

  const idempotencyKey = generateDeterministicIdempotencyKey({
    actorId: params.actor.userId,
    capability: params.capability,
    targetEventId,
    proposalId,
    draftVersion: params.draftVersion ?? null,
  })

  return {
    proposalId,
    idempotencyKey,
    capability: params.capability,
    riskLevel: params.riskLevel,
    requiresConfirmation: true,
    validatedInput: params.validatedInput,
    preview: params.preview,
    authorization: {
      actorId: params.actor.userId,
      workspaceOrganizerId: params.actor.workspaceOrganizerId?.trim() || null,
      targetEventId,
      sessionId: params.sessionId?.trim() || null,
      operation: params.operation ?? null,
      draftId: params.draftId?.trim() || null,
      draftVersion: params.draftVersion?.trim() || null,
    },
    status: "PENDING",
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    confirmedAt: null,
    cancelledAt: null,
    executedAt: null,
    failedAt: null,
    failureReason: null,
    resultMetadata: null,
  }
}

export async function confirmActionProposal<TInput>(params: {
  proposal: PendingActionProposal<TInput>
  confirmingActor: AssistantActorContext
  idempotencyKey: string
  sessionId?: string | null
  expectedDraftVersion?: string | null
  revalidatePermissionsAndState: (
    proposal: PendingActionProposal<TInput>,
    actor: AssistantActorContext
  ) => Promise<{ allowed: boolean; reason?: string }>
  now?: Date
}): Promise<ConfirmationDecisionResult<TInput>> {
  const {
    proposal,
    confirmingActor,
    idempotencyKey,
    revalidatePermissionsAndState,
  } = params
  const now = params.now ?? new Date()

  if (
    !confirmingActor.userId ||
    confirmingActor.userId !== proposal.authorization.actorId
  ) {
    return {
      ok: false,
      code: "ACTOR_MISMATCH",
      message: "Only the user who initiated this action can confirm it.",
    }
  }

  if (
    proposal.authorization.sessionId &&
    params.sessionId !== undefined &&
    params.sessionId !== proposal.authorization.sessionId
  ) {
    return {
      ok: false,
      code: "SESSION_MISMATCH",
      message:
        "This confirmation belongs to a different assistant session and cannot be confirmed here.",
    }
  }

  const callerWorkspace = confirmingActor.workspaceOrganizerId?.trim() || null
  if (callerWorkspace !== proposal.authorization.workspaceOrganizerId) {
    return {
      ok: false,
      code: "WORKSPACE_MISMATCH",
      message:
        "Workspace context changed since this action was proposed. Please start a new request.",
    }
  }

  if (
    proposal.authorization.draftVersion &&
    params.expectedDraftVersion !== undefined &&
    params.expectedDraftVersion !== proposal.authorization.draftVersion
  ) {
    return {
      ok: false,
      code: "DRAFT_VERSION_MISMATCH",
      message:
        "The event draft was modified after this confirmation was prepared. Please review and confirm the updated draft.",
    }
  }

  if (!idempotencyKey || idempotencyKey !== proposal.idempotencyKey) {
    return {
      ok: false,
      code: "IDEMPOTENCY_CONFLICT",
      message: "Invalid or mismatched confirmation idempotency key.",
    }
  }

  if (proposal.status !== "PENDING") {
    return {
      ok: false,
      code: "PROPOSAL_NOT_PENDING",
      message: `Action proposal is already in state "${proposal.status}" and cannot be confirmed again.`,
      proposal,
    }
  }

  if (isProposalExpired(proposal, now)) {
    const expiredProposal: PendingActionProposal<TInput> = {
      ...proposal,
      status: "EXPIRED",
    }
    return {
      ok: false,
      code: "PROPOSAL_EXPIRED",
      message:
        "This confirmation request has expired. Please ask the assistant to prepare a fresh preview.",
      proposal: expiredProposal,
    }
  }

  const revalidation = await revalidatePermissionsAndState(
    proposal,
    confirmingActor
  )
  if (!revalidation.allowed) {
    return {
      ok: false,
      code: "REVALIDATION_FAILED",
      message:
        revalidation.reason ??
        "Permissions or event state changed since the preview was generated. Execution was blocked.",
      proposal,
    }
  }

  const confirmedProposal: PendingActionProposal<TInput> = {
    ...proposal,
    status: "CONFIRMED",
    confirmedAt: now.toISOString(),
  }

  return {
    ok: true,
    code: "CONFIRMED",
    message: "Action proposal verified and confirmed.",
    proposal: confirmedProposal,
  }
}

export function cancelActionProposal<TInput>(params: {
  proposal: PendingActionProposal<TInput>
  cancellingActor: AssistantActorContext
  now?: Date
}): ConfirmationDecisionResult<TInput> {
  const { proposal, cancellingActor } = params
  const now = params.now ?? new Date()

  if (
    !cancellingActor.userId ||
    cancellingActor.userId !== proposal.authorization.actorId
  ) {
    return {
      ok: false,
      code: "ACTOR_MISMATCH",
      message: "Only the user who initiated this action can cancel it.",
    }
  }

  if (proposal.status !== "PENDING") {
    return {
      ok: false,
      code: "PROPOSAL_NOT_PENDING",
      message: `Action proposal is already in state "${proposal.status}".`,
      proposal,
    }
  }

  const cancelledProposal: PendingActionProposal<TInput> = {
    ...proposal,
    status: "CANCELLED",
    cancelledAt: now.toISOString(),
  }

  return {
    ok: true,
    code: "CANCELLED",
    message: "Pending action has been cancelled.",
    proposal: cancelledProposal,
  }
}

/**
 * Validates whether a prepared `EventDraftPreview` satisfies all schema and business rules
 * required before a `CREATE_EVENT` confirmation proposal can be generated or executed.
 */
export function validateDraftReadyForCreationConfirmation(
  draft: EventDraftPreview
): { valid: boolean; reason?: string } {
  if (!draft || draft.isLiveEvent !== false) {
    return {
      valid: false,
      reason: "A valid non-published event draft preview is required.",
    }
  }

  if (draft.missingFields.length > 0) {
    const labels = draft.missingFields.map((m) => m.label).join(", ")
    return {
      valid: false,
      reason: `Cannot confirm event creation while required fields are missing: ${labels}.`,
    }
  }

  if (draft.uncertainFields.length > 0) {
    const labels = draft.uncertainFields.map((u) => u.label).join(", ")
    return {
      valid: false,
      reason: `Cannot confirm event creation while uncertain or contradictory details remain unresolved: ${labels}.`,
    }
  }

  if (!draft.schemaValid || draft.validationIssues.length > 0) {
    const firstIssue =
      draft.validationIssues[0]?.message ??
      "Draft does not pass EventSlot schema validation."
    return {
      valid: false,
      reason: `Cannot confirm event creation: ${firstIssue}`,
    }
  }

  const recomputedVersion = computeDraftVersion({
    draftId: draft.draftId,
    fields: draft.fields,
    schemaValid: draft.schemaValid,
    missingFields: draft.missingFields,
    uncertainFields: draft.uncertainFields,
  })
  if (draft.draftVersion !== recomputedVersion) {
    return {
      valid: false,
      reason:
        "Draft version integrity check failed. Please regenerate the draft preview.",
    }
  }

  const zodPayload = {
    title: draft.fields.title ?? "",
    category: draft.fields.category,
    description: draft.fields.description,
    visibility: draft.fields.visibility,
    accessType: draft.fields.accessType,
    eventType: draft.fields.eventType,
    virtualLink: draft.fields.virtualLink ?? "",
    capacity: draft.fields.capacity,
    deadline: draft.fields.deadline,
    eventDate: draft.fields.eventDate,
    eventEndAt: draft.fields.eventEndAt,
    location: draft.fields.location,
    isPaid: draft.fields.isPaid,
    ticketPrice: draft.fields.ticketPrice,
    ticketTiers:
      draft.fields.isPaid && draft.fields.ticketPrice
        ? [
            {
              name: "Standard Ticket",
              badgeColor: "#C8F55A",
              textColor: "#0A0A0A",
              priceKes: draft.fields.ticketPrice,
              currency: "KES",
              capacity: draft.fields.capacity ?? 100,
            },
          ]
        : [],
    whatsappNumber: draft.fields.whatsappNumber ?? "",
    organizerName: draft.fields.organizerName ?? "Event Organizer",
  }

  const parsed = createEventSchema.safeParse(zodPayload)
  if (!parsed.success) {
    return {
      valid: false,
      reason:
        parsed.error.issues[0]?.message ??
        "Draft failed authoritative EventSlot schema validation.",
    }
  }

  return { valid: true }
}

/**
 * Prepares a durable `CREATE_EVENT` confirmation proposal bound to an authenticated actor,
 * session, workspace context, and exact `draftId` + `draftVersion`.
 *
 * Fails closed with `PERSISTENCE_UNAVAILABLE` if no durable database persistence store is provided.
 */
export async function prepareEventCreationProposalFromDraft(params: {
  actor: AssistantActorContext
  sessionId: string
  draft: EventDraftPreview
  persistenceStore: PendingActionPersistenceStore | null | undefined
  ttlSeconds?: number
  now?: Date
}): Promise<ConfirmationDecisionResult<EventDraftFields>> {
  const now = params.now ?? new Date()

  if (!params.actor?.userId) {
    return {
      ok: false,
      code: "ACTOR_MISMATCH",
      message: "Authentication is required to prepare an event creation proposal.",
    }
  }

  if (!params.sessionId?.trim()) {
    return {
      ok: false,
      code: "SESSION_MISMATCH",
      message: "A valid assistant sessionId is required.",
    }
  }

  if (
    !params.persistenceStore ||
    params.persistenceStore.isDurableDatabaseStore !== true
  ) {
    return {
      ok: false,
      code: "PERSISTENCE_UNAVAILABLE",
      message:
        "Durable pending-action persistence is not yet enabled in the database schema. Live event creation from chat is disabled until the persistence migration is reviewed and applied.",
    }
  }

  const readiness = validateDraftReadyForCreationConfirmation(params.draft)
  if (!readiness.valid) {
    return {
      ok: false,
      code: "INVALID_DRAFT",
      message:
        readiness.reason ?? "Draft is incomplete or invalid and cannot be confirmed.",
    }
  }

  // Invalidate any previous pending proposals for this draft before creating the new version-bound proposal
  await params.persistenceStore.invalidatePendingProposalsForDraft({
    actorId: params.actor.userId,
    sessionId: params.sessionId.trim(),
    draftId: params.draft.draftId,
    reason: `Superseded by draftVersion ${params.draft.draftVersion}`,
    now,
  })

  const proposal = createActionProposal<EventDraftFields>({
    capability: "create_event_from_confirmed_draft",
    riskLevel: "WRITE_HIGH",
    validatedInput: { ...params.draft.fields },
    preview: {
      title: `Confirm Event Creation: ${params.draft.fields.title}`,
      summary: `Create a ${params.draft.fields.visibility.toLowerCase()} ${params.draft.fields.eventType.toLowerCase()} event (${params.draft.fields.accessType}) from draft ${params.draft.draftId} (${params.draft.draftVersion}).`,
      targetEvent: null,
      fields: [
        {
          key: "title",
          label: "Event Title",
          proposedValue: params.draft.fields.title,
        },
        {
          key: "eventDate",
          label: "Start Date",
          proposedValue: params.draft.fields.eventDate,
        },
        {
          key: "location",
          label:
            params.draft.fields.eventType === "VIRTUAL"
              ? "Virtual Link"
              : "Location",
          proposedValue:
            params.draft.fields.eventType === "VIRTUAL"
              ? params.draft.fields.virtualLink
              : params.draft.fields.location,
        },
        {
          key: "capacity",
          label: "Capacity",
          proposedValue: params.draft.fields.capacity,
        },
        {
          key: "visibility",
          label: "Visibility",
          proposedValue: params.draft.fields.visibility,
        },
      ],
      impactWarnings: [
        "This event has not been created yet. Confirming will create a live event record in your workspace.",
      ],
    },
    actor: params.actor,
    sessionId: params.sessionId.trim(),
    operation: "CREATE_EVENT",
    draftId: params.draft.draftId,
    draftVersion: params.draft.draftVersion,
    ttlSeconds: params.ttlSeconds,
    now,
  })

  const saved = await params.persistenceStore.savePendingProposal(proposal)
  return {
    ok: true,
    code: "CONFIRMED",
    message:
      "Pending event creation confirmation prepared. Review the details and confirm to create the event.",
    proposal: saved,
  }
}

/**
 * Executes `create_event_from_confirmed_draft` ONLY after verifying:
 * 1. Durable persistence store availability (`PERSISTENCE_UNAVAILABLE` if missing)
 * 2. Server-stored proposal existence (`PROPOSAL_NOT_FOUND`)
 * 3. Actor identity (`ACTOR_MISMATCH`), session ownership (`SESSION_MISMATCH`), workspace scope (`WORKSPACE_MISMATCH`),
 *    operation (`OPERATION_MISMATCH`), and idempotency key (`IDEMPOTENCY_CONFLICT`)
 * 4. Exact `draftId` and `draftVersion` match against the current session draft (`DRAFT_VERSION_MISMATCH` if edited)
 * 5. Proposal status (`PROPOSAL_NOT_PENDING`) and TTL expiry (`PROPOSAL_EXPIRED`)
 * 6. Immediate pre-execution permission + plan-limit revalidation (`REVALIDATION_FAILED`) and schema re-validation (`INVALID_DRAFT`)
 * 7. Atomic compare-and-swap claim (`PENDING -> EXECUTING`) to prevent duplicate/concurrent execution
 * 8. Authoritative domain creation service execution and outcome verification (`COMPLETED` vs `EXECUTION_FAILED`).
 */
export async function executeConfirmedEventCreationProposal(params: {
  proposalId: string
  idempotencyKey: string
  confirmingActor: AssistantActorContext
  sessionId: string
  currentDraft: EventDraftPreview | null
  persistenceStore: PendingActionPersistenceStore | null | undefined
  revalidatePermissionsAndState: (
    proposal: PendingActionProposal<EventDraftFields>,
    actor: AssistantActorContext
  ) => Promise<{ allowed: boolean; reason?: string }>
  creationService: EventCreationDomainService
  now?: Date
}): Promise<EventCreationConfirmationResult> {
  const now = params.now ?? new Date()

  if (
    !params.persistenceStore ||
    params.persistenceStore.isDurableDatabaseStore !== true
  ) {
    return {
      ok: false,
      code: "PERSISTENCE_UNAVAILABLE",
      message:
        "Durable pending-action persistence is not available. Live event creation is blocked.",
    }
  }

  const storedProposal =
    await params.persistenceStore.getProposalById<EventDraftFields>(
      params.proposalId
    )
  if (!storedProposal) {
    return {
      ok: false,
      code: "PROPOSAL_NOT_FOUND",
      message: "Confirmation proposal was not found.",
    }
  }

  if (
    !params.confirmingActor?.userId ||
    params.confirmingActor.userId !== storedProposal.authorization.actorId
  ) {
    return {
      ok: false,
      code: "ACTOR_MISMATCH",
      message: "Only the organizer who initiated this draft can confirm it.",
    }
  }

  if (
    !params.sessionId ||
    params.sessionId.trim() !== storedProposal.authorization.sessionId
  ) {
    return {
      ok: false,
      code: "SESSION_MISMATCH",
      message:
        "Confirmation session does not match the session that created this proposal.",
    }
  }

  const callerWorkspace =
    params.confirmingActor.workspaceOrganizerId?.trim() || null
  if (callerWorkspace !== storedProposal.authorization.workspaceOrganizerId) {
    return {
      ok: false,
      code: "WORKSPACE_MISMATCH",
      message:
        "Workspace context does not match the workspace bound to this confirmation proposal.",
    }
  }

  if (
    storedProposal.authorization.operation !== "CREATE_EVENT" ||
    storedProposal.capability !== "create_event_from_confirmed_draft"
  ) {
    return {
      ok: false,
      code: "OPERATION_MISMATCH",
      message: "Proposal operation is not CREATE_EVENT.",
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

  if (storedProposal.status !== "PENDING") {
    return {
      ok: false,
      code: "PROPOSAL_NOT_PENDING",
      message: `Proposal is in state "${storedProposal.status}" and cannot be executed again.`,
      proposal: storedProposal,
    }
  }

  if (isProposalExpired(storedProposal, now)) {
    const expired = await params.persistenceStore.markProposalExpired<EventDraftFields>({
      proposalId: storedProposal.proposalId,
      now,
    })
    return {
      ok: false,
      code: "PROPOSAL_EXPIRED",
      message:
        "This confirmation proposal has expired. Please review a fresh preview to confirm.",
      proposal: expired ?? { ...storedProposal, status: "EXPIRED" },
    }
  }

  // Verify the current draft still matches the exact draftId and draftVersion the user reviewed
  if (
    !params.currentDraft ||
    params.currentDraft.draftId !== storedProposal.authorization.draftId ||
    params.currentDraft.draftVersion !== storedProposal.authorization.draftVersion
  ) {
    await params.persistenceStore.markProposalCancelled({
      proposalId: storedProposal.proposalId,
      now,
    })
    return {
      ok: false,
      code: "DRAFT_VERSION_MISMATCH",
      message:
        "The event draft was updated after this confirmation was prepared. Please review and confirm the latest draft version.",
    }
  }

  // Re-validate draft readiness and schema immediately before execution
  const draftReadiness = validateDraftReadyForCreationConfirmation(
    params.currentDraft
  )
  if (!draftReadiness.valid) {
    return {
      ok: false,
      code: "INVALID_DRAFT",
      message:
        draftReadiness.reason ??
        "The draft no longer passes schema validation.",
    }
  }

  // Revalidate actor permissions and workspace membership immediately before claiming/executing
  const revalidation = await params.revalidatePermissionsAndState(
    storedProposal,
    params.confirmingActor
  )
  if (!revalidation.allowed) {
    return {
      ok: false,
      code: "REVALIDATION_FAILED",
      message:
        revalidation.reason ??
        "Your permissions or plan limits changed since the draft was prepared. Event creation was blocked.",
      proposal: storedProposal,
    }
  }

  // Atomic compare-and-swap transition PENDING -> EXECUTING to guarantee single execution under concurrency
  const claimed =
    await params.persistenceStore.claimPendingProposalForExecution({
      proposalId: storedProposal.proposalId,
      idempotencyKey: storedProposal.idempotencyKey,
      actorId: params.confirmingActor.userId,
      now,
    })

  if (!claimed) {
    const current =
      await params.persistenceStore.getProposalById<EventDraftFields>(
        storedProposal.proposalId
      )
    return {
      ok: false,
      code: "PROPOSAL_NOT_PENDING",
      message:
        "This confirmation proposal is already being processed or has already completed.",
      proposal: current ?? storedProposal,
    }
  }

  try {
    const createdEvent =
      await params.creationService.createEventFromValidatedDraft({
        actor: params.confirmingActor,
        workspaceOrganizerId: storedProposal.authorization.workspaceOrganizerId,
        draftId: storedProposal.authorization.draftId ?? "",
        draftVersion: storedProposal.authorization.draftVersion ?? "",
        idempotencyKey: storedProposal.idempotencyKey,
        fields: storedProposal.validatedInput,
      })

    if (!createdEvent?.eventId || !createdEvent?.slug) {
      throw new Error("Creation service did not return a verified event ID and slug.")
    }

    const completedProposal =
      await params.persistenceStore.markProposalCompleted<EventDraftFields>({
        proposalId: storedProposal.proposalId,
        resultMetadata: {
          eventId: createdEvent.eventId,
          slug: createdEvent.slug,
          title: createdEvent.title,
          visibility: createdEvent.visibility,
          status: createdEvent.status,
        },
        now,
      })

    return {
      ok: true,
      code: "COMPLETED",
      message: `Event "${createdEvent.title}" (${createdEvent.slug}) was created with ${createdEvent.visibility.toLowerCase()} visibility.`,
      proposal:
        completedProposal ?? {
          ...storedProposal,
          status: "COMPLETED",
          executedAt: now.toISOString(),
        },
      createdEvent,
    }
  } catch (error) {
    const safeReason =
      error instanceof Error && error.message
        ? error.message
        : "Event creation failed in the domain service."
    const failedProposal =
      await params.persistenceStore.markProposalFailed<EventDraftFields>({
        proposalId: storedProposal.proposalId,
        failureReason: safeReason,
        now,
      })

    return {
      ok: false,
      code: "EXECUTION_FAILED",
      message:
        "Event creation could not be completed. No event was confirmed as created.",
      proposal:
        failedProposal ?? {
          ...storedProposal,
          status: "FAILED",
          failedAt: now.toISOString(),
          failureReason: safeReason,
        },
      createdEvent: null,
    }
  }
}

export const defaultConfirmationEngine: ConfirmationEngineContract = {
  doesRiskRequireConfirmation,
  createProposal: createActionProposal,
  confirmProposal: confirmActionProposal,
  cancelProposal: cancelActionProposal,
}
