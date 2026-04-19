import type { Metadata } from "next"
import Link from "next/link"
import SmartCTA from "@/components/SmartCTA"

export const metadata: Metadata = {
  title: "How EventSlot Works – Event Registration System",
  description:
    "See how EventSlot's event registration system works in 5 simple steps: create your event, share a link, fill slots, overflow to waitlist, and auto-confirm attendees.",
  alternates: { canonical: "https://www.eventsslot.com/how-it-works" },
  openGraph: {
    title: "How EventSlot Works – Event Registration System",
    description:
      "5-step walkthrough of EventSlot's event registration platform — from creating your event to auto-confirming waitlisted attendees.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "How EventSlot Works" }],
  },
}

const LIME = "#C8F55A"
const FG = "#F0EDE6"
const BG = "#0A0A0A"
const SURFACE = "#141414"
const BORDER = "rgba(240,237,230,0.08)"
const MUTED = "rgba(240,237,230,0.45)"

const STEPS = [
  {
    n: "01",
    title: "Create your event",
    body: "Set a title, date, location, registration capacity, and custom form questions. Your event registration page is live in under 3 minutes — no coding, no plugins.",
    keyword: "event registration system",
  },
  {
    n: "02",
    title: "Share one link",
    body: "Share your unique event link on WhatsApp, Instagram, email, or anywhere. Attendees register directly through the link — no account required on their end.",
    keyword: "online event registration",
  },
  {
    n: "03",
    title: "Slots fill automatically",
    body: "As people register, confirmed slots fill up in real time. Your event management tool tracks registrations, collects responses, and sends confirmation emails automatically.",
    keyword: "event management tool",
  },
  {
    n: "04",
    title: "Overflow goes to waitlist",
    body: "Once capacity is reached, new registrants join an automatic waitlist. No manual management needed — our event waitlist system queues every interested attendee fairly.",
    keyword: "event waitlist system",
  },
  {
    n: "05",
    title: "Auto-confirm when slots open",
    body: "If a confirmed attendee cancels or you increase capacity, the next person on the waitlist is promoted and notified instantly. Zero manual follow-up for you.",
    keyword: "event registration platform",
  },
]

export default function HowItWorksPage() {
  return (
    <main style={{ background: BG, color: FG, minHeight: "100vh" }}>
      {/* Hero */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "6rem 1.5rem 4rem", textAlign: "center" }}>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, fontWeight: 500, marginBottom: "1rem" }}>
          How it works
        </p>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(2rem, 5vw, 3rem)", fontWeight: 400, color: FG, margin: "0 0 1.25rem", lineHeight: 1.15 }}>
          How EventSlot&apos;s Event Registration System Works
        </h1>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "1.05rem", color: MUTED, margin: "0 auto 2rem", maxWidth: 560, lineHeight: 1.7 }}>
          EventSlot is an online event registration platform that replaces spreadsheets, manual confirmations, and WhatsApp-group chaos. Here&apos;s the exact flow from event creation to a full house.
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
          Try it free
        </SmartCTA>
      </section>

      {/* Steps */}
      <section style={{ maxWidth: 860, margin: "0 auto", padding: "0 1.5rem 6rem" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          {STEPS.map((step) => (
            <div key={step.n} style={{
              background: SURFACE,
              border: `0.5px solid ${BORDER}`,
              borderRadius: 16,
              padding: "2rem 2.25rem",
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "2rem",
              alignItems: "start",
            }}>
              <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "3.5rem", color: "rgba(200,245,90,0.12)", lineHeight: 1, minWidth: 60, textAlign: "center" }}>
                {step.n}
              </div>
              <div>
                <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.35rem", color: FG, fontWeight: 400, margin: "0 0 0.6rem" }}>
                  {step.title}
                </h2>
                <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "0.95rem", color: MUTED, margin: 0, lineHeight: 1.7 }}>
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Who it's for */}
      <section style={{ background: "#0D0D0D", borderTop: `0.5px solid ${BORDER}`, borderBottom: `0.5px solid ${BORDER}`, padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.6rem, 3.5vw, 2.2rem)", fontWeight: 400, color: FG, margin: "0 0 1rem" }}>
            Who Uses EventSlot
          </h2>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "0.95rem", color: MUTED, margin: "0 auto 2.5rem", maxWidth: 560, lineHeight: 1.7 }}>
            Our event management system is used by organizers across Africa and beyond — from university campus events to corporate training days, churches, and community meetups.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
            {["Universities & Campuses", "Churches & Faith Communities", "Corporate Teams", "Community Organizers", "Sports Tournaments", "Conference Organizers"].map(who => (
              <span key={who} style={{ background: SURFACE, border: `0.5px solid ${BORDER}`, borderRadius: 100, padding: "0.4rem 1rem", fontFamily: "var(--font-dm-sans)", fontSize: "0.82rem", color: "rgba(240,237,230,0.6)" }}>
                {who}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 800, margin: "0 auto", padding: "5rem 1.5rem", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.6rem, 3.5vw, 2.2rem)", fontWeight: 400, color: FG, margin: "0 0 1rem" }}>
          Ready to try the event registration system?
        </h2>
        <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "0.95rem", color: MUTED, margin: "0 0 2rem", lineHeight: 1.7 }}>
          Free to start. No credit card needed. Your first event is live in minutes.
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
          <Link href="/waitlist-system" style={{ display: "inline-flex", alignItems: "center", background: "transparent", color: FG, border: `0.5px solid rgba(240,237,230,0.18)`, borderRadius: 100, padding: "0.7rem 1.6rem", fontFamily: "var(--font-dm-sans)", fontWeight: 500, fontSize: "0.9rem", textDecoration: "none" }}>
            Learn about our waitlist system →
          </Link>
        </div>
      </section>
    </main>
  )
}
