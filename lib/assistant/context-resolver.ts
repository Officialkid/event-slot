import { prisma } from "@/lib/prisma"
import { hasTeamEventAccess } from "@/lib/eventAccess"
import { hasAdminAccess } from "@/lib/isAdmin"
import { getAdminModeFromCookie } from "@/lib/adminMode"

export type AssistantAccessRole = "owner" | "team_member" | "admin"

export interface AssistantActorContext {
  userId: string
  userEmail?: string | null
  userRole?: string | null
  isAdmin?: boolean | null
  /**
   * Optional workspace scope (e.g. organization/owner userId when operating in a team workspace).
   * Must be independently verified on the server; never trusted blindly from the client.
   */
  workspaceOrganizerId?: string | null
}

export interface AuthorizedEventCandidate {
  id: string
  slug: string
  title: string
  status: string
  visibility: string
  eventType: string
  organizerId: string | null
  capacity: number | null
  confirmedCount: number
  waitlistCount: number
  eventDate: Date | null
  deadline: Date | null
  location: string | null
  ticketsEnabled: boolean
  isPaid: boolean
  archived: boolean
  createdAt: Date
  accessRole: AssistantAccessRole
}

export type AssistantEventResolutionResult =
  | {
      status: "RESOLVED"
      source: "EXPLICIT_CONTEXT" | "CONVERSATION_MATCH"
      event: AuthorizedEventCandidate
    }
  | {
      status: "AMBIGUOUS"
      reason: string
      candidates: AuthorizedEventCandidate[]
      clarificationPrompt: string
    }
  | {
      status: "NEEDS_CONTEXT"
      reason: string
      candidates: AuthorizedEventCandidate[]
      clarificationPrompt: string
    }
  | {
      status: "FORBIDDEN_OR_NOT_FOUND"
      reason: string
      candidates: []
      clarificationPrompt: string
    }

const EVENT_SELECT = {
  id: true,
  slug: true,
  title: true,
  status: true,
  visibility: true,
  eventType: true,
  organizerId: true,
  capacity: true,
  confirmedCount: true,
  waitlistCount: true,
  eventDate: true,
  deadline: true,
  location: true,
  ticketsEnabled: true,
  isPaid: true,
  archived: true,
  createdAt: true,
} as const

type RawEventRecord = {
  id: string
  slug: string
  title: string
  status: string
  visibility: string
  eventType: string
  organizerId: string | null
  capacity: number | null
  confirmedCount: number
  waitlistCount: number
  eventDate: Date | null
  deadline: Date | null
  location: string | null
  ticketsEnabled: boolean
  isPaid: boolean
  archived: boolean
  createdAt: Date
}

async function resolveCallerAdminFlags(actor: AssistantActorContext): Promise<{
  isPlatformAdmin: boolean
  adminModeEventId: string | null
}> {
  let userRole = actor.userRole ?? null
  let userEmail = actor.userEmail ?? null
  let isAdminFlag = actor.isAdmin ?? null

  if (userRole === null && userEmail === null && isAdminFlag === null && actor.userId) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: actor.userId },
        select: { email: true, isAdmin: true },
      })
      if (dbUser) {
        userEmail = dbUser.email
        isAdminFlag = dbUser.isAdmin
      }
    } catch {
      // Proceed with supplied actor properties if user lookup fails.
    }
  }

  const isPlatformAdmin = hasAdminAccess({
    user: {
      role: userRole,
      email: userEmail,
      isAdmin: isAdminFlag,
    },
  })

  let adminModeEventId: string | null = null
  if (isPlatformAdmin || userRole === "SUPER_ADMIN") {
    try {
      const adminMode = await getAdminModeFromCookie()
      if (adminMode.active && adminMode.eventId) {
        adminModeEventId = adminMode.eventId
      }
    } catch {
      // Cookie store may not be active in non-request test contexts.
    }
  }

  return { isPlatformAdmin, adminModeEventId }
}

/**
 * Verifies whether the authenticated actor is permitted to operate within the requested workspace.
 */
export async function verifyWorkspaceMembership(
  actor: AssistantActorContext
): Promise<{ allowed: boolean; isPlatformAdmin: boolean }> {
  if (!actor.userId) {
    return { allowed: false, isPlatformAdmin: false }
  }

  const { isPlatformAdmin } = await resolveCallerAdminFlags(actor)
  const workspaceId = actor.workspaceOrganizerId?.trim() || null

  if (!workspaceId || workspaceId === actor.userId) {
    return { allowed: true, isPlatformAdmin }
  }

  if (isPlatformAdmin) {
    return { allowed: true, isPlatformAdmin: true }
  }

  const membership = await prisma.teamMember.findFirst({
    where: {
      ownerId: workspaceId,
      memberId: actor.userId,
      status: "accepted",
    },
    select: { id: true },
  })

  return { allowed: Boolean(membership), isPlatformAdmin: false }
}

/**
 * Authorizes an actor's access to a specific event record using EventSlot's authoritative RBAC rules:
 * 1. Workspace boundary check (if workspaceOrganizerId is set, event.organizerId must match it).
 * 2. Event owner (event.organizerId === actor.userId).
 * 3. Accepted team member / workspace collaborator explicitly assigned to the event (`hasTeamEventAccess`).
 * 4. Super-admin / platform admin access (`hasAdminAccess` or active Admin Mode session for the event).
 */
export async function authorizeEventRecordAccess(
  actor: AssistantActorContext,
  event: RawEventRecord
): Promise<{ allowed: boolean; accessRole: AssistantAccessRole | null }> {
  if (!actor.userId) {
    return { allowed: false, accessRole: null }
  }

  const workspaceId = actor.workspaceOrganizerId?.trim() || null
  if (workspaceId && event.organizerId !== workspaceId) {
    return { allowed: false, accessRole: null }
  }

  const workspaceCheck = await verifyWorkspaceMembership(actor)
  if (!workspaceCheck.allowed) {
    return { allowed: false, accessRole: null }
  }

  if (event.organizerId && event.organizerId === actor.userId) {
    return { allowed: true, accessRole: "owner" }
  }

  if (event.organizerId) {
    const teamAccess = await hasTeamEventAccess({
      userId: actor.userId,
      organizerId: event.organizerId,
      eventId: event.id,
    })
    if (teamAccess) {
      return { allowed: true, accessRole: "team_member" }
    }
  }

  const { isPlatformAdmin, adminModeEventId } = await resolveCallerAdminFlags(actor)
  if (isPlatformAdmin || (actor.userRole === "SUPER_ADMIN" && adminModeEventId === event.id)) {
    return { allowed: true, accessRole: "admin" }
  }

  return { allowed: false, accessRole: null }
}

/**
 * Resolves and authorizes a single event by ID or slug for the given actor.
 */
export async function getAuthorizedEventByIdOrSlug(
  idOrSlug: string,
  actor: AssistantActorContext
): Promise<AuthorizedEventCandidate | null> {
  const trimmed = idOrSlug.trim()
  if (!trimmed || !actor.userId) return null

  const byId = await prisma.event.findUnique({
    where: { id: trimmed },
    select: EVENT_SELECT,
  })

  const event =
    byId ??
    (await prisma.event.findUnique({
      where: { slug: trimmed },
      select: EVENT_SELECT,
    }))

  if (!event) return null

  const auth = await authorizeEventRecordAccess(actor, event)
  if (!auth.allowed || !auth.accessRole) return null

  return {
    ...event,
    accessRole: auth.accessRole,
  }
}

/**
 * Lists all events the actor is authorized to access within the active workspace scope.
 */
export async function listAuthorizedEventsForActor(
  actor: AssistantActorContext,
  options?: { limit?: number; status?: "active" | "closed" | "all" }
): Promise<AuthorizedEventCandidate[]> {
  if (!actor.userId) return []

  const workspaceCheck = await verifyWorkspaceMembership(actor)
  if (!workspaceCheck.allowed) return []

  const workspaceId = actor.workspaceOrganizerId?.trim() || null
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50)

  // Find team-assigned event IDs for this user
  const memberships = await prisma.teamMember.findMany({
    where: {
      memberId: actor.userId,
      status: "accepted",
      ...(workspaceId ? { ownerId: workspaceId } : {}),
    },
    select: {
      ownerId: true,
      eventAccess: {
        select: { eventId: true },
      },
    },
  })

  const assignedEventIds = Array.from(
    new Set(memberships.flatMap((m) => m.eventAccess.map((ea) => ea.eventId)))
  )

  const ownershipBranches: Record<string, unknown>[] = []

  if (!workspaceId || workspaceId === actor.userId) {
    ownershipBranches.push({ organizerId: actor.userId })
  }

  if (assignedEventIds.length > 0) {
    ownershipBranches.push({
      id: { in: assignedEventIds },
      ...(workspaceId ? { organizerId: workspaceId } : {}),
    })
  }

  if (workspaceCheck.isPlatformAdmin && workspaceId && workspaceId !== actor.userId) {
    ownershipBranches.push({ organizerId: workspaceId })
  }

  if (ownershipBranches.length === 0) {
    return []
  }

  const statusFilter =
    options?.status === "active"
      ? { status: { in: ["active", "ACTIVE", "published", "PUBLISHED"] } }
      : options?.status === "closed"
        ? { status: { in: ["closed", "CLOSED"] } }
        : {}

  const events = await prisma.event.findMany({
    where: {
      OR: ownershipBranches,
      ...statusFilter,
    },
    select: EVENT_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  const authorized: AuthorizedEventCandidate[] = []
  for (const event of events) {
    const accessRole: AssistantAccessRole =
      event.organizerId === actor.userId
        ? "owner"
        : assignedEventIds.includes(event.id)
          ? "team_member"
          : "admin"

    authorized.push({
      ...event,
      accessRole,
    })
  }

  return authorized
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function findMatchingCandidatesInMessage(
  message: string,
  candidates: AuthorizedEventCandidate[]
): AuthorizedEventCandidate[] {
  const normalizedMsg = normalizeForMatch(message)
  if (!normalizedMsg) return []

  const exactMatches: AuthorizedEventCandidate[] = []
  for (const candidate of candidates) {
    const slugNorm = candidate.slug.toLowerCase().trim()
    const titleNorm = normalizeForMatch(candidate.title)

    const hasSlug = slugNorm.length >= 3 && message.toLowerCase().includes(slugNorm)
    const hasFullTitle = titleNorm.length >= 3 && normalizedMsg.includes(titleNorm)

    if (hasSlug || hasFullTitle) {
      exactMatches.push(candidate)
    }
  }

  if (exactMatches.length > 0) {
    return exactMatches
  }

  // Secondary check: distinctive title token overlap (>= 2 significant tokens of length >= 4)
  const msgTokens = new Set(normalizedMsg.split(" ").filter((t) => t.length >= 4))
  if (msgTokens.size === 0) return []

  const partialMatches: AuthorizedEventCandidate[] = []
  for (const candidate of candidates) {
    const titleTokens = normalizeForMatch(candidate.title)
      .split(" ")
      .filter((t) => t.length >= 4)

    if (titleTokens.length === 0) continue

    const matchedTokens = titleTokens.filter((t) => msgTokens.has(t))
    const requiredMatches = titleTokens.length === 1 ? 1 : 2
    if (matchedTokens.length >= requiredMatches) {
      partialMatches.push(candidate)
    }
  }

  return partialMatches
}

function buildClarificationPrompt(
  candidates: AuthorizedEventCandidate[],
  header: string
): string {
  if (candidates.length === 0) {
    return `${header} You do not have any matching events in this workspace yet.`
  }

  const listText = candidates
    .slice(0, 10)
    .map(
      (c, index) =>
        `${index + 1}. "${c.title}" (slug: ${c.slug}, status: ${c.status})`
    )
    .join("\n")

  return `${header}\n${listText}\nPlease specify the event title or slug you would like me to use.`
}

/**
 * Deterministic active-event context resolver for ESA.
 *
 * Resolution order:
 * 1. Explicit event ID or slug supplied by page/request context -> independently authorized.
 * 2. Clearly specified event in the current conversation message -> unambiguously matched & authorized.
 * 3. Multiple matching events (or multiple authorized workspace events when no event is named) -> structured disambiguation response.
 * 4. No event resolved -> structured prompt asking the user to choose or provide context.
 *
 * Never silently selects `events[0]`.
 */
export async function resolveAssistantEventContext(params: {
  actor: AssistantActorContext
  explicitEventIdOrSlug?: string | null
  message?: string | null
}): Promise<AssistantEventResolutionResult> {
  const { actor, explicitEventIdOrSlug, message } = params

  if (!actor.userId) {
    return {
      status: "FORBIDDEN_OR_NOT_FOUND",
      reason: "Authentication is required to resolve event context.",
      candidates: [],
      clarificationPrompt: "Please sign in to access your EventSlot events.",
    }
  }

  const workspaceCheck = await verifyWorkspaceMembership(actor)
  if (!workspaceCheck.allowed) {
    return {
      status: "FORBIDDEN_OR_NOT_FOUND",
      reason: "You do not have access to the requested organization workspace.",
      candidates: [],
      clarificationPrompt:
        "You do not have permission to access events in that workspace.",
    }
  }

  // Step 1: Explicit event ID or slug from page/request context
  if (explicitEventIdOrSlug && explicitEventIdOrSlug.trim().length > 0) {
    const resolved = await getAuthorizedEventByIdOrSlug(
      explicitEventIdOrSlug,
      actor
    )
    if (!resolved) {
      return {
        status: "FORBIDDEN_OR_NOT_FOUND",
        reason: "The requested event was not found or you do not have permission to access it.",
        candidates: [],
        clarificationPrompt:
          "I couldn't access that event. Please verify the event link or choose one of your authorized events.",
      }
    }

    return {
      status: "RESOLVED",
      source: "EXPLICIT_CONTEXT",
      event: resolved,
    }
  }

  // Load authorized events for this actor & workspace
  const authorizedEvents = await listAuthorizedEventsForActor(actor)

  if (authorizedEvents.length === 0) {
    return {
      status: "NEEDS_CONTEXT",
      reason: "No authorized events were found in the current workspace.",
      candidates: [],
      clarificationPrompt:
        "I couldn't find any events under your current account or workspace. Please create an event first or switch to the appropriate workspace.",
    }
  }

  // Step 2: Check if the conversation message unambiguously names an authorized event
  const trimmedMessage = (message ?? "").trim()
  if (trimmedMessage.length > 0) {
    const matched = findMatchingCandidatesInMessage(
      trimmedMessage,
      authorizedEvents
    )

    if (matched.length === 1) {
      return {
        status: "RESOLVED",
        source: "CONVERSATION_MATCH",
        event: matched[0],
      }
    }

    if (matched.length > 1) {
      return {
        status: "AMBIGUOUS",
        reason: "Multiple authorized events match your message.",
        candidates: matched,
        clarificationPrompt: buildClarificationPrompt(
          matched,
          "Multiple events match your request:"
        ),
      }
    }
  }

  // Step 3 & 4: Never silently guess `events[0]`.
  if (authorizedEvents.length > 1) {
    return {
      status: "AMBIGUOUS",
      reason: "Multiple authorized events exist and no specific event was selected.",
      candidates: authorizedEvents,
      clarificationPrompt: buildClarificationPrompt(
        authorizedEvents,
        "You have multiple events available:"
      ),
    }
  }

  return {
    status: "NEEDS_CONTEXT",
    reason: "No specific event was specified in the request.",
    candidates: authorizedEvents,
    clarificationPrompt: buildClarificationPrompt(
      authorizedEvents,
      "Please confirm which event you are asking about:"
    ),
  }
}
