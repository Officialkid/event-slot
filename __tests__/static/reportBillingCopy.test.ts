import { readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

describe("report billing copy", () => {
  it("keeps assistant report guidance aligned with paused premium billing", () => {
    const assistantRoute = readFileSync(path.join(root, "app/api/assistant/message/route.ts"), "utf8")

    expect(assistantRoute).toContain("currently free for authorised organisers")
    expect(assistantRoute).not.toContain("requires tokens and is a separate paid feature")
  })
})
