import { readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

describe("dashboard theme coverage", () => {
  it("keeps the event management page on semantic theme tokens", () => {
    const eventsPage = readFileSync(
      path.join(root, "app/(organizer)/dashboard/events/page.tsx"),
      "utf8"
    )

    expect(eventsPage).toContain("var(--text-primary)")
    expect(eventsPage).toContain("var(--surface)")
    expect(eventsPage).not.toMatch(/#(?:141414|1A1A1A|F0EDE6)/i)
    expect(eventsPage).not.toContain("rgba(240,237,230")
  })

  it.each([
    "app/(organizer)/dashboard/_shell.tsx",
    "app/(organizer)/dashboard/feedback/page.tsx",
    "app/(organizer)/dashboard/page.tsx",
    "app/(organizer)/dashboard/insights/page.tsx",
    "app/(organizer)/dashboard/notifications/page.tsx",
    "app/(organizer)/dashboard/profile/page.tsx",
    "app/(organizer)/dashboard/team/page.tsx",
    "components/dashboard/SidebarInstallPrompt.tsx",
  ])("keeps %s free from dark-only neutral palette values", (relativePath) => {
    const source = readFileSync(path.join(root, relativePath), "utf8")

    expect(source).toMatch(/var\(--(?:text|bg|surface|border)/)
    expect(source).not.toMatch(/#(?:111(?:111)?|121212|141414|1A1A1A|F0EDE6)/i)
    expect(source).not.toContain("rgba(240,237,230")
  })

  it("refreshes the sidebar identity from the profile source of truth", () => {
    const shell = readFileSync(
      path.join(root, "app/(organizer)/dashboard/_shell.tsx"),
      "utf8"
    )
    const profile = readFileSync(
      path.join(root, "app/(organizer)/dashboard/profile/page.tsx"),
      "utf8"
    )

    expect(shell).toContain('fetch("/api/profile", { cache: "no-store" })')
    expect(shell).toContain('window.addEventListener("eventslot:profile-updated"')
    expect(shell).toContain("profileIdentity?.name || session?.user?.name")
    expect(profile).toContain('window.dispatchEvent(new Event("eventslot:profile-updated"))')
  })

  it("keeps the first language preference and verifier foundations wired", () => {
    const signup = readFileSync(path.join(root, "app/(auth)/signup/page.tsx"), "utf8")
    const profile = readFileSync(path.join(root, "app/(organizer)/dashboard/profile/page.tsx"), "utf8")
    const profileApi = readFileSync(path.join(root, "app/api/profile/route.ts"), "utf8")
    const nextConfig = readFileSync(path.join(root, "next.config.mjs"), "utf8")
    const verifierPage = readFileSync(path.join(root, "app/verify-tickets/[slug]/page.tsx"), "utf8")

    expect(signup).toContain("SUPPORTED_LANGUAGES")
    expect(signup).toContain("preferredLanguage")
    expect(profile).toContain("Preferred language")
    expect(profileApi).toContain("preferredLanguage")
    expect(nextConfig).toContain("verify.eventsslot.com")
    expect(verifierPage).toContain("<ScannerHome")
  })

  it("informs existing users that preferred language can be changed in profile", () => {
    const shell = readFileSync(
      path.join(root, "app/(organizer)/dashboard/_shell.tsx"),
      "utf8"
    )

    expect(shell).toContain("New: choose your preferred language")
    expect(shell).toContain("eventslot:language-notice-dismissed")
    expect(shell).toContain('href="/dashboard/profile"')
    expect(shell).toContain("Dismiss language preference notice")
  })
})
