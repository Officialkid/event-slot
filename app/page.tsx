import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import type { CSSProperties } from "react"
import SmartCTA from "@/components/SmartCTA"

export const metadata: Metadata = {
  title: "EventSlot – Smart Event Registration Platform with Built-in Waitlist",
  description:
    "The fastest event registration system with automatic waitlist management. Create an event, share one link, and let EventSlot handle registrations, confirmations, and waitlists automatically.",
  alternates: { canonical: "https://www.eventsslot.com" },
  openGraph: {
    title: "EventSlot – Smart Event Registration Platform with Built-in Waitlist",
    description:
      "Create events, share one link, and fill slots automatically. EventSlot manages registrations and waitlists without spreadsheets.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "EventSlot Event Registration Platform" }],
  },
}

// ── Shared tokens ──────────────────────────────────────────────────────────────
const LIME = "#C8F55A"
const FG = "#F0EDE6"
const BG = "#0A0A0A"
const SURFACE = "#141414"
const BORDER = "rgba(240,237,230,0.08)"
const MUTED = "rgba(240,237,230,0.45)"
const MUTED_LO = "rgba(240,237,230,0.25)"

const EVENT_TYPE_PILLS = [
  "Community Meetups",
  "Corporate Training",
  "Workshops",
  "Church Events",
  "Sports Tournaments",
  "Conferences",
  "Campus Events",
]

const SCREENSHOT_FRAME: CSSProperties = {
  background: "linear-gradient(180deg, rgba(20,20,20,0.98) 0%, rgba(10,10,10,0.94) 100%)",
  border: "0.5px solid rgba(240,237,230,0.1)",
  borderRadius: 24,
  boxShadow: "0 30px 60px rgba(0,0,0,0.35)",
  overflow: "hidden",
}

type ShowcaseImageProps = {
  src: string
  alt: string
  width: number
  height: number
  priority?: boolean
  maxWidth?: number
  aspectRatio?: string
}

function ShowcaseImage({
  src,
  alt,
  width,
  height,
  priority = false,
  maxWidth,
  aspectRatio = "3 / 2",
}: ShowcaseImageProps) {
  return (
    <div
      style={{
        ...SCREENSHOT_FRAME,
        width: "100%",
        maxWidth: maxWidth ?? 640,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          padding: "1rem 1.25rem",
          borderBottom: "0.5px solid " + BORDER,
          display: "flex",
          gap: "0.35rem",
          alignItems: "center",
          background: "rgba(255,255,255,0.02)",
        }}
      >
        {["#F7685B", "#F2C94C", "#33D69F"].map(c => (
          <span key={c} style={{ width: 9, height: 9, borderRadius: "50%", background: c, display: "inline-block" }} />
        ))}
        <span style={{ marginLeft: "0.5rem", fontFamily: "var(--font-dm-sans)", fontSize: "0.65rem", color: MUTED }}>
          EventSlot preview
        </span>
      </div>
      <div
        style={{
          padding: "1rem",
          background: "radial-gradient(circle at top, rgba(200,245,90,0.08), transparent 50%), #0A0A0A",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio,
            borderRadius: 18,
            overflow: "hidden",
            background: "#101010",
            border: "0.5px solid rgba(240,237,230,0.08)",
          }}
        >
          <Image
            src={src}
            alt={alt}
            width={width}
            height={height}
            priority={priority}
            sizes="(max-width: 900px) 100vw, 50vw"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              objectPosition: "center",
            }}
          />
        </div>
      </div>
    </div>
  )
}

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "EventSlot",
    alternateName: "Event Slot",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "EventSlot is an event registration platform built for organizers who run events with limited slots. Manage registrations, waitlists, and automatic confirmations.",
    url: "https://www.eventsslot.com",
    keywords: "eventslot, event slot, events slot, event registration platform, event waitlist system",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "KES",
      description: "Free plan available",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "12",
    },
    featureList: [
      "Event registration management",
      "Automatic waitlist system",
      "QR code ticket generation",
      "Confirmation tickets",
      "Organizer dashboard",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "EventSlot",
    alternateName: "Event Slot",
    url: "https://www.eventsslot.com",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://www.eventsslot.com/search?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  },
]

export default function Home() {
  return (
    <main style={{ background: BG, color: FG, minHeight: "100vh", overflowX: "hidden" }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section style={{ 
        maxWidth: 1200, 
        margin: "0 auto", 
        padding: "5rem 1.5rem 4rem",
        backgroundImage: "url('/assets/hero-bg.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        position: "relative",
        borderRadius: 32,
        overflow: "hidden",
      }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(90deg, rgba(10,10,10,0.92) 0%, rgba(10,10,10,0.72) 50%, rgba(10,10,10,0.82) 100%)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4rem",
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
          className="hero-grid"
        >
          {/* Left */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
            {/* Eyebrow */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "rgba(200,245,90,0.08)",
              border: "0.5px solid rgba(200,245,90,0.25)",
              borderRadius: 100,
              padding: "0.3rem 0.9rem",
              width: "fit-content",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: LIME, display: "inline-block" }} />
              <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.78rem", fontWeight: 500, color: LIME, letterSpacing: "0.04em" }}>
                Used by event organizers across Africa
              </span>
            </div>

            {/* Headline — primary SEO H1 */}
            <h1 style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "clamp(2.4rem, 5vw, 3.6rem)",
              fontWeight: 400,
              color: FG,
              lineHeight: 1.1,
              margin: 0,
            }}>
              Smart Event Registration Platform with Built-in Waitlist
            </h1>

            {/* Subheading */}
            <p style={{
              fontFamily: "var(--font-dm-sans)",
              fontWeight: 300,
              fontSize: "1.05rem",
              color: MUTED,
              lineHeight: 1.7,
              margin: 0,
              maxWidth: 480,
            }}>
              Everything is free. Create your event, manage your waitlist, get AI-powered insights — no subscription needed. Pay only when you want to download your report.
            </p>

            {/* Buttons */}
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link href="/signup" style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                background: LIME,
                color: BG,
                border: "none",
                borderRadius: 100,
                padding: "0.7rem 1.5rem",
                fontFamily: "var(--font-dm-sans)",
                fontWeight: 600,
                fontSize: "0.9rem",
                textDecoration: "none",
                letterSpacing: "0.01em",
              }}>
                Start for free — no credit card
              </Link>
              <a href="#demo" style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "transparent",
                color: FG,
                border: "0.5px solid rgba(240,237,230,0.18)",
                borderRadius: 100,
                padding: "0.7rem 1.5rem",
                fontFamily: "var(--font-dm-sans)",
                fontWeight: 500,
                fontSize: "0.9rem",
                textDecoration: "none",
              }}>
                See it in action
                <span style={{ opacity: 0.5 }}>↓</span>
              </a>
            </div>

            {/* Trust stats */}
            <div style={{ display: "flex", gap: "0", flexWrap: "wrap", alignItems: "center" }}>
              {[
                "10,000+ registrations processed",
                "Zero spreadsheets needed",
                "Used across Kenya, Nigeria, Uganda & beyond",
              ].map((s, i) => (
                <span key={s} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  {i > 0 && <span style={{ color: MUTED_LO, fontSize: "0.6rem", margin: "0 0.2rem" }}>·</span>}
                  <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.76rem", color: MUTED, fontWeight: 400 }}>{s}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Right - Dashboard image */}
          <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            <ShowcaseImage
              src="/assets/dashboard-laptop.png"
              alt="EventSlot dashboard analytics view showing registrations, waitlist, and attendee data"
              width={1536}
              height={1024}
              maxWidth={560}
            />
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ───────────────────────────────────────────────────────── */}
      <section style={{ background: "#0D0D0D", padding: "3rem 1.5rem", borderTop: "0.5px solid " + BORDER, borderBottom: "0.5px solid " + BORDER }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <p style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: "0.72rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: MUTED,
            fontWeight: 500,
            marginBottom: "1.5rem",
          }}>
            Trusted by organizers running all kinds of events
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", justifyContent: "center" }}>
            {EVENT_TYPE_PILLS.map(pill => (
              <span key={pill} style={{
                background: SURFACE,
                border: "0.5px solid " + BORDER,
                borderRadius: 100,
                padding: "0.4rem 1rem",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.82rem",
                color: "rgba(240,237,230,0.6)",
                fontWeight: 400,
              }}>
                {pill}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────────────── */}
      <section id="demo" style={{ maxWidth: 1100, margin: "0 auto", padding: "6rem 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, fontWeight: 500, marginBottom: "0.75rem" }}>
            How it works
          </p>
          <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 400, color: FG, margin: 0 }}>
            How EventSlot&apos;s Event Registration System Works
          </h2>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "0.95rem", color: MUTED, margin: "1rem auto 0", maxWidth: 560, lineHeight: 1.7 }}>
            From creating your event to auto-confirming waitlisted attendees — our online event registration platform handles every step.
          </p>
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr auto 1fr", gap: "1rem", alignItems: "center" }}
          className="steps-grid"
        >
          {[
            {
              n: "01",
              title: "Create your event",
              desc: "Set a title, capacity, deadline, and your registration questions. Done in 3 minutes.",
            },
            {
              n: "02",
              title: "Share one link",
              desc: "Share it on WhatsApp, Instagram, or anywhere. Registrations come in automatically.",
            },
            {
              n: "03",
              title: "Everything else is automatic",
              desc: "Slots fill up. Waitlists form. Capacity increases promote people instantly. You just watch.",
            },
          ].flatMap((step, i) => [
            <div key={step.n} style={{
              background: SURFACE,
              border: "0.5px solid " + BORDER,
              borderRadius: 16,
              padding: "2rem 1.75rem",
            }}>
              <div style={{
                fontFamily: "var(--font-instrument-serif)",
                fontSize: "3rem",
                color: "rgba(200,245,90,0.15)",
                lineHeight: 1,
                marginBottom: "1rem",
              }}>{step.n}</div>
              <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: FG, fontWeight: 400, margin: "0 0 0.75rem" }}>
                {step.title}
              </h3>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "0.875rem", color: MUTED, margin: 0, lineHeight: 1.65 }}>
                {step.desc}
              </p>
            </div>,
            i < 2 && (
              <div key={"arrow-" + i} style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "1.5rem",
                color: LIME,
                textAlign: "center" as const,
                opacity: 0.7,
                flexShrink: 0,
              }} className="step-arrow">→</div>
            ),
          ])}
        </div>
      </section>

      {/* ── FEATURE HIGHLIGHTS ────────────────────────────────────────────────── */}
      <section id="how-it-works" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem 6rem" }}>
        <div style={{ textAlign: "center", marginBottom: "4rem" }}>
          <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.8rem, 4vw, 2.6rem)", fontWeight: 400, color: FG, margin: 0 }}>
            Why EventSlot Is the Right Event Management Tool
          </h2>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "0.95rem", color: MUTED, margin: "1rem auto 0", maxWidth: 560, lineHeight: 1.7 }}>
            Every core feature is available from day one. No locked tiers, no upgrade paths, and no subscription barriers.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "5rem" }}>

          {/* Feature 1 - image left, text right */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }} className="feature-row">
            <ShowcaseImage
              src="/assets/event-checkin.png"
              alt="EventSlot attendee list and check-in experience"
              width={1536}
              height={1024}
            />
            <div>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, marginBottom: "1rem", fontWeight: 500 }}>Command center</p>
              <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 400, color: FG, margin: "0 0 1rem", lineHeight: 1.2 }}>
                Every event, every registration — at a glance.
              </h3>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "0.95rem", color: MUTED, margin: "0 0 1.5rem", lineHeight: 1.7 }}>
                See confirmed counts, waitlists, and capacity across all your events instantly. Get notified when things need your attention before they become problems.
              </p>
              <SmartCTA style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem", color: LIME, textDecoration: "none", fontWeight: 500 }}>
                Start your first event →
              </SmartCTA>
            </div>
          </div>

          {/* Feature 2 - text left, image right */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }} className="feature-row">
            <div>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, marginBottom: "1rem", fontWeight: 500 }}>AI reports</p>
              <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 400, color: FG, margin: "0 0 1rem", lineHeight: 1.2 }}>
                Reports that actually tell you something.
              </h3>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "0.95rem", color: MUTED, margin: "0 0 1.5rem", lineHeight: 1.7 }}>
                AI reads your registration data and writes a narrative report — audience profile, registration patterns, recommendations. Not just a spreadsheet.
              </p>
              <Link href="/dashboard/insights" style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem", color: LIME, textDecoration: "none", fontWeight: 500 }}>
                Open analytics →
              </Link>
            </div>
            <ShowcaseImage
              src="/assets/dashboard-laptop.png"
              alt="EventSlot reporting and analytics dashboard"
              width={1536}
              height={1024}
            />
          </div>

          {/* Feature 3 - image left, text right */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4rem", alignItems: "center" }} className="feature-row">
            <ShowcaseImage
              src="/assets/organizer-mobile.png"
              alt="EventSlot mobile interface showing event management on the go"
              width={1024}
              height={1536}
              maxWidth={420}
              aspectRatio="4 / 5"
            />
            <div>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED, marginBottom: "1rem", fontWeight: 500 }}>Everything included</p>
              <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.5rem, 3vw, 2rem)", fontWeight: 400, color: FG, margin: "0 0 1rem", lineHeight: 1.2 }}>
                Use the full platform with no subscription.
              </h3>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "0.95rem", color: MUTED, margin: "0 0 1.5rem", lineHeight: 1.7 }}>
                Start for free and use the full product. The only paid action is report downloads.
              </p>
              <Link href="/dashboard/billing" style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem", color: LIME, textDecoration: "none", fontWeight: 500 }}>
                View download options →
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* ── CTA BAND ───────────────────────────────────────────────────────────── */}
      <section id="get-started" style={{ maxWidth: 1100, margin: "0 auto", padding: "6rem 1.5rem" }}>
        <div style={{
          background: SURFACE,
          border: "0.5px solid " + BORDER,
          borderRadius: 20,
          padding: "4rem 3rem",
          textAlign: "center",
        }}>
          <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.8rem, 4vw, 2.8rem)", fontWeight: 400, color: FG, margin: "0 0 1rem", lineHeight: 1.15 }}>
            Ready to run your event<br />
            <span style={{ color: LIME, fontStyle: "italic" }}>the right way?</span>
          </h2>
          <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "0.95rem", color: MUTED, margin: "0 0 2rem" }}>
            Takes less than 3 minutes to set up. Free forever on the basics.
          </p>
          <SmartCTA style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            background: LIME,
            color: BG,
            borderRadius: 100,
            padding: "0.8rem 2rem",
            fontFamily: "var(--font-dm-sans)",
            fontWeight: 600,
            fontSize: "0.9rem",
            textDecoration: "none",
          }}>
            Create your first event — it&apos;s free
          </SmartCTA>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: "0.5px solid " + BORDER, padding: "3.5rem 1.5rem 2rem" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: "2rem", marginBottom: "3rem" }} className="footer-grid">
            {/* Brand */}
            <div>
              <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", color: FG, marginBottom: "0.75rem" }}>
                EventSlot
              </div>
              <p style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 300, fontSize: "0.82rem", color: MUTED, margin: 0, maxWidth: 220, lineHeight: 1.6 }}>
                Smart event registration for organizers who move fast.
              </p>
            </div>

            {/* Product */}
            <div>
              <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED_LO, marginBottom: "1rem" }}>Product</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {[["Features", "/#demo"], ["How it works", "/#demo"], ["Get started", "/signup"]].map(([label, href]) => (
                  <Link key={label} href={href} style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.82rem", color: MUTED, textDecoration: "none" }}>{label}</Link>
                ))}
              </div>
            </div>

            {/* Plans */}
            <div>
              <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED_LO, marginBottom: "1rem" }}>Resources</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {[["Downloads", "/dashboard/billing"], ["How it works", "/how-it-works"], ["Create event", "/create"]].map(([label, href]) => (
                  <Link key={label} href={href} style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.82rem", color: MUTED, textDecoration: "none" }}>{label}</Link>
                ))}
              </div>
            </div>

            {/* Company */}
            <div>
              <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED_LO, marginBottom: "1rem" }}>Company</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {[["About", "/"], ["Contact", "/"]].map(([label, href]) => (
                  <Link key={label} href={href} style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.82rem", color: MUTED, textDecoration: "none" }}>{label}</Link>
                ))}
              </div>
            </div>

            {/* Legal */}
            <div>
              <div style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: MUTED_LO, marginBottom: "1rem" }}>Legal</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {[["Privacy Policy", "/privacy"], ["Terms of Service", "/terms"]].map(([label, href]) => (
                  <Link key={label} href={href} style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.82rem", color: MUTED, textDecoration: "none" }}>{label}</Link>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{
            borderTop: "0.5px solid " + BORDER,
            paddingTop: "1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}>
            <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.78rem", color: MUTED }}>
              © 2026 EventSlot · Built for event organizers
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <Link href="/privacy" style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.78rem", color: MUTED_LO, textDecoration: "none" }}>Privacy Policy</Link>
              <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.78rem", color: MUTED_LO }}>·</span>
              <Link href="/terms" style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.78rem", color: MUTED_LO, textDecoration: "none" }}>Terms of Use</Link>
              <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.78rem", color: MUTED_LO }}>·</span>
              <span style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.78rem", color: MUTED_LO }}>
                Made in Nairobi 🇰🇪
              </span>
            </div>
          </div>
        </div>
      </footer>

      {/* ── Responsive overrides ───────────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .step-arrow { display: none !important; }
          .feature-row { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          .footer-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  )
}
