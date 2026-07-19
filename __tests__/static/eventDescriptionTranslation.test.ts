import { readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

describe("event description translation foundation", () => {
  it("keeps attendee event descriptions compact, expandable, and translatable", () => {
    const component = readFileSync(
      path.join(root, "components/events/EventDescriptionBlock.tsx"),
      "utf8"
    )
    const registrationForm = readFileSync(
      path.join(root, "app/(attendee)/[username]/RegistrationForm.tsx"),
      "utf8"
    )
    const route = readFileSync(
      path.join(root, "app/api/events/[slug]/translate-description/route.ts"),
      "utf8"
    )

    expect(component).toContain("Read more")
    expect(component).toContain("Translate")
    expect(component).toContain("whiteSpace: \"pre-wrap\"")
    expect(component).toContain("SUPPORTED_LANGUAGES")
    expect(registrationForm).toContain("<EventDescriptionBlock")
    expect(route).toContain("askAIWithMeta")
    expect(route).toContain("Preserve the meaning, line breaks, spacing, emojis")
    expect(route).toContain("event.status !== \"active\"")
  })
})
