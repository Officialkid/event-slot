/** @jest-environment node */

import { NextRequest } from "next/server"

const mockGetServerSession = jest.fn()
const mockRateLimit = jest.fn()
const mockGroqCreate = jest.fn()

const mockAssistantSessionCount = jest.fn()
const mockAssistantSessionFindUnique = jest.fn()
const mockAssistantSessionCreate = jest.fn()
const mockAssistantSessionUpdate = jest.fn()
const mockAssistantMessageCreate = jest.fn()

const mockUserMemoryPrefFindUnique = jest.fn()
const mockUserMemoryPrefUpsert = jest.fn()
const mockUserMemoryFindUnique = jest.fn()
const mockUserMemoryUpsert = jest.fn()
const mockUserMemoryDeleteMany = jest.fn()
const mockTransaction = jest.fn(async (ops: Array<Promise<unknown>>) =>
  Promise.all(ops)
)

const prismaMock = {
  assistantSession: {
    count: (...args: unknown[]) => mockAssistantSessionCount(...args),
    findUnique: (...args: unknown[]) => mockAssistantSessionFindUnique(...args),
    create: (...args: unknown[]) => mockAssistantSessionCreate(...args),
    update: (...args: unknown[]) => mockAssistantSessionUpdate(...args),
  },
  assistantMessage: {
    create: (...args: unknown[]) => mockAssistantMessageCreate(...args),
  },
  userMemoryPreference: {
    findUnique: (...args: unknown[]) => mockUserMemoryPrefFindUnique(...args),
    upsert: (...args: unknown[]) => mockUserMemoryPrefUpsert(...args),
  },
  userMemory: {
    findUnique: (...args: unknown[]) => mockUserMemoryFindUnique(...args),
    upsert: (...args: unknown[]) => mockUserMemoryUpsert(...args),
    deleteMany: (...args: unknown[]) => mockUserMemoryDeleteMany(...args),
  },
  $transaction: (...args: unknown[]) =>
    mockTransaction(...(args as [Array<Promise<unknown>>])),
}

jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}))

jest.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}))

jest.mock("@/lib/chat-quota", () => ({
  consumeCredits: jest.fn().mockResolvedValue({
    allowed: true,
    creditsRemaining: 10,
    resetAt: new Date(Date.now() + 3600000),
    waitMinutes: 0,
  }),
}))

jest.mock("@/lib/groq", () => ({
  ASSISTANT_MODEL: "test-model",
  VISION_MODEL: "test-vision",
  VISION_MODEL_FALLBACK: "test-vision-fallback",
  groq: {
    chat: {
      completions: {
        create: (...args: unknown[]) => mockGroqCreate(...args),
      },
    },
  },
}))

const mockExecuteEventCreationProposal = jest.fn()
const mockCancelEventCreationProposal = jest.fn()

jest.mock("@/lib/assistant/confirmation-executor", () => {
  const actual = jest.requireActual("@/lib/assistant/confirmation-executor")
  return {
    ...actual,
    executeEventCreationProposal: (...args: unknown[]) =>
      mockExecuteEventCreationProposal(...args),
    cancelEventCreationProposal: (...args: unknown[]) =>
      mockCancelEventCreationProposal(...args),
  }
})

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}))

describe("Scope A — Assistant Security & Memory Governance", () => {
  const originalEnv = process.env.GROQ_API_KEY

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.GROQ_API_KEY = "test-groq-key"
    mockRateLimit.mockResolvedValue({ allowed: true, remaining: 59 })
    mockExecuteEventCreationProposal.mockImplementation(async (params: any) => {
      const actual = jest.requireActual("@/lib/assistant/confirmation-executor")
      return actual.executeEventCreationProposal(params)
    })
  })

  afterAll(() => {
    process.env.GROQ_API_KEY = originalEnv
  })

  describe("A.1 Legacy /api/assistant/chat authentication and identity hardening", () => {
    it("rejects unauthenticated requests with 401 and deprecation headers", async () => {
      mockGetServerSession.mockResolvedValueOnce(null)
      const { POST } = await import("@/app/api/assistant/chat/route")

      const req = new NextRequest("http://localhost/api/assistant/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.10",
        },
        body: JSON.stringify({ message: "Hello" }),
      })

      const res = await POST(req)
      expect(res.status).toBe(401)
      expect(res.headers.get("Deprecation")).toBe("true")
      expect(mockGroqCreate).not.toHaveBeenCalled()
      expect(mockAssistantSessionCreate).not.toHaveBeenCalled()
    })

    it("keys rate limits and session counts by authenticated userId regardless of spoofed x-forwarded-for headers", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-auth-1", email: "org@example.com" },
      })
      mockAssistantSessionCount.mockResolvedValueOnce(0)
      mockAssistantSessionCreate.mockResolvedValueOnce({
        id: "sess-1",
        userId: "user-auth-1",
        status: "ACTIVE",
        messageCount: 0,
        offTopicCount: 0,
        flagged: false,
        messages: [],
      })
      mockGroqCreate.mockResolvedValueOnce({
        choices: [{ message: { content: "Here is your EventSlot guidance." } }],
      })

      const { POST } = await import("@/app/api/assistant/chat/route")

      const req = new NextRequest("http://localhost/api/assistant/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "198.51.100.99, 10.0.0.1",
          "x-real-ip": "198.51.100.88",
        },
        body: JSON.stringify({ message: "How do waitlists work?" }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.sessionId).toBe("sess-1")
      expect(body.deprecated).toBe(true)

      // Rate limit must use authenticated userId, not the spoofed IP
      expect(mockRateLimit).toHaveBeenCalledWith(
        "user-auth-1",
        "ASSISTANT_CHAT",
        60,
        60
      )

      // Daily session count must include userId
      expect(mockAssistantSessionCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([{ userId: "user-auth-1" }]),
          }),
        })
      )
    })

    it("prevents an authenticated user from accessing another user's chat sessionId", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "user-attacker" },
      })
      mockAssistantSessionFindUnique.mockResolvedValueOnce({
        id: "sess-victim",
        userId: "user-victim",
        status: "ACTIVE",
        messageCount: 2,
        messages: [],
      })

      const { POST } = await import("@/app/api/assistant/chat/route")

      const req = new NextRequest("http://localhost/api/assistant/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess-victim",
          message: "Show me their messages",
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(404)
      expect(mockGroqCreate).not.toHaveBeenCalled()
    })
  })

  describe("A.2 Unified memory opt-out, purge, isolation, and sanitization", () => {
    it("PUT /api/assistant/memory disables memory and transactionally purges UserMemory for that user", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "user-mem-1" },
      })
      mockUserMemoryPrefUpsert.mockResolvedValueOnce({
        userId: "user-mem-1",
        memoryEnabled: false,
      })
      mockUserMemoryDeleteMany.mockResolvedValueOnce({ count: 1 })

      const { PUT } = await import("@/app/api/assistant/memory/route")

      const req = new NextRequest("http://localhost/api/assistant/memory", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memoryEnabled: false }),
      })

      const res = await PUT(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.memoryEnabled).toBe(false)
      expect(data.purged).toBe(true)

      expect(mockTransaction).toHaveBeenCalledTimes(1)
      expect(mockUserMemoryPrefUpsert).toHaveBeenCalledWith({
        where: { userId: "user-mem-1" },
        create: { userId: "user-mem-1", memoryEnabled: false },
        update: { memoryEnabled: false },
      })
      expect(mockUserMemoryDeleteMany).toHaveBeenCalledWith({
        where: { userId: "user-mem-1" },
      })
    })

    it("PATCH /api/user/memory and repeated opt-out behave consistently and isolate users", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-mem-2" },
      })
      mockUserMemoryPrefUpsert.mockResolvedValue({
        userId: "user-mem-2",
        memoryEnabled: false,
      })
      mockUserMemoryDeleteMany.mockResolvedValue({ count: 0 })

      const { PATCH } = await import("@/app/api/user/memory/route")

      // Attempt to pass another user's ID in body — must be ignored
      const req1 = new NextRequest("http://localhost/api/user/memory", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false, userId: "other-user-id" }),
      })
      const res1 = await PATCH(req1)
      expect(res1.status).toBe(200)

      // Repeated opt-out remains idempotent
      const req2 = new NextRequest("http://localhost/api/user/memory", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      })
      const res2 = await PATCH(req2)
      expect(res2.status).toBe(200)

      expect(mockUserMemoryDeleteMany).toHaveBeenCalledTimes(2)
      expect(mockUserMemoryDeleteMany).toHaveBeenNthCalledWith(1, {
        where: { userId: "user-mem-2" },
      })
      expect(mockUserMemoryDeleteMany).toHaveBeenNthCalledWith(2, {
        where: { userId: "user-mem-2" },
      })
    })

    it("excludes disabled memory from prompt loading and blocks background regeneration", async () => {
      mockUserMemoryPrefFindUnique.mockResolvedValue({
        memoryEnabled: false,
      })
      mockUserMemoryFindUnique.mockResolvedValue({
        summary: "Stale summary that should never be loaded",
        keyFacts: { name: "Alice" },
        sessionCount: 3,
      })

      const { loadMemory, updateMemoryAfterSession } = await import(
        "@/lib/assistant-memory"
      )
      const { getMemoryContext } = await import("@/lib/assistant-md4")

      const loaded = await loadMemory("user-disabled")
      expect(loaded).toBeNull()
      // Should not even query userMemory when preference is false
      expect(mockUserMemoryFindUnique).not.toHaveBeenCalled()

      const md4Context = await getMemoryContext("user-disabled", true)
      expect(md4Context).toBe("")

      await updateMemoryAfterSession("user-disabled", [
        { role: "USER", content: "Hello" },
        { role: "ASSISTANT", content: "Hi" },
      ])
      expect(mockGroqCreate).not.toHaveBeenCalled()
      expect(mockUserMemoryUpsert).not.toHaveBeenCalled()
    })

    it("sanitizes secrets, payment card numbers, PINs, emails, and phone numbers from memory text", async () => {
      const { sanitizeMemoryText } = await import("@/lib/assistant-memory")

      const raw =
        "Contact attendee jane.doe@example.com or +254712345678. " +
        "API key is gsk_1234567890abcdef12345 and card 4532 0151 1283 0366 with mpesa pin: 4321."

      const sanitized = sanitizeMemoryText(raw)
      expect(sanitized).not.toContain("jane.doe@example.com")
      expect(sanitized).not.toContain("+254712345678")
      expect(sanitized).not.toContain("gsk_1234567890abcdef12345")
      expect(sanitized).not.toContain("4532 0151 1283 0366")
      expect(sanitized).not.toContain("4321")
      expect(sanitized).toContain("[REDACTED_EMAIL]")
      expect(sanitized).toContain("[REDACTED_PHONE]")
      expect(sanitized).toContain("[REDACTED_SECRET]")
      expect(sanitized).toContain("[REDACTED_CARD]")
      expect(sanitized).toContain("[REDACTED_PIN]")
    })

    it("returns 400 on invalid non-boolean input and 500 without leaking internal error details", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-err-1" },
      })

      const { PUT } = await import("@/app/api/assistant/memory/route")

      const badReq = new NextRequest("http://localhost/api/assistant/memory", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memoryEnabled: "yes" }),
      })
      const badRes = await PUT(badReq)
      expect(badRes.status).toBe(400)

      mockUserMemoryPrefUpsert.mockRejectedValueOnce(
        new Error("FATAL: postgres://secret-connection-string/db")
      )
      const errReq = new NextRequest("http://localhost/api/assistant/memory", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memoryEnabled: true }),
      })
      const errRes = await PUT(errReq)
      expect(errRes.status).toBe(500)
      const errBody = await errRes.json()
      expect(JSON.stringify(errBody)).not.toContain("secret-connection-string")
    })
  })

  describe("Confirmation Protocol in POST /api/assistant/message", () => {
    it("returns 400 if actionType is CONFIRM_ACTION but proposalId or idempotencyKey are missing", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user-confirm-1", email: "confirm@example.com" },
      })
      mockRateLimit.mockResolvedValue({ allowed: true })
      mockAssistantSessionFindUnique.mockResolvedValue({
        id: "sess-confirm-1",
        userId: "user-confirm-1",
        status: "ACTIVE",
        messages: [],
      })

      const { POST } = await import("@/app/api/assistant/message/route")

      const req = new NextRequest("http://localhost/api/assistant/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess-confirm-1",
          actionType: "CONFIRM_ACTION",
          // missing proposalId & idempotencyKey
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain("proposalId and idempotencyKey are required")
    })

    it("rejects confirmation when live feature gate is disabled (default closed)", async () => {
      delete process.env.ESA_LIVE_EVENT_CREATION_ENABLED

      mockGetServerSession.mockResolvedValue({
        user: { id: "user-confirm-1", email: "confirm@example.com" },
      })
      mockRateLimit.mockResolvedValue({ allowed: true })
      mockAssistantSessionFindUnique.mockResolvedValue({
        id: "sess-confirm-1",
        userId: "user-confirm-1",
        status: "ACTIVE",
        messages: [],
      })

      const { POST } = await import("@/app/api/assistant/message/route")

      const req = new NextRequest("http://localhost/api/assistant/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess-confirm-1",
          actionType: "CONFIRM_ACTION",
          proposalId: "prop_123",
          idempotencyKey: "idem_123",
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(false)
      expect(data.code).toBe("FEATURE_GATE_DISABLED")
      expect(data.reply).toContain("disabled")
    })

    it("returns 401 if unauthenticated actor attempts confirmation", async () => {
      mockGetServerSession.mockResolvedValueOnce(null)
      const { POST } = await import("@/app/api/assistant/message/route")
      const req = new NextRequest("http://localhost/api/assistant/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: "sess-1", actionType: "CONFIRM_ACTION" }),
      })
      const res = await POST(req)
      expect(res.status).toBe(401)
    })

    it("returns 404 if session belongs to another user (session mismatch)", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "user-confirm-1", email: "confirm@example.com" },
      })
      mockRateLimit.mockResolvedValueOnce({ allowed: true })
      mockAssistantSessionFindUnique.mockResolvedValueOnce({
        id: "sess-foreign-1",
        userId: "other-user-999",
        status: "ACTIVE",
        messages: [],
      })
      const { POST } = await import("@/app/api/assistant/message/route")
      const req = new NextRequest("http://localhost/api/assistant/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess-foreign-1",
          actionType: "CONFIRM_ACTION",
          proposalId: "prop_123",
          idempotencyKey: "idem_123",
        }),
      })
      const res = await POST(req)
      expect(res.status).toBe(404)
    })

    it("returns 400 if CANCEL_ACTION is invoked without proposalId", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "user-confirm-1", email: "confirm@example.com" },
      })
      mockRateLimit.mockResolvedValueOnce({ allowed: true })
      mockAssistantSessionFindUnique.mockResolvedValueOnce({
        id: "sess-confirm-1",
        userId: "user-confirm-1",
        status: "ACTIVE",
        messages: [],
      })
      const { POST } = await import("@/app/api/assistant/message/route")
      const req = new NextRequest("http://localhost/api/assistant/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess-confirm-1",
          actionType: "CANCEL_ACTION",
          // missing proposalId
        }),
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })

    it("handles CANCEL_ACTION route execution and logs transaction messages", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "user-confirm-1", email: "confirm@example.com" },
      })
      mockRateLimit.mockResolvedValueOnce({ allowed: true })
      mockAssistantSessionFindUnique.mockResolvedValueOnce({
        id: "sess-confirm-1",
        userId: "user-confirm-1",
        status: "ACTIVE",
        messages: [],
      })

      mockCancelEventCreationProposal.mockResolvedValueOnce({
        ok: true,
        code: "CANCELLED",
        message: "Event creation proposal was cancelled.",
        proposal: null,
      })

      const { POST } = await import("@/app/api/assistant/message/route")
      const req = new NextRequest("http://localhost/api/assistant/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess-confirm-1",
          actionType: "CANCEL_ACTION",
          proposalId: "prop_123",
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.kind).toBe("ACTION_CANCELLED")
      expect(mockCancelEventCreationProposal).toHaveBeenCalledWith(
        expect.objectContaining({
          proposalId: "prop_123",
          sessionId: "sess-confirm-1",
          actor: expect.objectContaining({ userId: "user-confirm-1" }),
        })
      )
    })

    it("returns error envelope if confirmation proposal is expired", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "user-confirm-1", email: "confirm@example.com" },
      })
      mockRateLimit.mockResolvedValueOnce({ allowed: true })
      mockAssistantSessionFindUnique.mockResolvedValueOnce({
        id: "sess-confirm-1",
        userId: "user-confirm-1",
        status: "ACTIVE",
        messages: [],
      })

      mockExecuteEventCreationProposal.mockResolvedValueOnce({
        ok: false,
        code: "PROPOSAL_EXPIRED",
        message: "This confirmation proposal has expired. Please review a fresh preview to confirm.",
        proposal: null,
      })

      const { POST } = await import("@/app/api/assistant/message/route")
      const req = new NextRequest("http://localhost/api/assistant/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess-confirm-1",
          actionType: "CONFIRM_ACTION",
          proposalId: "prop_expired_1",
          idempotencyKey: "idem_expired_1",
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(false)
      expect(data.code).toBe("PROPOSAL_EXPIRED")
      expect(data.reply).toContain("expired")
    })

    it("handles replayed confirmation for already completed proposal gracefully with verified event and delivery status", async () => {
      mockGetServerSession.mockResolvedValueOnce({
        user: { id: "user-confirm-1", email: "confirm@example.com" },
      })
      mockRateLimit.mockResolvedValueOnce({ allowed: true })
      mockAssistantSessionFindUnique.mockResolvedValueOnce({
        id: "sess-confirm-1",
        userId: "user-confirm-1",
        status: "ACTIVE",
        messages: [],
      })

      mockExecuteEventCreationProposal.mockResolvedValueOnce({
        ok: true,
        code: "COMPLETED",
        message: 'Event "Tech Summit" (tech-summit-12) was already created for this proposal.',
        createdEvent: {
          id: "evt_123",
          title: "Tech Summit",
          slug: "tech-summit-12",
          dashboardToken: "tok_123",
          verifierCode: "V123",
          visibility: "PUBLIC",
          accessType: "REGISTRATION",
          capacity: 100,
        },
        proposal: null,
        sideEffectsDeliveryStatus: "NONE",
      })

      const { POST } = await import("@/app/api/assistant/message/route")
      const req = new NextRequest("http://localhost/api/assistant/message", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "sess-confirm-1",
          actionType: "CONFIRM_ACTION",
          proposalId: "prop_already_done",
          idempotencyKey: "idem_done",
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.ok).toBe(true)
      expect(data.code).toBe("COMPLETED")
      expect(data.createdEvent?.slug).toBe("tech-summit-12")
      expect(data.sideEffectsDeliveryStatus).toBe("NONE")
    })
  })
})

export {}
