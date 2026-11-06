import { z } from "zod"
import {
  assertValidRiskConfirmationPolicy,
  doesRiskRequireConfirmation,
  type CapabilityRiskLevel,
} from "@/lib/assistant/confirmation-engine"
import {
  listAuthorizedEventsForActor,
  resolveAssistantEventContext,
  verifyWorkspaceMembership,
  type AssistantAccessRole,
  type AssistantActorContext,
} from "@/lib/assistant/context-resolver"
import { getEventInsights, type EventInsights } from "@/lib/event-insights"
import {
  prepareEventDraftPreview,
  type EventDraftPreview,
} from "@/lib/assistant/draft-preparation"
import prisma from "@/lib/prisma"
import { purgeUserCache } from "@/lib/cache"
import { dispatchNewEventAnnouncements } from "@/services/notifications/followerAnnouncements"

export const INITIAL_READ_ONLY_CAPABILITY_NAMES = [
  "list_organizer_events",
  "get_event_summary",
  "get_event_insights",
] as const

export const PHASE_1_CAPABILITY_NAMES = [
  ...INITIAL_READ_ONLY_CAPABILITY_NAMES,
  "prepare_event_draft",
] as const

export const EVENT_MANAGEMENT_CAPABILITY_NAMES = [
  "get_follower_and_announcement_status",
  "reschedule_event",
  "update_event_capacity",
  "update_event_venue",
  "update_event_status",
] as const

export const ALL_CAPABILITY_NAMES = [
  ...PHASE_1_CAPABILITY_NAMES,
  ...EVENT_MANAGEMENT_CAPABILITY_NAMES,
] as const

export type RegisteredCapabilityName =
  (typeof ALL_CAPABILITY_NAMES)[number]

export type CapabilityErrorCode =
  | "CAPABILITY_NOT_FOUND"
  | "CAPABILITY_UNAVAILABLE"
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "AMBIGUOUS_CONTEXT"
  | "MISSING_CONTEXT"
  | "CONFIRMATION_REQUIRED"
  | "EXECUTION_FAILED"

export interface CapabilityErrorPayload {
  code: CapabilityErrorCode
  message: string
  details?: unknown
}

export type CapabilityResultEnvelope<TOutput = unknown> =
  | {
      ok: true
      capability: string
      riskLevel: CapabilityRiskLevel
      requiresConfirmation: false
      data: TOutput
      verifiedAt?: string
    }
  | {
      ok: false
      capability: string
      riskLevel?: CapabilityRiskLevel
      requiresConfirmation?: boolean
      error: CapabilityErrorPayload
    }

export interface CapabilityAuthorizationRequirement {
  requireAuthenticatedUser: boolean
  allowedRoles?: readonly AssistantAccessRole[]
  enforceWorkspaceBoundary?: boolean
}

export interface CapabilityDefinition<
  TInputSchema extends z.ZodTypeAny = z.ZodTypeAny,
  TOutput = unknown
> {
  name: string
  description: string
  riskLevel: CapabilityRiskLevel
  requiresConfirmation: boolean
  enabled: boolean
  authorization: CapabilityAuthorizationRequirement
  inputSchema: TInputSchema
  handler: (params: {
    actor: AssistantActorContext
    input: z.infer<TInputSchema>
  }) => Promise<CapabilityResultEnvelope<TOutput>>
}

// ─── Input & Output Types for Initial Read-Only Capabilities ──────────────────

export const listOrganizerEventsInputSchema = z
  .object({
    status: z.enum(["active", "closed", "all"]).optional().default("all"),
    limit: z.number().int().min(1).max(25).optional().default(10),
    workspaceOrganizerId: z.string().trim().min(1).nullable().optional(),
  })
  .strict()

export type ListOrganizerEventsInput = z.infer<
  typeof listOrganizerEventsInputSchema
>

export interface OrganizerEventSummaryItem {
  id: string
  slug: string
  title: string
  status: string
  visibility: string
  eventType: string
  capacity: number | null
  confirmedCount: number
  waitlistCount: number
  fillRate: number
  eventDate: string | null
  deadline: string | null
  accessRole: AssistantAccessRole
}

export interface ListOrganizerEventsOutput {
  workspaceOrganizerId: string | null
  totalReturned: number
  events: OrganizerEventSummaryItem[]
}

export const getEventSummaryInputSchema = z
  .object({
    eventIdOrSlug: z.string().trim().min(1).optional(),
    messageContext: z.string().trim().max(1000).optional(),
    workspaceOrganizerId: z.string().trim().min(1).nullable().optional(),
  })
  .strict()

export type GetEventSummaryInput = z.infer<typeof getEventSummaryInputSchema>

export interface EventSummaryOutput {
  id: string
  slug: string
  title: string
  status: string
  visibility: string
  eventType: string
  capacity: number | null
  confirmedCount: number
  waitlistCount: number
  fillRate: number
  registrationOpen: boolean
  eventDate: string | null
  deadline: string | null
  location: string | null
  ticketsEnabled: boolean
  isPaid: boolean
  accessRole: AssistantAccessRole
}

export const getEventInsightsInputSchema = z
  .object({
    eventIdOrSlug: z.string().trim().min(1).optional(),
    messageContext: z.string().trim().max(1000).optional(),
    workspaceOrganizerId: z.string().trim().min(1).nullable().optional(),
  })
  .strict()

export type GetEventInsightsInput = z.infer<typeof getEventInsightsInputSchema>

export interface EventInsightsOutput {
  eventId: string
  slug: string
  accessRole: AssistantAccessRole
  insights: EventInsights
}

export const prepareEventDraftInputSchema = z
  .object({
    sessionId: z.string().trim().min(1).max(120).optional(),
    messageText: z.string().trim().max(4000).optional(),
    defaultOrganizerName: z.string().trim().max(200).optional().nullable(),
    workspaceOrganizerId: z.string().trim().min(1).nullable().optional(),
    posterImages: z
      .array(
        z
          .object({
            mediaType: z.string().trim().min(1).max(60),
            base64DataUrl: z.string().trim().min(1),
          })
          .strict()
      )
      .max(3)
      .optional(),
    overrides: z
      .object({
        title: z.string().max(200).nullable().optional(),
        description: z.string().max(5000).nullable().optional(),
        category: z.string().max(40).nullable().optional(),
        visibility: z.enum(["PUBLIC", "PRIVATE"]).nullable().optional(),
        accessType: z.enum(["REGISTRATION", "WALK_IN"]).nullable().optional(),
        eventType: z.enum(["PHYSICAL", "VIRTUAL"]).nullable().optional(),
        eventDate: z.string().max(64).nullable().optional(),
        eventEndAt: z.string().max(64).nullable().optional(),
        deadline: z.string().max(64).nullable().optional(),
        location: z.string().max(300).nullable().optional(),
        virtualLink: z.string().max(1000).nullable().optional(),
        capacity: z.number().int().positive().nullable().optional(),
        isPaid: z.boolean().nullable().optional(),
        ticketPrice: z.number().int().nonnegative().nullable().optional(),
        organizerName: z.string().max(200).nullable().optional(),
        whatsappNumber: z.string().max(40).nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export type PrepareEventDraftInput = z.infer<typeof prepareEventDraftInputSchema>
export type PrepareEventDraftOutput = EventDraftPreview

// ─── Input & Output Types for Event Management Capabilities ──────────────────

export const getFollowerStatusInputSchema = z
  .object({
    eventIdOrSlug: z.string().trim().min(1).optional(),
    workspaceOrganizerId: z.string().trim().min(1).nullable().optional(),
  })
  .strict()

export type GetFollowerStatusInput = z.infer<typeof getFollowerStatusInputSchema>

export interface FollowerStatusOutput {
  organizerId: string
  totalFollowers: number
  notifiableFollowers: number
  announcementStatus: "SENT" | "PENDING" | "INELIGIBLE"
  announcementSentAt: string | null
  eventTitle?: string
  visibility?: string
  accessRole: AssistantAccessRole
}

export const rescheduleEventInputSchema = z
  .object({
    eventIdOrSlug: z.string().trim().min(1),
    newEventDate: z.string().trim().min(1),
    newEventEndAt: z.string().trim().optional().nullable(),
    workspaceOrganizerId: z.string().trim().min(1).nullable().optional(),
  })
  .strict()

export type RescheduleEventInput = z.infer<typeof rescheduleEventInputSchema>

export interface RescheduleEventOutput {
  eventId: string
  slug: string
  title: string
  previousEventDate: string | null
  newEventDate: string
  newEventEndAt: string | null
}

export const updateEventCapacityInputSchema = z
  .object({
    eventIdOrSlug: z.string().trim().min(1),
    capacity: z.number().int().min(1).max(500000),
    workspaceOrganizerId: z.string().trim().min(1).nullable().optional(),
  })
  .strict()

export type UpdateEventCapacityInput = z.infer<typeof updateEventCapacityInputSchema>

export interface UpdateEventCapacityOutput {
  eventId: string
  slug: string
  title: string
  previousCapacity: number | null
  newCapacity: number
}

export const updateEventVenueInputSchema = z
  .object({
    eventIdOrSlug: z.string().trim().min(1),
    location: z.string().trim().min(1).max(300),
    mapDirectionsUrl: z.string().trim().url().optional().nullable(),
    workspaceOrganizerId: z.string().trim().min(1).nullable().optional(),
  })
  .strict()

export type UpdateEventVenueInput = z.infer<typeof updateEventVenueInputSchema>

export interface UpdateEventVenueOutput {
  eventId: string
  slug: string
  title: string
  previousLocation: string | null
  newLocation: string
  mapDirectionsUrl: string | null
}

export const updateEventStatusInputSchema = z
  .object({
    eventIdOrSlug: z.string().trim().min(1),
    status: z.enum(["active", "closed", "archived", "cancelled"]).optional(),
    visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
    workspaceOrganizerId: z.string().trim().min(1).nullable().optional(),
  })
  .strict()
  .refine((data) => data.status !== undefined || data.visibility !== undefined, {
    message: "At least one of status or visibility must be provided.",
  })

export type UpdateEventStatusInput = z.infer<typeof updateEventStatusInputSchema>

export interface UpdateEventStatusOutput {
  eventId: string
  slug: string
  title: string
  previousStatus: string
  newStatus: string
  previousVisibility: string
  newVisibility: string
}

// ─── Helper Builders ──────────────────────────────────────────────────────────

function makeSuccessEnvelope<TOutput>(
  capability: string,
  riskLevel: CapabilityRiskLevel,
  data: TOutput
): CapabilityResultEnvelope<TOutput> {
  return {
    ok: true,
    capability,
    riskLevel,
    requiresConfirmation: false,
    data,
    verifiedAt: new Date().toISOString(),
  }
}

function makeErrorEnvelope<TOutput = never>(params: {
  capability: string
  riskLevel?: CapabilityRiskLevel
  requiresConfirmation?: boolean
  code: CapabilityErrorCode
  message: string
  details?: unknown
}): CapabilityResultEnvelope<TOutput> {
  return {
    ok: false,
    capability: params.capability,
    riskLevel: params.riskLevel,
    requiresConfirmation: params.requiresConfirmation,
    error: {
      code: params.code,
      message: params.message,
      details: params.details,
    },
  }
}

// ─── Capability Registry Class ────────────────────────────────────────────────

export class AssistantCapabilityRegistry {
  private readonly definitions = new Map<string, CapabilityDefinition<any, any>>()

  register<TInputSchema extends z.ZodTypeAny, TOutput>(
    definition: CapabilityDefinition<TInputSchema, TOutput>
  ): this {
    const normalizedName = definition.name.trim()
    if (!/^[a-z][a-z0-9_]{2,63}$/.test(normalizedName)) {
      throw new Error(
        `Invalid capability name "${definition.name}". Capability names must be lowercase snake_case.`
      )
    }

    if (this.definitions.has(normalizedName)) {
      throw new Error(`Duplicate capability registration: "${normalizedName}".`)
    }

    assertValidRiskConfirmationPolicy(
      normalizedName,
      definition.riskLevel,
      definition.requiresConfirmation
    )

    this.definitions.set(normalizedName, {
      ...definition,
      name: normalizedName,
    })

    return this
  }

  get(name: string): CapabilityDefinition<any, any> | undefined {
    return this.definitions.get(name)
  }

  listMetadata(): Array<{
    name: string
    description: string
    riskLevel: CapabilityRiskLevel
    requiresConfirmation: boolean
    enabled: boolean
    authorization: CapabilityAuthorizationRequirement
  }> {
    return Array.from(this.definitions.values()).map((def) => ({
      name: def.name,
      description: def.description,
      riskLevel: def.riskLevel,
      requiresConfirmation: def.requiresConfirmation,
      enabled: def.enabled,
      authorization: def.authorization,
    }))
  }

  async execute<TOutput = unknown>(params: {
    capability: string
    actor: AssistantActorContext | null | undefined
    rawInput: unknown
    isConfirmedExecution?: boolean
  }): Promise<CapabilityResultEnvelope<TOutput>> {
    const capabilityName = (params.capability ?? "").trim()
    const definition = this.definitions.get(capabilityName)

    if (!definition) {
      return makeErrorEnvelope({
        capability: capabilityName || "unknown",
        code: "CAPABILITY_NOT_FOUND",
        message: `Capability "${capabilityName}" is not registered in EventSlot Assistant.`,
      })
    }

    if (!definition.enabled) {
      return makeErrorEnvelope({
        capability: definition.name,
        riskLevel: definition.riskLevel,
        requiresConfirmation: definition.requiresConfirmation,
        code: "CAPABILITY_UNAVAILABLE",
        message: `Capability "${definition.name}" is currently unavailable.`,
      })
    }

    if (
      definition.authorization.requireAuthenticatedUser &&
      (!params.actor || !params.actor.userId || typeof params.actor.userId !== "string")
    ) {
      return makeErrorEnvelope({
        capability: definition.name,
        riskLevel: definition.riskLevel,
        requiresConfirmation: definition.requiresConfirmation,
        code: "UNAUTHORIZED",
        message: "Authentication is required to execute assistant capabilities.",
      })
    }

    const policyRequiresConfirmation =
      definition.requiresConfirmation ||
      doesRiskRequireConfirmation(definition.riskLevel, params.rawInput)

    // Consequential action safety gate: any capability that requires confirmation cannot be executed directly unless confirmed.
    if (policyRequiresConfirmation && !params.isConfirmedExecution) {
      return makeErrorEnvelope({
        capability: definition.name,
        riskLevel: definition.riskLevel,
        requiresConfirmation: true,
        code: "CONFIRMATION_REQUIRED",
        message: `Capability "${definition.name}" has risk level "${definition.riskLevel}" and requires explicit user confirmation before execution.`,
      })
    }

    const parsed = definition.inputSchema.safeParse(params.rawInput ?? {})
    if (!parsed.success) {
      return makeErrorEnvelope({
        capability: definition.name,
        riskLevel: definition.riskLevel,
        requiresConfirmation: definition.requiresConfirmation,
        code: "INVALID_INPUT",
        message: "Invalid input parameters for capability.",
        details: parsed.error.issues.map((issue: z.ZodIssue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      })
    }

    try {
      return await definition.handler({
        actor: params.actor!,
        input: parsed.data,
      })
    } catch (error) {
      console.error(`[ESA Capability] Handler failure in ${definition.name}:`, error)
      return makeErrorEnvelope({
        capability: definition.name,
        riskLevel: definition.riskLevel,
        requiresConfirmation: definition.requiresConfirmation,
        code: "EXECUTION_FAILED",
        message: "An unexpected error occurred while executing the capability.",
      })
    }
  }
}

// ─── Initial Read-Only Capability Implementations ─────────────────────────────

export function createDefaultCapabilityRegistry(options?: {
  enableEventManagement?: boolean
}): AssistantCapabilityRegistry {
  const registry = new AssistantCapabilityRegistry()

  // 1. list_organizer_events
  registry.register<typeof listOrganizerEventsInputSchema, ListOrganizerEventsOutput>({
    name: "list_organizer_events",
    description:
      "Lists events the authenticated organizer, team member, or workspace operator is authorized to access.",
    riskLevel: "READ",
    requiresConfirmation: false,
    enabled: true,
    authorization: {
      requireAuthenticatedUser: true,
      allowedRoles: ["owner", "team_member", "admin"],
      enforceWorkspaceBoundary: true,
    },
    inputSchema: listOrganizerEventsInputSchema,
    handler: async ({ actor, input }) => {
      const effectiveWorkspaceId =
        input.workspaceOrganizerId ?? actor.workspaceOrganizerId ?? null

      const scopedActor: AssistantActorContext = {
        ...actor,
        workspaceOrganizerId: effectiveWorkspaceId,
      }

      const workspaceMembership = await verifyWorkspaceMembership(scopedActor)
      if (!workspaceMembership.allowed) {
        return makeErrorEnvelope({
          capability: "list_organizer_events",
          riskLevel: "READ",
          code: "FORBIDDEN",
          message: "You do not have access to the requested organization workspace.",
        })
      }

      const events = await listAuthorizedEventsForActor(scopedActor, {
        status: input.status,
        limit: input.limit,
      })

      const mapped: OrganizerEventSummaryItem[] = events.map((ev) => {
        const cap = ev.capacity ?? 0
        const fillRate = cap > 0 ? Math.round((ev.confirmedCount / cap) * 100) : 0
        return {
          id: ev.id,
          slug: ev.slug,
          title: ev.title,
          status: ev.status,
          visibility: String(ev.visibility),
          eventType: String(ev.eventType),
          capacity: ev.capacity,
          confirmedCount: ev.confirmedCount,
          waitlistCount: ev.waitlistCount,
          fillRate,
          eventDate: ev.eventDate ? ev.eventDate.toISOString() : null,
          deadline: ev.deadline ? ev.deadline.toISOString() : null,
          accessRole: ev.accessRole,
        }
      })

      return makeSuccessEnvelope("list_organizer_events", "READ", {
        workspaceOrganizerId: effectiveWorkspaceId,
        totalReturned: mapped.length,
        events: mapped,
      })
    },
  })

  // 2. get_event_summary
  registry.register<typeof getEventSummaryInputSchema, EventSummaryOutput>({
    name: "get_event_summary",
    description:
      "Returns a verified summary of a single authorized event without exposing attendee PII.",
    riskLevel: "READ",
    requiresConfirmation: false,
    enabled: true,
    authorization: {
      requireAuthenticatedUser: true,
      allowedRoles: ["owner", "team_member", "admin"],
      enforceWorkspaceBoundary: true,
    },
    inputSchema: getEventSummaryInputSchema,
    handler: async ({ actor, input }) => {
      const effectiveWorkspaceId =
        input.workspaceOrganizerId ?? actor.workspaceOrganizerId ?? null

      const scopedActor: AssistantActorContext = {
        ...actor,
        workspaceOrganizerId: effectiveWorkspaceId,
      }

      const resolution = await resolveAssistantEventContext({
        actor: scopedActor,
        explicitEventIdOrSlug: input.eventIdOrSlug ?? null,
        message: input.messageContext ?? null,
      })

      if (resolution.status === "FORBIDDEN_OR_NOT_FOUND") {
        return makeErrorEnvelope({
          capability: "get_event_summary",
          riskLevel: "READ",
          code: "FORBIDDEN",
          message: resolution.reason,
        })
      }

      if (resolution.status === "AMBIGUOUS") {
        return makeErrorEnvelope({
          capability: "get_event_summary",
          riskLevel: "READ",
          code: "AMBIGUOUS_CONTEXT",
          message: resolution.clarificationPrompt,
          details: {
            candidates: resolution.candidates.map((c) => ({
              id: c.id,
              slug: c.slug,
              title: c.title,
              status: c.status,
            })),
          },
        })
      }

      if (resolution.status === "NEEDS_CONTEXT") {
        return makeErrorEnvelope({
          capability: "get_event_summary",
          riskLevel: "READ",
          code: "MISSING_CONTEXT",
          message: resolution.clarificationPrompt,
          details: {
            candidates: resolution.candidates.map((c) => ({
              id: c.id,
              slug: c.slug,
              title: c.title,
              status: c.status,
            })),
          },
        })
      }

      const ev = resolution.event
      const capacity = ev.capacity ?? 0
      const fillRate =
        capacity > 0 ? Math.round((ev.confirmedCount / capacity) * 100) : 0
      const now = new Date()
      const registrationOpen =
        ev.status.toLowerCase() === "active" &&
        !ev.archived &&
        (!ev.deadline || now < ev.deadline)

      return makeSuccessEnvelope("get_event_summary", "READ", {
        id: ev.id,
        slug: ev.slug,
        title: ev.title,
        status: ev.status,
        visibility: String(ev.visibility),
        eventType: String(ev.eventType),
        capacity: ev.capacity,
        confirmedCount: ev.confirmedCount,
        waitlistCount: ev.waitlistCount,
        fillRate,
        registrationOpen,
        eventDate: ev.eventDate ? ev.eventDate.toISOString() : null,
        deadline: ev.deadline ? ev.deadline.toISOString() : null,
        location: ev.location,
        ticketsEnabled: ev.ticketsEnabled,
        isPaid: ev.isPaid,
        accessRole: ev.accessRole,
      })
    },
  })

  // 3. get_event_insights
  registry.register<typeof getEventInsightsInputSchema, EventInsightsOutput>({
    name: "get_event_insights",
    description:
      "Computes registration velocity, fill rate, peak registration timing, and actionable recommendations for an authorized event.",
    riskLevel: "READ",
    requiresConfirmation: false,
    enabled: true,
    authorization: {
      requireAuthenticatedUser: true,
      allowedRoles: ["owner", "team_member", "admin"],
      enforceWorkspaceBoundary: true,
    },
    inputSchema: getEventInsightsInputSchema,
    handler: async ({ actor, input }) => {
      const effectiveWorkspaceId =
        input.workspaceOrganizerId ?? actor.workspaceOrganizerId ?? null

      const scopedActor: AssistantActorContext = {
        ...actor,
        workspaceOrganizerId: effectiveWorkspaceId,
      }

      const resolution = await resolveAssistantEventContext({
        actor: scopedActor,
        explicitEventIdOrSlug: input.eventIdOrSlug ?? null,
        message: input.messageContext ?? null,
      })

      if (resolution.status === "FORBIDDEN_OR_NOT_FOUND") {
        return makeErrorEnvelope({
          capability: "get_event_insights",
          riskLevel: "READ",
          code: "FORBIDDEN",
          message: resolution.reason,
        })
      }

      if (resolution.status === "AMBIGUOUS") {
        return makeErrorEnvelope({
          capability: "get_event_insights",
          riskLevel: "READ",
          code: "AMBIGUOUS_CONTEXT",
          message: resolution.clarificationPrompt,
          details: {
            candidates: resolution.candidates.map((c) => ({
              id: c.id,
              slug: c.slug,
              title: c.title,
              status: c.status,
            })),
          },
        })
      }

      if (resolution.status === "NEEDS_CONTEXT") {
        return makeErrorEnvelope({
          capability: "get_event_insights",
          riskLevel: "READ",
          code: "MISSING_CONTEXT",
          message: resolution.clarificationPrompt,
          details: {
            candidates: resolution.candidates.map((c) => ({
              id: c.id,
              slug: c.slug,
              title: c.title,
              status: c.status,
            })),
          },
        })
      }

      const insights = await getEventInsights(
        resolution.event.id,
        scopedActor.userId,
        scopedActor
      )

      if (!insights) {
        return makeErrorEnvelope({
          capability: "get_event_insights",
          riskLevel: "READ",
          code: "FORBIDDEN",
          message: "Event insights could not be loaded or access was denied.",
        })
      }

      return makeSuccessEnvelope("get_event_insights", "READ", {
        eventId: resolution.event.id,
        slug: resolution.event.slug,
        accessRole: resolution.event.accessRole,
        insights,
      })
    },
  })

  // 4. prepare_event_draft (DRAFT risk — strictly non-mutating preview only)
  registry.register<typeof prepareEventDraftInputSchema, PrepareEventDraftOutput>({
    name: "prepare_event_draft",
    description:
      "Extracts and validates a non-mutating event draft preview from user text or a poster image using EventSlot's createEventSchema. Does not create or publish a live event.",
    riskLevel: "DRAFT",
    requiresConfirmation: false,
    enabled: true,
    authorization: {
      requireAuthenticatedUser: true,
      allowedRoles: ["owner", "team_member", "admin"],
      enforceWorkspaceBoundary: true,
    },
    inputSchema: prepareEventDraftInputSchema,
    handler: async ({ actor, input }) => {
      const effectiveWorkspaceId =
        input.workspaceOrganizerId ?? actor.workspaceOrganizerId ?? null

      const scopedActor: AssistantActorContext = {
        ...actor,
        workspaceOrganizerId: effectiveWorkspaceId,
      }

      const workspaceMembership = await verifyWorkspaceMembership(scopedActor)
      if (!workspaceMembership.allowed) {
        return makeErrorEnvelope({
          capability: "prepare_event_draft",
          riskLevel: "DRAFT",
          code: "FORBIDDEN",
          message: "You do not have access to prepare an event draft in the requested organization workspace.",
        })
      }

      const preview = await prepareEventDraftPreview({
        userId: scopedActor.userId,
        sessionId: input.sessionId ?? "default",
        defaultOrganizerName: input.defaultOrganizerName ?? null,
        messageText: input.messageText ?? null,
        explicitOverrides: input.overrides ?? null,
        posterImages: input.posterImages,
      })

      return makeSuccessEnvelope("prepare_event_draft", "DRAFT", preview)
    },
  })

  // ─── Event Management Capabilities (Phase 1 Extension) ──────────────────────
  if (options?.enableEventManagement) {
    // 5. get_follower_and_announcement_status
    registry.register<typeof getFollowerStatusInputSchema, FollowerStatusOutput>({
      name: "get_follower_and_announcement_status",
      description:
        "Retrieves follower count, notification opt-in count, and publication announcement status for an authorized event or organizer.",
      riskLevel: "READ",
      requiresConfirmation: false,
      enabled: true,
      authorization: {
        requireAuthenticatedUser: true,
        allowedRoles: ["owner", "team_member", "admin"],
        enforceWorkspaceBoundary: true,
      },
      inputSchema: getFollowerStatusInputSchema,
      handler: async ({ actor, input }) => {
        const effectiveWorkspaceId =
          input.workspaceOrganizerId ?? actor.workspaceOrganizerId ?? null

        const scopedActor: AssistantActorContext = {
          ...actor,
          workspaceOrganizerId: effectiveWorkspaceId,
        }

        let targetEvent: any = null
        let targetOrganizerId = scopedActor.workspaceOrganizerId ?? scopedActor.userId

        if (input.eventIdOrSlug) {
          const resolution = await resolveAssistantEventContext({
            actor: scopedActor,
            explicitEventIdOrSlug: input.eventIdOrSlug,
          })

          if (resolution.status === "FORBIDDEN_OR_NOT_FOUND") {
            return makeErrorEnvelope({
              capability: "get_follower_and_announcement_status",
              riskLevel: "READ",
              code: "FORBIDDEN",
              message: resolution.reason,
            })
          }
          if (resolution.status === "AMBIGUOUS" || resolution.status === "NEEDS_CONTEXT") {
            return makeErrorEnvelope({
              capability: "get_follower_and_announcement_status",
              riskLevel: "READ",
              code: resolution.status === "AMBIGUOUS" ? "AMBIGUOUS_CONTEXT" : "MISSING_CONTEXT",
              message: resolution.clarificationPrompt,
            })
          }
          targetEvent = resolution.event
          targetOrganizerId = targetEvent.organizerId
        }

        const [totalFollowers, notifiableFollowers] = await Promise.all([
          prisma.organiserFollower.count({ where: { organiserId: targetOrganizerId } }),
          prisma.organiserFollower.count({ where: { organiserId: targetOrganizerId, notifyNewEvents: true } }),
        ])

        let announcementStatus: "SENT" | "PENDING" | "INELIGIBLE" = "INELIGIBLE"
        let announcementSentAt: string | null = null

        if (targetEvent) {
          if (targetEvent.announcementSentAt) {
            announcementStatus = "SENT"
            announcementSentAt = new Date(targetEvent.announcementSentAt).toISOString()
          } else if (targetEvent.visibility === "PUBLIC" && targetEvent.status === "active" && !targetEvent.archived) {
            announcementStatus = "PENDING"
          } else {
            announcementStatus = "INELIGIBLE"
          }
        }

        return makeSuccessEnvelope("get_follower_and_announcement_status", "READ", {
          organizerId: targetOrganizerId,
          totalFollowers,
          notifiableFollowers,
          announcementStatus,
          announcementSentAt,
          eventTitle: targetEvent?.title,
          visibility: targetEvent?.visibility,
          accessRole: targetEvent?.accessRole ?? "owner",
        })
      },
    })

    // 6. reschedule_event
    registry.register<typeof rescheduleEventInputSchema, RescheduleEventOutput>({
      name: "reschedule_event",
      description:
        "Reschedules an authorized event to a new start date/time. Requires confirmation.",
      riskLevel: "WRITE_HIGH",
      requiresConfirmation: true,
      enabled: true,
      authorization: {
        requireAuthenticatedUser: true,
        allowedRoles: ["owner", "team_member", "admin"],
        enforceWorkspaceBoundary: true,
      },
      inputSchema: rescheduleEventInputSchema,
      handler: async ({ actor, input }) => {
        const effectiveWorkspaceId =
          input.workspaceOrganizerId ?? actor.workspaceOrganizerId ?? null

        const scopedActor: AssistantActorContext = {
          ...actor,
          workspaceOrganizerId: effectiveWorkspaceId,
        }

        const resolution = await resolveAssistantEventContext({
          actor: scopedActor,
          explicitEventIdOrSlug: input.eventIdOrSlug,
        })

        if (resolution.status === "FORBIDDEN_OR_NOT_FOUND") {
          return makeErrorEnvelope({
            capability: "reschedule_event",
            riskLevel: "WRITE_HIGH",
            code: "FORBIDDEN",
            message: resolution.reason,
          })
        }
        if (resolution.status === "AMBIGUOUS" || resolution.status === "NEEDS_CONTEXT") {
          return makeErrorEnvelope({
            capability: "reschedule_event",
            riskLevel: "WRITE_HIGH",
            code: resolution.status === "AMBIGUOUS" ? "AMBIGUOUS_CONTEXT" : "MISSING_CONTEXT",
            message: resolution.clarificationPrompt,
          })
        }

        const event = resolution.event
        const parsedStart = new Date(input.newEventDate)
        if (isNaN(parsedStart.getTime())) {
          return makeErrorEnvelope({
            capability: "reschedule_event",
            riskLevel: "WRITE_HIGH",
            code: "INVALID_INPUT",
            message: "Invalid new event date. Please provide a valid date/time string.",
          })
        }

        let parsedEnd: Date | null = null
        if (input.newEventEndAt) {
          parsedEnd = new Date(input.newEventEndAt)
          if (isNaN(parsedEnd.getTime()) || parsedEnd <= parsedStart) {
            return makeErrorEnvelope({
              capability: "reschedule_event",
              riskLevel: "WRITE_HIGH",
              code: "INVALID_INPUT",
              message: "New event end time must be after the start time.",
            })
          }
        }

        await prisma.event.update({
          where: { id: event.id },
          data: {
            eventDate: parsedStart,
            eventEndAt: parsedEnd,
          },
        })

        if (event.organizerId) {
          purgeUserCache(event.organizerId, null)
        }

        return makeSuccessEnvelope("reschedule_event", "WRITE_HIGH", {
          eventId: event.id,
          slug: event.slug,
          title: event.title,
          previousEventDate: event.eventDate ? new Date(event.eventDate).toISOString() : null,
          newEventDate: parsedStart.toISOString(),
          newEventEndAt: parsedEnd ? parsedEnd.toISOString() : null,
        })
      },
    })

    // 7. update_event_capacity
    registry.register<typeof updateEventCapacityInputSchema, UpdateEventCapacityOutput>({
      name: "update_event_capacity",
      description:
        "Updates the attendee capacity limit for an authorized event. Requires confirmation.",
      riskLevel: "WRITE_LOW",
      requiresConfirmation: true,
      enabled: true,
      authorization: {
        requireAuthenticatedUser: true,
        allowedRoles: ["owner", "team_member", "admin"],
        enforceWorkspaceBoundary: true,
      },
      inputSchema: updateEventCapacityInputSchema,
      handler: async ({ actor, input }) => {
        const effectiveWorkspaceId =
          input.workspaceOrganizerId ?? actor.workspaceOrganizerId ?? null

        const scopedActor: AssistantActorContext = {
          ...actor,
          workspaceOrganizerId: effectiveWorkspaceId,
        }

        const resolution = await resolveAssistantEventContext({
          actor: scopedActor,
          explicitEventIdOrSlug: input.eventIdOrSlug,
        })

        if (resolution.status === "FORBIDDEN_OR_NOT_FOUND") {
          return makeErrorEnvelope({
            capability: "update_event_capacity",
            riskLevel: "WRITE_LOW",
            code: "FORBIDDEN",
            message: resolution.reason,
          })
        }
        if (resolution.status === "AMBIGUOUS" || resolution.status === "NEEDS_CONTEXT") {
          return makeErrorEnvelope({
            capability: "update_event_capacity",
            riskLevel: "WRITE_LOW",
            code: resolution.status === "AMBIGUOUS" ? "AMBIGUOUS_CONTEXT" : "MISSING_CONTEXT",
            message: resolution.clarificationPrompt,
          })
        }

        const event = resolution.event
        const confirmed = typeof event.confirmedCount === "number" ? event.confirmedCount : 0
        if (confirmed > input.capacity) {
          return makeErrorEnvelope({
            capability: "update_event_capacity",
            riskLevel: "WRITE_LOW",
            code: "INVALID_INPUT",
            message: `Cannot set capacity to ${input.capacity}. Event already has ${confirmed} confirmed attendees.`,
          })
        }

        await prisma.event.update({
          where: { id: event.id },
          data: { capacity: input.capacity },
        })

        if (event.organizerId) {
          purgeUserCache(event.organizerId, null)
        }

        return makeSuccessEnvelope("update_event_capacity", "WRITE_LOW", {
          eventId: event.id,
          slug: event.slug,
          title: event.title,
          previousCapacity: event.capacity,
          newCapacity: input.capacity,
        })
      },
    })

    // 8. update_event_venue
    registry.register<typeof updateEventVenueInputSchema, UpdateEventVenueOutput>({
      name: "update_event_venue",
      description:
        "Updates venue location or map directions URL for an authorized event. Requires confirmation.",
      riskLevel: "WRITE_LOW",
      requiresConfirmation: true,
      enabled: true,
      authorization: {
        requireAuthenticatedUser: true,
        allowedRoles: ["owner", "team_member", "admin"],
        enforceWorkspaceBoundary: true,
      },
      inputSchema: updateEventVenueInputSchema,
      handler: async ({ actor, input }) => {
        const effectiveWorkspaceId =
          input.workspaceOrganizerId ?? actor.workspaceOrganizerId ?? null

        const scopedActor: AssistantActorContext = {
          ...actor,
          workspaceOrganizerId: effectiveWorkspaceId,
        }

        const resolution = await resolveAssistantEventContext({
          actor: scopedActor,
          explicitEventIdOrSlug: input.eventIdOrSlug,
        })

        if (resolution.status === "FORBIDDEN_OR_NOT_FOUND") {
          return makeErrorEnvelope({
            capability: "update_event_venue",
            riskLevel: "WRITE_LOW",
            code: "FORBIDDEN",
            message: resolution.reason,
          })
        }
        if (resolution.status === "AMBIGUOUS" || resolution.status === "NEEDS_CONTEXT") {
          return makeErrorEnvelope({
            capability: "update_event_venue",
            riskLevel: "WRITE_LOW",
            code: resolution.status === "AMBIGUOUS" ? "AMBIGUOUS_CONTEXT" : "MISSING_CONTEXT",
            message: resolution.clarificationPrompt,
          })
        }

        const event = resolution.event
        const updateData: { location: string; mapDirectionsUrl?: string | null } = {
          location: input.location,
        }
        if (input.mapDirectionsUrl !== undefined) {
          updateData.mapDirectionsUrl = input.mapDirectionsUrl
        }

        await prisma.event.update({
          where: { id: event.id },
          data: updateData,
        })

        if (event.organizerId) {
          purgeUserCache(event.organizerId, null)
        }

        return makeSuccessEnvelope("update_event_venue", "WRITE_LOW", {
          eventId: event.id,
          slug: event.slug,
          title: event.title,
          previousLocation: event.location,
          newLocation: input.location,
          mapDirectionsUrl: input.mapDirectionsUrl ?? null,
        })
      },
    })

    // 9. update_event_status
    registry.register<typeof updateEventStatusInputSchema, UpdateEventStatusOutput>({
      name: "update_event_status",
      description:
        "Updates the status (active/closed/archived/cancelled) or visibility (PUBLIC/UNLISTED/PRIVATE) of an authorized event. Requires confirmation.",
      riskLevel: "WRITE_HIGH",
      requiresConfirmation: true,
      enabled: true,
      authorization: {
        requireAuthenticatedUser: true,
        allowedRoles: ["owner", "admin"],
        enforceWorkspaceBoundary: true,
      },
      inputSchema: updateEventStatusInputSchema,
      handler: async ({ actor, input }) => {
        const effectiveWorkspaceId =
          input.workspaceOrganizerId ?? actor.workspaceOrganizerId ?? null

        const scopedActor: AssistantActorContext = {
          ...actor,
          workspaceOrganizerId: effectiveWorkspaceId,
        }

        const resolution = await resolveAssistantEventContext({
          actor: scopedActor,
          explicitEventIdOrSlug: input.eventIdOrSlug,
        })

        if (resolution.status === "FORBIDDEN_OR_NOT_FOUND") {
          return makeErrorEnvelope({
            capability: "update_event_status",
            riskLevel: "WRITE_HIGH",
            code: "FORBIDDEN",
            message: resolution.reason,
          })
        }
        if (resolution.status === "AMBIGUOUS" || resolution.status === "NEEDS_CONTEXT") {
          return makeErrorEnvelope({
            capability: "update_event_status",
            riskLevel: "WRITE_HIGH",
            code: resolution.status === "AMBIGUOUS" ? "AMBIGUOUS_CONTEXT" : "MISSING_CONTEXT",
            message: resolution.clarificationPrompt,
          })
        }

        const event = resolution.event
        const updateData: Record<string, any> = {}
        if (input.status) {
          updateData.status = input.status
          if (input.status === "archived") {
            updateData.archived = true
          }
        }
        if (input.visibility) {
          updateData.visibility = input.visibility
        }

        await prisma.event.update({
          where: { id: event.id },
          data: updateData,
        })

        if (event.organizerId) {
          purgeUserCache(event.organizerId, null)
        }

        // If transitioned to PUBLIC and active, dispatch follower announcements
        const isNowPublicAndActive =
          (input.visibility === "PUBLIC" || (!input.visibility && event.visibility === "PUBLIC")) &&
          (input.status === "active" || (!input.status && event.status === "active"))

        if (isNowPublicAndActive) {
          void dispatchNewEventAnnouncements(event.id).catch((err) => {
            console.warn("[update_event_status] Follower announcement warning:", err)
          })
        }

        return makeSuccessEnvelope("update_event_status", "WRITE_HIGH", {
          eventId: event.id,
          slug: event.slug,
          title: event.title,
          previousStatus: event.status,
          newStatus: input.status ?? event.status,
          previousVisibility: event.visibility,
          newVisibility: input.visibility ?? event.visibility,
        })
      },
    })
  }

  return registry
}

export function createEventManagementCapabilityRegistry(): AssistantCapabilityRegistry {
  return createDefaultCapabilityRegistry({ enableEventManagement: true })
}

export const assistantCapabilityRegistry = createDefaultCapabilityRegistry({ enableEventManagement: true })
