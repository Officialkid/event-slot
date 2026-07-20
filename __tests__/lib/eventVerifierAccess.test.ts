import { hasDashboardOrVerifierToken } from "@/lib/eventVerifierAccess"
import { normalizeVerifierCode } from "@/lib/verifierCode"

describe("event verifier access", () => {
  const event = {
    dashboardToken: "dashboard-secret",
    verifierCode: "EV-12AB34CD",
    verifierCodeEnabled: true,
  }

  it("accepts the private dashboard token for organiser scanner flows", () => {
    expect(hasDashboardOrVerifierToken("dashboard-secret", event)).toBe(true)
  })

  it("accepts the public verifier code only when enabled", () => {
    expect(hasDashboardOrVerifierToken(" ev-12ab34cd ", event)).toBe(true)
    expect(hasDashboardOrVerifierToken("EV-12AB34CD", { ...event, verifierCodeEnabled: false })).toBe(false)
  })

  it("rejects missing or unrelated values", () => {
    expect(hasDashboardOrVerifierToken("", event)).toBe(false)
    expect(hasDashboardOrVerifierToken("EV-NOTTHIS", event)).toBe(false)
  })

  it("normalizes shared verifier codes for copy/paste", () => {
    expect(normalizeVerifierCode(" ev-12 ab34cd ")).toBe("EV-12AB34CD")
  })
})
