"use client"

import { useState, Fragment } from "react"

type PlanValue = boolean | string

interface ComparisonRow {
  feature: string
  free: PlanValue
  pro: PlanValue
  business: PlanValue
}

interface ComparisonSection {
  title: string
  rows: ComparisonRow[]
}

const comparisonSections: ComparisonSection[] = [
  {
    title: "Core",
    rows: [
      { feature: "Active events", free: "1", pro: "Unlimited", business: "Unlimited" },
      { feature: "Registrations per event", free: "100", pro: "500", business: "Unlimited" },
      { feature: "Waitlist", free: true, pro: true, business: true },
      { feature: "Form questions", free: "Unlimited", pro: "Unlimited", business: "Unlimited" },
      { feature: "Waitlist automation", free: true, pro: true, business: true },
      { feature: "Community link", free: true, pro: true, business: true },
      { feature: "Email notifications", free: true, pro: true, business: true },
    ],
  },
  {
    title: "Data & Export",
    rows: [
      { feature: "Data retention", free: "30 days", pro: "Forever", business: "Forever" },
      { feature: "CSV export", free: false, pro: true, business: true },
      { feature: "Event reports (Word)", free: false, pro: true, business: true },
    ],
  },
  {
    title: "Customisation",
    rows: [
      { feature: "Remove EventSlot watermark", free: false, pro: true, business: true },
      { feature: "Custom thank you message", free: false, pro: true, business: true },
      { feature: "Custom domain", free: false, pro: false, business: true },
    ],
  },
  {
    title: "Analytics & Insights",
    rows: [
      { feature: "Analytics", free: false, pro: true, business: "Advanced" },
      { feature: "Attendee demographics", free: false, pro: false, business: true },
      { feature: "Post-event feedback form", free: false, pro: false, business: true },
    ],
  },
  {
    title: "Team & Operations",
    rows: [
      { feature: "Team members", free: "1", pro: "2", business: "5" },
      { feature: "Duplicate events", free: false, pro: true, business: true },
      { feature: "Bulk registration", free: false, pro: "Up to 20", business: "Unlimited" },
      { feature: "QR code check-in", free: false, pro: false, business: "Coming soon" },
      { feature: "Priority support", free: false, pro: false, business: true },
    ],
  },
]

const faqItems = [
  {
    q: "Can I upgrade or downgrade at any time?",
    a: "Yes. Upgrades take effect immediately. Downgrades take effect at the end of your billing period.",
  },
  {
    q: "What happens to my data if I downgrade to free?",
    a: "Your data is kept for 30 days after downgrading. Export it before then.",
  },
  {
    q: "Do you offer refunds?",
    a: "We offer a 7-day refund on your first payment if you are not satisfied.",
  },
  {
    q: "Is there a limit on attendees for free events?",
    a: "Free accounts support up to 100 confirmed registrations per event. The waitlist is always unlimited.",
  },
]

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}>
      <circle cx="8" cy="8" r="8" fill="rgba(200,245,90,0.15)" />
      <path d="M5 8l2.2 2.4L11 5.5" stroke="#C8F55A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: "inline-block", verticalAlign: "middle" }}>
      <circle cx="8" cy="8" r="8" fill="rgba(240,237,230,0.05)" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="rgba(240,237,230,0.2)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function FeatureItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.55rem",
        fontSize: "0.82rem",
        color: ok ? "rgba(240,237,230,0.75)" : "rgba(240,237,230,0.3)",
        fontFamily: "var(--font-dm-sans)",
        lineHeight: 1.45,
      }}
    >
      <span style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2 }}>
        {ok ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="7" fill="rgba(200,245,90,0.15)" />
            <path d="M4 7l2 2.2L10 4.5" stroke="#C8F55A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="7" fill="rgba(240,237,230,0.05)" />
            <path d="M4.5 4.5l5 5M9.5 4.5l-5 5" stroke="rgba(240,237,230,0.2)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </span>
      {label}
    </li>
  )
}

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly")
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [regs, setRegs] = useState(500)
  const [loading, setLoading] = useState<string | null>(null)
  const isAnnual = billing === "annual"

  async function handleUpgrade(plan: "pro" | "business") {
    const key = `${plan}_${billing}`
    setLoading(key)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, billingCycle: billing }),
      })
      const data = await res.json()
      if (res.status === 401) {
        window.location.href = `/signin?callbackUrl=/pricing`
        return
      }
      if (!res.ok) {
        alert(`Error: ${data.error ?? "Something went wrong"}`)
        return
      }
      window.location.href = data.url
    } catch {
      alert("Something went wrong. Please try again.")
    } finally {
      setLoading(null)
    }
  }

  return (
    <main style={{ background: "#0A0A0A", minHeight: "100vh", color: "#F0EDE6" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "4rem 1.5rem" }}>

        {/* PAGE HEADER */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              borderRadius: 100,
              border: "1px solid #C8F55A",
              padding: "0.25rem 0.75rem",
              fontSize: "0.72rem",
              fontWeight: 600,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#C8F55A",
              fontFamily: "var(--font-dm-sans)",
              marginBottom: "1.5rem",
            }}
          >
            Simple pricing
          </div>
          <h1
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "clamp(2.2rem, 5vw, 3.2rem)",
              fontWeight: 400,
              color: "#F0EDE6",
              lineHeight: 1.1,
              marginBottom: "0.75rem",
            }}
          >
            Pay for what you need.
          </h1>
          <p
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontWeight: 300,
              fontSize: "1rem",
              color: "rgba(240,237,230,0.5)",
              margin: 0,
            }}
          >
            Start free. Upgrade when your events grow.
          </p>
        </div>

        {/* BILLING TOGGLE */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "3.5rem" }}>
          <div
            style={{
              background: "#141414",
              border: "0.5px solid rgba(240,237,230,0.1)",
              borderRadius: 100,
              padding: 4,
              display: "inline-flex",
            }}
          >
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              style={{
                padding: "0.4rem 1.25rem",
                borderRadius: 100,
                border: "none",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
                fontFamily: "var(--font-dm-sans)",
                transition: "background 0.2s, color 0.2s",
                background: !isAnnual ? "#C8F55A" : "transparent",
                color: !isAnnual ? "#0A0A0A" : "rgba(240,237,230,0.45)",
              }}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              style={{
                padding: "0.4rem 1.25rem",
                borderRadius: 100,
                border: "none",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
                fontFamily: "var(--font-dm-sans)",
                transition: "background 0.2s, color 0.2s",
                background: isAnnual ? "#C8F55A" : "transparent",
                color: isAnnual ? "#0A0A0A" : "rgba(240,237,230,0.45)",
              }}
            >
              Annual (save 20%)
            </button>
          </div>
        </div>

        {/* PRICING CARDS */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start"
          style={{ marginBottom: "5rem" }}
        >
          {/* FREE */}
          <div
            style={{
              background: "#141414",
              border: "0.5px solid rgba(240,237,230,0.08)",
              borderRadius: 16,
              padding: "2rem",
            }}
          >
            <p style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6", margin: "0 0 0.5rem" }}>
              Free
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem", marginBottom: "0.4rem" }}>
              <span style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2.4rem", color: "#F0EDE6" }}>$0</span>
              <span style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)" }}>
                &nbsp;/ month
              </span>
            </div>
            <p style={{ fontSize: "0.8rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", margin: "0 0 1.5rem" }}>
              For occasional organizers
            </p>
            <a
              href="/signup"
              style={{
                display: "block",
                padding: "0.65rem 1rem",
                borderRadius: 100,
                border: "0.5px solid rgba(240,237,230,0.2)",
                background: "transparent",
                color: "#F0EDE6",
                fontSize: "0.875rem",
                fontWeight: 500,
                fontFamily: "var(--font-dm-sans)",
                textAlign: "center",
                textDecoration: "none",
                marginBottom: "1.75rem",
              }}
            >
              Get started
            </a>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {[
                { label: "1 active event", ok: true },
                { label: "100 registrations per event", ok: true },
                { label: "Unlimited waitlist", ok: true },
                { label: "Unlimited form questions", ok: true },
                { label: "Waitlist automation", ok: true },
                { label: "Community link", ok: true },
                { label: "Email notifications (with consent)", ok: true },
                { label: "Data deleted after 30 days", ok: false },
                { label: "EventSlot watermark on pages", ok: false },
                { label: "No CSV export", ok: false },
                { label: "No event reports", ok: false },
              ].map((f, i) => (
                <FeatureItem key={i} label={f.label} ok={f.ok} />
              ))}
            </ul>
          </div>

          {/* PRO — highlighted */}
          <div style={{ position: "relative", paddingTop: 20 }}>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                background: "rgba(200,245,90,0.12)",
                border: "0.5px solid rgba(200,245,90,0.3)",
                borderRadius: 100,
                padding: "0.2rem 0.85rem",
                fontSize: "0.65rem",
                fontWeight: 700,
                color: "#C8F55A",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                fontFamily: "var(--font-dm-sans)",
                whiteSpace: "nowrap",
                zIndex: 1,
              }}
            >
              Most popular
            </div>
            <div
              style={{
                background: "#141414",
                border: "1.5px solid rgba(200,245,90,0.3)",
                borderRadius: 16,
                padding: "2rem",
              }}
            >
              <p style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6", margin: "0 0 0.5rem" }}>
                Pro
              </p>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2.4rem", color: "#F0EDE6" }}>
                  {isAnnual ? "$16" : "$20"}
                </span>
                <span style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)" }}>
                  {isAnnual ? "\u00a0/ month, billed $192/year" : "\u00a0/ month"}
                </span>
              </div>
              {isAnnual && (
                <div style={{ marginBottom: "0.4rem" }}>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "0.68rem",
                      background: "rgba(200,245,90,0.12)",
                      color: "#C8F55A",
                      padding: "0.15rem 0.55rem",
                      borderRadius: 100,
                      fontWeight: 600,
                      fontFamily: "var(--font-dm-sans)",
                      border: "0.5px solid rgba(200,245,90,0.25)",
                    }}
                  >
                    Save $48/year
                  </span>
                </div>
              )}
              <p style={{ fontSize: "0.8rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", margin: "0 0 1.5rem" }}>
                For active event organizers
              </p>
              <button
                type="button"
                onClick={() => handleUpgrade("pro")}
                disabled={loading !== null}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "0.65rem 1rem",
                  borderRadius: 100,
                  border: "none",
                  background: loading === `pro_${billing}` ? "rgba(200,245,90,0.5)" : "#C8F55A",
                  color: "#0A0A0A",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  fontFamily: "var(--font-dm-sans)",
                  textAlign: "center",
                  cursor: loading !== null ? "not-allowed" : "pointer",
                  marginBottom: "1.75rem",
                }}
              >
                {loading === `pro_${billing}` ? "Redirecting..." : "Upgrade to Pro"}
              </button>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {[
                  "Everything in Free",
                  "Unlimited active events",
                  "500 registrations per event",
                  "Data stored forever",
                  "Export attendees (CSV)",
                  "Event report download (Word)",
                  "Remove EventSlot watermark",
                  "Event analytics",
                  "Custom thank you message",
                  "Duplicate events",
                  "2 team members",
                  "Bulk registration (up to 20)",
                ].map((f, i) => (
                  <FeatureItem key={i} label={f} ok={true} />
                ))}
              </ul>
            </div>
          </div>

          {/* BUSINESS */}
          <div
            style={{
              background: "#141414",
              border: "0.5px solid rgba(240,237,230,0.08)",
              borderRadius: 16,
              padding: "2rem",
            }}
          >
            <p style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6", margin: "0 0 0.5rem" }}>
              Business
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem", marginBottom: "0.25rem", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2.4rem", color: "#F0EDE6" }}>
                {isAnnual ? "$80" : "$100"}
              </span>
              <span style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)" }}>
                {isAnnual ? "\u00a0/ month, billed $960/year" : "\u00a0/ month"}
              </span>
            </div>
            {isAnnual && (
              <div style={{ marginBottom: "0.4rem" }}>
                <span
                  style={{
                    display: "inline-block",
                    fontSize: "0.68rem",
                    background: "rgba(200,245,90,0.12)",
                    color: "#C8F55A",
                    padding: "0.15rem 0.55rem",
                    borderRadius: 100,
                    fontWeight: 600,
                    fontFamily: "var(--font-dm-sans)",
                    border: "0.5px solid rgba(200,245,90,0.25)",
                  }}
                >
                  Save $240/year
                </span>
              </div>
            )}
            <p style={{ fontSize: "0.8rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", margin: "0 0 1.5rem" }}>
              For teams and organisations
            </p>
            <button
              type="button"
              onClick={() => handleUpgrade("business")}
              disabled={loading !== null}
              style={{
                display: "block",
                width: "100%",
                padding: "0.65rem 1rem",
                borderRadius: 100,
                border: "0.5px solid rgba(240,237,230,0.2)",
                background: loading === `business_${billing}` ? "rgba(240,237,230,0.08)" : "transparent",
                color: "#F0EDE6",
                fontSize: "0.875rem",
                fontWeight: 500,
                fontFamily: "var(--font-dm-sans)",
                textAlign: "center",
                cursor: loading !== null ? "not-allowed" : "pointer",
                marginBottom: "1.75rem",
              }}
            >
              {loading === `business_${billing}` ? "Redirecting..." : "Upgrade to Business"}
            </button>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {[
                "Everything in Pro",
                "Unlimited registrations",
                "5 team members",
                "Custom domain",
                "Advanced analytics + Insight Tracker",
                "Post-event feedback form",
                "Attendee demographics",
                "Priority support",
                "QR code check-in (coming soon)",
              ].map((f, i) => (
                <FeatureItem key={i} label={f} ok={true} />
              ))}
            </ul>
          </div>
        </div>

        {/* PAY AS YOU GO */}
        <div style={{ marginBottom: "5rem" }}>
          <div style={{ marginBottom: "1.75rem" }}>
            <h2
              style={{
                fontFamily: "var(--font-instrument-serif)",
                fontSize: "1.3rem",
                fontWeight: 400,
                color: "#F0EDE6",
                margin: "0 0 0.4rem",
              }}
            >
              Only need it once?
            </h2>
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.875rem",
                color: "rgba(240,237,230,0.45)",
                margin: 0,
              }}
            >
              Use credits for one-time access. No subscription needed.
            </p>
          </div>

          {/* Credits pricing table */}
          <div
            style={{
              background: "#141414",
              border: "0.5px solid rgba(240,237,230,0.08)",
              borderRadius: 16,
              overflow: "hidden",
              marginBottom: "1.5rem",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "rgba(240,237,230,0.03)", borderBottom: "0.5px solid rgba(240,237,230,0.07)" }}>
                  <th style={{ padding: "0.75rem 1.25rem", textAlign: "left", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>Feature</th>
                  <th style={{ padding: "0.75rem 1.25rem", textAlign: "right", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { feature: "Registrations (per 100 after free threshold)", cost: "$1" },
                  { feature: "Remove EventSlot watermark (one event)", cost: "$5" },
                  { feature: "Export CSV", cost: "$2 + $1/100 registrations" },
                  { feature: "Download Word report", cost: "$3 + $1/100 registrations" },
                  { feature: "Unlock analytics (one event)", cost: "$4" },
                  { feature: "Custom thank you message", cost: "$2" },
                ] as const).map((row, i) => (
                  <tr key={i} style={{ borderTop: "0.5px solid rgba(240,237,230,0.05)" }}>
                    <td style={{ padding: "0.875rem 1.25rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.65)", fontFamily: "var(--font-dm-sans)" }}>
                      {row.feature}
                    </td>
                    <td style={{ padding: "0.875rem 1.25rem", fontSize: "0.82rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontWeight: 500, textAlign: "right", whiteSpace: "nowrap" as const }}>
                      {row.cost}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ padding: "0.875rem 1.25rem", borderTop: "0.5px solid rgba(240,237,230,0.07)", background: "rgba(200,245,90,0.03)" }}>
              <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(200,245,90,0.65)", fontFamily: "var(--font-dm-sans)" }}>
                First 100 registrations are always free on every plan.
              </p>
            </div>
          </div>

          {/* Credits calculator */}
          <div
            style={{
              background: "#141414",
              border: "0.5px solid rgba(240,237,230,0.08)",
              borderRadius: 16,
              padding: "1.75rem",
            }}
          >
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.25rem" }}>
                <label
                  htmlFor="reg-slider"
                  style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem", color: "#F0EDE6", fontWeight: 500 }}
                >
                  How many registrations do you expect?
                </label>
                <span style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#C8F55A" }}>
                  {regs.toLocaleString()}
                </span>
              </div>
              <input
                id="reg-slider"
                type="range"
                min={100}
                max={10000}
                step={100}
                value={regs}
                onChange={e => setRegs(Number(e.target.value))}
                style={{ width: "100%", accentColor: "#C8F55A", cursor: "pointer" }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.35rem" }}>
                <span style={{ fontSize: "0.7rem", color: "rgba(240,237,230,0.25)", fontFamily: "var(--font-dm-sans)" }}>100</span>
                <span style={{ fontSize: "0.7rem", color: "rgba(240,237,230,0.25)", fontFamily: "var(--font-dm-sans)" }}>10,000</span>
              </div>
            </div>

            {/* Cost breakdown pills */}
            <div
              style={{
                background: "rgba(240,237,230,0.03)",
                border: "0.5px solid rgba(240,237,230,0.07)",
                borderRadius: 10,
                padding: "0.75rem 1rem",
                marginBottom: "1.25rem",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "0.125rem",
              }}
            >
              <span style={{ fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)", color: "rgba(240,237,230,0.6)", padding: "0.2rem 0.5rem" }}>
                0–100: <strong style={{ color: "#C8F55A" }}>Free</strong>
              </span>
              {regs > 100 && (
                <>
                  <span style={{ color: "rgba(240,237,230,0.2)", fontSize: "0.82rem" }}>|</span>
                  <span style={{ fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)", color: "rgba(240,237,230,0.6)", padding: "0.2rem 0.5rem" }}>
                    101–{Math.min(regs, 500).toLocaleString()}:{" "}
                    <strong style={{ color: "#F0EDE6" }}>${Math.min(Math.ceil((regs - 100) / 100), 4)}</strong>
                  </span>
                </>
              )}
              {regs > 500 && (
                <>
                  <span style={{ color: "rgba(240,237,230,0.2)", fontSize: "0.82rem" }}>|</span>
                  <span style={{ fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)", color: "rgba(240,237,230,0.6)", padding: "0.2rem 0.5rem" }}>
                    501–{regs.toLocaleString()}:{" "}
                    <strong style={{ color: "#F0EDE6" }}>${Math.ceil((regs - 100) / 100)}</strong>
                  </span>
                </>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
              <div>
                <span style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)" }}>
                  Total credits needed:{" "}
                </span>
                <span style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.1rem", color: regs <= 100 ? "#C8F55A" : "#F0EDE6" }}>
                  {regs <= 100 ? "Free" : `$${Math.ceil((regs - 100) / 100)} in credits`}
                </span>
              </div>
              <a
                href="/dashboard/billing#credits"
                style={{
                  padding: "0.55rem 1.25rem",
                  borderRadius: 100,
                  background: "#C8F55A",
                  color: "#0A0A0A",
                  fontSize: "0.825rem",
                  fontWeight: 600,
                  fontFamily: "var(--font-dm-sans)",
                  textDecoration: "none",
                  whiteSpace: "nowrap" as const,
                  display: "inline-block",
                }}
              >
                Buy credits
              </a>
            </div>
          </div>
        </div>

        {/* FEATURE COMPARISON TABLE */}
        <div style={{ marginBottom: "5rem" }}>
          <h2
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "1.6rem",
              fontWeight: 400,
              color: "#F0EDE6",
              marginBottom: "1.5rem",
            }}
          >
            Compare plans
          </h2>
          <div style={{ overflowX: "auto", borderRadius: 12, border: "0.5px solid rgba(240,237,230,0.08)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
              <thead>
                <tr>
                  <th
                    style={{
                      padding: "0.9rem 1.25rem",
                      textAlign: "left",
                      fontSize: "0.72rem",
                      fontWeight: 600,
                      color: "rgba(240,237,230,0.35)",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      fontFamily: "var(--font-dm-sans)",
                      background: "#141414",
                      borderBottom: "0.5px solid rgba(240,237,230,0.08)",
                      width: "40%",
                    }}
                  >
                    Feature
                  </th>
                  {(["Free", "Pro", "Business"] as const).map(plan => (
                    <th
                      key={plan}
                      style={{
                        padding: "0.9rem 1.25rem",
                        textAlign: "center",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        color: plan === "Pro" ? "#C8F55A" : "rgba(240,237,230,0.35)",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        fontFamily: "var(--font-dm-sans)",
                        background: "#141414",
                        borderBottom: "0.5px solid rgba(240,237,230,0.08)",
                      }}
                    >
                      {plan}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonSections.map((section, sIdx) => (
                  <Fragment key={`s-${sIdx}`}>
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          padding: "0.7rem 1.25rem 0.45rem",
                          fontSize: "0.65rem",
                          fontWeight: 700,
                          color: "rgba(240,237,230,0.25)",
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          fontFamily: "var(--font-dm-sans)",
                          background: "rgba(240,237,230,0.015)",
                          borderTop: sIdx > 0 ? "0.5px solid rgba(240,237,230,0.06)" : "none",
                        }}
                      >
                        {section.title}
                      </td>
                    </tr>
                    {section.rows.map((row, rIdx) => (
                      <tr
                        key={`r-${sIdx}-${rIdx}`}
                        style={{
                          background: rIdx % 2 !== 0 ? "rgba(240,237,230,0.015)" : "transparent",
                          borderTop: "0.5px solid rgba(240,237,230,0.04)",
                        }}
                      >
                        <td style={{ padding: "0.75rem 1.25rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.65)", fontFamily: "var(--font-dm-sans)" }}>
                          {row.feature}
                        </td>
                        {(["free", "pro", "business"] as const).map(plan => {
                          const val = row[plan]
                          if (typeof val === "boolean") {
                            return (
                              <td key={plan} style={{ padding: "0.75rem 1.25rem", textAlign: "center" }}>
                                <span style={{ display: "inline-flex", justifyContent: "center" }}>
                                  {val ? <CheckIcon /> : <CrossIcon />}
                                </span>
                              </td>
                            )
                          }
                          return (
                            <td
                              key={plan}
                              style={{
                                padding: "0.75rem 1.25rem",
                                textAlign: "center",
                                fontSize: "0.82rem",
                                color: plan === "pro" ? "rgba(200,245,90,0.85)" : "rgba(240,237,230,0.6)",
                                fontFamily: "var(--font-dm-sans)",
                                fontWeight: plan === "pro" ? 500 : 400,
                              }}
                            >
                              {val}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 680, margin: "0 auto 4rem" }}>
          <h2
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "1.6rem",
              fontWeight: 400,
              color: "#F0EDE6",
              marginBottom: "1.5rem",
            }}
          >
            Frequently asked questions
          </h2>
          {faqItems.map((item, i) => {
            const isOpen = openFaq === i
            return (
              <div key={i} style={{ borderBottom: "0.5px solid rgba(240,237,230,0.08)" }}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    padding: "1rem 0",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    gap: "1rem",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans)",
                      fontWeight: 500,
                      fontSize: "0.9rem",
                      color: "#F0EDE6",
                    }}
                  >
                    {item.q}
                  </span>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    style={{
                      flexShrink: 0,
                      transition: "transform 0.2s",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                    }}
                  >
                    <path d="M3 6l5 5 5-5" stroke="rgba(240,237,230,0.45)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {isOpen && (
                  <p
                    style={{
                      fontFamily: "var(--font-dm-sans)",
                      fontWeight: 300,
                      fontSize: "0.875rem",
                      color: "rgba(240,237,230,0.55)",
                      paddingTop: "0.25rem",
                      paddingBottom: "1rem",
                      margin: 0,
                      lineHeight: 1.65,
                    }}
                  >
                    {item.a}
                  </p>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </main>
  )
}
