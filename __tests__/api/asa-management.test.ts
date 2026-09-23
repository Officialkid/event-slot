/** @jest-environment node */

import {
  formatEventMetricsSummary,
  detectManagementActionIntent,
  isActionConfirmation,
  isActionCancellation,
  isOrganizerEventsOverviewQuery,
  formatOrganizerEventsOverview,
  type AsaEventMetrics,
} from "@/lib/asa/asa-engine"
import { NextRequest } from "next/server"

const mockGetServerSession = jest.fn()
const mockCanCreateEvent = jest.fn()
const mockEventFindFirst = jest.fn()
const mockEventFindMany = jest.fn()
const mockEventFindUnique = jest.fn()
const mockEventUpdate = jest.fn()
const mockRegistrationCount = jest.fn()

jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}))

jest.mock("@/lib/adminMode", () => ({
  hasOrganiserAccess: jest.fn().mockResolvedValue(false),
}))

jest.mock("@/lib/planEnforcement", () => ({
  canCreateEvent: (...args: unknown[]) => mockCanCreateEvent(...args),
}))

jest.mock("@/lib/referral", () => ({
  processFirstEventReferral: jest.fn().mockResolvedValue(undefined),
}))

jest.mock("@/lib/ai", () => ({
  askAIWithMeta: jest.fn().mockResolvedValue({ content: "{}" }),
}))

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    event: {
      create: jest.fn(),
      findFirst: (...args: unknown[]) => mockEventFindFirst(...args),
      findMany: (...args: unknown[]) => mockEventFindMany(...args),
      findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
      update: (...args: unknown[]) => mockEventUpdate(...args),
    },
    registration: {
      count: (...args: unknown[]) => mockRegistrationCount(...args),
    },
  },
}))

import { POST } from "@/app/api/assistant/asa/route"

describe("ASA Phase 3: Event Intelligence and Management Engine", () => {
  const sampleEvent = {
    id: "evt_123",
    slug: "partners-dinner-2026",
    title: "Partners Dinner 2026",
    description: "Annual partners celebration dinner",
    category: "NETWORKING",
    location: "Swiss Lenana",
    capacity: 500,
    confirmedCount: 350,
    waitlistCount: 25,
    status: "active",
    accessType: "REGISTRATION",
    visibility: "PUBLIC",
    eventDate: new Date("2026-10-03T15:00:00Z"),
    eventEndAt: new Date("2026-10-03T18:00:00Z"),
    eventType: "PHYSICAL",
    organizerId: "user_org_1",
    questions: [],
  }

  const sampleMetrics: AsaEventMetrics = {
    eventId: "evt_123",
    eventSlug: "partners-dinner-2026",
    eventTitle: "Partners Dinner 2026",
    totalConfirmed: 350,
    totalWaitlist: 25,
    registeredToday: 15,
    registeredYesterday: 10,
    capacity: 500,
    remainingSlots: 150,
    utilizationPct: 70,
    checkedInCount: 120,
    remainingExpectedAttendees: 230,
    isFull: false,
    eventDate: "Sat, Oct 3, 2026",
    eventEndAt: "2026-10-03T18:00:00.000Z",
    timeUntilEvent: "in 10 days",
    status: "active",
    location: "Swiss Lenana",
    accessType: "REGISTRATION",
    visibility: "PUBLIC",
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockCanCreateEvent.mockResolvedValue({ allowed: true })
    mockGetServerSession.mockResolvedValue({
      user: { id: "user_org_1", email: "organizer@eventslot.test", name: "Daniel" },
    })
  })

  describe("1. Metric Formatter (formatEventMetricsSummary)", () => {
    it("answers inquiry about today's registrations", () => {
      const summary = formatEventMetricsSummary(sampleMetrics, "How many people registered today?")
      expect(summary).toContain("15 people have registered today")
      expect(summary).toContain("Partners Dinner 2026")
      expect(summary).toContain("350 confirmed registrations")
      expect(summary).toContain("150 slots remaining")
      expect(summary).toContain("25 people on the waitlist")
    })

    it("answers inquiry about remaining capacity and slots", () => {
      const summary = formatEventMetricsSummary(sampleMetrics, "How many slots are remaining?")
      expect(summary).toContain("150 slots remain")
      expect(summary).toContain("350 out of 500 slots are taken (70% capacity)")
    })

    it("answers whether the event is full when not full", () => {
      const summary = formatEventMetricsSummary(sampleMetrics, "Is my event full?")
      expect(summary).toContain("No, your event is not full yet")
      expect(summary).toContain("150 slots remaining out of 500")
    })

    it("answers whether the event is full when at capacity", () => {
      const fullMetrics: AsaEventMetrics = {
        ...sampleMetrics,
        totalConfirmed: 500,
        remainingSlots: 0,
        isFull: true,
      }
      const summary = formatEventMetricsSummary(fullMetrics, "Is my event full?")
      expect(summary).toContain("Yes, your event is currently at full capacity (500/500 slots filled)")
      expect(summary).toContain("25 people on the waitlist")
    })

    it("answers inquiry about check-ins", () => {
      const summary = formatEventMetricsSummary(sampleMetrics, "How many people have checked in?")
      expect(summary).toContain("120 attendees have checked in so far")
      expect(summary).toContain("230 expected attendees who haven't checked in yet")
    })

    it("answers inquiry about waitlist", () => {
      const summary = formatEventMetricsSummary(sampleMetrics, "How many people are on the waitlist?")
      expect(summary).toContain("There are 25 people currently on the waitlist for **Partners Dinner 2026**")
    })

    it("provides complete overview for general inquiry 'How is my event doing?'", () => {
      const summary = formatEventMetricsSummary(sampleMetrics, "How is my event doing?")
      expect(summary).toContain("Here is how **Partners Dinner 2026** is performing:")
      expect(summary).toContain("Registrations")
      expect(summary).toContain("**Registered Today**: 15 (10 yesterday)")
      expect(summary).toContain("**Remaining Slots**: 150")
      expect(summary).toContain("**Check-ins**: 120 checked in (230 remaining)")
      expect(summary).toContain("**Waitlist**: 25 waiting")
    })
  })

  describe("2. Management Action Intent Detection", () => {
    it("detects capacity change intent with proposed value", () => {
      const action = detectManagementActionIntent("Increase the capacity to 800", sampleMetrics)
      expect(action).not.toBeNull()
      expect(action?.type).toBe("UPDATE_CAPACITY")
      expect(action?.fieldName).toBe("capacity")
      expect(action?.currentValue).toBe(500)
      expect(action?.proposedValue).toBe(800)
      expect(action?.confirmationMessage).toContain("Your current capacity is 500. Would you like me to change it to 800?")
      expect(action?.status).toBe("proposed")
    })

    it("detects venue change intent with proposed location", () => {
      const action = detectManagementActionIntent("Update the venue to Sarit Expo Centre", sampleMetrics)
      expect(action).not.toBeNull()
      expect(action?.type).toBe("UPDATE_VENUE")
      expect(action?.fieldName).toBe("location")
      expect(action?.currentValue).toBe("Swiss Lenana")
      expect(action?.proposedValue).toBe("Sarit Expo Centre")
      expect(action?.confirmationMessage).toContain("Would you like me to update the venue to \"Sarit Expo Centre\"?")
    })

    it("detects registration closure intent", () => {
      const action = detectManagementActionIntent("Close registration", sampleMetrics)
      expect(action).not.toBeNull()
      expect(action?.type).toBe("CLOSE_REGISTRATION")
      expect(action?.fieldName).toBe("status")
      expect(action?.proposedValue).toBe("closed")
    })

    it("detects registration reopen intent", () => {
      const closedMetrics = { ...sampleMetrics, status: "closed" }
      const action = detectManagementActionIntent("Reopen registration", closedMetrics)
      expect(action).not.toBeNull()
      expect(action?.type).toBe("REOPEN_REGISTRATION")
      expect(action?.proposedValue).toBe("active")
    })
  })

  describe("3. Confirmation and Cancellation Guards", () => {
    it("recognizes affirmative phrases as confirmations", () => {
      expect(isActionConfirmation("yes")).toBe(true)
      expect(isActionConfirmation("Yes please")).toBe(true)
      expect(isActionConfirmation("Confirm")).toBe(true)
      expect(isActionConfirmation("Do it")).toBe(true)
      expect(isActionConfirmation("Proceed")).toBe(true)
      expect(isActionConfirmation("Go ahead")).toBe(true)
    })

    it("recognizes refusal phrases as cancellations", () => {
      expect(isActionCancellation("no")).toBe(true)
      expect(isActionCancellation("Cancel")).toBe(true)
      expect(isActionCancellation("Stop")).toBe(true)
      expect(isActionCancellation("Don't")).toBe(true)
      expect(isActionCancellation("Never mind")).toBe(true)
    })
  })

  describe("4. API Route: Event Intelligence & Disambiguation", () => {
    it("auto-resolves single event if organizer has exactly 1 event", async () => {
      mockEventFindMany.mockResolvedValue([sampleEvent])
      mockRegistrationCount
        .mockResolvedValueOnce(15) // today
        .mockResolvedValueOnce(10) // yesterday
        .mockResolvedValueOnce(120) // checked in

      const req = new NextRequest("http://localhost:3000/api/assistant/asa", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "How is my event doing?" }],
        }),
      })

      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.reply).toContain("Here is how **Partners Dinner 2026** is performing")
      expect(data.metrics.totalConfirmed).toBe(350)
    })

    it("prompts for disambiguation when organizer has multiple events and query is ambiguous", async () => {
      const event2 = {
        ...sampleEvent,
        id: "evt_456",
        slug: "tech-summit-2026",
        title: "Tech Summit 2026",
        confirmedCount: 100,
      }
      mockEventFindMany.mockResolvedValue([sampleEvent, event2])

      const req = new NextRequest("http://localhost:3000/api/assistant/asa", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "How is my event doing?" }],
        }),
      })

      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.needsDisambiguation).toBe(true)
      expect(data.eventsList).toHaveLength(2)
      expect(data.reply).toContain("Which event would you like me to check?")
    })

    it("matches specific event by name when user mentions it in query", async () => {
      const event2 = {
        ...sampleEvent,
        id: "evt_456",
        slug: "tech-summit-2026",
        title: "Tech Summit 2026",
        confirmedCount: 100,
      }
      mockEventFindMany.mockResolvedValue([sampleEvent, event2])
      mockRegistrationCount
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(50)

      const req = new NextRequest("http://localhost:3000/api/assistant/asa", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "How is Tech Summit 2026 doing?" }],
        }),
      })

      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.metrics.eventTitle).toBe("Tech Summit 2026")
    })
  })

  describe("5. API Route: Management Action Execution & Confirmation Guard", () => {
    it("proposes change and DOES NOT mutate database on initial request", async () => {
      mockEventFindMany.mockResolvedValue([sampleEvent])
      mockRegistrationCount.mockResolvedValue(10)

      const req = new NextRequest("http://localhost:3000/api/assistant/asa", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "Increase capacity to 800" }],
        }),
      })

      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.pendingAction).toBeDefined()
      expect(data.pendingAction.proposedValue).toBe(800)
      expect(data.reply).toContain("Would you like me to change it to 800?")
      // Ensure update was NOT called yet
      expect(mockEventUpdate).not.toHaveBeenCalled()
    })

    it("executes change in database when user replies 'Yes' to pending action", async () => {
      mockEventFindFirst.mockResolvedValue(sampleEvent)
      mockEventUpdate.mockResolvedValue({ ...sampleEvent, capacity: 800 })
      mockRegistrationCount.mockResolvedValue(10)

      const pendingAction = {
        id: "act_1",
        eventId: "evt_123",
        eventSlug: "partners-dinner-2026",
        eventTitle: "Partners Dinner 2026",
        type: "UPDATE_CAPACITY" as const,
        fieldName: "capacity",
        currentValue: 500,
        proposedValue: 800,
        confirmationMessage: "Would you like me to change it to 800?",
        status: "proposed" as const,
      }

      const req = new NextRequest("http://localhost:3000/api/assistant/asa", {
        method: "POST",
        body: JSON.stringify({
          pendingAction,
          messages: [{ role: "user", content: "Yes" }],
        }),
      })

      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.actionExecuted).toBe(true)
      expect(mockEventUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "evt_123" },
          data: { capacity: 800 },
        })
      )
      expect(data.reply).toContain("Done! I've updated the capacity for **Partners Dinner 2026** to **800**")
    })

    it("cancels pending action and does NOT mutate database when user replies 'Cancel'", async () => {
      const pendingAction = {
        id: "act_1",
        eventId: "evt_123",
        eventSlug: "partners-dinner-2026",
        eventTitle: "Partners Dinner 2026",
        type: "UPDATE_CAPACITY" as const,
        fieldName: "capacity",
        currentValue: 500,
        proposedValue: 800,
        confirmationMessage: "Would you like me to change it to 800?",
        status: "proposed" as const,
      }

      const req = new NextRequest("http://localhost:3000/api/assistant/asa", {
        method: "POST",
        body: JSON.stringify({
          pendingAction,
          messages: [{ role: "user", content: "Cancel" }],
        }),
      })

      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.actionCancelled).toBe(true)
      expect(mockEventUpdate).not.toHaveBeenCalled()
      expect(data.reply).toContain("Understood, I've cancelled that update")
    })

    it("executes venue update via explicit execute_management_action action", async () => {
      mockEventFindFirst.mockResolvedValue(sampleEvent)
      mockEventUpdate.mockResolvedValue({ ...sampleEvent, location: "Sarit Expo Centre" })
      mockRegistrationCount.mockResolvedValue(10)

      const pendingAction = {
        id: "act_venue",
        eventId: "evt_123",
        eventSlug: "partners-dinner-2026",
        eventTitle: "Partners Dinner 2026",
        type: "UPDATE_VENUE" as const,
        fieldName: "location",
        currentValue: "Swiss Lenana",
        proposedValue: "Sarit Expo Centre",
        confirmationMessage: "Update venue?",
        status: "proposed" as const,
      }

      const req = new NextRequest("http://localhost:3000/api/assistant/asa", {
        method: "POST",
        body: JSON.stringify({
          action: "execute_management_action",
          pendingAction,
        }),
      })

      const res = await POST(req)
      const data = await res.json()

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.actionExecuted).toBe(true)
      expect(mockEventUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "evt_123" },
          data: { location: "Sarit Expo Centre" },
        })
      )
    })

    it("enforces security: denies unauthorized organizer access with 403", async () => {
      mockEventFindFirst.mockResolvedValue({
        ...sampleEvent,
        organizerId: "another_organizer_id",
      })

      const pendingAction = {
        id: "act_cap",
        eventId: "evt_123",
        eventSlug: "partners-dinner-2026",
        eventTitle: "Partners Dinner 2026",
        type: "UPDATE_CAPACITY" as const,
        fieldName: "capacity",
        currentValue: 500,
        proposedValue: 800,
        confirmationMessage: "Change capacity?",
        status: "proposed" as const,
      }

      const req = new NextRequest("http://localhost:3000/api/assistant/asa", {
        method: "POST",
        body: JSON.stringify({
          action: "execute_management_action",
          pendingAction,
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(403)
      expect(mockEventUpdate).not.toHaveBeenCalled()
    })
  })

  describe("Organizer Events Overview & Count Queries", () => {
    it("correctly identifies event count and overview intents", () => {
      expect(isOrganizerEventsOverviewQuery("How many events do I currently have?")).toBe(true)
      expect(isOrganizerEventsOverviewQuery("how many events do i have")).toBe(true)
      expect(isOrganizerEventsOverviewQuery("I asked how many events have we done?")).toBe(true)
      expect(isOrganizerEventsOverviewQuery("what events do i have")).toBe(true)
      expect(isOrganizerEventsOverviewQuery("list my events")).toBe(true)
      expect(isOrganizerEventsOverviewQuery("show my events")).toBe(true)
      expect(isOrganizerEventsOverviewQuery("my events")).toBe(true)
      expect(isOrganizerEventsOverviewQuery("events overview")).toBe(true)

      // Negative checks
      expect(isOrganizerEventsOverviewQuery("how many people registered today?")).toBe(false)
      expect(isOrganizerEventsOverviewQuery("increase capacity to 800")).toBe(false)
    })

    it("formats empty event overview gracefully", () => {
      const summary = formatOrganizerEventsOverview([])
      expect(summary).toContain("You currently don't have any events")
      expect(summary).toContain("help you create your first event")
    })

    it("formats multiple events overview with attendee totals", () => {
      const summary = formatOrganizerEventsOverview([
        {
          id: "evt_1",
          slug: "tech-summit",
          title: "Tech Summit 2026",
          confirmedCount: 350,
          capacity: 500,
          eventDate: "2026-10-15T10:00:00Z",
          status: "active",
        },
        {
          id: "evt_2",
          slug: "partners-dinner",
          title: "Partners Dinner",
          confirmedCount: 80,
          capacity: 100,
          eventDate: "2026-11-20T18:00:00Z",
          status: "active",
        },
      ])

      expect(summary).toContain("You currently have **2 events** on EventSlot")
      expect(summary).toContain("Tech Summit 2026")
      expect(summary).toContain("Partners Dinner")
      expect(summary).toContain("total of **430 registered attendees**")
    })

    it("handles conversational overview query in route.ts successfully", async () => {
      mockEventFindMany.mockResolvedValue([
        {
          id: "evt_1",
          slug: "tech-summit",
          title: "Tech Summit 2026",
          confirmedCount: 350,
          capacity: 500,
          eventDate: new Date("2026-10-15T10:00:00Z"),
          status: "active",
          location: "Nairobi",
        },
      ])

      const req = new NextRequest("http://localhost:3000/api/assistant/asa", {
        method: "POST",
        body: JSON.stringify({
          messages: [{ role: "user", content: "How many events do I currently have?" }],
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.isOverview).toBe(true)
      expect(data.reply).toContain("You currently have **1 event** on EventSlot")
      expect(data.reply).toContain("Tech Summit 2026")
      expect(data.eventsList).toHaveLength(1)
    })
  })
})
