import { renderBroadcastEmail } from "@/lib/emailTemplates"

describe("renderBroadcastEmail", () => {
  it("renders a rich promotional email with hero banner, chips, and CTA button", () => {
    const html = renderBroadcastEmail({
      layoutType: "PROMOTIONAL_HERO",
      subject: "Dark Factory Hackathon",
      preheader: "LIGHTS OUT. THE FACTORY RUNS ANYWAY.",
      bannerUrl: "https://example.com/poster.png",
      content: "Hey {{name}},\n\nJoin our biggest hackathon of the year!\n\n**Prize pool:** $5,000",
      ctaText: "JOIN THE CHALLENGE →",
      ctaUrl: "https://eventsslot.com/events/dark-factory",
      eventDateLabel: "SEP 26 - OCT 5",
      eventLocation: "ONLINE",
      eventBadge: "$5,000 Cash",
      recipientName: "Daniel",
      userId: "user_123",
    })

    expect(html).toContain("LIGHTS OUT. THE FACTORY RUNS ANYWAY.")
    expect(html).toContain("https://example.com/poster.png")
    expect(html).toContain("SEP 26 - OCT 5")
    expect(html).toContain("ONLINE")
    expect(html).toContain("$5,000 Cash")
    expect(html).toContain("Hey Daniel,")
    expect(html).toContain("JOIN THE CHALLENGE →")
    expect(html).toContain("https://eventsslot.com/events/dark-factory")
    expect(html).toContain("/api/email/unsubscribe?id=user_123")
  })

  it("renders a clean minimal announcement without a hero banner", () => {
    const html = renderBroadcastEmail({
      layoutType: "TEXT_MINIMAL",
      subject: "Platform Update Announcement",
      content: "Hi {{name}},\n\nWe have launched new updates for all organizers.\n\n* Check your dashboard.",
      recipientName: "Faith",
      userId: "user_456",
    })

    expect(html).not.toContain("<img src=")
    expect(html).toContain("Hi Faith,")
    expect(html).toContain("Check your dashboard")
    expect(html).toContain("/api/email/unsubscribe?id=user_456")
  })

  it("sanitizes greetings safely when name is Kid or officialkid", () => {
    const html = renderBroadcastEmail({
      subject: "Hello",
      content: "Hi {{name}},",
      recipientName: "kid",
      userId: "user_789",
    })

    expect(html).toContain("Hi there,")
  })
})
