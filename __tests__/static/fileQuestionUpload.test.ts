import { readFileSync } from "node:fs"
import path from "node:path"

const root = process.cwd()

describe("registration file upload questions", () => {
  it("allows organisers to add file upload questions", () => {
    const createPage = readFileSync(path.join(root, "app/(organizer)/create/page.tsx"), "utf8")
    const editPage = readFileSync(path.join(root, "app/(organizer)/edit/[slug]/page.tsx"), "utf8")
    const eventSchema = readFileSync(path.join(root, "lib/schemas/event.schema.ts"), "utf8")

    expect(createPage).toContain('"file"')
    expect(createPage).toContain("File upload")
    expect(editPage).toContain('"file"')
    expect(editPage).toContain("File upload")
    expect(eventSchema).toContain("'file'")
  })

  it("uploads attendee files to bucket storage before registration submit", () => {
    const form = readFileSync(path.join(root, "app/(attendee)/[username]/RegistrationForm.tsx"), "utf8")
    const uploadRoute = readFileSync(path.join(root, "app/api/register/upload/route.ts"), "utf8")

    expect(form).toContain('q.type === "file"')
    expect(form).toContain('/api/register/upload')
    expect(form).toContain('JSON.stringify(data.file)')
    expect(uploadRoute).toContain('registrations/${event.id}/${questionId}')
    expect(uploadRoute).toContain('question?.type !== "file"')
    expect(uploadRoute).toContain("MAX_BYTES = 10 * 1024 * 1024")
  })
})
