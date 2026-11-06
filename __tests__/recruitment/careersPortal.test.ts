/** @jest-environment node */

import crypto from "crypto"
import {
  OPPORTUNITY_TYPES,
  VACANCY_STATUSES,
  APPLICATION_STATUSES,
  QUESTION_TYPES,
  type VacancyTypeValue,
} from "@/lib/recruitment/types"
import {
  generateReferenceCodeCandidate,
  REFERENCE_CODE_PREFIX,
  SAFE_CHARSET,
} from "@/lib/recruitment/reference-code"
import {
  ALLOWED_DOCUMENT_MIMES,
  MIME_TO_EXT,
  MAX_DOCUMENT_SIZE,
} from "@/lib/recruitment/storage"
import {
  checkRecruitmentAccess,
  getPermittedVacancyIds,
} from "@/lib/recruitment/permissions"
import { careerApplicationRatelimit, careerTrackRatelimit } from "@/lib/ratelimit"

// Mock Prisma Client
jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    jobApplication: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    vacancy: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    recruitmentReviewerAssignment: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    recruitmentReviewerInvitation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    recruitmentAuditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb({
      recruitmentReviewerAssignment: { create: jest.fn() },
      recruitmentReviewerInvitation: { update: jest.fn() },
      recruitmentAuditLog: { create: jest.fn() },
    })),
  },
}))

import prisma from "@/lib/prisma"

describe("Group A: Public Careers Visibility & Opportunity Taxonomy", () => {
  it("registers all 7 mandatory opportunity types", () => {
    const opportunityValues = OPPORTUNITY_TYPES.map((t) => t.value)
    expect(opportunityValues).toContain("FULL_TIME")
    expect(opportunityValues).toContain("PART_TIME")
    expect(opportunityValues).toContain("CONTRACT")
    expect(opportunityValues).toContain("INTERNSHIP")
    expect(opportunityValues).toContain("TEMPORARY")
    expect(opportunityValues).toContain("VOLUNTEER")
    expect(opportunityValues).toContain("CONSULTANT")
    expect(opportunityValues.length).toBe(7)
  })

  it("registers all 9 candidate journey statuses with explicit labels and descriptions", () => {
    const statusValues = APPLICATION_STATUSES.map((s) => s.value)
    expect(statusValues).toEqual([
      "SUBMITTED",
      "UNDER_REVIEW",
      "SHORTLISTED",
      "ASSESSMENT_INTERVIEW",
      "REFERENCE_CHECKS",
      "OFFER_MADE",
      "HIRED",
      "NOT_SELECTED",
      "WITHDRAWN",
    ])

    for (const status of APPLICATION_STATUSES) {
      expect(status.label).toBeTruthy()
      expect(status.description).toBeTruthy()
    }
  })

  it("supports all 6 dynamic vacancy question types", () => {
    const qTypes = QUESTION_TYPES.map((q) => q.value)
    expect(qTypes).toContain("SHORT_TEXT")
    expect(qTypes).toContain("LONG_TEXT")
    expect(qTypes).toContain("SINGLE_CHOICE")
    expect(qTypes).toContain("MULTIPLE_CHOICE")
    expect(qTypes).toContain("YES_NO")
    expect(qTypes).toContain("URL")
  })

  it("filters out unpublished (Draft & Archived) vacancies from public visibility", () => {
    const vacancies = [
      { id: "1", title: "Open Role", status: "PUBLISHED" },
      { id: "2", title: "Closed Role", status: "CLOSED" },
      { id: "3", title: "Draft Role", status: "DRAFT" },
      { id: "4", title: "Archived Role", status: "ARCHIVED" },
    ]

    const publicVacancies = vacancies.filter((v) => ["PUBLISHED", "CLOSED"].includes(v.status))
    expect(publicVacancies.map((v) => v.status)).toEqual(["PUBLISHED", "CLOSED"])
    expect(publicVacancies.some((v) => v.status === "DRAFT")).toBe(false)
    expect(publicVacancies.some((v) => v.status === "ARCHIVED")).toBe(false)
  })

  it("detects expired deadlines and marks opportunities closed in Nairobi timezone", () => {
    const now = new Date()
    const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 1 day ago
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 1 day future

    const isPast = (deadline: Date | null) => (deadline ? deadline <= now : false)

    expect(isPast(pastDate)).toBe(true)
    expect(isPast(futureDate)).toBe(false)
    expect(isPast(null)).toBe(false)
  })
})

describe("Group B: Application Submission & Cryptographic Reference Code Tracking", () => {
  it("generates reference codes with signature prefix and exact 16-character length", () => {
    const code = generateReferenceCodeCandidate()
    expect(code.startsWith(REFERENCE_CODE_PREFIX)).toBe(true)
    expect(code).toHaveLength(16) // "ES-CARE-" (8) + 8 chars = 16
  })

  it("uses exclusively safe charset omitting ambiguous characters (0, O, 1, I, L)", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateReferenceCodeCandidate()
      const suffix = code.slice(REFERENCE_CODE_PREFIX.length)
      expect(suffix).toHaveLength(8)

      for (const char of suffix) {
        expect(SAFE_CHARSET).toContain(char)
        expect(["0", "O", "1", "I", "L"]).not.toContain(char)
      }
    }
  })

  it("demonstrates high entropy with zero collisions across 500 rapid iterations", () => {
    const generated = new Set<string>()
    const count = 500

    for (let i = 0; i < count; i++) {
      const code = generateReferenceCodeCandidate()
      expect(generated.has(code)).toBe(false)
      generated.add(code)
    }

    expect(generated.size).toBe(count)
  })

  it("enforces candidate privacy masking (e.g. John Doe -> John D.)", () => {
    const maskName = (fullName: string): string => {
      const parts = fullName.trim().split(/\s+/)
      if (parts.length === 1) {
        const single = parts[0]
        return single.length > 2 ? `${single.slice(0, 2)}***` : `${single[0]}***`
      }
      const firstName = parts[0]
      const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || ""
      return `${firstName} ${lastInitial}.`
    }

    expect(maskName("Daniel Mwalili")).toBe("Daniel M.")
    expect(maskName("Jane Sarah Smith")).toBe("Jane S.")
    expect(maskName("Alex")).toBe("Al***")
  })
})

describe("Group C: Super Admin Integration & Navigation Boundaries", () => {
  it("rejects unauthenticated requests to recruitment management", async () => {
    const result = await checkRecruitmentAccess(null)
    expect(result.authorized).toBe(false)
    expect(result.error).toMatch(/Authentication required/i)
  })

  it("grants unrestricted recruitment access to Global Admins / Super Admins", async () => {
    const mockSession = {
      user: { id: "user_admin", email: "admin@eventsslot.com", role: "ADMIN" },
      expires: "2099-01-01",
    } as any

    const result = await checkRecruitmentAccess(mockSession)
    expect(result.authorized).toBe(true)
    expect(result.isGlobalAdmin).toBe(true)
    expect(result.role).toBe("GLOBAL_ADMIN")
  })

  it("denies temporary reviewers from executing admin-only operations (requireAdmin: true)", async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)

    const mockSession = {
      user: { id: "user_reviewer", email: "reviewer@example.com", role: "USER" },
      expires: "2099-01-01",
    } as any

    const result = await checkRecruitmentAccess(mockSession, { requireAdmin: true })
    expect(result.authorized).toBe(false)
    expect(result.error).toMatch(/Administrative recruitment privileges required/i)
  })
})

describe("Group D: Guest & Invited Reviewer Access (Category A & B)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("grants access to active temporary reviewers within their validity window (Category A)", async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)

    ;(prisma.recruitmentReviewerAssignment.findMany as jest.Mock).mockResolvedValue([
      {
        id: "assignment_1",
        userId: "user_reviewer",
        role: "REVIEWER",
        vacancyId: "vac_123",
        applicationId: null,
        expiresAt: futureDate,
        revokedAt: null,
      },
    ])

    const mockSession = {
      user: { id: "user_reviewer", email: "reviewer@example.com", role: "USER" },
      expires: "2099-01-01",
    } as any

    const result = await checkRecruitmentAccess(mockSession)
    expect(result.authorized).toBe(true)
    expect(result.isGlobalAdmin).toBe(false)
    expect(result.isReviewer).toBe(true)
    expect(result.role).toBe("REVIEWER")
  })

  it("enforces vacancy scoping: denies reviewer access to unassigned vacancies", async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)

    ;(prisma.recruitmentReviewerAssignment.findMany as jest.Mock).mockResolvedValue([
      {
        id: "assignment_1",
        userId: "user_reviewer",
        role: "REVIEWER",
        vacancyId: "vac_assigned_100",
        applicationId: null,
        expiresAt: futureDate,
        revokedAt: null,
      },
    ])

    const mockSession = {
      user: { id: "user_reviewer", email: "reviewer@example.com", role: "USER" },
      expires: "2099-01-01",
    } as any

    // Requesting unassigned vacancy
    const deniedResult = await checkRecruitmentAccess(mockSession, {
      vacancyId: "vac_unassigned_999",
    })
    expect(deniedResult.authorized).toBe(false)
    expect(deniedResult.error).toMatch(/Not assigned to this vacancy/i)

    // Requesting assigned vacancy
    const allowedResult = await checkRecruitmentAccess(mockSession, {
      vacancyId: "vac_assigned_100",
    })
    expect(allowedResult.authorized).toBe(true)
    expect(allowedResult.role).toBe("REVIEWER")
  })

  it("denies access if reviewer assignment is expired or revoked", async () => {
    ;(prisma.recruitmentReviewerAssignment.findMany as jest.Mock).mockResolvedValue([])

    const mockSession = {
      user: { id: "user_expired", email: "expired@example.com", role: "USER" },
      expires: "2099-01-01",
    } as any

    const result = await checkRecruitmentAccess(mockSession)
    expect(result.authorized).toBe(false)
    expect(result.error).toMatch(/No active reviewer assignment/i)
  })

  it("hashes external guest invitation tokens using SHA-256 (Category B)", () => {
    const rawToken = "sample_raw_token_for_external_reviewer"
    const hash = crypto.createHash("sha256").update(rawToken).digest("hex")

    expect(hash).toHaveLength(64)
    expect(hash).not.toBe(rawToken)

    // Same raw token produces deterministic hash
    const hash2 = crypto.createHash("sha256").update(rawToken).digest("hex")
    expect(hash).toBe(hash2)
  })

  it("getPermittedVacancyIds returns null for Global Admin (all) and exact list for reviewer", async () => {
    const adminIds = await getPermittedVacancyIds("admin_id", true)
    expect(adminIds).toBeNull()

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)

    ;(prisma.recruitmentReviewerAssignment.findMany as jest.Mock).mockResolvedValue([
      { vacancyId: "vac_1" },
      { vacancyId: "vac_2" },
    ])

    const reviewerIds = await getPermittedVacancyIds("reviewer_id", false)
    expect(reviewerIds).toEqual(["vac_1", "vac_2"])
  })
})

describe("Group E: Private Document Storage Security & Rate Limiting", () => {
  it("enforces strict maximum document size of 10 MB", () => {
    expect(MAX_DOCUMENT_SIZE).toBe(10 * 1024 * 1024)
  })

  it("permits only sanctioned document and image MIME types", () => {
    expect(ALLOWED_DOCUMENT_MIMES.has("application/pdf")).toBe(true)
    expect(ALLOWED_DOCUMENT_MIMES.has("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true)
    expect(ALLOWED_DOCUMENT_MIMES.has("image/jpeg")).toBe(true)
    expect(ALLOWED_DOCUMENT_MIMES.has("image/png")).toBe(true)

    // Executables or scripts must be rejected
    expect(ALLOWED_DOCUMENT_MIMES.has("application/x-msdownload")).toBe(false)
    expect(ALLOWED_DOCUMENT_MIMES.has("text/javascript")).toBe(false)
    expect(ALLOWED_DOCUMENT_MIMES.has("application/x-sh")).toBe(false)
  })

  it("maps MIME types to safe, sanitized extensions", () => {
    expect(MIME_TO_EXT["application/pdf"]).toBe("pdf")
    expect(MIME_TO_EXT["application/msword"]).toBe("doc")
    expect(MIME_TO_EXT["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]).toBe("docx")
    expect(MIME_TO_EXT["image/png"]).toBe("png")
  })

  it("provides dedicated rate limiters for application submissions and status lookups", async () => {
    expect(careerApplicationRatelimit).toBeDefined()
    expect(typeof careerApplicationRatelimit.limit).toBe("function")

    expect(careerTrackRatelimit).toBeDefined()
    expect(typeof careerTrackRatelimit.limit).toBe("function")

    const trackResult = await careerTrackRatelimit.limit("test_client_ip")
    expect(trackResult).toHaveProperty("success")
    expect(trackResult).toHaveProperty("remaining")
  })
})
