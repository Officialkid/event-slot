/** @jest-environment node */

const mockEventFindUnique = jest.fn()
const mockEventFindMany = jest.fn()
const mockTeamMemberFindFirst = jest.fn()
const mockTeamMemberFindMany = jest.fn()
const mockUserFindUnique = jest.fn()
const mockGetAdminModeFromCookie = jest.fn()

const prismaMock = {
  event: {
    findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
    findMany: (...args: unknown[]) => mockEventFindMany(...args),
  },
  teamMember: {
    findFirst: (...args: unknown[]) => mockTeamMemberFindFirst(...args),
    findMany: (...args: unknown[]) => mockTeamMemberFindMany(...args),
  },
  user: {
    findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
  },
}

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: prismaMock,
  prisma: prismaMock,
}))

jest.mock("@/lib/adminMode", () => ({
  getAdminModeFromCookie: (...args: unknown[]) =>
    mockGetAdminModeFromCookie(...args),
}))

function buildSampleEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "evt-1",
    slug: "nairobi-tech-summit",
    title: "Nairobi Tech Summit",
    status: "active",
    visibility: "PUBLIC",
    eventType: "PHYSICAL",
    organizerId: "owner-1",
    capacity: 100,
    confirmedCount: 45,
    waitlistCount: 5,
    eventDate: new Date("2026-11-15T09:00:00Z"),
    deadline: new Date("2026-11-14T23:59:59Z"),
    location: "Nairobi",
    ticketsEnabled: true,
    isPaid: false,
    archived: false,
    createdAt: new Date("2026-10-01T10:00:00Z"),
    registrations: [
      { status: "confirmed", submittedAt: new Date("2026-10-10T10:00:00Z") },
      { status: "CONFIRMED", submittedAt: new Date("2026-10-10T11:00:00Z") },
      { status: "waitlisted", submittedAt: new Date("2026-10-11T12:00:00Z") },
    ],
    ...overrides,
  }
}

describe("Scope B — Assistant Event RBAC & Deterministic Context Resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetAdminModeFromCookie.mockResolvedValue({
      active: false,
      eventId: null,
      eventSlug: null,
      eventTitle: null,
      organiserId: null,
      activatedAt: null,
    })
    mockUserFindUnique.mockResolvedValue(null)
  })

  describe("B.1 getEventInsights RBAC alignment", () => {
    it("allows the event owner to access insights", async () => {
      mockEventFindUnique.mockResolvedValueOnce(buildSampleEvent())

      const { getEventInsights } = await import("@/lib/event-insights")
      const insights = await getEventInsights("evt-1", "owner-1")

      expect(insights).not.toBeNull()
      expect(insights?.eventTitle).toBe("Nairobi Tech Summit")
      expect(insights?.totalRegistrations).toBe(2)
      expect(insights?.waitlistCount).toBe(1)
    })

    it("allows an accepted team member with explicit event assignment", async () => {
      mockEventFindUnique.mockResolvedValueOnce(buildSampleEvent())
      // First call in verifyWorkspaceMembership (no workspaceOrganizerId -> not called)
      // Call in hasTeamEventAccess:
      mockTeamMemberFindFirst.mockResolvedValueOnce({
        id: "tm-1",
        _count: { eventAccess: 1 },
        eventAccess: [{ id: "ea-1" }],
      })

      const { getEventInsights } = await import("@/lib/event-insights")
      const insights = await getEventInsights("evt-1", "team-user-1", {
        userEmail: "collaborator@example.com",
        userRole: "USER",
      })

      expect(insights).not.toBeNull()
      expect(insights?.eventTitle).toBe("Nairobi Tech Summit")
    })

    it("denies a team member who is not assigned to the specific event", async () => {
      mockEventFindUnique.mockResolvedValueOnce(buildSampleEvent())
      mockTeamMemberFindFirst.mockResolvedValueOnce({
        id: "tm-1",
        _count: { eventAccess: 0 },
        eventAccess: [],
      })

      const { getEventInsights } = await import("@/lib/event-insights")
      const insights = await getEventInsights("evt-1", "unassigned-team-user", {
        userEmail: "unassigned@example.com",
        userRole: "USER",
      })

      expect(insights).toBeNull()
    })

    it("denies an unrelated authenticated user", async () => {
      mockEventFindUnique.mockResolvedValueOnce(buildSampleEvent())
      mockTeamMemberFindFirst.mockResolvedValueOnce(null)

      const { getEventInsights } = await import("@/lib/event-insights")
      const insights = await getEventInsights("evt-1", "stranger-user", {
        userEmail: "stranger@example.com",
        userRole: "USER",
      })

      expect(insights).toBeNull()
    })

    it("allows a platform super-admin", async () => {
      mockEventFindUnique.mockResolvedValueOnce(buildSampleEvent())
      mockTeamMemberFindFirst.mockResolvedValueOnce(null)

      const { getEventInsights } = await import("@/lib/event-insights")
      const insights = await getEventInsights("evt-1", "admin-user-1", {
        userEmail: "admin@eventsslot.com",
        userRole: "SUPER_ADMIN",
        isAdmin: true,
      })

      expect(insights).not.toBeNull()
      expect(insights?.eventTitle).toBe("Nairobi Tech Summit")
    })
  })

  describe("B.2 Deterministic active-event resolution (never guessing events[0])", () => {
    it("resolves an explicit eventId/slug when the actor is authorized", async () => {
      mockEventFindUnique.mockResolvedValueOnce(buildSampleEvent())

      const { resolveAssistantEventContext } = await import(
        "@/lib/assistant/context-resolver"
      )

      const res = await resolveAssistantEventContext({
        actor: { userId: "owner-1", userEmail: "owner@example.com" },
        explicitEventIdOrSlug: "evt-1",
        message: "How many people registered?",
      })

      expect(res.status).toBe("RESOLVED")
      if (res.status === "RESOLVED") {
        expect(res.source).toBe("EXPLICIT_CONTEXT")
        expect(res.event.id).toBe("evt-1")
        expect(res.event.accessRole).toBe("owner")
      }
    })

    it("returns FORBIDDEN_OR_NOT_FOUND when an explicit eventId belongs to another organizer", async () => {
      mockEventFindUnique.mockResolvedValueOnce(
        buildSampleEvent({ organizerId: "other-owner" })
      )
      mockTeamMemberFindFirst.mockResolvedValueOnce(null)

      const { resolveAssistantEventContext } = await import(
        "@/lib/assistant/context-resolver"
      )

      const res = await resolveAssistantEventContext({
        actor: { userId: "owner-1", userEmail: "owner@example.com" },
        explicitEventIdOrSlug: "evt-1",
      })

      expect(res.status).toBe("FORBIDDEN_OR_NOT_FOUND")
      if (res.status === "FORBIDDEN_OR_NOT_FOUND") {
        expect(res.candidates).toEqual([])
      }
    })

    it("resolves unambiguously when the user names a specific authorized event in conversation", async () => {
      mockTeamMemberFindMany.mockResolvedValueOnce([])
      mockEventFindMany.mockResolvedValueOnce([
        buildSampleEvent({
          id: "evt-1",
          slug: "nairobi-tech-summit",
          title: "Nairobi Tech Summit",
        }),
        buildSampleEvent({
          id: "evt-2",
          slug: "mombasa-founders-mixer",
          title: "Mombasa Founders Mixer",
        }),
      ])

      const { resolveAssistantEventContext } = await import(
        "@/lib/assistant/context-resolver"
      )

      const res = await resolveAssistantEventContext({
        actor: { userId: "owner-1", userEmail: "owner@example.com" },
        message: "What is the fill rate for Mombasa Founders Mixer?",
      })

      expect(res.status).toBe("RESOLVED")
      if (res.status === "RESOLVED") {
        expect(res.source).toBe("CONVERSATION_MATCH")
        expect(res.event.id).toBe("evt-2")
      }
    })

    it("returns AMBIGUOUS listing only authorized events when multiple events exist and none is specified (never picks events[0])", async () => {
      mockTeamMemberFindMany.mockResolvedValueOnce([])
      mockEventFindMany.mockResolvedValueOnce([
        buildSampleEvent({
          id: "evt-1",
          slug: "nairobi-tech-summit",
          title: "Nairobi Tech Summit",
        }),
        buildSampleEvent({
          id: "evt-2",
          slug: "mombasa-founders-mixer",
          title: "Mombasa Founders Mixer",
        }),
      ])

      const { resolveAssistantEventContext } = await import(
        "@/lib/assistant/context-resolver"
      )

      const res = await resolveAssistantEventContext({
        actor: { userId: "owner-1", userEmail: "owner@example.com" },
        message: "How many registrations do I have?",
      })

      expect(res.status).toBe("AMBIGUOUS")
      if (res.status === "AMBIGUOUS") {
        expect(res.candidates).toHaveLength(2)
        expect(res.candidates.map((c) => c.id)).toEqual(["evt-1", "evt-2"])
        expect(res.clarificationPrompt).toContain("Nairobi Tech Summit")
        expect(res.clarificationPrompt).toContain("Mombasa Founders Mixer")
      }
    })

    it("returns NEEDS_CONTEXT when 1 event exists but the user did not specify an event ID or name (never silently selects events[0])", async () => {
      mockTeamMemberFindMany.mockResolvedValueOnce([])
      mockEventFindMany.mockResolvedValueOnce([
        buildSampleEvent({
          id: "evt-only",
          slug: "annual-gala",
          title: "Annual Gala",
        }),
      ])

      const { resolveAssistantEventContext } = await import(
        "@/lib/assistant/context-resolver"
      )

      const res = await resolveAssistantEventContext({
        actor: { userId: "owner-1", userEmail: "owner@example.com" },
        message: "How many people have registered?",
      })

      expect(res.status).toBe("NEEDS_CONTEXT")
      if (res.status === "NEEDS_CONTEXT") {
        expect(res.candidates).toHaveLength(1)
        expect(res.candidates[0].id).toBe("evt-only")
        expect(res.clarificationPrompt).toContain("Annual Gala")
      }
    })

    it("enforces workspace boundaries and blocks cross-workspace event access", async () => {
      // Actor is an accepted member of org-1, but tries to resolve an event owned by org-2
      mockEventFindUnique.mockResolvedValueOnce(
        buildSampleEvent({ id: "evt-org-2", organizerId: "org-2" })
      )

      const { resolveAssistantEventContext } = await import(
        "@/lib/assistant/context-resolver"
      )

      const res = await resolveAssistantEventContext({
        actor: {
          userId: "member-1",
          userEmail: "member@example.com",
          workspaceOrganizerId: "org-1",
        },
        explicitEventIdOrSlug: "evt-org-2",
      })

      expect(res.status).toBe("FORBIDDEN_OR_NOT_FOUND")
      if (res.status === "FORBIDDEN_OR_NOT_FOUND") {
        expect(res.candidates).toEqual([])
      }
    })
  })
})

export {}
