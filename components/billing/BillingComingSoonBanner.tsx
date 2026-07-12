"use client"

import { useMemo, useState } from "react"
import { getBillingComingSoonHeadline } from "@/lib/pricingRollout"
import { SUBSCRIPTION_PLANS, formatCommissionRate } from "@/lib/subscriptionPlans"

type BillingComingSoonBannerProps = {
  isAdmin?: boolean
  compact?: boolean
}

export function BillingComingSoonBanner({
  isAdmin = false,
  compact = false,
}: BillingComingSoonBannerProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"visuals" | "text">("visuals")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const planPreview = useMemo(() => SUBSCRIPTION_PLANS.filter((plan) => plan.key !== "free"), [])

  async function handleNotifyMe() {
    setSaving(true)
    setMessage("")

    try {
      const response = await fetch("/api/billing/launch-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          previewMode: mode,
          source: isAdmin ? "admin_billing_coming_soon_banner" : "organiser_billing_coming_soon_banner",
        }),
      })

      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(data.error ?? "Could not save your launch interest right now.")
        return
      }

      setMessage("You are on the notify list for the payments launch.")
    } catch {
      setMessage("Could not save your launch interest right now.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
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
              Launch preview
            </div>
            <h2 style={{ margin: "0.75rem 0 0.35rem", fontFamily: "var(--font-instrument-serif)", fontSize: compact ? "1.2rem" : "1.35rem", fontWeight: 400, color: "#F0EDE6" }}>
              {getBillingComingSoonHeadline()}
            </h2>
            <p style={{ margin: 0, color: "rgba(240,237,230,0.78)", fontSize: "0.9rem", lineHeight: 1.7, fontFamily: "var(--font-dm-sans)" }}>
              Everyone currently keeps full access while we finish the payment rollout. You can preview the upcoming packages, understand what changes later, and ask EventSlot to notify you when billing officially opens.
            </p>
            {isAdmin ? (
              <p style={{ margin: "0.55rem 0 0", color: "#C8F55A", fontSize: "0.82rem", lineHeight: 1.6, fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}>
                Super admin accounts remain fully privileged and are not meant to be restricted by organiser billing.
              </p>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setOpen(true)}
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
              More
            </button>
            <button
              type="button"
              onClick={() => void handleNotifyMe()}
              disabled={saving}
              style={{
                borderRadius: 999,
                border: "0.5px solid rgba(200,245,90,0.24)",
                background: "#C8F55A",
                color: "#0A0A0A",
                padding: "0.75rem 1rem",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.86rem",
                fontWeight: 800,
                cursor: saving ? "default" : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "Saving..." : "Notify me at launch"}
            </button>
          </div>
        </div>

        {message ? (
          <p style={{ margin: "0.85rem 0 0", color: message.includes("notify list") ? "#C8F55A" : "#FF8E7D", fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)" }}>
            {message}
          </p>
        ) : null}
      </section>

      {open ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(1020px, 96vw)",
              maxHeight: "88vh",
              overflowY: "auto",
              borderRadius: 28,
              border: "0.5px solid rgba(240,237,230,0.1)",
              background: "#0E0E0E",
              padding: "1.25rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
              <div>
                <p style={{ margin: 0, color: "#D8ECFF", fontSize: "0.72rem", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)", fontWeight: 700 }}>
                  EventSlot billing preview
                </p>
                <h3 style={{ margin: "0.45rem 0 0", fontFamily: "var(--font-instrument-serif)", fontSize: "1.55rem", fontWeight: 400, color: "#F0EDE6" }}>
                  What users will get once payments launch
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  borderRadius: 999,
                  border: "0.5px solid rgba(240,237,230,0.12)",
                  background: "transparent",
                  color: "rgba(240,237,230,0.72)",
                  padding: "0.55rem 0.9rem",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <div style={{ display: "inline-flex", borderRadius: 999, border: "0.5px solid rgba(240,237,230,0.12)", background: "rgba(255,255,255,0.03)", padding: "0.25rem", marginBottom: "1rem" }}>
              {(["visuals", "text"] as const).map((option) => {
                const active = mode === option
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMode(option)}
                    style={{
                      borderRadius: 999,
                      border: "none",
                      background: active ? "#C8F55A" : "transparent",
                      color: active ? "#0A0A0A" : "rgba(240,237,230,0.65)",
                      padding: "0.6rem 0.95rem",
                      fontFamily: "var(--font-dm-sans)",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      textTransform: "capitalize",
                    }}
                  >
                    {option}
                  </button>
                )
              })}
            </div>

            {mode === "visuals" ? (
              <div style={{ display: "grid", gap: "0.95rem", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                {planPreview.map((plan) => (
                  <article
                    key={plan.key}
                    style={{
                      borderRadius: 22,
                      border: plan.key === "pro" ? "0.5px solid rgba(200,245,90,0.28)" : "0.5px solid rgba(240,237,230,0.08)",
                      background: plan.key === "pro" ? "linear-gradient(180deg, rgba(200,245,90,0.1), rgba(255,255,255,0.02))" : "rgba(255,255,255,0.02)",
                      padding: "1rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
                      <div>
                        <p style={{ margin: 0, color: "#F0EDE6", fontSize: "1.05rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>
                          {plan.name}
                        </p>
                        <p style={{ margin: "0.25rem 0 0", color: "rgba(240,237,230,0.56)", fontSize: "0.8rem", fontFamily: "var(--font-dm-sans)" }}>
                          ${plan.monthlyPriceUsd}/month or ${plan.annualPriceUsd}/year
                        </p>
                      </div>
                      <span style={{ color: plan.key === "pro" ? "#C8F55A" : "#D8ECFF", fontSize: "0.78rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>
                        {formatCommissionRate(plan.commissionRate)}
                      </span>
                    </div>
                    <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.9rem" }}>
                      {plan.highlights.slice(0, 4).map((item) => (
                        <div key={item} style={{ color: "rgba(240,237,230,0.72)", fontSize: "0.82rem", lineHeight: 1.55, fontFamily: "var(--font-dm-sans)" }}>
                          {item}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gap: "0.9rem" }}>
                <section style={{ borderRadius: 20, border: "0.5px solid rgba(240,237,230,0.08)", background: "rgba(255,255,255,0.02)", padding: "1rem" }}>
                  <h4 style={{ margin: "0 0 0.4rem", color: "#F0EDE6", fontSize: "1rem", fontFamily: "var(--font-dm-sans)", fontWeight: 700 }}>
                    What happens right now
                  </h4>
                  <p style={{ margin: 0, color: "rgba(240,237,230,0.68)", fontSize: "0.88rem", lineHeight: 1.75, fontFamily: "var(--font-dm-sans)" }}>
                    Everyone keeps full EventSlot access while we prepare the live payment rails. That means users can continue creating, growing, and testing events without losing tools during this rollout window.
                  </p>
                </section>
                <section style={{ borderRadius: 20, border: "0.5px solid rgba(240,237,230,0.08)", background: "rgba(255,255,255,0.02)", padding: "1rem" }}>
                  <h4 style={{ margin: "0 0 0.4rem", color: "#F0EDE6", fontSize: "1rem", fontFamily: "var(--font-dm-sans)", fontWeight: 700 }}>
                    What the packages will introduce
                  </h4>
                  <p style={{ margin: 0, color: "rgba(240,237,230,0.68)", fontSize: "0.88rem", lineHeight: 1.75, fontFamily: "var(--font-dm-sans)" }}>
                    The upcoming plans will make organiser billing clearer, reduce commission for stronger organisers, unlock bigger event capacity, and create a more structured path for premium workflows like reporting, team growth, analytics depth, and advanced controls.
                  </p>
                </section>
                <section style={{ borderRadius: 20, border: "0.5px solid rgba(240,237,230,0.08)", background: "rgba(255,255,255,0.02)", padding: "1rem" }}>
                  <h4 style={{ margin: "0 0 0.4rem", color: "#F0EDE6", fontSize: "1rem", fontFamily: "var(--font-dm-sans)", fontWeight: 700 }}>
                    What users can do next
                  </h4>
                  <p style={{ margin: 0, color: "rgba(240,237,230,0.68)", fontSize: "0.88rem", lineHeight: 1.75, fontFamily: "var(--font-dm-sans)" }}>
                    Review the preview, decide which package feels right, and tap the notify button so we can contact you as soon as billing is officially available. That gives EventSlot a warm list of ready organisers without forcing anyone into payment early.
                  </p>
                </section>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
