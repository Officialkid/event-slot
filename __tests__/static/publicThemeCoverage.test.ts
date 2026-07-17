import { readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

describe("public secondary route theme coverage", () => {
  it.each([
    "app/terms/page.tsx",
    "app/privacy/page.tsx",
    "app/unauthorized/page.tsx",
    "app/not-found.tsx",
    "app/error.tsx",
    "app/clear-sw/page.tsx",
  ])("keeps %s on semantic neutral theme values", (relativePath) => {
    const source = readFileSync(path.join(root, relativePath), "utf8")

    expect(source).toMatch(/var\(--(?:text|bg|surface|border)/)
    expect(source).not.toMatch(/#(?:080808|111(?:111)?|121212|141414|1A1A1A|F0EDE6)/i)
    expect(source).not.toContain("rgba(240,237,230")
  })
})
