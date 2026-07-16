// Static documentation snippets - update as docs site grows
// When docs.eventsslot.com is fully live, replace with
// dynamic fetch from the sitemap + page content

export const DOCS_PAGES: { title: string; url: string; content: string }[] = [
  {
    title: "How waitlists work",
    url: "https://docs.eventsslot.com/product/waitlist",
    content:
      "When an event reaches capacity, EventSlot automatically opens a waitlist. Attendees who register after capacity is reached are placed on the waitlist in order. When a confirmed attendee cancels, the first person on the waitlist is automatically promoted and notified.",
  },
  {
    title: "Creating your first event",
    url: "https://docs.eventsslot.com/guides/create-event",
    content:
      "To create an event: sign in to EventSlot, click Create new event on your dashboard, fill in the title, description, date, location, and capacity, then publish. Your registration link is generated automatically.",
  },
  {
    title: "Ticket generation",
    url: "https://docs.eventsslot.com/product/features",
    content:
      "Organisers can enable or disable ticket generation per event from their dashboard. When enabled, confirmed attendees can download a PDF ticket containing their name, confirmation number, event details, and a QR code for entry verification.",
  },
  {
    title: "Premium rollout and reports",
    url: "https://docs.eventsslot.com/business/monetization",
    content:
      "Payments and premium billing are paused while EventSlot completes the rollout. Event report previews and Word downloads are currently free for authorised organisers, assigned team members, and super admins. One-time event passes are shown as coming soon and should not be described as active checkout.",
  },
  {
    title: "Kenya Data Protection Act compliance",
    url: "https://docs.eventsslot.com/technical/security",
    content:
      "EventSlot is compliant with the Kenya Data Protection Act (2019). Users can export all their data from Account Settings. Account deletion removes all personal data within 72 hours. Free tier event data is deleted 30 days after the event ends.",
  },
  {
    title: "Registration confirmation lookup",
    url: "https://docs.eventsslot.com/guides/attendee",
    content:
      "Attendees can check their registration status at any time by going to the event page and entering their name or email in the Check Your Registration section. The system returns Confirmed, Waitlisted, or Not Found along with a confirmation number.",
  },
  {
    title: "Ticket verification",
    url: "https://docs.eventsslot.com/product/ticket-verification",
    content:
      "EventSlot supports ticket verification from the event dashboard using QR scan, uploaded ticket image/PDF, or manual lookup by name, email, ticket number, or confirmation code. Accepted team members only access events explicitly assigned to them. A future standalone verify.eventsslot.com experience is planned for temporary event verifiers.",
  },
]

// Simple keyword search - returns relevant doc snippets
export function searchDocs(query: string): { title: string; url: string; snippet: string }[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean)

  const results = DOCS_PAGES.filter((page) =>
    words.some(
      (word) =>
        page.title.toLowerCase().includes(word) ||
        page.content.toLowerCase().includes(word)
    )
  )

  return results.slice(0, 2).map((result) => ({
    title: result.title,
    url: result.url,
    snippet: result.content,
  }))
}

// Build docs context block for system prompt
export function buildDocsContext(query: string): string {
  const results = searchDocs(query)
  if (results.length === 0) return ""

  return `
═══════════════════════════════════════════════
RELEVANT DOCUMENTATION (cite the source URL when referencing)
═══════════════════════════════════════════════
${results
  .map(
    (result) => `
Source: ${result.title} - ${result.url}
Content: ${result.snippet}
`
  )
  .join("\n")}
When referencing documentation, say something like:
"According to the EventSlot docs (${results[0]?.url}), ..."
═══════════════════════════════════════════════
`
}
