import { readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

describe("standalone verifier access-code flow", () => {
  it("keeps verifier host routing separate from dashboard routes", () => {
    const nextConfig = readFileSync(path.join(root, "next.config.mjs"), "utf8")

    expect(nextConfig).toContain("verify.eventsslot.com")
    expect(nextConfig).toContain("verify.www.eventsslot.com")
    expect(nextConfig).toContain("destination: '/verify-tickets'")
  })

  it("uses verifier codes without exposing dashboard tokens on the verifier landing", () => {
    const landing = readFileSync(path.join(root, "app/verify-tickets/page.tsx"), "utf8")
    const accessForm = readFileSync(path.join(root, "components/verify/VerifyAccessForm.tsx"), "utf8")
    const accessRoute = readFileSync(path.join(root, "app/api/verify-tickets/access/route.ts"), "utf8")

    expect(landing).toContain("<VerifyAccessForm")
    expect(accessForm).toContain("/api/verify-tickets/access")
    expect(accessForm).toContain("event verifier code")
    expect(accessRoute).toContain("verifierCode")
    expect(accessRoute).not.toContain("dashboardToken")
  })

  it("lets only scanner APIs accept verifier tokens", () => {
    const verifyRoute = readFileSync(path.join(root, "app/api/events/[slug]/verify-ticket/route.ts"), "utf8")
    const lookupRoute = readFileSync(path.join(root, "app/api/events/[slug]/verify-ticket/lookup/route.ts"), "utf8")
    const eventRoute = readFileSync(path.join(root, "app/api/events/[slug]/route.ts"), "utf8")

    expect(verifyRoute).toContain("hasDashboardOrVerifierToken")
    expect(lookupRoute).toContain("hasDashboardOrVerifierToken")
    expect(eventRoute).toContain("const hasValidToken = !!(token && event.dashboardToken === token)")
  })
})
