"use client"

type PaymentMaintenanceBannerProps = {
  title?: string
  message?: string
  compact?: boolean
}

export function PaymentMaintenanceBanner({
  title = "Payments are under maintenance",
  message = "We are temporarily unable to offer paid-event checkout or organiser billing. Please continue using EventSlot on the free plan while we complete the live payment setup.",
  compact = false,
}: PaymentMaintenanceBannerProps) {
  return (
    <section
      style={{
        marginBottom: compact ? "1rem" : "1.25rem",
        borderRadius: compact ? 18 : 22,
        border: "0.5px solid rgba(255,184,77,0.24)",
        background: "linear-gradient(135deg, rgba(255,184,77,0.12), rgba(255,255,255,0.02) 72%)",
        padding: compact ? "1rem" : "1.1rem 1.2rem",
      }}
    >
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, background: "rgba(10,10,10,0.32)", border: "0.5px solid rgba(255,255,255,0.08)", padding: "0.3rem 0.7rem", color: "#FFB84D", fontSize: "0.68rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)" }}>
        Maintenance
      </div>
      <h2 style={{ margin: "0.7rem 0 0.35rem", fontFamily: "var(--font-instrument-serif)", fontSize: compact ? "1.18rem" : "1.3rem", fontWeight: 400, color: "#F0EDE6" }}>
        {title}
      </h2>
      <p style={{ margin: 0, color: "rgba(240,237,230,0.78)", fontSize: "0.88rem", lineHeight: 1.7, fontFamily: "var(--font-dm-sans)" }}>
        {message}
      </p>
    </section>
  )
}
