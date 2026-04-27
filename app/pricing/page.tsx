type FutureFeature = {
  icon: string
  title: string
  description: string
  tier: "free" | "pro" | "business" | "credits"
  credits?: number
}

const futureFeatures: FutureFeature[] = [
  { icon: "+", title: "Event creation", description: "Create unlimited registration links", tier: "free" },
  { icon: "⟳", title: "Waitlist automation", description: "Auto-manage overflow registrations", tier: "free" },
  { icon: "▦", title: "Bulk registration", description: "Register multiple people at once", tier: "free" },
  { icon: "🔗", title: "Community link", description: "Add WhatsApp or Telegram link", tier: "free" },
  { icon: "↓", title: "Export CSV", description: "Download attendee data as spreadsheet", tier: "credits", credits: 15 },
  { icon: "📄", title: "Standard report", description: "Basic Word document with attendee list", tier: "free" },
  { icon: "✦", title: "AI event report", description: "Narrative analysis written by AI", tier: "credits", credits: 50 },
  { icon: "▥", title: "Event analytics", description: "Views, conversion rate, timelines", tier: "pro" },
  { icon: "◔", title: "AI insight cards", description: "3 AI-generated insights per event", tier: "credits", credits: 20 },
  { icon: "💬", title: "Ask your data", description: "Chat with your event analytics", tier: "business" },
  { icon: "⧉", title: "Duplicate event", description: "Clone any event setup instantly", tier: "pro" },
  { icon: "✉", title: "Custom thank you", description: "Personalized confirmation message", tier: "pro" },
]

function tierBadge(feature: FutureFeature) {
  if (feature.tier === "credits") return `Credits · ${feature.credits}`
  if (feature.tier === "pro") return "Pro"
  if (feature.tier === "business") return "Business"
  return "Free"
}

function tierBadgeStyle(feature: FutureFeature) {
  if (feature.tier === "credits") {
    return {
      background: "rgba(27,100,167,0.15)",
      border: "0.5px solid rgba(27,100,167,0.35)",
      color: "#2E9BFF",
    }
  }

  if (feature.tier === "pro") {
    return {
      background: "rgba(250,199,117,0.12)",
      border: "0.5px solid rgba(250,199,117,0.32)",
      color: "#FAC775",
    }
  }

  if (feature.tier === "business") {
    return {
      background: "rgba(147,112,219,0.14)",
      border: "0.5px solid rgba(147,112,219,0.35)",
      color: "#A98BFF",
    }
  }

  return {
    background: "rgba(200,245,90,0.12)",
    border: "0.5px solid rgba(200,245,90,0.3)",
    color: "#C8F55A",
  }
}

export default function PricingPage() {
  return (
    <main style={{ background: "#0A0A0A", minHeight: "100vh", color: "#F0EDE6" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "4rem 1.5rem 5rem" }}>
        <section
          style={{
            marginBottom: "2.5rem",
            borderRadius: 16,
            border: "0.5px solid rgba(240,237,230,0.08)",
            background: "radial-gradient(ellipse at top, rgba(200,245,90,0.08), transparent 58%), #111",
            padding: "2rem 1.5rem",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              borderRadius: 100,
              padding: "0.25rem 0.75rem",
              background: "rgba(250,199,117,0.12)",
              border: "0.5px solid rgba(250,199,117,0.35)",
              marginBottom: "0.95rem",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FAC775" }} />
            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.68rem", color: "#FAC775", letterSpacing: "0.09em", textTransform: "uppercase", fontWeight: 600 }}>
              Coming soon
            </span>
          </div>

          <h1
            style={{
              margin: "0 0 0.5rem",
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "clamp(2rem, 4vw, 2.9rem)",
              fontWeight: 400,
              lineHeight: 1.08,
            }}
          >
            Pricing is being finalized
          </h1>

          <p style={{ margin: 0, fontFamily: "var(--font-dm-sans)", fontSize: "0.95rem", color: "rgba(240,237,230,0.56)", maxWidth: 820, lineHeight: 1.65 }}>
            We are polishing Pro and Business packaging so every upgrade clearly maps to real outcomes. For now, here is exactly what EventSlot will do across Free, Credits, Pro, and Business so your team can plan ahead.
          </p>
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ margin: "0 0 0.4rem", fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", fontWeight: 400, color: "#F0EDE6" }}>
            Everything EventSlot can do
          </h2>
          <p style={{ margin: 0, fontFamily: "var(--font-dm-sans)", fontSize: "0.86rem", color: "rgba(240,237,230,0.4)" }}>
            Free is available now. Pro and Business capabilities are shown as the roadmap experience customers can expect.
          </p>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "0.9rem",
          }}
        >
          {futureFeatures.map((feature) => (
            <article
              key={feature.title}
              style={{
                borderRadius: 14,
                border: "0.5px solid rgba(240,237,230,0.08)",
                background: "#141414",
                padding: "1.25rem 1.2rem",
                minHeight: 132,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", gap: "0.75rem" }}>
                <span style={{ color: "rgba(240,237,230,0.8)", fontSize: "1rem", lineHeight: 1, fontFamily: "var(--font-dm-sans)" }}>{feature.icon}</span>
                <span
                  style={{
                    ...tierBadgeStyle(feature),
                    borderRadius: 100,
                    padding: "0.2rem 0.65rem",
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "0.7rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  {tierBadge(feature)}
                </span>
              </div>
              <h3 style={{ margin: "0 0 0.35rem", fontFamily: "var(--font-dm-sans)", fontSize: "1.02rem", color: "#F0EDE6", fontWeight: 700 }}>
                {feature.title}
              </h3>
              <p style={{ margin: 0, fontFamily: "var(--font-dm-sans)", fontSize: "0.88rem", lineHeight: 1.55, color: "rgba(240,237,230,0.45)" }}>
                {feature.description}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  )
}
