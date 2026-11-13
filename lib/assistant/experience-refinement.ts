/**
 * EventSlot Assistant (ESA) — Experience Refinement & Conversation Intelligence
 * Grounded in Prompt 12 & Prompt 13:
 * - Scoped session context & reliable context reuse
 * - Explicit corrections & conflict detection
 * - Capability-aware and permission-scoped smart recommendations
 * - Safe intent detection with conversational follow-up awareness
 * - Non-repetitive milestone summaries & minimal follow-ups
 * - User-friendly error shielding with clear distinction for ambiguous outcomes
 * - Strict credential and PII sanitization
 */

import { sanitizeMemoryText } from "@/lib/assistant-memory"

export type AssistantIntentType =
  | "REGISTRATION"
  | "TICKETING"
  | "CHECK_IN"
  | "REPORTS"
  | "WAITLIST"
  | "EMAIL_BROADCAST"
  | "CREATE_EVENT"
  | "MARKETING"
  | "GENERAL_HELP"
  | "PROVIDE_EVENT_DETAILS"
  | "UNCERTAIN"

export type FieldProvenanceType = "EXPLICIT" | "INFERRED" | "CORRECTION"

export interface IntentAnalysis {
  intent: AssistantIntentType
  confidence: "HIGH" | "MEDIUM" | "LOW"
  primaryGoal: string
  suggestedNextStep: string
  contextualFeatures: string[]
  clarificationQuestion?: string
}

export interface EventContextMemory {
  userId?: string | null
  sessionId?: string | null
  eventName?: string | null
  location?: string | null
  date?: string | null
  organizer?: string | null
  attendeeLimit?: number | null
  eventType?: "PHYSICAL" | "VIRTUAL" | null
  isPaid?: boolean | null
  ticketPrice?: number | null
  accessType?: "REGISTRATION" | "WALK_IN" | null
  hasConflicts?: boolean
  conflictDetails?: string[]
  fieldProvenance?: Partial<Record<string, FieldProvenanceType>>
}

export interface ConversationState {
  userId?: string | null
  sessionId?: string | null
  hasGreeted: boolean
  hasIntroduced: boolean
  addressedIntents: AssistantIntentType[]
  turnCount: number
  eventContext: EventContextMemory
  completedMilestones: string[]
  recommendedFeatures: string[]
  lastSummaryTurn?: number
}

export type FeatureExecutionStatus =
  | "AVAILABLE_IN_DASHBOARD"
  | "READ_ONLY_IN_CHAT"
  | "REQUIRES_ORGANIZER_ROLE"
  | "PLANNED"

export interface SmartRecommendation {
  feature: string
  reason: string
  status: FeatureExecutionStatus
  availabilityNote: string
}

// ─── 1. Session Isolation Guard ───────────────────────────────────────────────

export function isContextScopedToSession(
  context: EventContextMemory,
  userId?: string | null,
  sessionId?: string | null
): boolean {
  if (context.userId && userId && context.userId !== userId) return false
  if (context.sessionId && sessionId && context.sessionId !== sessionId) return false
  return true
}

// ─── 2. Intent Detection with Follow-Up Context Awareness ─────────────────────

export function detectUserIntent(
  message: string,
  state?: ConversationState
): IntentAnalysis {
  const lower = message.toLowerCase().trim()

  // 0. Follow-up contextual response awareness:
  // If user provides a direct answer to a previously asked follow-up question (date, location, capacity)
  if (
    state &&
    state.turnCount >= 1 &&
    (
      /^\d{4}-\d{2}-\d{2}/.test(lower) ||
      /^(?:next\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|tomorrow|today)/.test(lower) ||
      /^\d+\s*(?:people|attendees|spots|seats|tickets)$/.test(lower) ||
      /^(?:virtual|online|in[- ]person|physical)$/.test(lower) ||
      /^(?:free|paid)$/.test(lower)
    )
  ) {
    return {
      intent: "PROVIDE_EVENT_DETAILS",
      confidence: "HIGH",
      primaryGoal: "Supplying requested event details for draft preparation",
      suggestedNextStep: "Capture the value into event context and suggest the next step.",
      contextualFeatures: [],
    }
  }

  // 1. Check-In & QR Codes
  if (
    /\b(?:qr\s*codes?|qr\s*tickets?|check[- ]in|scanner|scan\s+at\s+the\s+door|verify\s+attendees?|gate\s+entry|walk[- ]ins?)\b/i.test(
      lower
    )
  ) {
    return {
      intent: "CHECK_IN",
      confidence: "HIGH",
      primaryGoal: "Fast and secure attendee check-in and QR ticket verification",
      suggestedNextStep:
        "Open your event dashboard to view the QR Check-in scanner or download attendee check-in lists.",
      contextualFeatures: ["QR Check-in", "Ticket Downloads", "Walk-in Check-in"],
    }
  }

  // 2. Ticketing & Passes
  if (
    /\b(?:need\s+tickets?|ticket\s+pricing|paid\s+tickets?|ticket\s+tiers?|issue\s+passes?|ticket\s+sales?|pricing\s+tiers?|ticket\s+download)\b/i.test(
      lower
    )
  ) {
    return {
      intent: "TICKETING",
      confidence: "HIGH",
      primaryGoal: "Setting up event tickets, pricing, and attendee passes",
      suggestedNextStep:
        "Configure your ticket tiers (free or paid) in the event setup form under Registration & Tickets.",
      contextualFeatures: ["QR Check-in", "Ticket Downloads", "Waitlist"],
    }
  }

  // 3. Analytics & Reports
  if (
    /\b(?:need\s+analytics|analytics|registration\s+reports?|reports?|metrics|insights|fill\s*rate|registration\s+stats|export\s+data|how\s+is\s+my\s+event\s+doing)\b/i.test(
      lower
    )
  ) {
    return {
      intent: "REPORTS",
      confidence: "HIGH",
      primaryGoal: "Reviewing event attendance, signup velocity, and executive reports",
      suggestedNextStep:
        "Visit your Event Dashboard to inspect live registration velocity or open the Export centre for Word/CSV summaries.",
      contextualFeatures: ["Analytics Dashboard", "Event Insights", "Export Centre"],
    }
  }

  // 4. Registration
  if (
    /\b(?:want\s+people\s+to\s+register|registration|sign[- ]?ups?|collect\s+details|attendee\s+questions?|custom\s+form|registration\s+link|how\s+can\s+people\s+sign\s+up)\b/i.test(
      lower
    )
  ) {
    return {
      intent: "REGISTRATION",
      confidence: "HIGH",
      primaryGoal: "Creating and sharing an event registration flow for attendees",
      suggestedNextStep:
        "Set your custom registration questions and share your event registration link with your community.",
      contextualFeatures: [
        "AI Registration Question Generator",
        "Waitlists",
        "Marketing Hub",
      ],
    }
  }

  // 5. Waitlist
  if (
    /\b(?:waitlists?|event\s+is\s+full|at\s+capacity|sold\s+out|queue\s+attendees?|overflow\s+signups?)\b/i.test(
      lower
    )
  ) {
    return {
      intent: "WAITLIST",
      confidence: "HIGH",
      primaryGoal: "Managing waitlist queues and automatic FIFO attendee promotions",
      suggestedNextStep:
        "Enable the automated waitlist in your event settings so additional guests can queue when spots fill up.",
      contextualFeatures: ["Waitlists", "Email Broadcasts", "Event Analytics"],
    }
  }

  // 6. Email Broadcasts & Attendee Communication
  if (
    /\b(?:send\s+emails?|email\s+broadcasts?|notify\s+attendees?|email\s+reminders?|blast\s+updates?|message\s+guests?)\b/i.test(
      lower
    )
  ) {
    return {
      intent: "EMAIL_BROADCAST",
      confidence: "HIGH",
      primaryGoal: "Sending targeted email updates and reminders to registered attendees",
      suggestedNextStep:
        "Go to your event dashboard and use the Emails tab to draft and send communications to confirmed or waitlisted guests.",
      contextualFeatures: ["Email Broadcasts", "Waitlists", "Event Insights"],
    }
  }

  // 7. Event Creation & Planning
  if (
    /\b(?:create\s+(?:an?\s+)?event|prepare\s+(?:an?\s+)?event|host\s+(?:an?\s+)?event|start\s+(?:an?\s+)?event|launch\s+(?:an?\s+)?event|organizing\s+(?:a|an)\s+)\b/i.test(
      lower
    )
  ) {
    return {
      intent: "CREATE_EVENT",
      confidence: "HIGH",
      primaryGoal: "Drafting, setting up, and launching an event on EventSlot",
      suggestedNextStep:
        "Review your event draft preview and fill in any missing details before publishing.",
      contextualFeatures: [
        "Waitlists",
        "QR Check-in",
        "AI Registration Question Generator",
        "Marketing Hub",
      ],
    }
  }

  // 8. Marketing & Promotion
  if (
    /\b(?:promote|share\s+(?:my\s+)?event|marketing\s+hub|get\s+more\s+attendees?|social\s+share)\b/i.test(
      lower
    )
  ) {
    return {
      intent: "MARKETING",
      confidence: "HIGH",
      primaryGoal: "Promoting your event and expanding attendee reach",
      suggestedNextStep:
        "Use your custom event link and the Marketing Hub to monitor referral channels and follower notifications.",
      contextualFeatures: ["Marketing Hub", "Email Broadcasts", "Organiser Profile Following"],
    }
  }

  // 9. General Help
  if (
    /\b(?:how\s+does\s+eventslot\s+work|what\s+is\s+eventslot|pricing|plans|help)\b/i.test(
      lower
    )
  ) {
    return {
      intent: "GENERAL_HELP",
      confidence: "MEDIUM",
      primaryGoal: "Understanding EventSlot capabilities and workflows",
      suggestedNextStep:
        "Let me know what you'd like to achieve with your event, and I will guide you through the fastest path.",
      contextualFeatures: ["Analytics Dashboard", "Waitlists", "QR Check-in"],
    }
  }

  // 10. Uncertain Intent
  return {
    intent: "UNCERTAIN",
    confidence: "LOW",
    primaryGoal: "Clarify user intent",
    suggestedNextStep: "Ask a polite clarification question",
    contextualFeatures: [],
    clarificationQuestion:
      "I don't have enough information yet. Could you clarify what you'd like to do with your event (for example, setting up registrations, managing tickets, or checking analytics)?",
  }
}

// ─── 3. Event Context Memory & Detail Extraction ──────────────────────────────

export function extractEventContextFields(
  message: string,
  existing: EventContextMemory = {},
  options?: { userId?: string | null; sessionId?: string | null }
): EventContextMemory {
  // Session isolation guard: do not blend context if user or session mismatches
  if (options && !isContextScopedToSession(existing, options.userId, options.sessionId)) {
    existing = {}
  }

  // User explicitly asks to clear event or start a fresh event
  if (
    /\b(?:start\s+(?:a\s+)?new\s+event|different\s+event|forget\s+(?:that|previous)\s+event|clear\s+event)\b/i.test(
      message
    )
  ) {
    return {
      userId: options?.userId ?? null,
      sessionId: options?.sessionId ?? null,
      fieldProvenance: {},
    }
  }

  const isStartingFresh = /\b(?:start\s+(?:a\s+)?new\s+event|different\s+event|another\s+event|start\s+fresh|start\s+over|create\s+(?:another|a\s+new)\s+event|draft\s+(?:another|a\s+new)\s+event)\b/i.test(message)
  const result: EventContextMemory = isStartingFresh
    ? {
        userId: options?.userId ?? existing.userId ?? null,
        sessionId: options?.sessionId ?? existing.sessionId ?? null,
        fieldProvenance: {},
      }
    : {
        ...existing,
        userId: options?.userId ?? existing.userId ?? null,
        sessionId: options?.sessionId ?? existing.sessionId ?? null,
        fieldProvenance: { ...(existing.fieldProvenance ?? {}) },
      }

  const isCorrection = /\b(?:actually|change|update|instead|correction|wrong|make\s+it|set\s+it\s+to)\b/i.test(message)
  const defaultProvenance: FieldProvenanceType = isCorrection ? "CORRECTION" : "EXPLICIT"

  // 1. Event Name / Title
  const titleCorrection =
    message.match(/(?:change|update|set)\s+(?:the\s+)?(?:event\s+)?(?:title|name)\s+(?:to|as)\s+["']?([^"',.\n]+?)["']?(?=\s+(?:and|with|on|for|\d)|$)/i)
  if (titleCorrection && titleCorrection[1]) {
    result.eventName = sanitizeMemoryText(titleCorrection[1].trim())
    result.fieldProvenance!["eventName"] = "CORRECTION"
  } else {
    const titleMatch =
      message.match(/(?:called|named|titled)\s+["']([^"'\n]+)["']/i) ??
      message.match(/(?:called|named|titled)\s+([^"',.\n]+?)(?=\s+(?:for|at|on|with|in|taking|hosted)|$)/i) ??
      message.match(/(?:title|event name)\s*[:=]\s*["']?([^"',.\n]+)["']?/i)
    if (titleMatch && titleMatch[1]) {
      result.eventName = sanitizeMemoryText(titleMatch[1].trim())
      result.fieldProvenance!["eventName"] = defaultProvenance
    }
  }

  // 2. Capacity / Attendee Limit
  const capacityCorrection =
    message.match(/(?:change|update|set)\s+(?:the\s+)?capacity\s+(?:to|is)\s+(\d+)/i) ??
    message.match(/(?:actually|make\s+it)\s+(\d+)\s*(?:people|attendees|spots|seats)/i)
  if (capacityCorrection && capacityCorrection[1]) {
    const val = parseInt(capacityCorrection[1], 10)
    if (!isNaN(val) && val > 0) {
      result.attendeeLimit = val
      result.fieldProvenance!["attendeeLimit"] = "CORRECTION"
    }
  } else {
    const capacityMatch =
      message.match(/(?:capacity|attendees?|limit|spots?|seats?)\s*(?:of|is|[:=])?\s*(\d+)/i) ??
      message.match(/(\d+)\s*(?:people|attendees|guests|seats|spots)/i)
    if (capacityMatch && capacityMatch[1]) {
      const val = parseInt(capacityMatch[1], 10)
      if (!isNaN(val) && val > 0) {
        result.attendeeLimit = val
        result.fieldProvenance!["attendeeLimit"] = defaultProvenance
      }
    }
  }

  // 3. Location / Venue
  const locationCorrection =
    message.match(/(?:change|update|set)\s+(?:the\s+)?(?:venue|location)\s+(?:to|is)\s+["']?([^"',.\n]+?)["']?(?=\s+(?:and|with|on|for|\d)|$)/i) ??
    message.match(/(?:actually\s+at)\s+["']?([^"',.\n]+?)["']?(?=\s+(?:and|with|on|for|\d)|$)/i)
  if (locationCorrection && locationCorrection[1]) {
    const loc = sanitizeMemoryText(locationCorrection[1].trim())
    result.location = loc
    result.fieldProvenance!["location"] = "CORRECTION"
  } else {
    const locationMatch =
      message.match(/(?:hosted at|taking place at)\s+["']?([^"',.\n]+?)["']?(?=\s+(?:on|for|with)|$)/i) ??
      message.match(/(?:venue|location)\s*[:=]\s*["']?([^"',.\n]+?)["']?(?=\s+(?:on|for|with)|$)/i) ??
      message.match(/\bat\s+["']?([^"',.\n]+?)["']?(?=\s+(?:on|for|with|\d{4})|$)/i)
    if (locationMatch && locationMatch[1]) {
      const loc = sanitizeMemoryText(locationMatch[1].trim())
      if (!/^(?:free|paid|virtual|physical|registration|walk-in)$/i.test(loc)) {
        result.location = loc
        result.fieldProvenance!["location"] = defaultProvenance
      }
    }
  }

  // 4. Virtual vs Physical
  if (/\b(?:change\s+to\s+virtual|make\s+it\s+virtual|switch\s+to\s+virtual)\b/i.test(message)) {
    result.eventType = "VIRTUAL"
    result.fieldProvenance!["eventType"] = "CORRECTION"
  } else if (/\b(?:change\s+to\s+physical|make\s+it\s+in[- ]person|switch\s+to\s+physical)\b/i.test(message)) {
    result.eventType = "PHYSICAL"
    result.fieldProvenance!["eventType"] = "CORRECTION"
  } else if (/\b(?:virtual|online|zoom|google\s*meet|webinar)\b/i.test(message)) {
    result.eventType = "VIRTUAL"
    result.fieldProvenance!["eventType"] = defaultProvenance
  } else if (/\b(?:physical|in[- ]person|venue|on[- ]site)\b/i.test(message)) {
    result.eventType = "PHYSICAL"
    result.fieldProvenance!["eventType"] = defaultProvenance
  }

  // 5. Date & Time
  const dateCorrection =
    message.match(/(?:change|update|set|move)\s+(?:the\s+)?date\s+(?:to|is)\s+(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)/i) ??
    message.match(/(?:actually\s+on)\s+(\d{4}-\d{2}-\d{2})/i)
  if (dateCorrection && dateCorrection[1]) {
    result.date = dateCorrection[1].trim()
    result.fieldProvenance!["date"] = "CORRECTION"
  } else {
    const dateMatch =
      message.match(/\b(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)\b/) ??
      message.match(/(?:date|on|when)\s*[:=]?\s*(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)/i) ??
      message.match(/\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+\d{4})?)/i)
    if (dateMatch && dateMatch[1]) {
      result.date = dateMatch[1].trim()
      result.fieldProvenance!["date"] = defaultProvenance
    }
  }

  // 6. Paid vs Free
  if (/\b(?:make\s+it\s+free|change\s+to\s+free|it\s+is\s+free)\b/i.test(message)) {
    result.isPaid = false
    result.ticketPrice = 0
    result.fieldProvenance!["isPaid"] = "CORRECTION"
  } else if (/\b(?:free\s+event|free\s+entry|free\s+admission)\b/i.test(message)) {
    result.isPaid = false
    result.ticketPrice = 0
    result.fieldProvenance!["isPaid"] = defaultProvenance
  } else {
    const priceCorrection =
      message.match(/(?:change|update|set)\s+(?:ticket\s*)?price\s+(?:to|is)\s*(?:kes|ksh|usd)?\s*(\d+)/i)
    if (priceCorrection && priceCorrection[1]) {
      const price = parseInt(priceCorrection[1], 10)
      if (!isNaN(price) && price > 0) {
        result.isPaid = true
        result.ticketPrice = price
        result.fieldProvenance!["isPaid"] = "CORRECTION"
      }
    } else {
      const priceMatch =
        message.match(/(?:ticket\s*price|fee|kes|ksh|usd)\s*[:=]?\s*(\d+)/i) ??
        message.match(/(?:paid\s+event.*?(\d+))/i)
      if (priceMatch && priceMatch[1]) {
        const price = parseInt(priceMatch[1], 10)
        if (!isNaN(price) && price > 0) {
          result.isPaid = true
          result.ticketPrice = price
          result.fieldProvenance!["isPaid"] = defaultProvenance
        }
      }
    }
  }

  // 7. Conflict Detection: Virtual format with physical location
  const conflicts: string[] = []
  if (
    result.eventType === "VIRTUAL" &&
    result.location &&
    !result.location.toLowerCase().includes("zoom") &&
    !result.location.toLowerCase().includes("link") &&
    !result.location.toLowerCase().includes("meet")
  ) {
    conflicts.push(`Event format is Virtual, but a physical location ("${result.location}") was provided.`)
  }

  if (conflicts.length > 0) {
    result.hasConflicts = true
    result.conflictDetails = conflicts
  } else {
    result.hasConflicts = false
    result.conflictDetails = []
  }

  return result
}

// ─── 4. Conversation State Tracker ────────────────────────────────────────────

export function analyzeConversationState(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  options?: { userId?: string | null; sessionId?: string | null }
): ConversationState {
  let hasGreeted = false
  let hasIntroduced = false
  const addressedIntents: AssistantIntentType[] = []
  const completedMilestones: string[] = []
  const recommendedFeatures: string[] = []
  let lastSummaryTurn: number | undefined = undefined
  let context: EventContextMemory = {}

  let turnCounter = 0
  for (const turn of history) {
    const text = turn.content.toLowerCase()

    if (turn.role === "assistant") {
      turnCounter += 1
      if (
        /\b(?:hello|hi\b|hey\b|welcome to eventslot|good\s+(?:morning|afternoon|evening))\b/i.test(
          text
        )
      ) {
        hasGreeted = true
      }
      if (
        /\b(?:i am the eventslot assistant|eventslot assistant \(esa\)|i'm your operational copilot)\b/i.test(
          text
        )
      ) {
        hasIntroduced = true
      }
      if (text.includes("so far we've:")) {
        lastSummaryTurn = turnCounter
      }
      if (text.includes("draft preview") || text.includes("created your event")) {
        if (!completedMilestones.includes("Event draft prepared")) {
          completedMilestones.push("Event draft prepared")
        }
      }
      if (text.includes("registration question") || text.includes("questions added")) {
        if (!completedMilestones.includes("Registration questions configured")) {
          completedMilestones.push("Registration questions configured")
        }
      }
      if (text.includes("qr check-in") || text.includes("tickets enabled")) {
        if (!completedMilestones.includes("QR tickets enabled")) {
          completedMilestones.push("QR tickets enabled")
        }
      }

      // Track features that have already been recommended in this session
      const featureNames = [
        "Waitlist",
        "QR Check-in",
        "Email Reminders",
        "Event Analytics",
        "Ticket Downloads",
        "Walk-in Check-in",
        "AI Registration Question Generator",
        "Marketing Hub",
        "Event Insights",
      ]
      for (const name of featureNames) {
        if (turn.content.includes(name) && !recommendedFeatures.includes(name)) {
          recommendedFeatures.push(name)
        }
      }
    }

    if (turn.role === "user") {
      const intentAnalysis = detectUserIntent(turn.content)
      if (
        intentAnalysis.intent !== "UNCERTAIN" &&
        !addressedIntents.includes(intentAnalysis.intent)
      ) {
        addressedIntents.push(intentAnalysis.intent)
      }

      // Extract context from user messages
      context = extractEventContextFields(turn.content, context, options)
    }
  }

  return {
    userId: options?.userId ?? null,
    sessionId: options?.sessionId ?? null,
    hasGreeted,
    hasIntroduced,
    addressedIntents,
    turnCount: Math.ceil(history.length / 2),
    eventContext: context,
    completedMilestones,
    recommendedFeatures,
    lastSummaryTurn,
  }
}

// ─── 5. Minimal Follow-Up Question Selection ──────────────────────────────────

export function selectMinimalFollowUpQuestion(
  context: EventContextMemory
): string | null {
  // If there is an unresolved conflict, clarify that first
  if (context.hasConflicts && context.conflictDetails && context.conflictDetails.length > 0) {
    return `Could you clarify: ${context.conflictDetails[0]} Should the event be in-person or virtual?`
  }

  // Always ask ONLY the single most vital missing detail, never multiple at once.
  if (!context.eventName) {
    return "What type of event are you organizing, or what would you like to call it?"
  }

  if (!context.eventType) {
    return "Will this be an in-person or virtual event?"
  }

  if (context.eventType === "PHYSICAL" && !context.location) {
    return "Where will the event be hosted?"
  }

  if (!context.date) {
    return "What date and time are you planning for the event?"
  }

  if (!context.attendeeLimit) {
    return "What is your target attendee capacity?"
  }

  if (context.isPaid === undefined || context.isPaid === null) {
    return "Will this be a free event or a paid ticketed event?"
  }

  return null
}

// ─── 6. Milestone & Progress Summaries ─────────────────────────────────────────

export function generateMilestoneSummary(
  state: ConversationState,
  currentTurn?: number
): string | null {
  // Prevent duplicate summaries on consecutive turns
  const activeTurn = currentTurn ?? state.turnCount
  if (state.lastSummaryTurn && activeTurn - state.lastSummaryTurn < 3) {
    return null
  }

  const items: string[] = []

  if (state.eventContext.eventName) {
    items.push(`✓ Event name: "${state.eventContext.eventName}"`)
  }
  if (state.eventContext.eventType) {
    items.push(`✓ Format: ${state.eventContext.eventType === "VIRTUAL" ? "Virtual" : "In-Person"}`)
  }
  if (state.eventContext.location) {
    items.push(`✓ Location: ${state.eventContext.location}`)
  }
  if (state.eventContext.attendeeLimit) {
    items.push(`✓ Capacity: ${state.eventContext.attendeeLimit} attendees`)
  }
  if (state.eventContext.isPaid !== undefined && state.eventContext.isPaid !== null) {
    items.push(
      state.eventContext.isPaid
        ? `✓ Entry: Paid (KSh ${state.eventContext.ticketPrice ?? "TBD"})`
        : "✓ Entry: Free admission"
    )
  }

  if (items.length < 2) {
    return null
  }

  const nextStep =
    selectMinimalFollowUpQuestion(state.eventContext) ??
    "Next we can review your registration questions or proceed with publishing."

  return ["So far we've:", ...items, "", `Next: ${nextStep}`].join("\n")
}

// ─── 7. Capability-Aware Smart Recommendations ────────────────────────────────

export function getSmartFeatureRecommendations(params: {
  context: EventContextMemory
  intent?: AssistantIntentType
  actor?: { role?: string; isAdmin?: boolean }
  eventScope?: { visibility?: "PUBLIC" | "PRIVATE" }
  alreadyRecommended?: string[]
}): SmartRecommendation[] {
  const recommendations: SmartRecommendation[] = []
  const prior = params.alreadyRecommended ?? []
  const isOrganizer = params.actor ? (params.actor.role !== "attendee" || Boolean(params.actor.isAdmin)) : true
  const isPublic = params.eventScope ? params.eventScope.visibility !== "PRIVATE" : true

  // 1. Paid event recommendations (only for organizers)
  if ((params.context.isPaid || params.intent === "TICKETING") && isOrganizer) {
    if (!prior.includes("Waitlist")) {
      recommendations.push({
        feature: "Waitlist",
        reason: "Automatically backfills cancellations so you never leave ticket revenue on the table.",
        status: "AVAILABLE_IN_DASHBOARD",
        availabilityNote: "Configurable in your Event Dashboard registration settings.",
      })
    }
    if (!prior.includes("QR Check-in")) {
      recommendations.push({
        feature: "QR Check-in",
        reason: "Fast door verification with mobile camera scanning.",
        status: "AVAILABLE_IN_DASHBOARD",
        availabilityNote: "Available in your Event Dashboard Check-in tab.",
      })
    }
    if (!prior.includes("Email Reminders")) {
      recommendations.push({
        feature: "Email Reminders",
        reason: "Keeps attendees engaged and reduces no-show rates before event day.",
        status: "AVAILABLE_IN_DASHBOARD",
        availabilityNote: "Available via Event Dashboard Emails tab.",
      })
    }
    if (!prior.includes("Event Analytics")) {
      recommendations.push({
        feature: "Event Analytics",
        reason: "Track registration velocity and peak signup periods in real time.",
        status: "AVAILABLE_IN_DASHBOARD",
        availabilityNote: "Live insights available in your Event Dashboard.",
      })
    }
    return recommendations
  }

  // 2. Large physical event recommendations
  if (
    (params.context.eventType === "PHYSICAL" || (params.context.attendeeLimit && params.context.attendeeLimit >= 100)) &&
    isOrganizer
  ) {
    if (!prior.includes("QR Check-in")) {
      recommendations.push({
        feature: "QR Check-in",
        reason: "Eliminates paper lists with instantaneous ticket barcode scanning.",
        status: "AVAILABLE_IN_DASHBOARD",
        availabilityNote: "Available in your Event Dashboard Check-in tab.",
      })
    }
    if (!prior.includes("Walk-in Check-in")) {
      recommendations.push({
        feature: "Walk-in Check-in",
        reason: "Easily accommodate and register surprise guests at the door.",
        status: "AVAILABLE_IN_DASHBOARD",
        availabilityNote: "Available on the check-in verification screen.",
      })
    }
    if (!prior.includes("Waitlist")) {
      recommendations.push({
        feature: "Waitlist",
        reason: "Queues extra attendees once maximum venue capacity is reached.",
        status: "AVAILABLE_IN_DASHBOARD",
        availabilityNote: "Configurable in your Event Dashboard.",
      })
    }
    if (!prior.includes("Ticket Downloads")) {
      recommendations.push({
        feature: "Ticket Downloads",
        reason: "Guests receive instant PDF passes with unique QR codes.",
        status: "AVAILABLE_IN_DASHBOARD",
        availabilityNote: "Included automatically for registered attendees.",
      })
    }
    return recommendations
  }

  // 3. Community / Free event recommendations
  if (isOrganizer) {
    if (!prior.includes("Waitlist")) {
      recommendations.push({
        feature: "Waitlist",
        reason: "Ensures you maintain a full room even if some free registrants cancel.",
        status: "AVAILABLE_IN_DASHBOARD",
        availabilityNote: "Configurable in your Event Dashboard.",
      })
    }
    if (!prior.includes("AI Registration Question Generator")) {
      recommendations.push({
        feature: "AI Registration Question Generator",
        reason: "Customizes intake questions based on your specific audience.",
        status: "AVAILABLE_IN_DASHBOARD",
        availabilityNote: "Accessible in the Create / Edit event form under Questions.",
      })
    }
    if (isPublic && !prior.includes("Marketing Hub")) {
      recommendations.push({
        feature: "Marketing Hub",
        reason: "Track where your signups are coming from across social platforms.",
        status: "AVAILABLE_IN_DASHBOARD",
        availabilityNote: "Available in your Event Dashboard.",
      })
    }
    if (!prior.includes("Event Insights")) {
      recommendations.push({
        feature: "Event Insights",
        reason: "Actionable tips on the best days and hours to share your event link.",
        status: "AVAILABLE_IN_DASHBOARD",
        availabilityNote: "Available in your Event Dashboard Export centre.",
      })
    }
  } else {
    // Attendee-scoped recommendations (viewing tickets / registration)
    if (!prior.includes("Ticket Downloads")) {
      recommendations.push({
        feature: "Ticket Downloads",
        reason: "Download your official EventSlot PDF ticket with QR code.",
        status: "AVAILABLE_IN_DASHBOARD",
        availabilityNote: "Check your registration status anytime on the event page.",
      })
    }
  }

  return recommendations
}

export function formatSmartRecommendations(
  recommendations: SmartRecommendation[]
): string {
  if (recommendations.length === 0) return ""

  const bullets = recommendations
    .slice(0, 4)
    .map((r) => `• **${r.feature}** — ${r.reason} *(Available in EventSlot Dashboard)*`)
    .join("\n")

  return `I'd also recommend considering these features for your event:\n${bullets}`
}

// ─── 8. Confidence & Truthful Fallback ─────────────────────────────────────────

export function formatLowConfidenceClarification(
  missingAspect: string
): string {
  return `I don't have enough information yet to give you the exact details. Could you clarify ${missingAspect}?`
}

// ─── 9. User-Friendly Error Shielding ─────────────────────────────────────────

export function formatUserFriendlyError(
  internalCode?: string,
  rawError?: string
): string {
  const code = (internalCode ?? "").toUpperCase()

  if (code === "AMBIGUOUS_OUTCOME" || code === "AMBIGUOUS_SIDE_EFFECT") {
    return "The event was created successfully, but delivery of follower announcements could not be confirmed with the external email provider. Automatic retries are paused to prevent sending duplicate emails. You can check the announcement status in your dashboard."
  }

  if (code === "CONFIRMATION_REQUIRED") {
    return "That action requires explicit confirmation before it can be executed on EventSlot."
  }

  if (code === "FORBIDDEN" || code === "UNAUTHORIZED") {
    return "You don't have permission to access that event in this workspace. Please check your workspace switcher or ask the event owner for access."
  }

  if (code === "NOT_FOUND" || code === "EVENT_NOT_FOUND") {
    return "I couldn't find an event matching those details in your authorised workspace. Please check the event name or choose an event from your dashboard."
  }

  if (code === "AMBIGUOUS_CONTEXT" || code === "MISSING_CONTEXT") {
    return "I found multiple matching events. Could you specify which event you'd like to look at?"
  }

  if (code === "RATE_LIMIT_EXCEEDED" || code === "TOO_MANY_REQUESTS") {
    return "You've sent several requests in a short time. Please wait a moment before trying again."
  }

  return "I couldn't complete that action right now. Let's try again in a moment, or reach out to info@eventsslot.com if you need direct support."
}

// ─── 10. Adaptive Formatting & Response Length Controller ─────────────────────

export type QueryComplexity = "SHORT_QUERY" | "STANDARD_QUERY" | "COMPLEX_PLANNING"

export function evaluateQueryComplexity(
  message: string,
  intent: AssistantIntentType
): QueryComplexity {
  const words = message.trim().split(/\s+/).length

  if (
    words <= 6 &&
    (intent === "CHECK_IN" ||
      intent === "TICKETING" ||
      intent === "REPORTS" ||
      intent === "WAITLIST" ||
      message.endsWith("?"))
  ) {
    return "SHORT_QUERY"
  }

  if (
    words > 25 ||
    intent === "CREATE_EVENT" ||
    /\b(?:plan|organize|set up|guide me through|step by step|how to run)\b/i.test(message)
  ) {
    return "COMPLEX_PLANNING"
  }

  return "STANDARD_QUERY"
}

export function formatHumanResponse(params: {
  coreAnswer: string
  intent: IntentAnalysis
  state: ConversationState
  complexity: QueryComplexity
  includeSummary?: boolean
  includeRecommendations?: boolean
  actor?: { role?: string; isAdmin?: boolean }
  eventScope?: { visibility?: "PUBLIC" | "PRIVATE" }
}): string {
  const sections: string[] = []

  // Repetition prevention: Do NOT repeat greeting if already greeted
  let prefix = ""
  if (!params.state.hasGreeted && params.state.turnCount <= 1) {
    prefix = "Hi! "
  }

  // Short queries get direct, confident, concise answers without fluff
  if (params.complexity === "SHORT_QUERY") {
    return `${prefix}${params.coreAnswer.trim()}`
  }

  sections.push(`${prefix}${params.coreAnswer.trim()}`)

  // Milestone summary if requested or appropriate for long conversations (turns >= 4)
  if (params.includeSummary || params.state.turnCount >= 4) {
    const summary = generateMilestoneSummary(params.state)
    if (summary) {
      sections.push(summary)
    }
  }

  // Contextual capability-aware recommendations (filtered for already recommended items)
  if (params.includeRecommendations) {
    const recs = getSmartFeatureRecommendations({
      context: params.state.eventContext,
      intent: params.intent.intent,
      actor: params.actor,
      eventScope: params.eventScope,
      alreadyRecommended: params.state.recommendedFeatures,
    })
    const formattedRecs = formatSmartRecommendations(recs)
    if (formattedRecs) {
      sections.push(formattedRecs)
    }
  }

  return sections.filter(Boolean).join("\n\n")
}
