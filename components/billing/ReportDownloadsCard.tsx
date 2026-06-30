"use client"

import { useState } from "react"

type ReportBundle = {
  key: string
  amount: number
  downloads: number
  label: string
}

type ReportDownloadsCardProps = {
  bundles: ReportBundle[]
  initialRemaining: number
  initialTotalPurchased: number
}

export function ReportDownloadsCard({
  bundles,
  initialRemaining,
  initialTotalPurchased,
}: ReportDownloadsCardProps) {
  const [submittingKey, setSubmittingKey] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function handleBuy(bundleKey: string) {
    setSubmittingKey(bundleKey)
    setError("")

    try {
      const response = await fetch("/api/billing/report-downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundleKey }),
      })

      const data = await response.json()
      if (!response.ok || !data.url) {
        setError(data.error ?? "Could not start checkout for report downloads.")
        return
      }

      window.location.assign(data.url)
    } catch {
      setError("Could not connect to the payment service right now.")
    } finally {
      setSubmittingKey(null)
    }
  }

  return (
    <section
      id="report-downloads"
      style={{
        background: "#141414",
        border: "0.5px solid rgba(240,237,230,0.08)",
        borderRadius: 14,
        padding: "1.25rem",
        marginBottom: "1rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: "0 0 0.35rem", fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6" }}>
            Report downloads
          </h2>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.7, maxWidth: 620 }}>
            Report previews stay free. Downloading the full Word report uses 1 paid download slot. Buy a bundle here and we will add it to your organiser account after secure Paystack checkout.
          </p>
        </div>
        <div style={{ display: "grid", gap: "0.45rem", minWidth: 210 }}>
          <div style={{ borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(240,237,230,0.08)", padding: "0.75rem 0.9rem" }}>
            <div style={{ fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)" }}>
              Remaining downloads
            </div>
            <div style={{ marginTop: "0.3rem", fontSize: "1.2rem", fontWeight: 700, color: "#C8F55A", fontFamily: "var(--font-dm-sans)" }}>
              {initialRemaining}
            </div>
          </div>
          <div style={{ borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(240,237,230,0.08)", padding: "0.75rem 0.9rem" }}>
            <div style={{ fontSize: "0.72rem", letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)" }}>
              Total purchased
            </div>
            <div style={{ marginTop: "0.3rem", fontSize: "1.05rem", fontWeight: 600, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>
              {initialTotalPurchased}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gap: "0.85rem", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginTop: "1rem" }}>
        {bundles.map((bundle) => (
          <div
            key={bundle.key}
            style={{
              borderRadius: 12,
              border: "0.5px solid rgba(240,237,230,0.08)",
              background: "rgba(255,255,255,0.02)",
              padding: "1rem",
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
              {bundle.downloads} download{bundle.downloads === 1 ? "" : "s"}
            </div>
            <div style={{ marginTop: "0.45rem", fontSize: "1.3rem", color: "#F0EDE6", fontFamily: "var(--font-instrument-serif)" }}>
              KSh {bundle.amount.toLocaleString()}
            </div>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
              {bundle.label}
            </p>
            <button
              type="button"
              onClick={() => void handleBuy(bundle.key)}
              disabled={submittingKey === bundle.key}
              style={{
                marginTop: "0.9rem",
                width: "100%",
                borderRadius: 999,
                border: "0.5px solid rgba(200,245,90,0.24)",
                background: "#C8F55A",
                color: "#0A0A0A",
                padding: "0.72rem 1rem",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.88rem",
                fontWeight: 700,
                cursor: submittingKey === bundle.key ? "default" : "pointer",
                opacity: submittingKey === bundle.key ? 0.7 : 1,
              }}
            >
              {submittingKey === bundle.key ? "Starting checkout..." : "Buy this bundle"}
            </button>
          </div>
        ))}
      </div>

      {error ? (
        <p style={{ margin: "0.9rem 0 0", color: "#FF8E7D", fontSize: "0.84rem", fontFamily: "var(--font-dm-sans)" }}>
          {error}
        </p>
      ) : null}
    </section>
  )
}
