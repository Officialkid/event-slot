/** @jest-environment node */

import { middlewareHandler } from "@/middleware"
import { NextRequest } from "next/server"

function createMockRequest(urlStr: string, host: string, token: any = null) {
  const req = new NextRequest(urlStr, {
    headers: {
      host,
      "x-forwarded-host": host,
    },
  })
  ;(req as any).nextauth = { token }
  return req
}

describe("Multi-Subdomain Routing Middleware", () => {
  describe("marketing.eventsslot.com subdomain", () => {
    it("redirects unauthenticated users to /signin with callbackUrl", async () => {
      const req = createMockRequest("https://marketing.eventsslot.com/", "marketing.eventsslot.com", null)
      const res: any = await middlewareHandler(req)

      expect(res).toBeDefined()
      expect(res.status).toBe(307)
      expect(res.headers.get("location")).toContain("/signin")
      expect(res.headers.get("location")).toContain("callbackUrl=https%3A%2F%2Fmarketing.eventsslot.com%2F")
    })

    it("rewrites / to /marketing for authenticated users", async () => {
      const token = { sub: "user-1", email: "marketer@eventsslot.com" }
      const req = createMockRequest("https://marketing.eventsslot.com/", "marketing.eventsslot.com", token)
      const res: any = await middlewareHandler(req)

      expect(res).toBeDefined()
      expect(res.headers.get("x-middleware-rewrite")).toBe("https://marketing.eventsslot.com/marketing")
    })

    it("rewrites /campaigns to /marketing/campaigns", async () => {
      const token = { sub: "user-1", email: "marketer@eventsslot.com" }
      const req = createMockRequest("https://marketing.eventsslot.com/campaigns", "marketing.eventsslot.com", token)
      const res: any = await middlewareHandler(req)

      expect(res.headers.get("x-middleware-rewrite")).toBe("https://marketing.eventsslot.com/marketing/campaigns")
    })

    it("rewrites /content to /marketing/content", async () => {
      const token = { sub: "user-1", email: "marketer@eventsslot.com" }
      const req = createMockRequest("https://marketing.eventsslot.com/content", "marketing.eventsslot.com", token)
      const res: any = await middlewareHandler(req)

      expect(res.headers.get("x-middleware-rewrite")).toBe("https://marketing.eventsslot.com/marketing/content")
    })

    it("rewrites /calendar to /marketing/calendar", async () => {
      const token = { sub: "user-1", email: "marketer@eventsslot.com" }
      const req = createMockRequest("https://marketing.eventsslot.com/calendar", "marketing.eventsslot.com", token)
      const res: any = await middlewareHandler(req)

      expect(res.headers.get("x-middleware-rewrite")).toBe("https://marketing.eventsslot.com/marketing/calendar")
    })

    it("supports local development host marketing.localhost", async () => {
      const token = { sub: "user-1", email: "marketer@eventsslot.com" }
      const req = createMockRequest("http://marketing.localhost:3000/tracking", "marketing.localhost:3000", token)
      const res: any = await middlewareHandler(req)

      expect(res.headers.get("x-middleware-rewrite")).toBe("http://marketing.localhost:3000/marketing/tracking")
    })
  })

  describe("admin.eventsslot.com subdomain", () => {
    it("redirects unauthenticated users to /signin", async () => {
      const req = createMockRequest("https://admin.eventsslot.com/", "admin.eventsslot.com", null)
      const res: any = await middlewareHandler(req)

      expect(res.status).toBe(307)
      expect(res.headers.get("location")).toContain("/signin")
    })

    it("redirects non-admin users to /unauthorized", async () => {
      const token = { sub: "user-2", email: "regular@eventsslot.com", role: "USER" }
      const req = createMockRequest("https://admin.eventsslot.com/", "admin.eventsslot.com", token)
      const res: any = await middlewareHandler(req)

      expect(res.status).toBe(307)
      expect(res.headers.get("location")).toContain("/unauthorized")
    })

    it("rewrites / to /admin for eventslot.co@gmail.com sovereign admin", async () => {
      const token = { sub: "admin-1", email: "eventslot.co@gmail.com" }
      const req = createMockRequest("https://admin.eventsslot.com/", "admin.eventsslot.com", token)
      const res: any = await middlewareHandler(req)

      expect(res.headers.get("x-middleware-rewrite")).toBe("https://admin.eventsslot.com/admin")
    })

    it("rewrites /teams to /admin/teams for Super Admin", async () => {
      const token = { sub: "admin-1", email: "eventslot.co@gmail.com", role: "SUPER_ADMIN" }
      const req = createMockRequest("https://admin.eventsslot.com/teams", "admin.eventsslot.com", token)
      const res: any = await middlewareHandler(req)

      expect(res.headers.get("x-middleware-rewrite")).toBe("https://admin.eventsslot.com/admin/teams")
    })
  })

  describe("app.eventsslot.com subdomain", () => {
    it("rewrites / to /dashboard", async () => {
      const token = { sub: "user-3", email: "organizer@eventsslot.com" }
      const req = createMockRequest("https://app.eventsslot.com/", "app.eventsslot.com", token)
      const res: any = await middlewareHandler(req)

      expect(res.headers.get("x-middleware-rewrite")).toBe("https://app.eventsslot.com/dashboard")
    })

    it("rewrites /events to /my-events", async () => {
      const token = { sub: "user-3", email: "organizer@eventsslot.com" }
      const req = createMockRequest("https://app.eventsslot.com/events", "app.eventsslot.com", token)
      const res: any = await middlewareHandler(req)

      expect(res.headers.get("x-middleware-rewrite")).toBe("https://app.eventsslot.com/my-events")
    })
  })

  describe("verify.eventsslot.com subdomain", () => {
    it("rewrites / to /verify-tickets", async () => {
      const req = createMockRequest("https://verify.eventsslot.com/", "verify.eventsslot.com", null)
      const res: any = await middlewareHandler(req)

      expect(res.headers.get("x-middleware-rewrite")).toBe("https://verify.eventsslot.com/verify-tickets")
    })
  })

  describe("Main domain eventsslot.com", () => {
    it("serves root / directly without rewriting to subdomains", async () => {
      const req = createMockRequest("https://eventsslot.com/", "eventsslot.com", null)
      const res: any = await middlewareHandler(req)

      expect(res.headers.get("x-middleware-rewrite")).toBeNull()
    })
  })
})
