import { readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

describe("attendee workflow theme coverage", () => {
  it.each([
    "app/feedback/[registrationId]/page.tsx",
    "app/register/success/[confirmationCode]/page.tsx",
    "app/registration/[registrationId]/edit/page.tsx",
    "app/registration/[registrationId]/page.tsx",
    "app/team/accept/page.tsx",
    "app/verify/[confirmationCode]/page.tsx",
    "app/walkin/[slug]/page.tsx",
  ])("keeps %s on semantic neutral theme values", (relativePath) => {
    const source = readFileSync(path.join(root, relativePath), "utf8")

    expect(source).toMatch(/var\(--(?:text|bg|surface|border)/)
    expect(source).not.toMatch(/#(?:080808|111(?:111)?|121212|141414|1A1A1A|1E1E1E|101010|F0EDE6)/i)
    expect(source).not.toContain("rgba(240,237,230")
  })
})
