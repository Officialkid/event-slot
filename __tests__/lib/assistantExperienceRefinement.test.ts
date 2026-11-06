/** @jest-environment node */

import {
  detectUserIntent,
  analyzeConversationState,
  extractEventContextFields,
  selectMinimalFollowUpQuestion,
  generateMilestoneSummary,
  getSmartFeatureRecommendations,
  formatSmartRecommendations,
  formatLowConfidenceClarification,
  formatUserFriendlyError,
  evaluateQueryComplexity,
  formatHumanResponse,
  isContextScopedToSession,
  type EventContextMemory,
  type ConversationState,
} from "@/lib/assistant/experience-refinement"
import { formatDraftPreviewReply } from "@/lib/assistant/orchestrator"
import type { EventDraftPreview } from "@/lib/assistant/draft-preparation"

describe("EventSlot Assistant (ESA) — Experience Refinement & Conversation Intelligence", () => {
  // ─── 1. Intent Detection ────────────────────────────────────────────────────
  describe("Part 3 & Prompt 13 — Safe & Capability-Grounded User Intent Understanding", () => {
    it("maps registration requests to REGISTRATION intent rather than exact wording", () => {
      const result1 = detectUserIntent("I want people to register")
      expect(result1.intent).toBe("REGISTRATION")
      expect(result1.confidence).toBe("HIGH")
      expect(result1.contextualFeatures).toContain("AI Registration Question Generator")

      const result2 = detectUserIntent("Can I create a custom signup form with questions?")
      expect(result2.intent).toBe("REGISTRATION")
    })

    it("maps ticket requests to TICKETING intent", () => {
      const result = detectUserIntent("I need tickets and pricing tiers for my attendees")
      expect(result.intent).toBe("TICKETING")
      expect(result.confidence).toBe("HIGH")
      expect(result.contextualFeatures).toContain("QR Check-in")
    })

    it("maps QR codes requests to CHECK_IN intent", () => {
      const result = detectUserIntent("I want QR codes for door entry and verification")
      expect(result.intent).toBe("CHECK_IN")
      expect(result.confidence).toBe("HIGH")
      expect(result.contextualFeatures).toContain("Walk-in Check-in")
    })

    it("maps analytics requests to REPORTS intent", () => {
      const result = detectUserIntent("I need analytics and registration reports")
      expect(result.intent).toBe("REPORTS")
      expect(result.confidence).toBe("HIGH")
      expect(result.contextualFeatures).toContain("Analytics Dashboard")
    })

    it("maps waitlist requests to WAITLIST intent", () => {
      const result = detectUserIntent("My event is at capacity, how does the waitlist work?")
      expect(result.intent).toBe("WAITLIST")
      expect(result.confidence).toBe("HIGH")
    })

    it("interprets follow-up messages supplying date/capacity in conversation context as PROVIDE_EVENT_DETAILS", () => {
      const conversationState: ConversationState = {
        userId: "user-1",
        sessionId: "sess-1",
        hasGreeted: true,
        hasIntroduced: true,
        addressedIntents: ["CREATE_EVENT"],
        turnCount: 2,
        eventContext: { eventName: "Fintech Mixer" },
        completedMilestones: [],
        recommendedFeatures: [],
      }

      const dateResult = detectUserIntent("2026-11-20", conversationState)
      expect(dateResult.intent).toBe("PROVIDE_EVENT_DETAILS")
      expect(dateResult.confidence).toBe("HIGH")

      const capacityResult = detectUserIntent("150 people", conversationState)
      expect(capacityResult.intent).toBe("PROVIDE_EVENT_DETAILS")

      const formatResult = detectUserIntent("virtual", conversationState)
      expect(formatResult.intent).toBe("PROVIDE_EVENT_DETAILS")
    })

    it("identifies UNCERTAIN intent and returns a clarifying question when intent is ambiguous", () => {
      const result = detectUserIntent("hmm maybe something tomorrow")
      expect(result.intent).toBe("UNCERTAIN")
      expect(result.confidence).toBe("LOW")
      expect(result.clarificationQuestion).toContain("I don't have enough information yet")
    })
  })

  // ─── 2. Conversation Memory & Repetition Elimination ────────────────────────
  describe("Part 2 — Repetition Removal & Session Memory", () => {
    it("detects when greeting or introduction has already occurred in the session", () => {
      const history1: Array<{ role: "user" | "assistant"; content: string }> = [
        { role: "user", content: "Hello there" },
        {
          role: "assistant",
          content:
            "Hi! I am the EventSlot Assistant (ESA). How can I help you manage your events today?",
        },
      ]

      const state1 = analyzeConversationState(history1, { userId: "user-1", sessionId: "sess-1" })
      expect(state1.hasGreeted).toBe(true)
      expect(state1.hasIntroduced).toBe(true)
      expect(state1.turnCount).toBe(1)

      // In turn 2, formatHumanResponse will suppress repeat greetings
      const formatted = formatHumanResponse({
        coreAnswer: "You can find your tickets under the Event Dashboard Tickets tab.",
        intent: detectUserIntent("Where are my tickets?"),
        state: state1,
        complexity: "STANDARD_QUERY",
      })

      expect(formatted).not.toMatch(/^Hi!/i)
      expect(formatted).not.toContain("I am the EventSlot Assistant")
      expect(formatted).toContain("Tickets tab")
    })

    it("allows a friendly greeting on the very first turn when no greeting has been given", () => {
      const emptyState: ConversationState = {
        userId: "user-1",
        sessionId: "sess-1",
        hasGreeted: false,
        hasIntroduced: false,
        addressedIntents: [],
        turnCount: 0,
        eventContext: {},
        completedMilestones: [],
        recommendedFeatures: [],
      }

      const formatted = formatHumanResponse({
        coreAnswer: "Welcome to EventSlot. Let's get your event started.",
        intent: detectUserIntent("I want to set up an event"),
        state: emptyState,
        complexity: "STANDARD_QUERY",
      })

      expect(formatted).toMatch(/^Hi!/i)
    })
  })

  // ─── 3. Context Reliability, Corrections, Session Isolation & Redaction ─────
  describe("Prompt 13 — Context Reliability, Explicit Corrections & Session Isolation", () => {
    it("extracts and remembers event name, location, date, capacity, and format across turns", () => {
      const context1 = extractEventContextFields(
        "I am planning a physical event called 'Nairobi Tech Summit' for 250 people at Sarit Centre on 2026-11-20",
        {},
        { userId: "user-1", sessionId: "sess-1" }
      )

      expect(context1.eventName).toBe("Nairobi Tech Summit")
      expect(context1.eventType).toBe("PHYSICAL")
      expect(context1.location).toBe("Sarit Centre")
      expect(context1.attendeeLimit).toBe(250)
      expect(context1.date).toBe("2026-11-20")
      expect(context1.fieldProvenance?.["eventName"]).toBe("EXPLICIT")

      // Subsequent update adds ticket price without overwriting prior details
      const context2 = extractEventContextFields(
        "Ticket price is KSh 1500",
        context1,
        { userId: "user-1", sessionId: "sess-1" }
      )
      expect(context2.eventName).toBe("Nairobi Tech Summit")
      expect(context2.location).toBe("Sarit Centre")
      expect(context2.isPaid).toBe(true)
      expect(context2.ticketPrice).toBe(1500)
    })

    it("recognizes explicit corrections and overwrites stale values with CORRECTION provenance", () => {
      const initial = extractEventContextFields(
        "Create an event called 'Tech Breakfast' at Sarit Centre for 100 people on 2026-11-10",
        {},
        { userId: "user-1", sessionId: "sess-1" }
      )
      expect(initial.eventName).toBe("Tech Breakfast")
      expect(initial.location).toBe("Sarit Centre")
      expect(initial.attendeeLimit).toBe(100)
      expect(initial.date).toBe("2026-11-10")

      // Correction turn 1: update venue and capacity
      const corrected1 = extractEventContextFields(
        "Actually, change venue to KICC and update capacity to 300",
        initial,
        { userId: "user-1", sessionId: "sess-1" }
      )
      expect(corrected1.location).toBe("KICC")
      expect(corrected1.fieldProvenance?.["location"]).toBe("CORRECTION")
      expect(corrected1.attendeeLimit).toBe(300)
      expect(corrected1.fieldProvenance?.["attendeeLimit"]).toBe("CORRECTION")
      // Preserves title and date from earlier
      expect(corrected1.eventName).toBe("Tech Breakfast")
      expect(corrected1.date).toBe("2026-11-10")

      // Correction turn 2: change event title and switch to virtual
      const corrected2 = extractEventContextFields(
        "Change title to 'Global Tech Summit' and switch to virtual",
        corrected1,
        { userId: "user-1", sessionId: "sess-1" }
      )
      expect(corrected2.eventName).toBe("Global Tech Summit")
      expect(corrected2.fieldProvenance?.["eventName"]).toBe("CORRECTION")
      expect(corrected2.eventType).toBe("VIRTUAL")
      expect(corrected2.fieldProvenance?.["eventType"]).toBe("CORRECTION")
    })

    it("enforces session isolation and does not blend details across different sessions or users", () => {
      const sessionAContext: EventContextMemory = {
        userId: "user-1",
        sessionId: "sess-A",
        eventName: "Exclusive Event A",
        attendeeLimit: 50,
      }

      // Check guard
      expect(isContextScopedToSession(sessionAContext, "user-1", "sess-A")).toBe(true)
      expect(isContextScopedToSession(sessionAContext, "user-1", "sess-B")).toBe(false)
      expect(isContextScopedToSession(sessionAContext, "user-2", "sess-A")).toBe(false)

      // Extraction with mismatched sessionId resets previous context
      const extractedInSessionB = extractEventContextFields(
        "Capacity is 200",
        sessionAContext,
        { userId: "user-1", sessionId: "sess-B" }
      )
      expect(extractedInSessionB.eventName).toBeUndefined()
      expect(extractedInSessionB.attendeeLimit).toBe(200)
      expect(extractedInSessionB.sessionId).toBe("sess-B")
    })

    it("resets event context when user explicitly requests to start a new or different event", () => {
      const existing: EventContextMemory = {
        userId: "user-1",
        sessionId: "sess-1",
        eventName: "Old Summit",
        location: "KICC",
        attendeeLimit: 100,
      }

      const fresh = extractEventContextFields(
        "Let's start a new event instead",
        existing,
        { userId: "user-1", sessionId: "sess-1" }
      )
      expect(fresh.eventName).toBeUndefined()
      expect(fresh.location).toBeUndefined()
      expect(fresh.attendeeLimit).toBeUndefined()
    })

    it("flags conflicting event information (e.g. virtual with physical venue) and prompts for clarification", () => {
      const conflictContext = extractEventContextFields(
        "I want a virtual event taking place at Sarit Expo Centre",
        {},
        { userId: "user-1", sessionId: "sess-1" }
      )
      expect(conflictContext.hasConflicts).toBe(true)
      expect(conflictContext.conflictDetails?.[0]).toContain("Event format is Virtual, but a physical location")

      const question = selectMinimalFollowUpQuestion(conflictContext)
      expect(question).toContain("Could you clarify:")
      expect(question).toContain("Should the event be in-person or virtual?")
    })

    it("redacts sensitive tokens, credentials, and attendee PII from extracted event strings", () => {
      const sanitized = extractEventContextFields(
        "Event called 'Founders Meetup sk_live_secret123456789012' at password=supersecret Venue",
        {},
        { userId: "user-1", sessionId: "sess-1" }
      )
      expect(sanitized.eventName).not.toContain("sk_live_secret")
      expect(sanitized.eventName).toContain("[REDACTED_SECRET]")
      expect(sanitized.location).not.toContain("supersecret")
    })
  })

  // ─── 4. Minimal Follow-Up Questions ──────────────────────────────────────────
  describe("Part 4 — Minimal Follow-Up Questions (One at a time)", () => {
    it("asks only ONE focused question when the event type/name is missing", () => {
      const question = selectMinimalFollowUpQuestion({})
      expect(question).toBe(
        "What type of event are you organizing, or what would you like to call it?"
      )
    })

    it("asks for format when name is known but in-person vs virtual is missing", () => {
      const question = selectMinimalFollowUpQuestion({ eventName: "DevOps Days" })
      expect(question).toBe("Will this be an in-person or virtual event?")
    })

    it("asks for location when event is physical and venue is missing", () => {
      const question = selectMinimalFollowUpQuestion({
        eventName: "DevOps Days",
        eventType: "PHYSICAL",
      })
      expect(question).toBe("Where will the event be hosted?")
    })

    it("asks for date when venue is known", () => {
      const question = selectMinimalFollowUpQuestion({
        eventName: "DevOps Days",
        eventType: "PHYSICAL",
        location: "KICC",
      })
      expect(question).toBe("What date and time are you planning for the event?")
    })

    it("returns null when all essential details are supplied", () => {
      const question = selectMinimalFollowUpQuestion({
        eventName: "DevOps Days",
        eventType: "PHYSICAL",
        location: "KICC",
        date: "2026-11-15",
        attendeeLimit: 100,
        isPaid: false,
      })
      expect(question).toBeNull()
    })
  })

  // ─── 5. Summary Generation & Suppression ─────────────────────────────────────
  describe("Part 5 & Prompt 13 — Milestone Summaries & Suppression", () => {
    it("generates a clean milestone summary with checkmarks when multiple details are captured", () => {
      const state: ConversationState = {
        userId: "user-1",
        sessionId: "sess-1",
        hasGreeted: true,
        hasIntroduced: true,
        addressedIntents: ["CREATE_EVENT"],
        turnCount: 4,
        eventContext: {
          eventName: "Nairobi Cloud Camp",
          eventType: "PHYSICAL",
          location: "Radisson Blu",
          attendeeLimit: 150,
          isPaid: false,
        },
        completedMilestones: ["Event draft prepared"],
        recommendedFeatures: [],
      }

      const summary = generateMilestoneSummary(state)
      expect(summary).not.toBeNull()
      expect(summary).toContain("So far we've:")
      expect(summary).toContain('✓ Event name: "Nairobi Cloud Camp"')
      expect(summary).toContain("✓ Format: In-Person")
      expect(summary).toContain("✓ Location: Radisson Blu")
      expect(summary).toContain("✓ Capacity: 150 attendees")
      expect(summary).toContain("✓ Entry: Free admission")
      expect(summary).toContain("Next:")
    })

    it("suppresses duplicate summaries when less than 3 turns have elapsed since the last summary", () => {
      const state: ConversationState = {
        userId: "user-1",
        sessionId: "sess-1",
        hasGreeted: true,
        hasIntroduced: true,
        addressedIntents: ["CREATE_EVENT"],
        turnCount: 5,
        lastSummaryTurn: 4, // Summary was emitted just 1 turn ago
        eventContext: {
          eventName: "Nairobi Cloud Camp",
          eventType: "PHYSICAL",
          location: "Radisson Blu",
          attendeeLimit: 150,
          isPaid: false,
        },
        completedMilestones: ["Event draft prepared"],
        recommendedFeatures: [],
      }

      const summary = generateMilestoneSummary(state, 5)
      expect(summary).toBeNull()
    })
  })

  // ─── 6. Capability-Aware Smart Recommendations ────────────────────────────────
  describe("Prompt 13 — Capability-Aware & Permission-Scoped Recommendations", () => {
    it("recommends Waitlist, QR Check-in, Email Reminders, and Event Analytics for paid events and notes Dashboard availability", () => {
      const recs = getSmartFeatureRecommendations({
        context: { isPaid: true, ticketPrice: 2000 },
        intent: "TICKETING",
        actor: { role: "owner", isAdmin: false },
      })
      const features = recs.map((r) => r.feature)
      expect(features).toContain("Waitlist")
      expect(features).toContain("QR Check-in")
      expect(features).toContain("Email Reminders")
      expect(features).toContain("Event Analytics")

      // Validates capability honesty
      for (const rec of recs) {
        expect(rec.status).toBe("AVAILABLE_IN_DASHBOARD")
        expect(rec.availabilityNote).toContain("Dashboard")
      }
    })

    it("respects actor permissions and does not recommend organizer dashboard tools to attendees", () => {
      const recs = getSmartFeatureRecommendations({
        context: { eventType: "PHYSICAL", attendeeLimit: 200 },
        intent: "CHECK_IN",
        actor: { role: "attendee", isAdmin: false },
      })
      const features = recs.map((r) => r.feature)
      expect(features).not.toContain("AI Registration Question Generator")
      expect(features).not.toContain("Email Reminders")
      expect(features).toContain("Ticket Downloads")
    })

    it("omits public marketing hub recommendations for private events", () => {
      const recs = getSmartFeatureRecommendations({
        context: { isPaid: false, attendeeLimit: 50 },
        intent: "CREATE_EVENT",
        actor: { role: "owner" },
        eventScope: { visibility: "PRIVATE" },
      })
      const features = recs.map((r) => r.feature)
      expect(features).not.toContain("Marketing Hub")
    })

    it("deduplicates recommendations across turns to avoid spamming the same features", () => {
      const recs = getSmartFeatureRecommendations({
        context: { isPaid: true, ticketPrice: 1500 },
        intent: "TICKETING",
        alreadyRecommended: ["Waitlist", "QR Check-in"],
      })
      const features = recs.map((r) => r.feature)
      expect(features).not.toContain("Waitlist")
      expect(features).not.toContain("QR Check-in")
      expect(features).toContain("Email Reminders")
      expect(features).toContain("Event Analytics")
    })

    it("formats recommendations with clean bullet points and clear Dashboard execution status", () => {
      const recs = [
        {
          feature: "Waitlist",
          reason: "Fills cancellations automatically.",
          status: "AVAILABLE_IN_DASHBOARD" as const,
          availabilityNote: "Configurable in Event Dashboard.",
        },
      ]
      const formatted = formatSmartRecommendations(recs)
      expect(formatted).toContain("• **Waitlist** — Fills cancellations automatically.")
      expect(formatted).toContain("*(Available in EventSlot Dashboard)*")
    })
  })

  // ─── 7. Confidence Detection ─────────────────────────────────────────────────
  describe("Part 7 — Confidence Detection & Honest Clarification", () => {
    it("produces an honest clarification message when information is insufficient", () => {
      const message = formatLowConfidenceClarification("which event workspace you mean")
      expect(message).toBe(
        "I don't have enough information yet to give you the exact details. Could you clarify which event workspace you mean?"
      )
      expect(message).not.toContain("Error")
    })
  })

  // ─── 8. User-Friendly Error Handling with Ambiguity Distinction ─────────────
  describe("Prompt 13 — User-Friendly Error Shielding & Ambiguous Outcome Distinction", () => {
    it("shields end users from raw error codes and stack traces for ordinary failures", () => {
      const msg1 = formatUserFriendlyError("EXECUTION_FAILED", "PrismaClientKnownRequestError: P2002")
      expect(msg1).not.toContain("EXECUTION_FAILED")
      expect(msg1).not.toContain("P2002")
      expect(msg1).toContain("I couldn't complete that action right now. Let's try again in a moment")

      const msg2 = formatUserFriendlyError("FORBIDDEN", "User not member of workspace")
      expect(msg2).toContain("You don't have permission to access that event in this workspace")
      expect(msg2).not.toContain("FORBIDDEN")
    })

    it("distinguishes AMBIGUOUS_OUTCOME from ordinary failures to prevent follower duplicate email confusion", () => {
      const msg = formatUserFriendlyError("AMBIGUOUS_OUTCOME")
      expect(msg).toContain("delivery of follower announcements could not be confirmed")
      expect(msg).toContain("Automatic retries are paused to prevent sending duplicate emails")
      expect(msg).toContain("check the announcement status in your dashboard")
    })

    it("handles confirmation required error gracefully", () => {
      const msg = formatUserFriendlyError("CONFIRMATION_REQUIRED")
      expect(msg).toContain("requires explicit confirmation")
    })

    it("handles rate limit exceeded error gracefully", () => {
      const msg = formatUserFriendlyError("RATE_LIMIT_EXCEEDED")
      expect(msg).toContain("Please wait a moment before trying again")
    })
  })

  // ─── 9. Adaptive Formatting & Response Length Control ────────────────────────
  describe("Part 10 & 11 — Formatting & Response Length Control", () => {
    it("classifies short direct questions as SHORT_QUERY and keeps replies concise", () => {
      const complexity = evaluateQueryComplexity("Do tickets have QR codes?", "CHECK_IN")
      expect(complexity).toBe("SHORT_QUERY")

      const formatted = formatHumanResponse({
        coreAnswer: "Yes, every EventSlot ticket includes a secure QR code for fast door check-in.",
        intent: detectUserIntent("Do tickets have QR codes?"),
        state: {
          userId: "user-1",
          sessionId: "sess-1",
          hasGreeted: true,
          hasIntroduced: true,
          addressedIntents: ["CHECK_IN"],
          turnCount: 2,
          eventContext: {},
          completedMilestones: [],
          recommendedFeatures: [],
        },
        complexity,
      })

      expect(formatted).toBe(
        "Yes, every EventSlot ticket includes a secure QR code for fast door check-in."
      )
      expect(formatted.split("\n\n").length).toBe(1)
    })

    it("classifies complex planning questions as COMPLEX_PLANNING and formats with headings", () => {
      const complexity = evaluateQueryComplexity(
        "Can you guide me step by step through how to organize a paid 500-person tech summit with custom questions?",
        "CREATE_EVENT"
      )
      expect(complexity).toBe("COMPLEX_PLANNING")
    })
  })

  // ─── 10. Refined Draft Preview Formatting Integration ────────────────────────
  describe("Part 1 & 4 — Refined Draft Preview Formatting", () => {
    it("formats draft preview with clean headings, bullets, minimal follow-up question, and smart recommendations", () => {
      const preview: EventDraftPreview = {
        draftId: "draft-test-1",
        draftVersion: "dv_123",
        status: "NEEDS_INFO",
        isLiveEvent: false,
        statusBanner: "This is a draft preview — no live event has been created.",
        fields: {
          title: "Mombasa Tech Festival",
          description: "Annual gathering of tech innovators",
          category: "Technology",
          visibility: "PUBLIC",
          accessType: "REGISTRATION",
          eventType: "PHYSICAL",
          eventDate: null,
          eventEndAt: null,
          deadline: null,
          location: "PrideInn Mombasa",
          virtualLink: null,
          capacity: 300,
          isPaid: true,
          ticketPrice: 1000,
          currency: "KES",
          organizerName: "Tech Coast",
          whatsappNumber: null,
          entryFeeLabel: null,
        },
        fieldProvenance: {
          title: "user_text",
          location: "user_text",
          capacity: "user_text",
        },
        extractedFieldKeys: ["title", "location", "capacity"],
        inferredFieldKeys: [],
        missingFields: [
          { field: "eventDate", label: "Date & Time", reason: "Date is required" },
        ],
        uncertainFields: [],
        validationIssues: [],
        schemaValid: false,
        nextRecommendedStep: "Please provide the event date.",
        updatedAt: new Date().toISOString(),
      }

      const formatted = formatDraftPreviewReply(preview)
      expect(formatted).toContain("Event Draft Preview")
      expect(formatted).toContain("No live event has been created or published on EventSlot.")
      expect(formatted).toContain("### Captured Details")
      expect(formatted).toContain('• **Title:** "Mombasa Tech Festival"')
      expect(formatted).toContain("• **Format:** In-Person")
      expect(formatted).toContain("• **Location:** PrideInn Mombasa")
      expect(formatted).toContain("• **Capacity:** 300 attendees")
      expect(formatted).toContain("• **Price:** KSh 1000")
      expect(formatted).toContain("### Next Step")
      expect(formatted).toContain("What date and time are you planning for the event?")
      expect(formatted).toContain("I'd also recommend considering these features for your event:")
      expect(formatted).toContain("• **Waitlist** —")
      expect(formatted).toContain("• **QR Check-in** —")
    })
  })
})
