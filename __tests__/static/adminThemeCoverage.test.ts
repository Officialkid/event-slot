import { readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

describe("admin theme coverage", () => {
  it.each([
    "app/admin/layout.tsx",
    "app/admin/AdminSidebar.tsx",
    "app/admin/events/page.tsx",
  ])("keeps %s on semantic neutral theme values", (relativePath) => {
    const source = readFileSync(path.join(root, relativePath), "utf8")

    expect(source).toMatch(/var\(--(?:text|bg|surface|border)/)
    expect(source).not.toMatch(/#(?:080808|111(?:111)?|121212|141414|1A1A1A|F0EDE6)/i)
    expect(source).not.toContain("rgba(240,237,230")
  })
})
