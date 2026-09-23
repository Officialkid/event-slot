/** @jest-environment node */

import {
  generateRegistrationQuestionsForEvent,
  processAsaFormConversation,
  formatQuestionsForReview,
  isFormApprovalPhrase,
  type AsaFormProposal,
  type AsaFormQuestion,
} from "@/lib/asa/asa-engine"

const mockGetServerSession = jest.fn()
const mockCanCreateEvent = jest.fn()
const mockEventFindFirst = jest.fn()
const mockEventUpdate = jest.fn()

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
  askAIWithMeta: jest.fn().mockImplementation(async ({ prompt }: { prompt: string }) => {
    return {
      content: JSON.stringify({
        reply: "I've updated the registration questions based on your request.",
        questions: [
          { id: "q1", label: "Full Name", type: "text", required: true },
          { id: "q2", label: "Email Address", type: "email", required: true },
          { id: "q3", label: "Do you need accommodation?", type: "select", options: ["No", "Yes"], required: false },
        ],
        approved: false,
      }),
    }
  }),
}))

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    event: {
      create: jest.fn(),
      findFirst: (...args: unknown[]) => mockEventFindFirst(...args),
      update: (...args: unknown[]) => mockEventUpdate(...args),
    },
  },
}))

// Import route dynamically after mocks are configured
import { POST } from "@/app/api/assistant/asa/route"
import { NextRequest } from "next/server"

describe("ASA Registration Form Intelligence Engine", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCanCreateEvent.mockResolvedValue({ allowed: true })
  })

  describe("Contextual Question Generation", () => {
    it("generates conference-specific questions including conditional organization fields and track preference", () => {
      const questions = generateRegistrationQuestionsForEvent({
        title: "East Africa Tech Summit 2026",
        category: "Conferences & Summits",
        venue: "KICC Nairobi",
        capacity: 1000,
      })

      // Standard core fields
      expect(questions.some((q) => q.label === "Full Name" && q.required)).toBe(true)
      expect(questions.some((q) => q.label === "Email Address" && q.type === "email")).toBe(true)
      expect(questions.some((q) => q.label === "Phone Number" && q.type === "phone")).toBe(true)

      // Conditional attendance question
      const attendanceQ = questions.find((q) => q.id === "q_attendance_type")
      expect(attendanceQ).toBeDefined()
      expect(attendanceQ?.type).toBe("select")
      expect(attendanceQ?.options).toEqual(["Individual", "Organization"])

      // Dependent organization fields
      const orgQ = questions.find((q) => q.id === "q_org")
      expect(orgQ).toBeDefined()
      expect(orgQ?.condition).toEqual({ questionId: "q_attendance_type", value: "Organization" })

      const jobQ = questions.find((q) => q.id === "q_job_title")
      expect(jobQ).toBeDefined()
      expect(jobQ?.condition).toEqual({ questionId: "q_attendance_type", value: "Organization" })

      // Track selection
      const trackQ = questions.find((q) => q.id === "q_track")
      expect(trackQ).toBeDefined()
      expect(trackQ?.type).toBe("select")
    })

    it("generates networking dinner-specific questions including dietary requirements", () => {
      const questions = generateRegistrationQuestionsForEvent({
        title: "Partners Dinner 2026",
        category: "Business & Networking",
        venue: "Swiss Lenana",
        capacity: 500,
      })

      expect(questions.some((q) => q.label === "Full Name")).toBe(true)
      expect(questions.some((q) => q.label === "Email Address")).toBe(true)
      expect(questions.some((q) => q.label === "Phone Number")).toBe(true)

      const dietaryQ = questions.find((q) => q.id === "q_dietary")
      expect(dietaryQ).toBeDefined()
      expect(dietaryQ?.type).toBe("select")
      expect(dietaryQ?.options).toContain("Vegetarian")
      expect(dietaryQ?.options).toContain("Halal")
      expect(dietaryQ?.options).toContain("Vegan")
    })

    it("generates workshop-specific questions including experience level and learning goals", () => {
      const questions = generateRegistrationQuestionsForEvent({
        title: "Next.js & AI Masterclass",
        category: "Workshops & Masterclasses",
        venue: "iHub Nairobi",
        capacity: 50,
      })

      const expQ = questions.find((q) => q.id === "q_experience")
      expect(expQ).toBeDefined()
      expect(expQ?.options).toEqual(["Beginner", "Intermediate", "Advanced"])

      const goalQ = questions.find((q) => q.id === "q_learning_goal")
      expect(goalQ).toBeDefined()
      expect(goalQ?.type).toBe("textarea")
    })

    it("respects minimal prompt requests and avoids unnecessary bloated forms", () => {
      const questions = generateRegistrationQuestionsForEvent({
        title: "Casual Community Meetup",
        customPrompt: "keep it minimal, only name and email",
      })

      expect(questions.length).toBe(2)
      expect(questions[0].label).toBe("Full Name")
      expect(questions[1].label).toBe("Email Address")
    })

    it("contextually adds accommodation assistance when requested in prompt", () => {
      const questions = generateRegistrationQuestionsForEvent({
        title: "Regional Founders Retreat",
        customPrompt: "ask if they need accommodation assistance",
      })

      const accQ = questions.find((q) => q.id === "q_accommodation")
      expect(accQ).toBeDefined()
      expect(accQ?.type).toBe("select")
      expect(accQ?.options).toEqual(["No", "Yes"])
    })
  })

  describe("Conversational Form Refinement & Formatting", () => {
    const baseProposal: AsaFormProposal = {
      eventId: "event_123",
      eventTitle: "Tech Summit 2026",
      status: "proposed",
      questions: [
        { id: "q1", label: "Full Name", type: "text", required: true },
        { id: "q2", label: "Email Address", type: "email", required: true },
        { id: "q3", label: "Phone Number", type: "phone", required: true },
        { id: "q4", label: "Organization", type: "text", required: false },
        { id: "q5", label: "Dietary Requirements", type: "select", options: ["None", "Veg"], required: false },
      ],
    }

    it("formats review questions clearly with types and requirement tags", () => {
      const reviewText = formatQuestionsForReview(baseProposal.questions, "Tech Summit 2026")
      expect(reviewText).toContain("1. Full Name [Short text, required]")
      expect(reviewText).toContain("2. Email Address [Email, required]")
      expect(reviewText).toContain("Would you like me to apply these questions to your registration form?")
    })

    it("handles removing a question by number and updates the list", async () => {
      const result = await processAsaFormConversation({
        messages: [{ role: "user", content: "Remove question 5" }],
        proposal: baseProposal,
      })

      expect(result.proposal.questions.length).toBe(4)
      expect(result.proposal.questions.some((q) => q.label === "Dietary Requirements")).toBe(false)
      expect(result.reply).toContain('removed question 5 ("Dietary Requirements")')
      expect(result.isReadyToApply).toBe(false)
    })

    it("handles adding an accommodation question", async () => {
      const result = await processAsaFormConversation({
        messages: [{ role: "user", content: "Add a question asking whether they need accommodation" }],
        proposal: baseProposal,
      })

      expect(result.proposal.questions.length).toBe(6)
      const acc = result.proposal.questions.find((q) => q.label.includes("accommodation"))
      expect(acc).toBeDefined()
      expect(result.reply).toContain("added")
    })

    it("handles toggling required status", async () => {
      const result = await processAsaFormConversation({
        messages: [{ role: "user", content: "Make question 4 required" }],
        proposal: baseProposal,
      })

      const q4 = result.proposal.questions.find((q) => q.id === "q4")
      expect(q4?.required).toBe(true)
      expect(result.reply).toContain('question 4 ("Organization") to required')
    })

    it("detects approval phrases accurately without saving immediately", () => {
      expect(isFormApprovalPhrase("yes")).toBe(true)
      expect(isFormApprovalPhrase("apply these questions")).toBe(true)
      expect(isFormApprovalPhrase("save form")).toBe(true)
      expect(isFormApprovalPhrase("looks good")).toBe(true)
      expect(isFormApprovalPhrase("random question")).toBe(false)
    })
  })

  describe("API Route Security & Registration Form Persistence", () => {
    it("returns 401 when user is not authenticated", async () => {
      mockGetServerSession.mockResolvedValue(null)

      const req = new NextRequest("http://localhost:3000/api/assistant/asa", {
        method: "POST",
        body: JSON.stringify({ action: "propose_questions", eventId: "ev_123" }),
      })

      const res = await POST(req)
      expect(res.status).toBe(401)
    })

    it("returns 403 Forbidden when organizer does not own the event", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user_attacker", email: "attacker@test.com", name: "Attacker" },
      })

      mockEventFindFirst.mockResolvedValue({
        id: "ev_victim",
        slug: "victim-event",
        title: "Victim Gala",
        organizerId: "user_victim",
      })

      const req = new NextRequest("http://localhost:3000/api/assistant/asa", {
        method: "POST",
        body: JSON.stringify({ action: "propose_questions", eventId: "ev_victim" }),
      })

      const res = await POST(req)
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toContain("Forbidden")
    })

    it("proposes questions for authorized organizer and does NOT modify database", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user_owner", email: "owner@test.com", name: "Event Owner" },
      })

      mockEventFindFirst.mockResolvedValue({
        id: "ev_owner",
        slug: "partners-dinner-2026",
        title: "Partners Dinner 2026",
        category: "Networking",
        location: "Swiss Lenana",
        capacity: 500,
        organizerId: "user_owner",
      })

      const req = new NextRequest("http://localhost:3000/api/assistant/asa", {
        method: "POST",
        body: JSON.stringify({ action: "propose_questions", eventId: "ev_owner" }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()

      expect(data.success).toBe(true)
      expect(data.proposal).toBeDefined()
      expect(data.proposal.status).toBe("proposed")
      expect(data.proposal.questions.some((q: AsaFormQuestion) => q.label === "Dietary Requirements")).toBe(true)

      // Ensure database was NOT modified during proposal
      expect(mockEventUpdate).not.toHaveBeenCalled()
    })

    it("applies and persists questions to Prisma ONLY when explicitly confirmed via apply_questions", async () => {
      mockGetServerSession.mockResolvedValue({
        user: { id: "user_owner", email: "owner@test.com", name: "Event Owner" },
      })

      mockEventFindFirst.mockResolvedValue({
        id: "ev_owner",
        slug: "partners-dinner-2026",
        title: "Partners Dinner 2026",
        organizerId: "user_owner",
      })

      mockEventUpdate.mockResolvedValue({
        id: "ev_owner",
        slug: "partners-dinner-2026",
      })

      const questionsToApply: AsaFormQuestion[] = [
        { id: "q1", label: "Full Name", type: "text", required: true },
        { id: "q2", label: "Email Address", type: "email", required: true },
        { id: "q3", label: "Dietary Requirements", type: "select", options: ["None", "Halal"], required: true },
      ]

      const req = new NextRequest("http://localhost:3000/api/assistant/asa", {
        method: "POST",
        body: JSON.stringify({
          action: "apply_questions",
          eventId: "ev_owner",
          questions: questionsToApply,
        }),
      })

      const res = await POST(req)
      expect(res.status).toBe(200)
      const data = await res.json()

      expect(data.success).toBe(true)
      expect(data.applied).toBe(true)
      expect(data.proposal.status).toBe("applied")

      // Verify Prisma was called with finalized questions
      expect(mockEventUpdate).toHaveBeenCalledWith({
        where: { id: "ev_owner" },
        data: {
          questions: expect.arrayContaining([
            expect.objectContaining({ label: "Full Name", type: "text", required: true }),
            expect.objectContaining({ label: "Dietary Requirements", type: "select", options: ["None", "Halal"] }),
          ]),
        },
      })
    })
  })
})
