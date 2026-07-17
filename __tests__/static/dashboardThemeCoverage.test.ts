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
    "app/(organizer)/dashboard/feedback/page.tsx",
    "app/(organizer)/dashboard/insights/page.tsx",
    "app/(organizer)/dashboard/notifications/page.tsx",
    "app/(organizer)/dashboard/team/page.tsx",
    "components/dashboard/SidebarInstallPrompt.tsx",
  ])("keeps %s free from dark-only neutral palette values", (relativePath) => {
    const source = readFileSync(path.join(root, relativePath), "utf8")

    expect(source).toMatch(/var\(--(?:text|bg|surface|border)/)
    expect(source).not.toMatch(/#(?:111(?:111)?|121212|141414|1A1A1A|F0EDE6)/i)
    expect(source).not.toContain("rgba(240,237,230")
  })
})
