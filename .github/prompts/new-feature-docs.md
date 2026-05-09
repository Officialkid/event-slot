# New Feature Documentation Prompt

Use this prompt whenever a new feature is shipped to EventSlot.
Copy it into GitHub Copilot Chat (agent mode) and fill in the placeholders.

---

```
A new feature has been added to EventSlot:

Feature: [NAME]
Description: [WHAT IT DOES]
Who uses it: [Organiser / Attendee / Admin]
Tier: [Free / Pro / Business / All]
API endpoints added: [LIST — e.g. POST /api/events/[slug]/feature]
Database changes: [DESCRIBE — e.g. "Added 'fieldName' column to Event model"]
KDPA impact: [YES/NO — DESCRIBE — e.g. "No new personal data collected"]

Update the following EventSlot documentation pages:
1. docs-site/pages/product/features.mdx       — add row to feature table
2. docs-site/pages/technical/api.mdx          — add new endpoints to correct domain group
3. docs-site/pages/technical/database.mdx     — add schema changes under correct model
4. docs-site/pages/guides/organiser.mdx       — add usage steps (if organiser-facing)
   OR docs-site/pages/guides/attendee.mdx     — add usage steps (if attendee-facing)
5. docs-site/pages/appendix/api-reference.mdx — add full endpoint docs with request/response examples
6. docs-site/pages/appendix/changelog.mdx     — add changelog entry under current month/version

Rules:
- Preserve all existing content exactly
- Add new content only — do not rewrite or remove existing sections
- Follow the exact formatting style of the file you are editing
- Output the complete updated content for each affected file
```

---

## When to trigger this prompt

- Any new `app/api/**` route file is added
- Any new model or column lands in `prisma/schema.prisma`
- Any new organiser or attendee-facing UI surface ships
- Any Paystack, AI, or integration change affects documented behavior

## Example completed prompt

```
A new feature has been added to EventSlot:

Feature: Event Duplication
Description: Allows organisers to clone an existing event, preserving all questions
             and settings, creating a new draft with a new slug.
Who uses it: Organiser
Tier: Free
API endpoints added: POST /api/events/[slug]/duplicate
Database changes: None — uses existing Event and Registration models
KDPA impact: No — duplicates structure only, no attendee personal data copied

Update the following EventSlot documentation pages:
1. docs-site/pages/product/features.mdx
2. docs-site/pages/technical/api.mdx
3. docs-site/pages/technical/database.mdx
4. docs-site/pages/guides/organiser.mdx
5. docs-site/pages/appendix/api-reference.mdx
6. docs-site/pages/appendix/changelog.mdx
```
