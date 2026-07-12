"use client"

import { useMemo, useState } from "react"
import { isBillingCheckoutEnabled } from "@/lib/pricingRollout"
import { formatKes, formatUsd } from "@/lib/subscriptionBilling"
import { getOneTimePassTiers, type OneTimePassTier } from "@/lib/oneTimePassCatalog"

type Props = {
  eventId?: string | null
  eventTitle?: string
  activeTier?: string | null
  activeStatus?: string | null
  activeExpiresAt?: string | null
  purchaseCountHint?: boolean
  compact?: boolean
}

export function EventPassSelector({
  eventId,
  eventTitle,
  activeTier,
  activeStatus,
  activeExpiresAt,
  purchaseCountHint = false,
  compact = false,
}: Props) {
  const options = useMemo(() => getOneTimePassTiers(), [])
  const billingEnabled = isBillingCheckoutEnabled()
  const [selectedTier, setSelectedTier] = useState<OneTimePassTier>("pro")
  const [paymentMethod, setPaymentMethod] = useState<"card" | "mpesa">("card")
  const [mpesaPhone, setMpesaPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const active = activeStatus === "ACTIVE"

  async function handleCheckout() {
    if (!billingEnabled) {
      setError("One-time event passes are temporarily disabled while EventSlot prepares the payments launch.")
      return
    }

    if (!eventId) {
      setError("Save the event first, then start checkout from the event dashboard.")
      return
    }

    if (paymentMethod === "mpesa" && !mpesaPhone.trim()) {
      setError("Enter the M-Pesa number that should receive the prompt.")
      return
    }

    setSubmitting(true)
    setError("")
    try {
      const response = await fetch("/api/billing/event-passes/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          tier: selectedTier,
          paymentMethod,
          mpesaPhone: paymentMethod === "mpesa" ? mpesaPhone : "",
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.url) {
        setError(data.error ?? "Could not start one-time pass checkout.")
        return
      }

      window.location.href = data.url
    } catch {
      setError("Could not start checkout right now.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        background: compact ? "rgba(255,255,255,0.02)" : "#141414",
        border: "0.5px solid rgba(240,237,230,0.08)",
        borderRadius: 16,
        padding: compact ? "1rem" : "1.25rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
        <div>
          <p style={{ margin: 0, fontSize: "0.74rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.42)", fontFamily: "var(--font-dm-sans)" }}>
            One-Time Event Pass
          </p>
          <h3 style={{ margin: "0.35rem 0 0", color: "#F0EDE6", fontSize: compact ? "1rem" : "1.12rem", fontFamily: "var(--font-instrument-serif)", fontWeight: 400 }}>
            Want premium features for this event?
          </h3>
          <p style={{ margin: "0.45rem 0 0", color: "rgba(240,237,230,0.56)", fontSize: "0.84rem", lineHeight: 1.6, fontFamily: "var(--font-dm-sans)", maxWidth: 620 }}>
            Unlock Standard, Pro, or Business tools for {eventTitle ? <strong style={{ color: "#F0EDE6" }}>{eventTitle}</strong> : "one event"}.
            Your account plan stays the same. The pass follows the event date if you postpone it.
          </p>
        </div>
        {active && activeTier ? (
          <div style={{ alignSelf: "flex-start", borderRadius: 999, padding: "0.45rem 0.8rem", background: "rgba(200,245,90,0.1)", color: "#C8F55A", fontSize: "0.76rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)" }}>
            {activeTier.charAt(0).toUpperCase() + activeTier.slice(1)} Pass Active
            {activeExpiresAt ? ` · Expires ${new Date(activeExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}
          </div>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        {options.map((option) => {
          const selected = selectedTier === option.tier
          return (
            <button
              key={option.tier}
              type="button"
              onClick={() => billingEnabled && setSelectedTier(option.tier)}
              style={{
                textAlign: "left",
                borderRadius: 14,
                border: selected ? "0.5px solid rgba(200,245,90,0.35)" : "0.5px solid rgba(240,237,230,0.08)",
                background: selected ? "rgba(200,245,90,0.06)" : "rgba(255,255,255,0.02)",
                padding: "0.95rem",
                cursor: billingEnabled ? "pointer" : "default",
                opacity: billingEnabled ? 1 : 0.78,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "flex-start" }}>
                <div>
                  <div style={{ color: "#F0EDE6", fontSize: "0.96rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)" }}>
                    {option.name}
                  </div>
                  <div style={{ color: "rgba(240,237,230,0.42)", fontSize: "0.74rem", marginTop: "0.2rem", fontFamily: "var(--font-dm-sans)" }}>
                    Commission {Math.round(option.commissionRate * 100)}%
                  </div>
                </div>
                <div style={{ color: selected ? "#C8F55A" : "rgba(240,237,230,0.72)", fontSize: "0.82rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>
                  {formatKes(option.priceKes)}
                </div>
              </div>
              <div style={{ color: "rgba(240,237,230,0.42)", fontSize: "0.72rem", marginTop: "0.3rem", fontFamily: "var(--font-dm-sans)" }}>
                {formatUsd(option.priceUsd)} one-time
              </div>
              <div style={{ color: "rgba(240,237,230,0.62)", fontSize: "0.76rem", marginTop: "0.7rem", lineHeight: 1.6, fontFamily: "var(--font-dm-sans)" }}>
                {option.features[0]}
              </div>
              <div style={{ color: "rgba(240,237,230,0.5)", fontSize: "0.73rem", marginTop: "0.45rem", fontFamily: "var(--font-dm-sans)" }}>
                {option.expiryRule}
              </div>
            </button>
          )
        })}
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.85rem" }}>
        {(["card", "mpesa"] as const).map((method) => {
          const activeMethod = paymentMethod === method
          return (
            <button
              key={method}
              type="button"
              onClick={() => billingEnabled && setPaymentMethod(method)}
              style={{
                borderRadius: 999,
                border: activeMethod ? "0.5px solid rgba(255,184,77,0.35)" : "0.5px solid rgba(240,237,230,0.08)",
                background: activeMethod ? "rgba(255,184,77,0.08)" : "transparent",
                color: activeMethod ? "#FFB84D" : "rgba(240,237,230,0.56)",
                padding: "0.5rem 0.9rem",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: billingEnabled ? "pointer" : "default",
                opacity: billingEnabled ? 1 : 0.72,
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              {method === "card" ? "Continue using card" : "Continue using STK Push"}
            </button>
          )
        })}
      </div>

      {paymentMethod === "mpesa" ? (
        <div style={{ marginBottom: "0.85rem" }}>
          <input
            type="tel"
            value={mpesaPhone}
            onChange={(event) => setMpesaPhone(event.target.value)}
            disabled={!billingEnabled}
            placeholder="M-Pesa number"
            style={{
              width: "100%",
              borderRadius: 10,
              border: "0.5px solid rgba(240,237,230,0.12)",
              background: "#101010",
              color: "#F0EDE6",
              padding: "0.75rem 0.9rem",
              fontSize: "0.86rem",
              fontFamily: "var(--font-dm-sans)",
              outline: "none",
            }}
          />
          <p style={{ margin: "0.45rem 0 0", color: "rgba(240,237,230,0.42)", fontSize: "0.74rem", fontFamily: "var(--font-dm-sans)" }}>
            We will send the payment prompt to this Safaricom line after you continue.
          </p>
        </div>
      ) : (
        <p style={{ margin: "0 0 0.85rem", color: "rgba(240,237,230,0.5)", fontSize: "0.78rem", lineHeight: 1.6, fontFamily: "var(--font-dm-sans)" }}>
          Card checkout continues on our secure hosted payment page. Prepaid and postpaid cards are both supported by the hosted provider flow.
        </p>
      )}

      {!billingEnabled ? (
        <p style={{ margin: "0 0 0.85rem", color: "#D8ECFF", fontSize: "0.78rem", lineHeight: 1.6, fontFamily: "var(--font-dm-sans)" }}>
          Event-pass checkout is paused for now. Premium event tools stay open during the payment-system preview.
        </p>
      ) : null}

      {purchaseCountHint ? (
        <p style={{ margin: "0 0 0.85rem", color: "rgba(255,184,77,0.7)", fontSize: "0.76rem", lineHeight: 1.6, fontFamily: "var(--font-dm-sans)" }}>
          If you find yourself buying passes repeatedly, a normal subscription may be cheaper.
        </p>
      ) : null}

      {error ? (
        <p style={{ margin: "0 0 0.85rem", color: "#FF6B6B", fontSize: "0.78rem", fontFamily: "var(--font-dm-sans)" }}>
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleCheckout}
        disabled={submitting || active || !billingEnabled}
        style={{
          width: compact ? "100%" : "auto",
          border: "none",
          borderRadius: 999,
          background: active ? "rgba(240,237,230,0.12)" : "#C8F55A",
          color: active ? "rgba(240,237,230,0.4)" : "#0A0A0A",
          padding: "0.8rem 1.25rem",
          fontSize: "0.84rem",
          fontWeight: 700,
          cursor: submitting || active || !billingEnabled ? "not-allowed" : "pointer",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        {!billingEnabled
          ? "Coming soon"
          : active
            ? "Pass already active"
            : submitting
              ? "Starting checkout..."
              : paymentMethod === "card"
                ? "Continue to secure card checkout"
                : "Continue to secure M-Pesa checkout"}
      </button>
    </div>
  )
}
