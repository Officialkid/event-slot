import Link from "next/link"
import { getBillingComingSoonHeadline } from "@/lib/pricingRollout"

type BillingComingSoonBannerProps = {
  compact?: boolean
}

export function BillingComingSoonBanner({ compact = false }: BillingComingSoonBannerProps) {
  return (
    <section
      aria-label="Payment system coming soon"
      style={{
        marginBottom: compact ? "1rem" : "1.25rem",
        borderRadius: compact ? 18 : 24,
        border: "0.5px solid color-mix(in srgb, var(--info) 32%, var(--border) 68%)",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--info) 16%, transparent), color-mix(in srgb, var(--accent) 10%, transparent) 55%, color-mix(in srgb, var(--surface) 88%, transparent) 100%)",
        padding: compact ? "1rem" : "1.15rem 1.2rem",
        boxShadow: "0 18px 45px rgba(0,0,0,0.18)",
      }}
    >
      <div style={{ maxWidth: 760 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            borderRadius: 999,
            background: "color-mix(in srgb, var(--bg-page) 55%, transparent)",
            border: "0.5px solid color-mix(in srgb, var(--text-primary) 10%, transparent)",
            padding: "0.3rem 0.7rem",
            color: "color-mix(in srgb, var(--info) 78%, var(--text-primary) 22%)",
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          Coming soon
        </div>
        <h2
          style={{
            margin: "0.75rem 0 0.35rem",
            fontFamily: "var(--font-instrument-serif)",
            fontSize: compact ? "1.2rem" : "1.35rem",
            fontWeight: 400,
            color: "var(--text-primary)",
          }}
        >
          {getBillingComingSoonHeadline()}
        </h2>
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem", lineHeight: 1.7, fontFamily: "var(--font-dm-sans)" }}>
          We are working on this. Payment collection, billing changes, paid-event checkout, and withdrawals are hidden until the rollout is ready. For now, keep using EventSlot with free events.
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginTop: "1rem" }}>
        <Link
          href="/dashboard/events"
          style={{
            borderRadius: 999,
            border: "0.5px solid rgba(200,245,90,0.24)",
            background: "#C8F55A",
            color: "#0A0A0A",
            padding: "0.8rem 1rem",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "0.86rem",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          View free events
        </Link>
        <Link
          href="/dashboard"
          style={{
            borderRadius: 999,
            border: "0.5px solid color-mix(in srgb, var(--text-primary) 16%, transparent)",
            background: "color-mix(in srgb, var(--text-primary) 4%, transparent)",
            color: "var(--text-primary)",
            padding: "0.8rem 1rem",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "0.86rem",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Back to dashboard
        </Link>
      </div>
    </section>
  )
}
