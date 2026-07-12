"use client"

import React, { useEffect, useState } from "react"
import { isBillingCheckoutEnabled } from "@/lib/pricingRollout"

type PaygSettings = {
  isEnabled: boolean
  monthlyCapUsd: number
  mpesaPhone: string | null
  paymentProvider: string | null
  billingAuthorizationAccepted: boolean
  billingAuthorizedAt?: string | null
  cardholderName: string | null
  billingCardBrand: string | null
  billingCardLast4: string | null
  billingCardExpiryMonth: number | null
  billingCardExpiryYear: number | null
}

type PaymentMethod = "mpesa" | "card"

function detectCardBrand(value: string): string {
  const digits = value.replace(/\D/g, "")
  if (/^4/.test(digits)) return "Visa"
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return "Mastercard"
  if (/^3[47]/.test(digits)) return "American Express"
  if (/^6(?:011|5)/.test(digits)) return "Discover"
  if (/^(5061|5078|6500)/.test(digits)) return "Verve"
  return ""
}

function inferPaymentMethod(settings: PaygSettings): PaymentMethod {
  if (settings.paymentProvider === "paystack_card") return "card"
  if (settings.paymentProvider === "mpesa_stk") return "mpesa"
  if (settings.billingCardLast4 || settings.billingCardBrand) return "card"
  return "mpesa"
}

const sectionLabelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "0.4rem",
  color: "rgba(240,237,230,0.45)",
  fontSize: "0.74rem",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  fontFamily: "var(--font-dm-sans)",
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "0.5px solid rgba(240,237,230,0.12)",
  background: "#0F0F0F",
  color: "#F0EDE6",
  padding: "0.75rem 0.9rem",
  fontFamily: "var(--font-dm-sans)",
  fontSize: "0.9rem",
}

export function PaygSettingsCard() {
  const billingEnabled = isBillingCheckoutEnabled()
  const [settings, setSettings] = useState<PaygSettings>({
    isEnabled: false,
    monthlyCapUsd: 10,
    mpesaPhone: "",
    paymentProvider: "mpesa_stk",
    billingAuthorizationAccepted: false,
    billingAuthorizedAt: null,
    cardholderName: "",
    billingCardBrand: "",
    billingCardLast4: "",
    billingCardExpiryMonth: null,
    billingCardExpiryYear: null,
  })
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mpesa")
  const [cardNumber, setCardNumber] = useState("")
  const [cardCvc, setCardCvc] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch("/api/billing/payg")
        const data = await res.json()
        if (!active) return
        if (res.ok && data.settings) {
          const nextSettings = {
            isEnabled: Boolean(data.settings.isEnabled),
            monthlyCapUsd: Number(data.settings.monthlyCapUsd ?? 10),
            mpesaPhone: data.settings.mpesaPhone ?? "",
            paymentProvider: data.settings.paymentProvider ?? "mpesa_stk",
            billingAuthorizationAccepted: Boolean(data.settings.billingAuthorizationAccepted),
            billingAuthorizedAt: data.settings.billingAuthorizedAt ?? null,
            cardholderName: data.settings.cardholderName ?? "",
            billingCardBrand: data.settings.billingCardBrand ?? "",
            billingCardLast4: data.settings.billingCardLast4 ?? "",
            billingCardExpiryMonth: data.settings.billingCardExpiryMonth ?? null,
            billingCardExpiryYear: data.settings.billingCardExpiryYear ?? null,
          }
          setSettings(nextSettings)
          setPaymentMethod(inferPaymentMethod(nextSettings))
        }
      } catch {
        if (active) setError("Could not load PAYG settings right now.")
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [])

  function handleCardNumberChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 19)
    const detectedBrand = detectCardBrand(digits)
    setCardNumber(digits)
    setSettings((current) => ({
      ...current,
      billingCardBrand: detectedBrand || current.billingCardBrand,
      billingCardLast4: digits.slice(-4),
    }))
  }

  async function handleSave() {
    if (!billingEnabled) {
      setError("PAYG is temporarily disabled while EventSlot prepares the payments launch.")
      return
    }

    setSaving(true)
    setMessage("")
    setError("")

    if (paymentMethod === "card" && !cardCvc.trim() && !settings.billingCardLast4) {
      setError("Enter the CVC for the card profile you are adding.")
      setSaving(false)
      return
    }

    try {
      const res = await fetch("/api/billing/payg", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...settings,
          paymentMethod,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Could not save PAYG settings.")
        return
      }

      const nextSettings = {
        isEnabled: Boolean(data.settings.isEnabled),
        monthlyCapUsd: Number(data.settings.monthlyCapUsd ?? 10),
        mpesaPhone: data.settings.mpesaPhone ?? "",
        paymentProvider: data.settings.paymentProvider ?? "mpesa_stk",
        billingAuthorizationAccepted: Boolean(data.settings.billingAuthorizationAccepted),
        billingAuthorizedAt: data.settings.billingAuthorizedAt ?? null,
        cardholderName: data.settings.cardholderName ?? "",
        billingCardBrand: data.settings.billingCardBrand ?? "",
        billingCardLast4: data.settings.billingCardLast4 ?? "",
        billingCardExpiryMonth: data.settings.billingCardExpiryMonth ?? null,
        billingCardExpiryYear: data.settings.billingCardExpiryYear ?? null,
      }

      setSettings(nextSettings)
      setPaymentMethod(inferPaymentMethod(nextSettings))
      setCardNumber("")
      setCardCvc("")
      setMessage("PAYG settings saved.")
    } catch {
      setError("Could not save PAYG settings.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
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
            Pay as you go
          </h2>
          <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.7, maxWidth: 620 }}>
            Let EventSlot accept extra attendees beyond your included plan limit at $0.05 per person instead of stopping registrations.
          </p>
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontSize: "0.88rem" }}>
          <input
            type="checkbox"
            checked={settings.isEnabled}
            disabled={loading || saving || !billingEnabled}
            onChange={(event) => setSettings((current) => ({ ...current, isEnabled: event.target.checked }))}
          />
          Enable PAYG
        </label>
      </div>

      <div style={{ marginTop: "1rem", display: "grid", gap: "0.9rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        <div>
          <label style={sectionLabelStyle}>Monthly cap (USD)</label>
          <input
            type="number"
            min="1"
            max="5000"
            disabled={loading || saving || !billingEnabled}
            value={settings.monthlyCapUsd}
            onChange={(event) => setSettings((current) => ({ ...current, monthlyCapUsd: Number(event.target.value || 0) }))}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <div style={{ fontSize: "0.74rem", letterSpacing: "0.05em", textTransform: "uppercase", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>
          Continue using
        </div>
        <div style={{ display: "grid", gap: "0.85rem", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <button
            type="button"
            disabled={loading || saving || !billingEnabled}
            onClick={() => setPaymentMethod("mpesa")}
            style={{
              borderRadius: 12,
              border: paymentMethod === "mpesa" ? "0.5px solid rgba(200,245,90,0.35)" : "0.5px solid rgba(240,237,230,0.08)",
              background: paymentMethod === "mpesa" ? "rgba(200,245,90,0.08)" : "rgba(255,255,255,0.02)",
              padding: "1rem",
              textAlign: "left",
              cursor: loading || saving ? "default" : "pointer",
            }}
          >
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>STK Push of M-Pesa</div>
            <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
              Add the M-Pesa number that should receive the payment prompt when overflow billing is needed.
            </p>
          </button>

          <button
            type="button"
            disabled={loading || saving || !billingEnabled}
            onClick={() => setPaymentMethod("card")}
            style={{
              borderRadius: 12,
              border: paymentMethod === "card" ? "0.5px solid rgba(255,184,77,0.35)" : "0.5px solid rgba(240,237,230,0.08)",
              background: paymentMethod === "card" ? "rgba(255,184,77,0.08)" : "rgba(255,255,255,0.02)",
              padding: "1rem",
              textAlign: "left",
              cursor: loading || saving ? "default" : "pointer",
            }}
          >
            <div style={{ fontSize: "1rem", fontWeight: 600, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>Card</div>
            <p style={{ margin: "0.3rem 0 0", fontSize: "0.82rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
              Add the card profile now. Full hosted card checkout remains aligned with your Paystack rollout.
            </p>
          </button>
        </div>
      </div>

      {paymentMethod === "mpesa" ? (
        <div style={{ display: "grid", gap: "0.9rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: "1rem" }}>
          <div>
            <label style={sectionLabelStyle}>M-Pesa number</label>
            <input
              type="tel"
              disabled={loading || saving || !billingEnabled}
              value={settings.mpesaPhone ?? ""}
              onChange={(event) => setSettings((current) => ({ ...current, mpesaPhone: event.target.value }))}
              placeholder="07XXXXXXXX or 2547XXXXXXXX"
              style={inputStyle}
            />
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: "0.9rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: "1rem" }}>
            <div>
              <label style={sectionLabelStyle}>Card holder name</label>
              <input
                type="text"
                disabled={loading || saving || !billingEnabled}
                value={settings.cardholderName ?? ""}
                onChange={(event) => setSettings((current) => ({ ...current, cardholderName: event.target.value }))}
                placeholder="Name on card"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={sectionLabelStyle}>Card number</label>
              <input
                type="text"
                inputMode="numeric"
                disabled={loading || saving || !billingEnabled}
                value={cardNumber}
                onChange={(event) => handleCardNumberChange(event.target.value)}
                placeholder={settings.billingCardLast4 ? `Saved card ending ${settings.billingCardLast4}` : "1234 5678 9012 3456"}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={sectionLabelStyle}>Card brand</label>
              <input
                type="text"
                disabled
                value={settings.billingCardBrand ?? ""}
                placeholder="Detected automatically"
                style={{ ...inputStyle, color: "rgba(240,237,230,0.78)" }}
              />
            </div>
            <div>
              <label style={sectionLabelStyle}>Account number</label>
              <input
                type="text"
                inputMode="numeric"
                disabled
                value={settings.billingCardLast4 ? `•••• ${settings.billingCardLast4}` : ""}
                placeholder="Last 4 digits appear here"
                style={{ ...inputStyle, color: "rgba(240,237,230,0.78)" }}
              />
            </div>
            <div>
              <label style={sectionLabelStyle}>Expiry month</label>
              <input
                type="number"
                min="1"
                max="12"
                disabled={loading || saving || !billingEnabled}
                value={settings.billingCardExpiryMonth ?? ""}
                onChange={(event) => setSettings((current) => ({ ...current, billingCardExpiryMonth: Number(event.target.value || 0) || null }))}
                placeholder="MM"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={sectionLabelStyle}>Expiry year</label>
              <input
                type="number"
                min={new Date().getFullYear()}
                disabled={loading || saving || !billingEnabled}
                value={settings.billingCardExpiryYear ?? ""}
                onChange={(event) => setSettings((current) => ({ ...current, billingCardExpiryYear: Number(event.target.value || 0) || null }))}
                placeholder="YYYY"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={sectionLabelStyle}>CVC</label>
              <input
                type="password"
                inputMode="numeric"
                disabled={loading || saving || !billingEnabled}
                value={cardCvc}
                onChange={(event) => setCardCvc(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="123"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginTop: "0.9rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.48)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.7 }}>
            Card brand is detected from the number you enter. EventSlot keeps only the masked card profile here while your hosted card checkout continues through Paystack.
          </div>
        </>
      )}

      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.7rem", marginTop: "1rem", color: "rgba(240,237,230,0.7)", fontFamily: "var(--font-dm-sans)", fontSize: "0.84rem", lineHeight: 1.6 }}>
        <input
          type="checkbox"
          checked={settings.billingAuthorizationAccepted}
          disabled={loading || saving || !billingEnabled}
          onChange={(event) => setSettings((current) => ({ ...current, billingAuthorizationAccepted: event.target.checked }))}
        />
        <span>
          I authorize EventSlot to use this billing method for PAYG overflow charges when my included attendee limit is exceeded.
        </span>
      </label>

      {settings.billingAuthorizedAt ? (
        <p style={{ margin: "0.7rem 0 0", color: "rgba(200,245,90,0.72)", fontSize: "0.78rem", fontFamily: "var(--font-dm-sans)" }}>
          PAYG authorization on file.
        </p>
      ) : null}

      {!billingEnabled ? (
        <p style={{ margin: "0.8rem 0 0", color: "#D8ECFF", fontSize: "0.84rem", fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
          PAYG overflow billing is paused for now. EventSlot is keeping registrations open without charging overage while payments are introduced.
        </p>
      ) : null}

      {message ? <p style={{ margin: "0.8rem 0 0", color: "#C8F55A", fontSize: "0.84rem", fontFamily: "var(--font-dm-sans)" }}>{message}</p> : null}
      {error ? <p style={{ margin: "0.8rem 0 0", color: "#FF8E7D", fontSize: "0.84rem", fontFamily: "var(--font-dm-sans)" }}>{error}</p> : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={loading || saving || !billingEnabled}
        style={{
          marginTop: "1rem",
          borderRadius: 999,
          border: "0.5px solid rgba(200,245,90,0.24)",
          background: "#C8F55A",
          color: "#0A0A0A",
          padding: "0.72rem 1.1rem",
          fontFamily: "var(--font-dm-sans)",
          fontSize: "0.88rem",
          fontWeight: 700,
          cursor: loading || saving || !billingEnabled ? "default" : "pointer",
          opacity: loading || saving || !billingEnabled ? 0.7 : 1,
        }}
      >
        {!billingEnabled ? "Coming soon" : saving ? "Saving..." : "Save PAYG settings"}
      </button>
    </section>
  )
}
