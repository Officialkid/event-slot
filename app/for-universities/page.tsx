import type { Metadata } from "next"
import Link from "next/link"
import SmartCTA from "@/components/SmartCTA"

export const metadata: Metadata = {
  title: "Event Registration for Universities & Campus Events",
  description:
    "EventSlot is the event registration platform built for universities, campuses, and student organisations. Manage campus events with automatic waitlists, team management, and zero spreadsheets.",
  alternates: { canonical: "https://www.eventsslot.com/for-universities" },
  openGraph: {
    title: "Event Registration for Universities & Campus Events",
    description:
      "The event management system for universities — handle registrations, waitlists, and attendee data for campus events automatically.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EventSlot for Universities" }],
  },
}

const LIME = "#C8F55A"
const FG = "#F0EDE6"
const BG = "#0A0A0A"
const SURFACE = "#141414"
const MUTED = "rgba(240,237,230,0.45)"

const USE_CASES = [
  {
    title: "Orientation & Welcome Events",
    body: "Handle hundreds of incoming student registrations with automatic capacity management and waitlists — no department admin spreadsheets required.",
  },
  {
    title: "Club & Society Events",
    body: "Student organisations can run their own events with individual links. Team members share access through the built-in team management system.",
  },
  {
    title: "Workshop & Seminar Registrations",
    body: "Set per-workshop capacity, collect custom registration questions (year, department, dietary requirements), and export attendee data with one click.",
  },
  {
    title: "Career Fairs & Networking Events",
    body: "Manage timed slots, session capacities, and waitlists across multiple parallel sessions in a single dashboard.",
  },
  {
    title: "Sports Tournaments & Tryouts",
    body: "Registration forms collect exactly the info you need — position, experience level, contact details. Waitlists manage cut-offs automatically.",
  },
  {
    title: "Cross-department Organising",
    body: "Add team members from different departments to co-manage events. No password sharing, no single point of failure.",
  },
]

const WHY_POINTS = [
  { icon: "🎓", text: "Purpose-built for event registration, not adapted from booking tools" },
  { icon: "⚡", text: "Live in 3 minutes — no IT department approval needed" },
  { icon: "📋", text: "Custom registration questions for every event" },
  { icon: "🔄", text: "Automatic waitlist promotes attendees when slots open" },
  { icon: "📊", text: "AI-generated post-event reports (Pro & Business)" },
  { icon: "👥", text: "Team management: invite co-organisers with full access control" },
  { icon: "🌍", text: "Used across universities in Kenya, Nigeria, Uganda and beyond" },
  { icon: "📱", text: "Mobile-first — share via WhatsApp, X or Instagram in one tap" },
]

export default function ForUniversitiesPage() {
  return (
    <main style={{ background: BG, color: FG, minHeight: "100vh" }}>
      {/* Hero */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "6rem 1.5rem 4rem", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, fontWeight: 500, marginBottom: "1rem" }}>
          For universities &amp; campuses
        </p>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 400, color: FG, margin: "0 0 1.25rem", lineHeight: 1.15 }}>
          Event Registration for Universities &amp; Campus Communities
        </h1>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "1.05rem", color: MUTED, margin: "0 auto 2rem", maxWidth: 580, lineHeight: 1.7 }}>
          The event registration platform used by universities, student unions, and campus organisations across Africa. Replace Google Forms, spreadsheets, and manual follow-ups with one intelligent tool.
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
            Start free for your campus
          </SmartCTA>
          <Link href="/dashboard/billing" style={{ display: "inline-flex", alignItems: "center", background: "transparent", color: FG, border: "0.5px solid rgba(240,237,230,0.18)", borderRadius: 100, padding: "0.7rem 1.6rem", fontFamily: "var(--font-dm-sans)", fontWeight: 500, fontSize: "0.9rem", textDecoration: "none" }}>
            View download options →
          </Link>
        </div>
      </section>

      {/* Use cases */}
      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "0 1.5rem 5rem" }}>
        <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.6rem, 3vw, 2rem)", fontWeight: 400, color: FG, textAlign: "center", margin: "0 0 3rem" }}>
          Campus Event Types We Handle
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.25rem" }}>
          {USE_CASES.map(uc => (
            <div key={uc.title} style={{ background: SURFACE, border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 16, padding: "1.75rem" }}>
              <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.1rem", fontWeight: 400, color: FG, margin: "0 0 0.65rem" }}>
                {uc.title}
              </h3>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "0.875rem", color: MUTED, margin: 0, lineHeight: 1.7 }}>
                {uc.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Why EventSlot */}
      <section style={{ background: "#0D0D0D", borderTop: "0.5px solid rgba(240,237,230,0.08)", borderBottom: "0.5px solid rgba(240,237,230,0.08)", padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: 800, margin: "0 auto" }}>
          <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.6rem, 3vw, 2rem)", fontWeight: 400, color: FG, textAlign: "center", margin: "0 0 2.5rem" }}>
            Why Universities Choose EventSlot
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
            {WHY_POINTS.map(p => (
              <div key={p.text} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", background: SURFACE, border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "1rem 1.25rem" }}>
                <span style={{ fontSize: "1.15rem", flexShrink: 0, marginTop: "0.05rem" }}>{p.icon}</span>
                <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem", color: "rgba(240,237,230,0.75)", lineHeight: 1.55 }}>{p.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Plans pointer */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "5rem 1.5rem", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.6rem, 3.5vw, 2.2rem)", fontWeight: 400, color: FG, margin: "0 0 1rem" }}>
          Free for small campus events. Powerful when you scale.
        </h2>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "0.95rem", color: MUTED, margin: "0 0 2rem", lineHeight: 1.7 }}>
          Start free with full product access for your campus. The only paid action is report downloads.
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
            Get started free
          </SmartCTA>
          <Link href="/how-it-works" style={{ display: "inline-flex", alignItems: "center", background: "transparent", color: FG, border: "0.5px solid rgba(240,237,230,0.18)", borderRadius: 100, padding: "0.7rem 1.6rem", fontFamily: "var(--font-dm-sans)", fontWeight: 500, fontSize: "0.9rem", textDecoration: "none" }}>
            See how it works →
          </Link>
        </div>
      </section>
    </main>
  )
}
