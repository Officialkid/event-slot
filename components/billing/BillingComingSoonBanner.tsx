"use client"

import { useEffect, useState } from "react"
import { getBillingComingSoonHeadline } from "@/lib/pricingRollout"

type BillingComingSoonBannerProps = {
  isAdmin?: boolean
  compact?: boolean
}

const DISMISS_KEY = "eventslot.billingComingSoonBanner.dismissed"

export function BillingComingSoonBanner({
  isAdmin = false,
  compact = false,
}: BillingComingSoonBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const [email, setEmail] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window !== "undefined" && window.sessionStorage.getItem(DISMISS_KEY) === "true") {
      setDismissed(true)
    }
  }, [])

  function dismissBanner() {
    setDismissed(true)
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(DISMISS_KEY, "true")
    }
  }

  async function handleNotifyMe() {
    if (!email.trim()) {
      setMessage("Enter your email address so we can notify you.")
      return
    }

    setSaving(true)
    setMessage("")

    try {
      const response = await fetch("/api/billing/launch-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          previewMode: "text",
          source: isAdmin ? "admin_billing_coming_soon_banner" : "organiser_billing_coming_soon_banner",
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(data.error ?? "Could not save your launch interest right now.")
        return
      }

      setMessage("You are on the notify list for the payments launch.")
      dismissBanner()
    } catch {
      setMessage("Could not save your launch interest right now.")
    } finally {
      setSaving(false)
    }
  }

  if (mounted && dismissed) {
    return null
  }

  return (
    <section
      style={{
        marginBottom: compact ? "1rem" : "1.25rem",
        borderRadius: compact ? 18 : 24,
        border: "0.5px solid rgba(124,199,255,0.24)",
        background: "linear-gradient(135deg, rgba(124,199,255,0.14), rgba(200,245,90,0.08) 55%, rgba(255,255,255,0.02) 100%)",
        padding: compact ? "1rem" : "1.15rem 1.2rem",
        boxShadow: "0 18px 45px rgba(0,0,0,0.18)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ maxWidth: 760 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, borderRadius: 999, background: "rgba(10,10,10,0.35)", border: "0.5px solid rgba(255,255,255,0.08)", padding: "0.3rem 0.7rem", color: "#D8ECFF", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)" }}>
            Coming soon
          </div>
          <h2 style={{ margin: "0.75rem 0 0.35rem", fontFamily: "var(--font-instrument-serif)", fontSize: compact ? "1.2rem" : "1.35rem", fontWeight: 400, color: "#F0EDE6" }}>
            {getBillingComingSoonHeadline()}
          </h2>
          <p style={{ margin: 0, color: "rgba(240,237,230,0.78)", fontSize: "0.9rem", lineHeight: 1.7, fontFamily: "var(--font-dm-sans)" }}>
            We are preparing the official payment system. For now, billing and subscription changes are unavailable. Keep using EventSlot on the free plan and leave your email below if you want the launch announcement.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={dismissBanner}
            style={{
              borderRadius: 999,
              border: "0.5px solid rgba(240,237,230,0.16)",
              background: "rgba(255,255,255,0.04)",
              color: "#F0EDE6",
              padding: "0.75rem 1rem",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "0.86rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginTop: "1rem" }}>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email for the launch announcement"
          style={{
            flex: "1 1 280px",
            minWidth: 220,
            borderRadius: 999,
            border: "0.5px solid rgba(240,237,230,0.14)",
            background: "rgba(10,10,10,0.28)",
            color: "#F0EDE6",
            padding: "0.8rem 1rem",
            fontSize: "0.86rem",
            fontFamily: "var(--font-dm-sans)",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => void handleNotifyMe()}
          disabled={saving}
          style={{
            borderRadius: 999,
            border: "0.5px solid rgba(200,245,90,0.24)",
            background: "#C8F55A",
            color: "#0A0A0A",
            padding: "0.8rem 1rem",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "0.86rem",
            fontWeight: 800,
            cursor: saving ? "default" : "pointer",
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? "Saving..." : "Notify me"}
        </button>
      </div>

      {message ? (
        <p style={{ margin: "0.85rem 0 0", color: message.includes("notify list") ? "#C8F55A" : "#FF8E7D", fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)" }}>
          {message}
        </p>
      ) : null}
    </section>
  )
}
