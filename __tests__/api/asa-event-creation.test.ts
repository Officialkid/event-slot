/** @jest-environment node */

import {
  extractBasicEventDetailsFromText,
  isConfirmationPhrase,
  processAsaConversation,
  type AsaEventDraft,
} from "@/lib/asa/asa-engine"

const mockGetServerSession = jest.fn()
const mockCanCreateEvent = jest.fn()
const mockEventCreate = jest.fn()
const mockProcessFirstEventReferral = jest.fn()

jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}))

jest.mock("@/lib/auth", () => ({
  authOptions: {},
}))

jest.mock("@/lib/planEnforcement", () => ({
  canCreateEvent: (...args: unknown[]) => mockCanCreateEvent(...args),
}))

jest.mock("@/lib/referral", () => ({
  processFirstEventReferral: (...args: unknown[]) => mockProcessFirstEventReferral(...args),
}))

jest.mock("@/lib/ai", () => ({
  askAIWithMeta: jest.fn().mockImplementation(async ({ prompt }: { prompt: string }) => {
    if (prompt.includes("Partners Dinner 2026")) {
      return {
        content: JSON.stringify({
          reply: "Here's what I have:\n\nEvent: Partners Dinner 2026\nDate: 3 October 2026\nTime: 3:00 PM – 6:00 PM\nVenue: Swiss Lenana\nCapacity: 500\n\nWould you like me to create this event?",
          extractedDraft: {
            title: "Partners Dinner 2026",
            displayDate: "3 October 2026",
            displayTime: "3:00 PM – 6:00 PM",
            location: "Swiss Lenana",
            capacity: 500,
          },
          missingFields: [],
          readyForReview: true,
          confirmedToCreate: false,
        }),
      }
    }
    return {
      content: JSON.stringify({
        reply: "Absolutely. Let's create it together. What would you like to call your event?",
        extractedDraft: {},
        missingFields: ["event name"],
        readyForReview: false,
        confirmedToCreate: false,
      }),
    }
  }),
}))

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    event: {
      create: (...args: unknown[]) => mockEventCreate(...args),
    },
  },
  prisma: {
    event: {
      create: (...args: unknown[]) => mockEventCreate(...args),
    },
  },
}))

describe("ASA Event Creation Assistant", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCanCreateEvent.mockResolvedValue({ allowed: true })
    mockProcessFirstEventReferral.mockResolvedValue(undefined)
  })

  describe("Entity Extraction & Rule Helpers", () => {
    it("extracts all details from a single comprehensive prompt (Flow 1)", () => {
      const text =
        "I want to create an event called Partners Dinner 2026. It will be on 3 October 2026 at Swiss Lenana, from 3 PM to 6 PM, with a capacity of 500 people."
      const extracted = extractBasicEventDetailsFromText(text)

      expect(extracted.title).toBe("Partners Dinner 2026")
      expect(extracted.location).toBe("Swiss Lenana")
      expect(extracted.capacity).toBe(500)
      expect(extracted.displayTime).toBe("3 PM – 6 PM")
      expect(extracted.displayDate).toBe("3 October 2026")
    })

    it("extracts venue and capacity corrections accurately", () => {
      const draft: Partial<AsaEventDraft> = {
        title: "Partners Dinner 2026",
        capacity: 500,
        location: "Swiss Lenana",
      }

      const updatedCap = extractBasicEventDetailsFromText("Change the capacity to 700", draft)
      expect(updatedCap.capacity).toBe(700)
      expect(updatedCap.title).toBe("Partners Dinner 2026")

      const updatedVenue = extractBasicEventDetailsFromText(
        "Actually, change the venue to Sarit Expo Centre",
        draft
      )
      expect(updatedVenue.location).toBe("Sarit Expo Centre")
      expect(updatedVenue.title).toBe("Partners Dinner 2026")
    })

    it("identifies confirmation phrases reliably", () => {
      expect(isConfirmationPhrase("Yes")).toBe(true)
      expect(isConfirmationPhrase("Create it")).toBe(true)
      expect(isConfirmationPhrase("Yes, create it!")).toBe(true)
      expect(isConfirmationPhrase("Looks good")).toBe(true)
      expect(isConfirmationPhrase("Go ahead")).toBe(true)
      expect(isConfirmationPhrase("Change capacity to 800")).toBe(false)
      expect(isConfirmationPhrase("What time does it start?")).toBe(false)
    })
  })

  describe("processAsaConversation Flow Logic", () => {
    it("guides an organizer who does not know what to provide step-by-step (Flow 2)", async () => {
      const result = await processAsaConversation({
        messages: [{ role: "user", content: "Help me create an event." }],
        currentDraft: { status: "collecting" },
      })

      expect(result.isReviewState).toBe(false)
      expect(result.isConfirmedState).toBe(false)
      expect(result.reply).toContain("call your event")
    })

    it("presents the review summary when all core information is present", async () => {
      const result = await processAsaConversation({
        messages: [
          {
            role: "user",
            content:
              "I want to create an event called Partners Dinner 2026. It will be on 3 October 2026 at Swiss Lenana, from 3 PM to 6 PM, with a capacity of 500 people.",
          },
        ],
        currentDraft: { status: "collecting" },
      })

      expect(result.isReviewState).toBe(true)
      expect(result.isConfirmedState).toBe(false)
      expect(result.draft.title).toBe("Partners Dinner 2026")
      expect(result.draft.location).toBe("Swiss Lenana")
      expect(result.draft.capacity).toBe(500)
      expect(result.reply).toContain("Here's what I have:")
      expect(result.reply).toContain("Partners Dinner 2026")
      expect(result.reply).toContain("Would you like me to create this event?")
    })

    it("marks draft as confirmed when user confirms a ready review draft", async () => {
      const readyDraft: AsaEventDraft = {
        title: "Partners Dinner 2026",
        displayDate: "3 October 2026",
        displayTime: "3 PM – 6 PM",
        location: "Swiss Lenana",
        capacity: 500,
        status: "ready_for_review",
      }

      const result = await processAsaConversation({
        messages: [{ role: "user", content: "Yes, create it!" }],
        currentDraft: readyDraft,
      })

      expect(result.isConfirmedState).toBe(true)
      expect(result.draft.status).toBe("confirmed")
    })
  })

  describe("API Route: /api/assistant/asa", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null)

      const { POST } = await import("@/app/api/assistant/asa/route")
      const req = new Request("http://localhost:3000/api/assistant/asa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }),
      })

      const res = await POST(req as any)
      expect(res.status).toBe(401)
      const data = await res.json()
      expect(data.error).toContain("Unauthorized")
    })

    it("creates the event in Prisma when confirmed by authorized organizer", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "organizer-123", name: "Daniel Organizer", email: "organizer@example.com" },
      })

      mockEventCreate.mockResolvedValue({
        id: "evt-asa-1",
        title: "Partners Dinner 2026",
        slug: "partners-dinner-2026-x9z1",
        location: "Swiss Lenana",
        capacity: 500,
        eventDate: new Date("2026-10-03T15:00:00.000Z"),
      })

      const { POST } = await import("@/app/api/assistant/asa/route")
      const req = new Request("http://localhost:3000/api/assistant/asa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_create",
          draft: {
            title: "Partners Dinner 2026",
            displayDate: "3 October 2026",
            displayTime: "3 PM – 6 PM",
            location: "Swiss Lenana",
            capacity: 500,
            status: "ready_for_review",
          },
        }),
      })

      const res = await POST(req as any)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.created).toBe(true)
      expect(data.event.title).toBe("Partners Dinner 2026")
      expect(data.event.dashboardUrl).toContain("/dashboard/events/partners-dinner-2026-x9z1")
      expect(mockEventCreate).toHaveBeenCalledTimes(1)
      const createCall = mockEventCreate.mock.calls[0][0]
      expect(createCall.data.title).toBe("Partners Dinner 2026")
      expect(createCall.data.organizerId).toBe("organizer-123")
      expect(createCall.data.questions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ label: "Full Name", required: true }),
        ])
      )
    })
  })
})
