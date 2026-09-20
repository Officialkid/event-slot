/** @jest-environment node */

import { POST as createCampaign } from "@/app/api/marketing/campaigns/route"
import { POST as createContent } from "@/app/api/marketing/content/route"
import { PATCH as updateContentStatus } from "@/app/api/marketing/content/[id]/route"
import { POST as createTrackingLink } from "@/app/api/marketing/tracking/route"
import { GET as redirectShortcode } from "@/app/l/[code]/route"
import { POST as logAttributionTouch } from "@/app/api/marketing/attribution/touch/route"
import { GET as getAnalytics } from "@/app/api/marketing/analytics/route"
import { POST as createReport } from "@/app/api/marketing/reports/route"
import { GET as getAuditLogs } from "@/app/api/marketing/audit/route"
import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { getMarketingContext } from "@/lib/marketing/rbac"
import { getServerSession } from "next-auth"

jest.mock("next-auth", () => ({
  getServerSession: jest.fn(),
}))

jest.mock("@/lib/isAdmin", () => ({
  hasAdminAccess: jest.fn(() => true),
  isAdminEmail: jest.fn(() => true),
  getConfiguredAdminEmails: jest.fn(() => ["eventslot.co@gmail.com"]),
}))

jest.mock("@/lib/marketing/gemini", () => ({
  generateMarketingCopy: jest.fn().mockResolvedValue("Exciting event coming up! Join us now. #EventSlot"),
  generateMarketingInsights: jest.fn().mockResolvedValue({
    summary: "Strong performance across LinkedIn and WhatsApp.",
    whatPerformedWell: ["High conversion on early bird"],
    whatUnderperformed: ["Twitter clicks were lower than expected"],
    recommendations: ["Increase posting frequency on LinkedIn"],
  }),
}))

let savedCampaignId = ""
let savedContentId = ""

jest.mock("@/lib/prisma", () => {
  const campaigns: any[] = []
  const contentItems: any[] = []
  const auditLogs: any[] = []
  const trackingLinks: any[] = []
  const attributionTouches: any[] = []
  const reports: any[] = []

  return {
    __esModule: true,
    default: {
      marketingCampaign: {
        create: jest.fn().mockImplementation(({ data }) => {
          const item = { id: `camp-${Date.now()}`, ...data, createdAt: new Date() }
          campaigns.push(item)
          return Promise.resolve(item)
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(campaigns)),
        findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve(campaigns.find(c => c.id === where.id))),
        count: jest.fn().mockImplementation(() => Promise.resolve(campaigns.length)),
      },
      marketingContentItem: {
        create: jest.fn().mockImplementation(({ data }) => {
          const item = { id: `content-${Date.now()}`, ...data, createdAt: new Date() }
          contentItems.push(item)
          return Promise.resolve(item)
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(contentItems)),
        findUnique: jest.fn().mockImplementation(({ where }) => Promise.resolve(contentItems.find(c => c.id === where.id))),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const item = contentItems.find(c => c.id === where.id)
          if (item) Object.assign(item, data)
          return Promise.resolve(item || { id: where.id, ...data })
        }),
        count: jest.fn().mockImplementation(() => Promise.resolve(contentItems.length)),
      },
      marketingContentAuditTrail: {
        create: jest.fn().mockResolvedValue({}),
      },
      marketingTrackingLink: {
        create: jest.fn().mockImplementation(({ data }) => {
          const item = { id: `link-${Date.now()}`, clickCount: 0, ...data, createdAt: new Date() }
          trackingLinks.push(item)
          return Promise.resolve(item)
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          return Promise.resolve(trackingLinks.find(l => l.code === where.code || l.id === where.id))
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(trackingLinks)),
        update: jest.fn().mockImplementation(({ where, data }) => {
          const item = trackingLinks.find(l => l.id === where.id)
          if (item && data.clickCount?.increment) item.clickCount += data.clickCount.increment
          return Promise.resolve(item || { id: where.id, ...data })
        }),
        count: jest.fn().mockImplementation(() => Promise.resolve(trackingLinks.length)),
      },
      marketingAttributionTouch: {
        create: jest.fn().mockImplementation(({ data }) => {
          const item = { id: `touch-${Date.now()}`, ...data, createdAt: new Date() }
          attributionTouches.push(item)
          return Promise.resolve(item)
        }),
        count: jest.fn().mockImplementation(() => Promise.resolve(attributionTouches.length)),
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(attributionTouches)),
      },
      marketingReport: {
        create: jest.fn().mockImplementation(({ data }) => {
          const item = { id: `rep-${Date.now()}`, ...data, createdAt: new Date() }
          reports.push(item)
          return Promise.resolve(item)
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(reports)),
      },
      marketingAuditLog: {
        create: jest.fn().mockImplementation(({ data }) => {
          const log = { id: `audit-${Date.now()}`, ...data, createdAt: new Date() }
          auditLogs.push(log)
          return Promise.resolve(log)
        }),
        findMany: jest.fn().mockImplementation(() => Promise.resolve(auditLogs)),
      },
      user: {
        count: jest.fn().mockResolvedValue(100),
      },
      event: {
        count: jest.fn().mockResolvedValue(25),
      },
    },
  }
})

describe("E2E Marketing Hub Lifecycle Operations", () => {
  const adminSession = {
    user: {
      id: "admin-user-id",
      email: "eventslot.co@gmail.com",
      name: "EventSlot Admin",
    },
  }

  beforeEach(() => {
    ;(getServerSession as jest.Mock).mockResolvedValue(adminSession)
  })

  it("1. Resolves sovereign Marketing Admin context for eventslot.co", async () => {
    const context = await getMarketingContext()
    expect(context).toBeDefined()
    expect(context?.role).toBe("MARKETING_ADMIN")
    expect(context?.isSuperAdmin).toBe(true)
    expect(context?.permissions.canCreateCampaign).toBe(true)
    expect(context?.permissions.canApproveContent).toBe(true)
    expect(context?.permissions.canSendBroadcast).toBe(true)
  })

  it("2. Creates a strategic marketing campaign with generated human campaignId", async () => {
    const req = new NextRequest("http://localhost:3000/api/marketing/campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: "Global Tech Summit 2026",
        objective: "Drive 500 developer registrations",
        startDate: "2026-10-01T00:00:00Z",
        targetAudience: "Tech founders, engineers, designers",
        channels: ["INSTAGRAM", "LINKEDIN", "WHATSAPP", "EMAIL"],
      }),
    })

    const res = await createCampaign(req)
    expect(res.status).toBe(201)
    const json = await res.json()

    expect(json.campaign).toBeDefined()
    expect(json.campaign.name).toBe("Global Tech Summit 2026")
    expect(json.campaign.campaignId).toMatch(/^CMP-/)
    savedCampaignId = json.campaign.id
  })

  it("3. Creates multi-channel content in DRAFT status", async () => {
    const req = new NextRequest("http://localhost:3000/api/marketing/content", {
      method: "POST",
      body: JSON.stringify({
        campaignId: savedCampaignId,
        channel: "LINKEDIN",
        contentType: "POST",
        title: "Early Bird Ticket Announcement",
        caption: "Tickets for Global Tech Summit are officially live! Register early.",
        ctaText: "Reserve Early Slot",
        destinationUrl: "https://eventsslot.com/events/tech-summit",
      }),
    })

    const res = await createContent(req)
    expect(res.status).toBe(201)
    const json = await res.json()

    expect(json.content).toBeDefined()
    expect(json.content.status).toBe("DRAFT")
    expect(json.content.channel).toBe("LINKEDIN")
    savedContentId = json.content.id
  })

  it("4. Advances content through approval pipeline (DRAFT -> IN_REVIEW -> APPROVED -> SCHEDULED)", async () => {
    // 1. Submit for review
    const reqReview = new NextRequest(`http://localhost:3000/api/marketing/content/${savedContentId}`, {
      method: "PATCH",
      body: JSON.stringify({
        workflowAction: "submit_for_review",
        notes: "Ready for manager review",
      }),
    })
    const resReview = await updateContentStatus(reqReview, { params: Promise.resolve({ id: savedContentId }) })
    expect(resReview.status).toBe(200)

    // 2. Approve
    const reqApprove = new NextRequest(`http://localhost:3000/api/marketing/content/${savedContentId}`, {
      method: "PATCH",
      body: JSON.stringify({
        workflowAction: "approve",
        notes: "Approved for publishing",
      }),
    })
    const resApprove = await updateContentStatus(reqApprove, { params: Promise.resolve({ id: savedContentId }) })
    expect(resApprove.status).toBe(200)

    // 3. Schedule
    const reqSchedule = new NextRequest(`http://localhost:3000/api/marketing/content/${savedContentId}`, {
      method: "PATCH",
      body: JSON.stringify({
        workflowAction: "schedule",
        scheduledFor: "2026-10-05T14:00:00Z",
        notes: "Approved and scheduled for dispatch",
      }),
    })
    const resSchedule = await updateContentStatus(reqSchedule, { params: Promise.resolve({ id: savedContentId }) })
    expect(resSchedule.status).toBe(200)
    const jsonSchedule = await resSchedule.json()
    expect(jsonSchedule.content.status).toBe("SCHEDULED")
  })

  it("5. Generates first-party UTM tracking shortlink", async () => {
    const req = new NextRequest("http://localhost:3000/api/marketing/tracking", {
      method: "POST",
      body: JSON.stringify({
        destinationUrl: "https://eventsslot.com/events/tech-summit",
        utmSource: "whatsapp",
        utmMedium: "chat",
        utmCampaign: "early_bird",
        customCode: "techsummit-wa",
      }),
    })

    const res = await createTrackingLink(req)
    expect(res.status).toBe(201)
    const json = await res.json()

    expect(json.link.code).toBe("techsummit-wa")
    expect(json.link.fullUrl).toContain("utm_source=whatsapp")
    expect(json.link.fullUrl).toContain("utm_medium=chat")
  })

  it("6. Redirects shortlink, records attribution touch, sets visitor cookies", async () => {
    const req = new NextRequest("http://localhost:3000/l/techsummit-wa", {
      headers: {
        referer: "https://web.whatsapp.com",
      },
    })

    const res = await redirectShortcode(req, { params: Promise.resolve({ code: "techsummit-wa" }) })

    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toContain("utm_source=whatsapp")

    const setCookies = res.headers.get("set-cookie") || ""
    expect(setCookies).toContain("es_mkt_vid=")
    expect(setCookies).toContain("es_mkt_first_touch=")
    expect(setCookies).toContain("es_mkt_last_touch=")
  })

  it("7. Logs conversion milestone (REGISTRATION_COMPLETE)", async () => {
    const req = new NextRequest("http://localhost:3000/api/marketing/attribution/touch", {
      method: "POST",
      body: JSON.stringify({
        action: "SIGNUP",
        utmSource: "whatsapp",
        metadata: { ticketTier: "VIP" },
      }),
    })

    const res = await logAttributionTouch(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.touchId).toBeDefined()
  })

  it("8. Retrieves analytics with honest attribution split", async () => {
    const req = new NextRequest("http://localhost:3000/api/marketing/analytics?range=30d")
    const res = await getAnalytics(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.kpis).toBeDefined()
    expect(json.attributionBreakdown).toBeDefined()
    expect(json.attributionBreakdown).toHaveProperty("tracked")
    expect(json.attributionBreakdown).toHaveProperty("attributed")
    expect(json.attributionBreakdown).toHaveProperty("direct")
    expect(json.attributionBreakdown).toHaveProperty("unknown")
  })

  it("9. Generates an immutable periodic marketing report with Gemini summary", async () => {
    const req = new NextRequest("http://localhost:3000/api/marketing/reports", {
      method: "POST",
      body: JSON.stringify({
        title: "Q3 Marketing Retrospective",
        reportType: "WEEKLY",
        periodStart: "2026-09-01T00:00:00Z",
        periodEnd: "2026-09-30T23:59:59Z",
      }),
    })

    const res = await createReport(req)
    expect(res.status).toBe(201)
    const json = await res.json()

    expect(json.report).toBeDefined()
    expect(json.report.aiSummary).toContain("Strong performance")
  })

  it("10. Retrieves marketing audit trail for enterprise accountability", async () => {
    const req = new NextRequest("http://localhost:3000/api/marketing/audit")
    const res = await getAuditLogs(req)
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(Array.isArray(json.logs)).toBe(true)
    expect(json.logs.length).toBeGreaterThan(0)
  })
})
