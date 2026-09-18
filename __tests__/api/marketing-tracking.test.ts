/** @jest-environment node */

import { POST as createTrackingLink } from "@/app/api/marketing/tracking/route"
import { GET as redirectShortcode } from "@/app/l/[code]/route"
import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { requireMarketingContext } from "@/lib/marketing/rbac"

jest.mock("@/lib/marketing/rbac", () => ({
  requireMarketingContext: jest.fn(),
}))

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    marketingTrackingLink: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    marketingAttributionTouch: {
      create: jest.fn(),
    },
    marketingAuditLog: {
      create: jest.fn(),
    },
  },
}))

describe("Marketing Tracking API - POST /api/marketing/tracking", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns 400 when required UTM fields are missing", async () => {
    ;(requireMarketingContext as jest.Mock).mockResolvedValue({
      context: { userId: "user-1", email: "marketer@eventsslot.com" },
    })

    const req = new NextRequest("http://localhost:3000/api/marketing/tracking", {
      method: "POST",
      body: JSON.stringify({ destinationUrl: "https://eventsslot.com/pricing" }),
    })

    const res = await createTrackingLink(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toContain("required")
  })

  it("constructs full UTM url and saves tracking link", async () => {
    ;(requireMarketingContext as jest.Mock).mockResolvedValue({
      context: { userId: "user-1", email: "marketer@eventsslot.com" },
    })

    ;(prisma.marketingTrackingLink.findUnique as jest.Mock).mockResolvedValue(null)
    ;(prisma.marketingTrackingLink.create as jest.Mock).mockImplementation(({ data }) =>
      Promise.resolve({ id: "link-123", ...data })
    )
    ;(prisma.marketingAuditLog.create as jest.Mock).mockResolvedValue({})

    const req = new NextRequest("http://localhost:3000/api/marketing/tracking", {
      method: "POST",
      body: JSON.stringify({
        destinationUrl: "https://eventsslot.com/events/tech-summit",
        utmSource: "linkedin",
        utmMedium: "social",
        utmCampaign: "spring_launch",
        utmContent: "banner_v1",
        customCode: "tech-summit-li",
      }),
    })

    const res = await createTrackingLink(req)
    expect(res.status).toBe(201)
    const json = await res.json()

    expect(json.link).toBeDefined()
    expect(json.link.code).toBe("tech-summit-li")
    expect(json.link.utmSource).toBe("linkedin")
    expect(json.link.utmMedium).toBe("social")
    expect(json.link.utmCampaign).toBe("spring_launch")
    expect(json.link.fullUrl).toContain("utm_source=linkedin")
    expect(json.link.fullUrl).toContain("utm_campaign=spring_launch")
    expect(json.link.fullUrl).toContain("utm_content=banner_v1")
    expect(prisma.marketingAuditLog.create).toHaveBeenCalled()
  })
})

describe("Marketing Shortlink Redirect - GET /l/[code]", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("redirects to / when tracking link does not exist", async () => {
    ;(prisma.marketingTrackingLink.findUnique as jest.Mock).mockResolvedValue(null)

    const req = new NextRequest("http://localhost:3000/l/unknown-link")
    const res = await redirectShortcode(req, { params: Promise.resolve({ code: "unknown-link" }) })

    expect(res.status).toBe(307) // Next.js NextResponse.redirect default temporary redirect
    expect(res.headers.get("location")).toBe("http://localhost:3000/")
  })

  it("increments click count, logs attribution touch, sets visitor cookies, and redirects to fullUrl", async () => {
    const mockLink = {
      id: "link-456",
      code: "promo2026",
      destinationUrl: "https://eventsslot.com/signup",
      fullUrl: "https://eventsslot.com/signup?utm_source=instagram&utm_medium=bio&utm_campaign=launch",
      utmSource: "instagram",
      utmMedium: "bio",
      utmCampaign: "launch",
      utmContent: null,
      utmTerm: null,
      utmId: null,
    }

    ;(prisma.marketingTrackingLink.findUnique as jest.Mock).mockResolvedValue(mockLink)
    ;(prisma.marketingTrackingLink.update as jest.Mock).mockResolvedValue({})
    ;(prisma.marketingAttributionTouch.create as jest.Mock).mockResolvedValue({})

    const req = new NextRequest("http://localhost:3000/l/promo2026", {
      headers: {
        referer: "https://instagram.com",
      },
    })

    const res = await redirectShortcode(req, { params: Promise.resolve({ code: "promo2026" }) })

    expect(res.status).toBe(302)
    expect(res.headers.get("location")).toBe(mockLink.fullUrl)
    expect(prisma.marketingTrackingLink.update).toHaveBeenCalledWith({
      where: { id: "link-456" },
      data: { clickCount: { increment: 1 } },
    })
    expect(prisma.marketingAttributionTouch.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trackingLinkId: "link-456",
          utmSource: "instagram",
          touchType: "SESSION_TOUCH",
          conversionAction: "CLICK",
        }),
      })
    )

    // Verify cookies set
    const setCookieHeader = res.headers.get("set-cookie") || ""
    expect(setCookieHeader).toContain("es_mkt_vid=")
    expect(setCookieHeader).toContain("es_mkt_first_touch=")
    expect(setCookieHeader).toContain("es_mkt_last_touch=")
  })
})
