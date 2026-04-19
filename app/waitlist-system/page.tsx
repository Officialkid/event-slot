import type { Metadata } from "next"
import Link from "next/link"
import SmartCTA from "@/components/SmartCTA"

export const metadata: Metadata = {
  title: "Event Waitlist System – Auto-confirm When Slots Open",
  description:
    "EventSlot's event waitlist system automatically promotes and confirms waitlisted attendees the moment a slot opens. No manual follow-up, no missed registrations.",
  alternates: { canonical: "https://www.eventsslot.com/waitlist-system" },
  openGraph: {
    title: "Event Waitlist System – Auto-confirm When Slots Open",
    description:
      "Automatic waitlist management for events. When a slot opens, EventSlot instantly promotes the next person in the queue and sends them a confirmation.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EventSlot Waitlist System" }],
  },
}

const LIME = "#C8F55A"
const FG = "#F0EDE6"
const BG = "#0A0A0A"
const SURFACE = "#141414"
const BORDER = "rgba(240,237,230,0.08)"
const MUTED = "rgba(240,237,230,0.45)"

const FEATURES = [
  {
    title: "Automatic queue management",
    body: "Every registrant who arrives after capacity is reached joins a real-time queue. The event waitlist system tracks position and fairness automatically — no action required from you.",
  },
  {
    title: "Instant promotion when slots open",
    body: "The moment a confirmed attendee cancels, or you increase capacity, the next person in the waitlist queue is immediately promoted and sent a confirmation email.",
  },
  {
    title: "Attendees know where they stand",
    body: "Waitlisted attendees see their queue position on their registration page. No uncertainty, no chasing you for updates.",
  },
  {
    title: "Capacity increases fill instantly",
    body: "Increase your event capacity by 1 or 100 — waitlisted attendees are confirmed in order, automatically. No manual confirmations needed.",
  },
  {
    title: "Never lose an attendee",
    body: "Traditional event management loses interested attendees the moment a sold-out page appears. EventSlot captures every sign-up and turns waitlisted interest into confirmed attendance.",
  },
  {
    title: "Works for all event sizes",
    body: "Whether your event has a 20-person or 2,000-person capacity, the waitlist management system scales with no extra configuration.",
  },
]

export default function WaitlistSystemPage() {
  return (
    <main style={{ background: BG, color: FG, minHeight: "100vh" }}>
      {/* Hero */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "6rem 1.5rem 4rem", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, fontWeight: 500, marginBottom: "1rem" }}>
          Waitlist management
        </p>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 400, color: FG, margin: "0 0 1.25rem", lineHeight: 1.15 }}>
          Built-in Event Waitlist System — Never Lose an Attendee
        </h1>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "1.05rem", color: MUTED, margin: "0 auto 2rem", maxWidth: 560, lineHeight: 1.7 }}>
          Most event management tools show a &ldquo;sold out&rdquo; page and lose the interest. EventSlot&apos;s automatic waitlist system captures every sign-up and converts them to confirmed attendees as slots open.
        </p>
        <SmartCTA style={{
          display: "inline-flex",
          alignItems: "center",
          background: LIME,
          color: BG,
          border: "none",
          borderRadius: 100,
          padding: "0.7rem 1.6rem",
          fontFamily: "var(--font-dm-sans)",
          fontWeight: 600,
          fontSize: "0.9rem",
          textDecoration: "none",
        }}>
          Start free — waitlist included
        </SmartCTA>
      </section>

      {/* How the waitlist works */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "0 1.5rem 5rem" }}>
        <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.6rem, 3vw, 2rem)", fontWeight: 400, color: FG, textAlign: "center", margin: "0 0 3rem" }}>
          How the Waitlist Auto-confirm Works
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "1.25rem" }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: SURFACE, border: `0.5px solid ${BORDER}`, borderRadius: 16, padding: "1.75rem" }}>
              <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.1rem", fontWeight: 400, color: FG, margin: "0 0 0.65rem" }}>
                {f.title}
              </h3>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "0.875rem", color: MUTED, margin: 0, lineHeight: 1.7 }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section style={{ background: "#0D0D0D", borderTop: `0.5px solid ${BORDER}`, borderBottom: `0.5px solid ${BORDER}`, padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.6rem, 3vw, 2rem)", fontWeight: 400, color: FG, textAlign: "center", margin: "0 0 2.5rem" }}>
            EventSlot vs Manual Waitlist Management
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
            {[
              { label: "Without EventSlot", items: ["Spreadsheet of names", "Manual WhatsApp follow-ups", "Miss cancellations", "Attendees don't know their position", "You spend hours on admin"] },
              { label: "With EventSlot", items: ["Automatic queue", "Instant confirmation emails", "Cancellations free slots immediately", "Position shown on registration page", "Zero manual effort"] },
            ].map(col => (
              <div key={col.label} style={{ background: SURFACE, border: `0.5px solid ${BORDER}`, borderRadius: 14, padding: "1.5rem" }}>
                <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, fontWeight: 500, marginBottom: "1rem" }}>
                  {col.label}
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {col.items.map(item => (
                    <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", fontFamily: "var(--font-dm-sans)", fontSize: "0.85rem", color: "rgba(240,237,230,0.7)", lineHeight: 1.5 }}>
                      <span style={{ color: col.label.includes("Without") ? "rgba(240,100,100,0.6)" : LIME, fontSize: "0.7rem", marginTop: "0.2rem", flexShrink: 0 }}>
                        {col.label.includes("Without") ? "✗" : "✓"}
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "5rem 1.5rem", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.6rem, 3.5vw, 2.2rem)", fontWeight: 400, color: FG, margin: "0 0 1rem" }}>
          Stop losing attendees. Start using a real event waitlist system.
        </h2>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "0.95rem", color: MUTED, margin: "0 0 2rem", lineHeight: 1.7 }}>
          The waitlist feature is included on every plan — including free. No configuration needed.
        </p>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <SmartCTA style={{
            display: "inline-flex",
            alignItems: "center",
            background: LIME,
            color: BG,
            border: "none",
            borderRadius: 100,
            padding: "0.7rem 1.6rem",
            fontFamily: "var(--font-dm-sans)",
            fontWeight: 600,
            fontSize: "0.9rem",
            textDecoration: "none",
          }}>
            Create your first event free
          </SmartCTA>
          <Link href="/how-it-works" style={{ display: "inline-flex", alignItems: "center", background: "transparent", color: FG, border: `0.5px solid rgba(240,237,230,0.18)`, borderRadius: 100, padding: "0.7rem 1.6rem", fontFamily: "var(--font-dm-sans)", fontWeight: 500, fontSize: "0.9rem", textDecoration: "none" }}>
            See how it all works →
          </Link>
        </div>
      </section>
    </main>
  )
}
