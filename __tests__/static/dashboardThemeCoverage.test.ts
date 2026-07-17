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
})
