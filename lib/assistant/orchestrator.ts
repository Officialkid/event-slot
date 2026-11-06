import {
  assistantCapabilityRegistry,
  type AssistantCapabilityRegistry,
  type CapabilityErrorCode,
  type CapabilityResultEnvelope,
  type EventInsightsOutput,
  type EventSummaryOutput,
  type ListOrganizerEventsOutput,
} from "@/lib/assistant/capability-registry"
import {
  createActionProposal,
  type ActionPreviewCard,
  type CapabilityRiskLevel,
  type PendingActionProposal,
  type PendingActionPersistenceStore,
} from "@/lib/assistant/confirmation-engine"
import {
  resolveAssistantEventContext,
  type AssistantActorContext,
} from "@/lib/assistant/context-resolver"
import { PrismaPendingActionStore } from "@/lib/assistant/prisma-pending-action-store"
import {
  getSessionDraftPreview,
  prepareEventDraftPreview,
  stripUntrustedControlPhrases,
  type EventDraftPreview,
} from "@/lib/assistant/draft-preparation"
import {
  detectUserIntent,
  analyzeConversationState,
  selectMinimalFollowUpQuestion,
  generateMilestoneSummary,
  getSmartFeatureRecommendations,
  formatSmartRecommendations,
  formatUserFriendlyError,
  evaluateQueryComplexity,
  type ConversationState,
} from "@/lib/assistant/experience-refinement"
import { EVENTSLOT_SYSTEM_PROMPT } from "@/lib/assistant-context"
import { groq, ASSISTANT_MODEL, VISION_MODEL, VISION_MODEL_FALLBACK } from "@/lib/groq"

export type OrchestratorResponseKind =
  | "ANSWER"
  | "CLARIFICATION_REQUIRED"
  | "CAPABILITY_ERROR"
  | "DRAFT_PREVIEW"
  | "ACTION_PROPOSAL"

export interface OrchestratorLimits {
  maxIterations: number
  maxToolCalls: number
  maxExecutionTimeMs: number
  maxOutputChars: number
  maxInputChars: number
}

export const DEFAULT_ORCHESTRATOR_LIMITS: OrchestratorLimits = {
  maxIterations: 2,
  maxToolCalls: 2,
  maxExecutionTimeMs: 15000,
  maxOutputChars: 2500,
  maxInputChars: 4000,
}

export interface OrchestratorToolCallRequest {
  capability: string
  input: unknown
}

export interface OrchestratorToolExecutionRecord {
  capability: string
  ok: boolean
  riskLevel?: CapabilityRiskLevel
  errorCode?: CapabilityErrorCode
}

export interface OrchestratorClarification {
  reason: string
  candidates: Array<{
    id: string
    slug: string
    title: string
    status: string
  }>
}

export interface OrchestratorCapabilityError {
  capability: string
  code: CapabilityErrorCode
  message: string
}

export interface OrchestratorResult {
  kind: OrchestratorResponseKind
  reply: string
  toolCallsExecuted: OrchestratorToolExecutionRecord[]
  iterationsUsed: number
  usedLiveEventData: boolean
  clarification: OrchestratorClarification | null
  capabilityError: OrchestratorCapabilityError | null
  draftPreview: EventDraftPreview | null
  proposal?: PendingActionProposal<any> | null
}

export interface AssistantLLMAdapter {
  /**
   * Optional model-driven tool planner. If provided, may return tool calls to execute
   * within the orchestrator's iteration/tool-call limits.
   */
  planToolCalls?: (params: {
    message: string
    availableCapabilities: Array<{
      name: string
      description: string
      riskLevel: CapabilityRiskLevel
    }>
    iteration: number
    priorToolResults: Array<{
      capability: string
      envelope: CapabilityResultEnvelope
    }>
  }) => Promise<OrchestratorToolCallRequest[] | null>

  /**
   * Generates the final conversational response grounded in verified tool results and system context.
   */
  generateReply: (params: {
    systemPrompt: string
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
    userMessage: string
    images?: Array<{ mediaType: string; base64DataUrl: string }>
    verifiedToolResults: Array<{
      capability: string
      envelope: CapabilityResultEnvelope
    }>
  }) => Promise<string>
}

const FULL_REPORT_CTA =
  "For the full AI analysis and downloadable report, open the Export centre from your event dashboard and choose Prepare AI report export. Report downloads are currently free for authorised organisers while premium billing is paused."

function clampLimits(custom?: Partial<OrchestratorLimits>): OrchestratorLimits {
  return {
    maxIterations: Math.min(
      Math.max(custom?.maxIterations ?? DEFAULT_ORCHESTRATOR_LIMITS.maxIterations, 1),
      3
    ),
    maxToolCalls: Math.min(
      Math.max(custom?.maxToolCalls ?? DEFAULT_ORCHESTRATOR_LIMITS.maxToolCalls, 1),
      3
    ),
    maxExecutionTimeMs: Math.min(
      Math.max(
        custom?.maxExecutionTimeMs ?? DEFAULT_ORCHESTRATOR_LIMITS.maxExecutionTimeMs,
        0
      ),
      30000
    ),
    maxOutputChars: Math.min(
      Math.max(custom?.maxOutputChars ?? DEFAULT_ORCHESTRATOR_LIMITS.maxOutputChars, 200),
      8000
    ),
    maxInputChars: Math.min(
      Math.max(custom?.maxInputChars ?? DEFAULT_ORCHESTRATOR_LIMITS.maxInputChars, 200),
      8000
    ),
  }
}

export function wrapUntrustedContent(label: string, content: string): string {
  const { cleaned } = stripUntrustedControlPhrases(content)
  return `<untrusted_${label}>\n${cleaned}\n</untrusted_${label}>`
}

function truncateOutput(text: string, maxChars: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  return `${trimmed.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timer: NodeJS.Timeout | null = null
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// ─── Intent Detection for Deterministic Capability Routing ────────────────────

export function detectsDraftPreparationIntent(
  message: string,
  hasActiveDraft: boolean,
  hasImages: boolean
): boolean {
  const lower = message.toLowerCase().trim()

  // Do not trigger draft preparation on informational questions such as "how do I create an event?"
  if (
    /^how\s+(?:do|can)\s+i\s+create\s+an?\s+event\??$/i.test(lower) ||
    /^(?:how|what|where|why|when)\b[^.!]*\b(?:create|set\s*up|host|start|organi[sz]e|plan)\b/i.test(lower)
  ) {
    return false
  }

  const explicitDraftTriggers = [
    /\b(?:prepare|draft|build|generate|extract)\s+(?:an?\s+|my\s+)?(?:new\s+)?event(?:\s+draft|\s+preview|\s+from\s+poster)?\b/i,
    /\b(?:create|creating|set\s*up|setting\s*up|host|hosting|launch|launching|start|starting|organi[sz]e|organi[sz]ing|plan|planning)\s+(?:an?\s+|my\s+|the\s+|our\s+)?(?:new\s+)?(?:[a-z-]+\s+){0,3}?(?:event|evenyt|evnt|evnet|meetup|workshop|conference|webinar|summit|hackathon|party|dinner|seminar|training|concert|fundraiser)\b/i,
    /\b(?:i\s+thought\s+i\s+said\s+)?(?:create|creating)\s+(?:an?\s+)?(?:event|evenyt|evnt|evnet)\b/i,
    /\b(?:it(?:'?s|\s+is)\s+)?(?:definitely|definetely|obviously|clearly)\s+(?:a\s+)?new\s+(?:event|evenyt|evnt)\b/i,
    /\bi\s+(?:already\s+)?(?:said|told\s+you)\s+(?:to\s+)?create\b/i,
    /\b(?:start\s+(?:a\s+)?new\s+event|different\s+event|another\s+event|start\s+fresh|start\s+over|create\s+(?:another|a\s+new)\s+event|draft\s+(?:another|a\s+new)\s+event)\b/i,
    /\bi\s+want\s+to\s+(?:prepare|draft|create|set\s*up)\s+an?\s+event\b/i,
    /\bextract\s+(?:event\s+)?(?:details|info)\s+from\s+(?:this\s+)?(?:poster|flyer|image)\b/i,
    /\bhere\s+is\s+(?:my|the)\s+(?:event\s+)?(?:poster|flyer)\b/i,
  ]

  if (explicitDraftTriggers.some((pattern) => pattern.test(lower))) {
    return true
  }

  if (hasImages && /\b(poster|flyer|draft|event\s+details|extract)\b/i.test(lower)) {
    return true
  }

  // If the session already has an active draft preview, check if this message is a field update/correction
  if (hasActiveDraft) {
    const correctionPatterns = [
      /\b(?:change|update|set|make|edit|correct)\s+(?:the\s+)?(?:title|name|date|time|location|venue|capacity|price|ticket|visibility|category|deadline|organizer|whatsapp)\b/i,
      /(?:^|\n|\b)(?:title|date|location|venue|capacity|price|deadline|organizer)\s*(?:is|to|[:=-])\s*\S+/i,
      /\b(?:it\s+is|make\s+it)\s+(?:free|paid|virtual|physical|public|private|walk-in)\b/i,
      /\bfor\s+\d+\s+(?:people|attendees|seats|slots)\b/i,
    ]
    if (correctionPatterns.some((p) => p.test(lower))) {
      return true
    }
  }

  return false
}

/**
 * Messages that clearly leave the event-creation flow (reads about existing events),
 * so they must not be absorbed into the in-progress draft.
 */
export function escapesDraftContinuation(message: string): boolean {
  return [
    /\b(?:how\s+many|summar(?:y|ize|ise)|insights?|followers?|announcement\s+status)\b/i,
    /\b(?:list|show|view)\s+(?:all\s+)?(?:my|our|the)\s+events\b/i,
    /\bmy\s+events\b/i,
  ].some((p) => p.test(message))
}

export function detectsListEventsIntent(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return [
    /\b(?:list|show|view|what\s+are|which)\s+(?:all\s+)?(?:my|our|the)\s+events\b/i,
    /\bevents\s+(?:i\s+have|i\s+manage|in\s+my\s+workspace)\b/i,
  ].some((p) => p.test(lower))
}

export function detectsEventInsightsOrSummaryIntent(
  message: string
): "get_event_insights" | "get_event_summary" | null {
  const lower = message.toLowerCase().trim()

  const insightKeywords = [
    "how many",
    "registered",
    "registrations",
    "waitlist",
    "fill rate",
    "capacity",
    "peak",
    "best time",
    "when should",
    "share my link",
    "insights",
    "registration timeline",
    "people registered",
    "how is my event",
    "how are registrations",
    "velocity",
    "wangapi",
    "walisajiliwa",
    "orodha ya kusubiri",
    "usajili",
  ]

  if (insightKeywords.some((kw) => lower.includes(kw))) {
    return "get_event_insights"
  }

  const summaryKeywords = [
    "event summary",
    "summary",
    "overview",
    "summarize my event",
    "summarise my event",
    "details of my event",
    "status of my event",
    "when is my event",
    "where is my event",
  ]

  if (summaryKeywords.some((kw) => lower.includes(kw))) {
    return "get_event_summary"
  }

  return null
}

// Capability 5 Intent Detection
export function detectsFollowerStatusIntent(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return [
    /\b(?:how\s+many\s+)?followers?(?:\s+do\s+i\s+have|\s+count|\s+status)?\b/i,
    /\b(?:announcement|notification)\s+status\b/i,
    /\b(?:did|will)\s+(?:my\s+)?followers\s+(?:get|receive|be)\s+(?:notified|announcement)\b/i,
    /\b(?:follower\s+and\s+announcement\s+status|who\s+was\s+notified)\b/i,
  ].some((p) => p.test(lower))
}

// Capability 6 Intent Detection
export function detectsRescheduleEventIntent(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return [
    /\b(?:reschedule|postpone|move|shift|push)\s+(?:the\s+|my\s+)?(?:event|meetup|workshop|session)?\s*(?:to|date|time)?\b/i,
    /\bchange\s+(?:the\s+)?(?:event\s+)?(?:date|time|start\s*time)\b/i,
    /\bnew\s+(?:event\s+)?(?:date|time)\s*(?:is|to|:)\b/i,
  ].some((p) => p.test(lower))
}

// Capability 7 Intent Detection
export function detectsUpdateCapacityIntent(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return [
    /\b(?:update|change|increase|decrease|set|raise|lower|expand)\s+(?:the\s+)?(?:event\s+)?(?:capacity|attendee\s+limit|seat\s+limit|spots?|seats?)\b/i,
    /\bcapacity\s*(?:to|is|[:=])\s*\d+\b/i,
    /\b(?:limit|cap)\s+(?:to|at)\s+\d+\s+(?:attendees|people|spots|seats|registrations)\b/i,
  ].some((p) => p.test(lower))
}

// Capability 8 Intent Detection
export function detectsUpdateVenueIntent(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return [
    /\b(?:update|change|move|set)\s+(?:the\s+)?(?:event\s+)?(?:venue|location|address|place)\b/i,
    /\b(?:new\s+venue|new\s+location)\s*(?:is|to|:)\b/i,
    /\b(?:map\s*directions|directions\s*url)\b/i,
  ].some((p) => p.test(lower))
}

// Capability 9 Intent Detection
export function detectsUpdateStatusIntent(message: string): boolean {
  const lower = message.toLowerCase().trim()
  return [
    /\b(?:cancel|close|archive|reactivate|reopen)\s+(?:the\s+|my\s+)?(?:event|registrations?)\b/i,
    /\b(?:make|set|change)\s+(?:the\s+|my\s+)?(?:event\s+)?(?:to\s+)?(?:public|private|unlisted|closed|active|archived|cancelled)\b/i,
    /\b(?:publish|unpublish)\s+(?:the\s+|my\s+)?event\b/i,
  ].some((p) => p.test(lower))
}

export function parseDateFromMessage(message: string): Date | null {
  const isoMatch = message.match(/\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[+-]\d{2}:\d{2})?)?\b/)
  if (isoMatch) {
    const d = new Date(isoMatch[0])
    if (!isNaN(d.getTime())) return d
  }
  const datePatternMatch = message.match(/\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember))\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?)?/i)
  if (datePatternMatch) {
    const cleanStr = datePatternMatch[0].replace(/(st|nd|rd|th)/gi, "")
    const d = new Date(cleanStr)
    if (!isNaN(d.getTime())) return d
  }
  const afterTo = message.match(/\b(?:to|on|for)\s+([A-Za-z0-9\s,:-]+?)(?:\.|$)/i)
  if (afterTo) {
    const candidate = afterTo[1].trim()
    const d = new Date(candidate)
    if (!isNaN(d.getTime()) && candidate.length >= 4) return d
  }
  return null
}

// ─── Grounded Deterministic Reply Formatters ──────────────────────────────────

export function formatDraftPreviewReply(
  preview: EventDraftPreview,
  state?: ConversationState
): string {
  const sections: string[] = []

  sections.push(
    "I've prepared an **Event Draft Preview** based on the details provided. **No live event has been created or published on EventSlot.**"
  )

  if (preview.extractedFieldKeys.length > 0) {
    const details: string[] = []
    if (preview.fields.title) details.push(`• **Title:** "${preview.fields.title}"`)
    if (preview.fields.eventType)
      details.push(`• **Format:** ${preview.fields.eventType === "VIRTUAL" ? "Virtual" : "In-Person"}`)
    if (preview.fields.eventDate) details.push(`• **Date:** ${preview.fields.eventDate}`)
    if (preview.fields.location) details.push(`• **Location:** ${preview.fields.location}`)
    if (preview.fields.virtualLink) details.push(`• **Link:** ${preview.fields.virtualLink}`)
    if (preview.fields.capacity !== null)
      details.push(`• **Capacity:** ${preview.fields.capacity} attendees`)
    if (preview.fields.isPaid && preview.fields.ticketPrice)
      details.push(`• **Price:** KSh ${preview.fields.ticketPrice}`)
    else if (!preview.fields.isPaid) details.push("• **Entry:** Free admission")

    if (details.length > 0) {
      sections.push(`### Captured Details\n${details.join("\n")}`)
    }
  }

  if (preview.uncertainFields.length > 0) {
    const issues = preview.uncertainFields.map((u) => `• ${u.label}: ${u.issue}`).join("\n")
    sections.push(`### Needs Clarification\n${issues}`)
  }

  // Ask minimal follow-up question (one single focus) rather than overwhelming
  if (preview.missingFields.length > 0) {
    const minimalQuestion = selectMinimalFollowUpQuestion({
      eventName: preview.fields.title,
      eventType: preview.fields.eventType,
      location: preview.fields.location,
      date: preview.fields.eventDate,
      attendeeLimit: preview.fields.capacity,
      isPaid: preview.fields.isPaid,
    })

    if (minimalQuestion) {
      sections.push(`### Next Step\n${minimalQuestion}`)
    } else {
      sections.push(`### Next Step\n${preview.nextRecommendedStep}`)
    }
  } else {
    sections.push(`### Next Step\n${preview.nextRecommendedStep}`)
  }

  // Proactively suggest contextual EventSlot features
  const recs = getSmartFeatureRecommendations({
    context: {
      eventName: preview.fields.title,
      eventType: preview.fields.eventType,
      location: preview.fields.location,
      date: preview.fields.eventDate,
      attendeeLimit: preview.fields.capacity,
      isPaid: preview.fields.isPaid,
    },
    intent: "CREATE_EVENT",
    alreadyRecommended: state?.recommendedFeatures,
  })
  const recsText = formatSmartRecommendations(recs)
  if (recsText) {
    sections.push(recsText)
  }

  return sections.join("\n\n")
}

function formatReadCapabilityFallbackReply(
  capability: string,
  data: unknown
): string {
  if (capability === "list_organizer_events") {
    const listData = data as ListOrganizerEventsOutput
    if (!listData.events || listData.events.length === 0) {
      return "You don't have any authorised events in this workspace yet. When you're ready, I can help you draft your first event!"
    }
    const items = listData.events
      .slice(0, 10)
      .map(
        (ev, idx) =>
          `${idx + 1}. **${ev.title}** (\`${ev.slug}\`)\n   • Confirmed: ${ev.confirmedCount}${
            ev.capacity ? ` / ${ev.capacity} (${ev.fillRate}% full)` : " confirmed"
          }\n   • Waitlist: ${ev.waitlistCount} | Status: **${ev.status}**`
      )
      .join("\n\n")
    return `### Your Authorised Events\n\n${items}`
  }

  if (capability === "get_event_summary") {
    const summary = data as EventSummaryOutput
    return `### Event Overview: ${summary.title}\n\n• **Status:** ${summary.status}\n• **Confirmed Registrations:** ${summary.confirmedCount}${
      summary.capacity ? ` / ${summary.capacity} (${summary.fillRate}% full)` : ""
    }\n• **Waitlist Queue:** ${summary.waitlistCount} waiting\n• **Event Slug:** \`${summary.slug}\``
  }

  if (capability === "get_event_insights") {
    const out = data as EventInsightsOutput
    const ins = out.insights
    const tip = ins.suggestions[0] ?? ""
    return `### Registration Insights: ${ins.eventTitle}\n\n• **Confirmed Registrations:** ${ins.totalRegistrations} / ${ins.capacity} (${ins.fillRate}% full)\n• **Waitlist Count:** ${ins.waitlistCount}\n• **Signup Velocity:** ${ins.registrationVelocity}\n\n${
      tip ? `💡 **Proactive Tip:** ${tip}\n\n` : ""
    }${FULL_REPORT_CTA}`
  }

  if (capability === "get_follower_and_announcement_status") {
    const statusData = data as any
    const parts = [
      `### Follower & Announcement Status`,
      `• **Total Followers:** ${statusData?.totalFollowers ?? 0}`,
      `• **Notification Opt-ins:** ${statusData?.notifiableFollowers ?? 0}`,
      `• **Publication Announcement:** **${statusData?.announcementStatus ?? "NOT_TRIGGERED"}**`,
    ]
    if (statusData?.eventTitle) {
      parts.push(`• **Event:** "${statusData.eventTitle}"`)
    }
    if (statusData?.announcementSentAt) {
      parts.push(`• **Sent At:** ${new Date(statusData.announcementSentAt).toLocaleString()}`)
    }
    return parts.join("\n")
  }

  return "Here is the verified information from your EventSlot workspace."
}

// ─── Default Groq LLM Adapter ─────────────────────────────────────────────────

export const defaultGroqLLMAdapter: AssistantLLMAdapter = {
  generateReply: async ({
    systemPrompt,
    conversationHistory,
    userMessage,
    images,
    verifiedToolResults,
  }) => {
    let groundedSystemPrompt = systemPrompt

    if (verifiedToolResults.length > 0) {
      const serialized = verifiedToolResults
        .map(
          (r) =>
            `Capability: ${r.capability}\nVerified Output JSON:\n${JSON.stringify(
              r.envelope,
              null,
              2
            )}`
        )
        .join("\n\n")

      groundedSystemPrompt += `\n\n═══════════════════════════════════════════════\nVERIFIED CAPABILITY RESULTS (AUTHORITATIVE GROUND TRUTH)\n═══════════════════════════════════════════════\n${serialized}\n\nIMPORTANT: Base your answer strictly on the verified capability output above. Do NOT invent metrics or claim any unverified action occurred.\n═══════════════════════════════════════════════`
    }

    const hasImages = Boolean(images && images.length > 0)
    const modelToUse = hasImages ? VISION_MODEL : ASSISTANT_MODEL

    const messages: NonNullable<
      Parameters<typeof groq.chat.completions.create>[0]["messages"]
    > = [
      { role: "system", content: groundedSystemPrompt },
      ...conversationHistory.slice(-16).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    ]

    if (hasImages && images) {
      messages.push({
        role: "user",
        content: [
          ...images.slice(0, 3).map((img) => ({
            type: "image_url" as const,
            image_url: { url: img.base64DataUrl },
          })),
          {
            type: "text" as const,
            text:
              wrapUntrustedContent("user_message", userMessage) ||
              "Please inspect this screenshot.",
          },
        ],
      })
    } else {
      messages.push({
        role: "user",
        content: wrapUntrustedContent("user_message", userMessage),
      })
    }

    let currentModel = modelToUse
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const completion = await groq.chat.completions.create({
          model: currentModel,
          messages,
          max_tokens: 500,
          temperature: 0.3,
        })
        const content = completion.choices?.[0]?.message?.content
        if (typeof content === "string" && content.trim()) {
          return content.trim()
        }
      } catch (err) {
        if (hasImages && currentModel !== VISION_MODEL_FALLBACK) {
          currentModel = VISION_MODEL_FALLBACK
          continue
        }
        throw err
      }
    }

    return ""
  },
}

// ─── Mutating Management Proposal Pipeline ──────────────────────────────────

async function handleMutatingManagementProposal(params: {
  actor: AssistantActorContext & { organizerName?: string | null }
  sessionId: string
  sanitizedMessage: string
  explicitEventIdOrSlug?: string | null
  limits: OrchestratorLimits
  toolCallsExecuted: OrchestratorToolExecutionRecord[]
  persistenceStore?: PendingActionPersistenceStore | null
}): Promise<OrchestratorResult | null> {
  const { actor, sessionId, sanitizedMessage, explicitEventIdOrSlug, limits, toolCallsExecuted } = params

  const isReschedule = detectsRescheduleEventIntent(sanitizedMessage)
  const isCapacity = detectsUpdateCapacityIntent(sanitizedMessage)
  const isVenue = detectsUpdateVenueIntent(sanitizedMessage)
  const isStatus = detectsUpdateStatusIntent(sanitizedMessage)

  if (!isReschedule && !isCapacity && !isVenue && !isStatus) {
    return null
  }

  const resolution = await resolveAssistantEventContext({
    actor,
    explicitEventIdOrSlug,
    message: sanitizedMessage,
  })

  if (resolution.status === "FORBIDDEN_OR_NOT_FOUND") {
    return {
      kind: "CAPABILITY_ERROR",
      reply: truncateOutput(resolution.reason, limits.maxOutputChars),
      toolCallsExecuted,
      iterationsUsed: 1,
      usedLiveEventData: false,
      clarification: null,
      capabilityError: {
        capability: "resolve_event_context",
        code: "FORBIDDEN",
        message: resolution.reason,
      },
      draftPreview: null,
    }
  }

  if (resolution.status === "AMBIGUOUS" || resolution.status === "NEEDS_CONTEXT") {
    return {
      kind: "CLARIFICATION_REQUIRED",
      reply: truncateOutput(resolution.clarificationPrompt, limits.maxOutputChars),
      toolCallsExecuted,
      iterationsUsed: 1,
      usedLiveEventData: false,
      clarification: {
        reason: resolution.clarificationPrompt,
        candidates: resolution.candidates.map((c) => ({
          id: c.id,
          slug: c.slug,
          title: c.title,
          status: c.status,
        })),
      },
      capabilityError: null,
      draftPreview: null,
    }
  }

  const event = resolution.event
  const store = params.persistenceStore ?? new PrismaPendingActionStore()

  // 1. Reschedule Event
  if (isReschedule) {
    const parsedDate = parseDateFromMessage(sanitizedMessage)
    if (!parsedDate) {
      return {
        kind: "ANSWER",
        reply: `I can help you reschedule "${event.title}". What new date and time would you like to move it to? (e.g. "December 15, 2026 6:00 PM" or "2026-12-15T18:00:00Z")`,
        toolCallsExecuted,
        iterationsUsed: 1,
        usedLiveEventData: true,
        clarification: null,
        capabilityError: null,
        draftPreview: null,
      }
    }

    const preview: ActionPreviewCard = {
      title: `Confirm Reschedule: ${event.title}`,
      summary: `Reschedule "${event.title}" to ${parsedDate.toLocaleString()}.`,
      targetEvent: { id: event.id, slug: event.slug, title: event.title },
      fields: [
        {
          key: "eventDate",
          label: "Event Date",
          previousValue: event.eventDate ? new Date(event.eventDate).toISOString() : "Not set",
          proposedValue: parsedDate.toISOString(),
        },
      ],
      impactWarnings: [
        "Registered attendees will see the updated date on their passes and confirmation links.",
      ],
    }

    const proposal = createActionProposal({
      capability: "reschedule_event",
      riskLevel: "WRITE_HIGH",
      validatedInput: {
        eventIdOrSlug: event.id,
        newEventDate: parsedDate.toISOString(),
        workspaceOrganizerId: actor.workspaceOrganizerId ?? null,
      },
      preview,
      actor,
      targetEventId: event.id,
      sessionId,
      operation: "RESCHEDULE_EVENT",
    })

    const savedProposal = await store.savePendingProposal(proposal)

    return {
      kind: "ACTION_PROPOSAL",
      reply: truncateOutput(
        `I have prepared a confirmation proposal to reschedule "${event.title}" to ${parsedDate.toLocaleString()}. Please review the details below and confirm to apply the change.`,
        limits.maxOutputChars
      ),
      toolCallsExecuted: [
        {
          capability: "reschedule_event",
          ok: true,
          riskLevel: "WRITE_HIGH",
        },
      ],
      iterationsUsed: 1,
      usedLiveEventData: true,
      clarification: null,
      capabilityError: null,
      draftPreview: null,
      proposal: savedProposal,
    }
  }

  // 2. Update Capacity
  if (isCapacity) {
    const capMatch =
      sanitizedMessage.match(/\b(?:capacity|limit|spots?|seats?)\s*(?:to|is|[:=])?\s*(\d+)\b/i) ||
      sanitizedMessage.match(/\b(?:to|at|set|update|change|raise|lower|expand)\s+(\d+)\s*(?:people|attendees|spots|seats|registrations)?\b/i) ||
      sanitizedMessage.match(/\b(\d+)\s*(?:people|attendees|spots|seats|registrations)\b/i)

    if (!capMatch) {
      return {
        kind: "ANSWER",
        reply: `What new capacity limit would you like to set for "${event.title}"? Currently it is ${event.capacity ?? "Unlimited"} (${event.confirmedCount} confirmed).`,
        toolCallsExecuted,
        iterationsUsed: 1,
        usedLiveEventData: true,
        clarification: null,
        capabilityError: null,
        draftPreview: null,
      }
    }

    const newCapacity = parseInt(capMatch[1], 10)
    if (newCapacity < event.confirmedCount) {
      return {
        kind: "ANSWER",
        reply: `Cannot set capacity to ${newCapacity}. Event "${event.title}" already has ${event.confirmedCount} confirmed attendees. Please specify a capacity equal to or greater than ${event.confirmedCount}.`,
        toolCallsExecuted,
        iterationsUsed: 1,
        usedLiveEventData: true,
        clarification: null,
        capabilityError: null,
        draftPreview: null,
      }
    }

    const preview: ActionPreviewCard = {
      title: `Confirm Capacity Update: ${event.title}`,
      summary: `Update capacity limit for "${event.title}" from ${event.capacity ?? "Unlimited"} to ${newCapacity} attendees.`,
      targetEvent: { id: event.id, slug: event.slug, title: event.title },
      fields: [
        {
          key: "capacity",
          label: "Attendee Capacity",
          previousValue: event.capacity,
          proposedValue: newCapacity,
        },
      ],
      impactWarnings: [
        "Updating capacity takes effect immediately. Waitlisted attendees may become eligible if capacity is increased.",
      ],
    }

    const proposal = createActionProposal({
      capability: "update_event_capacity",
      riskLevel: "WRITE_LOW",
      validatedInput: {
        eventIdOrSlug: event.id,
        capacity: newCapacity,
        workspaceOrganizerId: actor.workspaceOrganizerId ?? null,
      },
      preview,
      actor,
      targetEventId: event.id,
      sessionId,
      operation: "UPDATE_EVENT_CAPACITY",
    })

    const savedProposal = await store.savePendingProposal(proposal)

    return {
      kind: "ACTION_PROPOSAL",
      reply: truncateOutput(
        `I have prepared a confirmation proposal to update the capacity of "${event.title}" to ${newCapacity} attendees. Please review the details below and confirm to apply the change.`,
        limits.maxOutputChars
      ),
      toolCallsExecuted: [
        {
          capability: "update_event_capacity",
          ok: true,
          riskLevel: "WRITE_LOW",
        },
      ],
      iterationsUsed: 1,
      usedLiveEventData: true,
      clarification: null,
      capabilityError: null,
      draftPreview: null,
      proposal: savedProposal,
    }
  }

  // 3. Update Venue
  if (isVenue) {
    const venueMatch =
      sanitizedMessage.match(/\b(?:venue|location|address|place)\s*(?:to|is|[:=])\s*([^\n\r.]+)/i) ||
      sanitizedMessage.match(/\b(?:move|shift)\s+(?:the\s+)?(?:event\s+)?(?:to)\s+([^\n\r.]+)/i)

    if (!venueMatch) {
      return {
        kind: "ANSWER",
        reply: `What new venue or location would you like to set for "${event.title}"? Currently it is "${event.location ?? "Not set"}".`,
        toolCallsExecuted,
        iterationsUsed: 1,
        usedLiveEventData: true,
        clarification: null,
        capabilityError: null,
        draftPreview: null,
      }
    }

    const newLocation = venueMatch[1].trim()
    const preview: ActionPreviewCard = {
      title: `Confirm Venue Update: ${event.title}`,
      summary: `Update location for "${event.title}" to "${newLocation}".`,
      targetEvent: { id: event.id, slug: event.slug, title: event.title },
      fields: [
        {
          key: "location",
          label: "Venue / Location",
          previousValue: event.location ?? "Not set",
          proposedValue: newLocation,
        },
      ],
      impactWarnings: [
        "The updated venue details will appear on tickets and the event registration page.",
      ],
    }

    const proposal = createActionProposal({
      capability: "update_event_venue",
      riskLevel: "WRITE_LOW",
      validatedInput: {
        eventIdOrSlug: event.id,
        location: newLocation,
        workspaceOrganizerId: actor.workspaceOrganizerId ?? null,
      },
      preview,
      actor,
      targetEventId: event.id,
      sessionId,
      operation: "UPDATE_EVENT_VENUE",
    })

    const savedProposal = await store.savePendingProposal(proposal)

    return {
      kind: "ACTION_PROPOSAL",
      reply: truncateOutput(
        `I have prepared a confirmation proposal to update the venue of "${event.title}" to "${newLocation}". Please review the details below and confirm to apply the change.`,
        limits.maxOutputChars
      ),
      toolCallsExecuted: [
        {
          capability: "update_event_venue",
          ok: true,
          riskLevel: "WRITE_LOW",
        },
      ],
      iterationsUsed: 1,
      usedLiveEventData: true,
      clarification: null,
      capabilityError: null,
      draftPreview: null,
      proposal: savedProposal,
    }
  }

  // 4. Update Status
  if (isStatus) {
    let newStatus: "active" | "closed" | "archived" | "cancelled" | undefined
    let newVisibility: "PUBLIC" | "UNLISTED" | "PRIVATE" | undefined

    const lower = sanitizedMessage.toLowerCase()
    if (/\bcancel(?:led|ing|ation)?\b/i.test(lower)) {
      newStatus = "cancelled"
    } else if (/\bclose(?:d)?\b/i.test(lower)) {
      newStatus = "closed"
    } else if (/\barchive(?:d)?\b/i.test(lower)) {
      newStatus = "archived"
    } else if (/\b(?:reactivate|reopen|active)\b/i.test(lower)) {
      newStatus = "active"
    }

    if (/\b(?:make\s+)?public\b/i.test(lower) || /\bpublish\b/i.test(lower)) {
      newVisibility = "PUBLIC"
    } else if (/\b(?:make\s+)?private\b/i.test(lower)) {
      newVisibility = "PRIVATE"
    } else if (/\b(?:make\s+)?unlisted\b/i.test(lower) || /\bunpublish\b/i.test(lower)) {
      newVisibility = "UNLISTED"
    }

    if (!newStatus && !newVisibility) {
      return {
        kind: "ANSWER",
        reply: `What status or visibility change would you like to make to "${event.title}"? (Options: active, closed, cancelled, archived, public, private, unlisted)`,
        toolCallsExecuted,
        iterationsUsed: 1,
        usedLiveEventData: true,
        clarification: null,
        capabilityError: null,
        draftPreview: null,
      }
    }

    const preview: ActionPreviewCard = {
      title: `Confirm Status Update: ${event.title}`,
      summary: `Update status of "${event.title}" to "${newStatus ?? event.status}"${newVisibility ? ` (${newVisibility})` : ""}.`,
      targetEvent: { id: event.id, slug: event.slug, title: event.title },
      fields: [
        ...(newStatus ? [{
          key: "status",
          label: "Event Status",
          previousValue: event.status,
          proposedValue: newStatus,
        }] : []),
        ...(newVisibility ? [{
          key: "visibility",
          label: "Visibility",
          previousValue: event.visibility,
          proposedValue: newVisibility,
        }] : []),
      ],
      impactWarnings: [
        newStatus === "cancelled"
          ? "Cancelling will display the event as cancelled on registration pages and halt registrations."
          : newStatus === "closed"
          ? "Closing will prevent new attendees from registering."
          : "Status and visibility changes take effect immediately across EventSlot.",
      ],
    }

    const proposal = createActionProposal({
      capability: "update_event_status",
      riskLevel: "WRITE_HIGH",
      validatedInput: {
        eventIdOrSlug: event.id,
        ...(newStatus ? { status: newStatus } : {}),
        ...(newVisibility ? { visibility: newVisibility } : {}),
        workspaceOrganizerId: actor.workspaceOrganizerId ?? null,
      },
      preview,
      actor,
      targetEventId: event.id,
      sessionId,
      operation: "UPDATE_EVENT_STATUS",
    })

    const savedProposal = await store.savePendingProposal(proposal)

    return {
      kind: "ACTION_PROPOSAL",
      reply: truncateOutput(
        `I have prepared a confirmation proposal to update "${event.title}" status to "${newStatus ?? event.status}"${newVisibility ? ` (${newVisibility})` : ""}. Please review the details below and confirm to apply the change.`,
        limits.maxOutputChars
      ),
      toolCallsExecuted: [
        {
          capability: "update_event_status",
          ok: true,
          riskLevel: "WRITE_HIGH",
        },
      ],
      iterationsUsed: 1,
      usedLiveEventData: true,
      clarification: null,
      capabilityError: null,
      draftPreview: null,
      proposal: savedProposal,
    }
  }

  return null
}

// ─── Main Controlled ESA Orchestrator ─────────────────────────────────────────

export async function runAssistantOrchestrator(params: {
  actor: AssistantActorContext & { organizerName?: string | null }
  sessionId: string
  message: string
  explicitEventIdOrSlug?: string | null
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
  images?: Array<{ mediaType: string; base64DataUrl: string }>
  systemPrompt?: string
  memoryContext?: string | null
  docsContext?: string | null
  registry?: AssistantCapabilityRegistry
  llmAdapter?: AssistantLLMAdapter
  limits?: Partial<OrchestratorLimits>
  persistenceStore?: PendingActionPersistenceStore | null
}): Promise<OrchestratorResult> {
  const limits = clampLimits(params.limits)
  const registry = params.registry ?? assistantCapabilityRegistry
  const llmAdapter = params.llmAdapter ?? defaultGroqLLMAdapter

  const boundedMessage = (params.message ?? "").slice(0, limits.maxInputChars)
  const { cleaned: sanitizedMessage } = stripUntrustedControlPhrases(boundedMessage)

  const conversationState = analyzeConversationState(
    params.conversationHistory ?? [],
    { userId: params.actor.userId, sessionId: params.sessionId }
  )
  const detectedIntent = detectUserIntent(sanitizedMessage, conversationState)
  const complexity = evaluateQueryComplexity(sanitizedMessage, detectedIntent.intent)

  const toolCallsExecuted: OrchestratorToolExecutionRecord[] = []
  const verifiedToolResults: Array<{
    capability: string
    envelope: CapabilityResultEnvelope
  }> = []

  const startTime = Date.now()
  let iterationsUsed = 0
  let usedLiveEventData = false

  const checkTimeBudget = () => {
    if (
      limits.maxExecutionTimeMs <= 0 ||
      Date.now() - startTime > limits.maxExecutionTimeMs
    ) {
      throw new Error("ORCHESTRATOR_TIMEOUT")
    }
  }

  try {
    checkTimeBudget()
  } catch {
    return {
      kind: "CAPABILITY_ERROR",
      reply:
        "I couldn't complete that action because the assistant request timed out. Please try again.",
      toolCallsExecuted,
      iterationsUsed,
      usedLiveEventData: false,
      clarification: null,
      capabilityError: {
        capability: "orchestrator",
        code: "EXECUTION_FAILED",
        message: "The assistant request timed out before completion.",
      },
      draftPreview: null,
    }
  }

  // Only capabilities registered, enabled, and with READ or DRAFT risk level can be exposed
  const availableCapabilities = registry
    .listMetadata()
    .filter(
      (cap) =>
        cap.enabled &&
        !cap.requiresConfirmation &&
        (cap.riskLevel === "READ" || cap.riskLevel === "DRAFT")
    )

  // Determine planned tool calls for Iteration 1
  const existingSessionDraft = getSessionDraftPreview(
    params.actor.userId,
    params.sessionId
  )
  const hasImages = Boolean(params.images && params.images.length > 0)

  const initialPlannedCalls: OrchestratorToolCallRequest[] = []

  if (llmAdapter.planToolCalls) {
    iterationsUsed += 1
    checkTimeBudget()
    const modelPlanned = await withTimeout(
      llmAdapter.planToolCalls({
        message: sanitizedMessage,
        availableCapabilities,
        iteration: iterationsUsed,
        priorToolResults: [],
      }),
      limits.maxExecutionTimeMs,
      "ORCHESTRATOR_TIMEOUT"
    )
    if (modelPlanned && modelPlanned.length > 0) {
      initialPlannedCalls.push(...modelPlanned)
    }
  } else {
    // Event-creation continuity: once the organizer has started describing a new event,
    // follow-up answers ("free, virtual, 8pm", "9th November", "capacity 120") belong to the
    // draft - not to event insights or to an existing-event lookup.
    const draftIntent = detectsDraftPreparationIntent(
      sanitizedMessage,
      Boolean(existingSessionDraft),
      hasImages
    )
    let creationInProgress = Boolean(existingSessionDraft)
    let replayMessages: string[] = []
    if (!creationInProgress) {
      const priorUserMessages = (params.conversationHistory ?? [])
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .slice(-12)
      const startIdx = priorUserMessages
        .map((m) => detectsDraftPreparationIntent(m, false, false))
        .lastIndexOf(true)
      if (startIdx >= 0) {
        creationInProgress = true
        replayMessages = priorUserMessages.slice(startIdx)
      }
    }
    const continuingDraft =
      creationInProgress && !draftIntent && !escapesDraftContinuation(sanitizedMessage)

    if (continuingDraft && !existingSessionDraft) {
      // Draft store is process-local; rebuild it from this conversation's earlier turns.
      for (const earlier of replayMessages) {
        await prepareEventDraftPreview({
          userId: params.actor.userId,
          sessionId: params.sessionId,
          messageText: earlier,
          defaultOrganizerName: params.actor.organizerName ?? null,
        })
      }
    }

    // Deterministic routing for capabilities
    if (draftIntent || continuingDraft) {
      initialPlannedCalls.push({
        capability: "prepare_event_draft",
        input: {
          sessionId: params.sessionId,
          messageText: sanitizedMessage,
          defaultOrganizerName: params.actor.organizerName ?? null,
          workspaceOrganizerId: params.actor.workspaceOrganizerId ?? null,
          ...(hasImages ? { posterImages: params.images } : {}),
        },
      })
    } else if (detectsListEventsIntent(sanitizedMessage)) {
      initialPlannedCalls.push({
        capability: "list_organizer_events",
        input: {
          status: "all",
          limit: 10,
          workspaceOrganizerId: params.actor.workspaceOrganizerId ?? null,
        },
      })
    } else if (detectsFollowerStatusIntent(sanitizedMessage)) {
      initialPlannedCalls.push({
        capability: "get_follower_and_announcement_status",
        input: {
          ...(params.explicitEventIdOrSlug
            ? { eventIdOrSlug: params.explicitEventIdOrSlug }
            : {}),
          workspaceOrganizerId: params.actor.workspaceOrganizerId ?? null,
        },
      })
    } else if (
      detectsRescheduleEventIntent(sanitizedMessage) ||
      detectsUpdateCapacityIntent(sanitizedMessage) ||
      detectsUpdateVenueIntent(sanitizedMessage) ||
      detectsUpdateStatusIntent(sanitizedMessage)
    ) {
      const mutationProposalResult = await handleMutatingManagementProposal({
        actor: params.actor,
        sessionId: params.sessionId,
        sanitizedMessage,
        explicitEventIdOrSlug: params.explicitEventIdOrSlug,
        limits,
        toolCallsExecuted,
        persistenceStore: params.persistenceStore,
      })
      if (mutationProposalResult) {
        return mutationProposalResult
      }
    } else {
      const eventReadCapability = detectsEventInsightsOrSummaryIntent(
        sanitizedMessage
      )
      if (params.explicitEventIdOrSlug || eventReadCapability) {
        const capName = eventReadCapability ?? "get_event_insights"
        initialPlannedCalls.push({
          capability: capName,
          input: {
            ...(params.explicitEventIdOrSlug
              ? { eventIdOrSlug: params.explicitEventIdOrSlug }
              : {}),
            messageContext: sanitizedMessage,
            workspaceOrganizerId: params.actor.workspaceOrganizerId ?? null,
          },
        })
      }
    }
  }

  // Execute tool-calling loop within strict iteration & tool-call bounds
  let pendingQueue = initialPlannedCalls.slice(0, limits.maxToolCalls)

  while (
    pendingQueue.length > 0 &&
    iterationsUsed < limits.maxIterations &&
    toolCallsExecuted.length < limits.maxToolCalls
  ) {
    if (!llmAdapter.planToolCalls || iterationsUsed === 0) {
      iterationsUsed += 1
    }

    for (const call of pendingQueue) {
      if (toolCallsExecuted.length >= limits.maxToolCalls) {
        break
      }

      checkTimeBudget()

      const envelope = await withTimeout(
        registry.execute({
          capability: call.capability,
          actor: params.actor,
          rawInput: call.input,
        }),
        limits.maxExecutionTimeMs,
        "ORCHESTRATOR_TIMEOUT"
      )

      toolCallsExecuted.push({
        capability: call.capability,
        ok: envelope.ok,
        riskLevel: envelope.riskLevel,
        errorCode: envelope.ok ? undefined : envelope.error.code,
      })

      verifiedToolResults.push({
        capability: call.capability,
        envelope,
      })

      // Handle non-OK capability envelope immediately without fabricating success
      if (!envelope.ok) {
        if (
          envelope.error.code === "AMBIGUOUS_CONTEXT" ||
          envelope.error.code === "MISSING_CONTEXT"
        ) {
          const details = (envelope.error.details ?? {}) as {
            candidates?: Array<{
              id: string
              slug: string
              title: string
              status: string
            }>
          }

          return {
            kind: "CLARIFICATION_REQUIRED",
            reply: truncateOutput(envelope.error.message, limits.maxOutputChars),
            toolCallsExecuted,
            iterationsUsed,
            usedLiveEventData: false,
            clarification: {
              reason: envelope.error.message,
              candidates: details.candidates ?? [],
            },
            capabilityError: null,
            draftPreview: null,
          }
        }

        return {
          kind: "CAPABILITY_ERROR",
          reply: truncateOutput(
            formatUserFriendlyError(envelope.error.code, envelope.error.message),
            limits.maxOutputChars
          ),
          toolCallsExecuted,
          iterationsUsed,
          usedLiveEventData: false,
          clarification: null,
          capabilityError: {
            capability: call.capability,
            code: envelope.error.code,
            message: envelope.error.message,
          },
          draftPreview: null,
        }
      }

      // If prepare_event_draft succeeded, return the structured DRAFT_PREVIEW response
      if (call.capability === "prepare_event_draft" && envelope.ok) {
        const preview = envelope.data as EventDraftPreview
        return {
          kind: "DRAFT_PREVIEW",
          reply: truncateOutput(
            formatDraftPreviewReply(preview, conversationState),
            limits.maxOutputChars
          ),
          toolCallsExecuted,
          iterationsUsed,
          usedLiveEventData: false,
          clarification: null,
          capabilityError: null,
          draftPreview: preview,
        }
      }

      if (
        call.capability === "list_organizer_events" ||
        call.capability === "get_event_summary" ||
        call.capability === "get_event_insights" ||
        call.capability === "get_follower_and_announcement_status"
      ) {
        usedLiveEventData = true
      }
    }

    // If custom model planner is used and we still have iteration & tool budget, check if it wants another step
    if (
      llmAdapter.planToolCalls &&
      iterationsUsed < limits.maxIterations &&
      toolCallsExecuted.length < limits.maxToolCalls
    ) {
      iterationsUsed += 1
      checkTimeBudget()
      const nextCalls = await withTimeout(
        llmAdapter.planToolCalls({
          message: sanitizedMessage,
          availableCapabilities,
          iteration: iterationsUsed,
          priorToolResults: verifiedToolResults,
        }),
        limits.maxExecutionTimeMs,
        "ORCHESTRATOR_TIMEOUT"
      )
      pendingQueue = (nextCalls ?? []).slice(
        0,
        limits.maxToolCalls - toolCallsExecuted.length
      )
    } else {
      break
    }
  }

  // Assemble full system prompt for grounded answer synthesis
  let fullSystemPrompt = params.systemPrompt ?? EVENTSLOT_SYSTEM_PROMPT
  if (params.memoryContext) {
    fullSystemPrompt += `\n${params.memoryContext}`
  }
  if (params.docsContext) {
    fullSystemPrompt += `\n${params.docsContext}`
  }

  // Inject conversational intelligence directives
  fullSystemPrompt += `\n\n═══════════════════════════════════════════════
CONVERSATION INTELLIGENCE DIRECTIVES FOR THIS TURN
═══════════════════════════════════════════════
• Turn count in conversation: ${conversationState.turnCount}
• Repetition rule: ${conversationState.hasGreeted ? "DO NOT GREET AGAIN (Already greeted in earlier turns)" : "First turn — a warm, brief greeting is permitted"}
• Self-introduction rule: ${conversationState.hasIntroduced ? "DO NOT RE-INTRODUCE YOURSELF" : "May briefly identify as EventSlot Assistant if helpful"}
• Detected User Intent: ${detectedIntent.intent} (${detectedIntent.primaryGoal})
• Known Event Context: ${JSON.stringify(conversationState.eventContext)}
• Response Style: ${complexity === "SHORT_QUERY" ? "Concise, direct answer (under 3 sentences, no fluff)" : "Well-structured response with clear headings, bullet points, and steps"}
• Tone: Natural, conversational, confident, helpful. Avoid sounding like a dry documentation page.
═══════════════════════════════════════════════`

  let reply = ""
  try {
    checkTimeBudget()
    const generated = await withTimeout(
      llmAdapter.generateReply({
        systemPrompt: fullSystemPrompt,
        conversationHistory: params.conversationHistory ?? [],
        userMessage: sanitizedMessage,
        images: params.images,
        verifiedToolResults,
      }),
      limits.maxExecutionTimeMs,
      "ORCHESTRATOR_TIMEOUT"
    )
    reply = typeof generated === "string" ? generated : ""
  } catch (error) {
    console.warn("[ESA Orchestrator] LLM generation fallback triggered:", error)
  }

  if (!(reply || "").trim() && verifiedToolResults.length > 0) {
    const lastSuccess = verifiedToolResults[verifiedToolResults.length - 1]
    if (lastSuccess.envelope.ok) {
      reply = formatReadCapabilityFallbackReply(
        lastSuccess.capability,
        lastSuccess.envelope.data
      )
    }
  }

  if (!reply.trim()) {
    reply =
      "I'm having trouble responding right now. Please try again in a moment or contact info@eventsslot.com."
  }

  if (usedLiveEventData && !reply.includes(FULL_REPORT_CTA)) {
    reply = `${reply.trim()}\n\n${FULL_REPORT_CTA}`
  }

  return {
    kind: "ANSWER",
    reply: truncateOutput(reply, limits.maxOutputChars),
    toolCallsExecuted,
    iterationsUsed: Math.max(1, iterationsUsed),
    usedLiveEventData,
    clarification: null,
    capabilityError: null,
    draftPreview: null,
  }
}
