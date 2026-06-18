"use client"

import React, { useEffect, useState } from "react"

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

export function PaygSettingsCard() {
  const [settings, setSettings] = useState<PaygSettings>({
      isEnabled: false,
      monthlyCapUsd: 10,
      mpesaPhone: "",
      paymentProvider: "intasend",
      billingAuthorizationAccepted: false,
      billingAuthorizedAt: null,
      cardholderName: "",
      billingCardBrand: "",
      billingCardLast4: "",
      billingCardExpiryMonth: null,
      billingCardExpiryYear: null,
    })
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
          setSettings({
            isEnabled: Boolean(data.settings.isEnabled),
            monthlyCapUsd: Number(data.settings.monthlyCapUsd ?? 10),
            mpesaPhone: data.settings.mpesaPhone ?? "",
            paymentProvider: data.settings.paymentProvider ?? "intasend",
            billingAuthorizationAccepted: Boolean(data.settings.billingAuthorizationAccepted),
            billingAuthorizedAt: data.settings.billingAuthorizedAt ?? null,
            cardholderName: data.settings.cardholderName ?? "",
            billingCardBrand: data.settings.billingCardBrand ?? "",
            billingCardLast4: data.settings.billingCardLast4 ?? "",
            billingCardExpiryMonth: data.settings.billingCardExpiryMonth ?? null,
            billingCardExpiryYear: data.settings.billingCardExpiryYear ?? null,
          })
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

  async function handleSave() {
    setSaving(true)
    setMessage("")
    setError("")
    try {
      const res = await fetch("/api/billing/payg", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Could not save PAYG settings.")
        return
      }
      setSettings({
        isEnabled: Boolean(data.settings.isEnabled),
        monthlyCapUsd: Number(data.settings.monthlyCapUsd ?? 10),
        mpesaPhone: data.settings.mpesaPhone ?? "",
        paymentProvider: data.settings.paymentProvider ?? "intasend",
        billingAuthorizationAccepted: Boolean(data.settings.billingAuthorizationAccepted),
        billingAuthorizedAt: data.settings.billingAuthorizedAt ?? null,
        cardholderName: data.settings.cardholderName ?? "",
        billingCardBrand: data.settings.billingCardBrand ?? "",
        billingCardLast4: data.settings.billingCardLast4 ?? "",
        billingCardExpiryMonth: data.settings.billingCardExpiryMonth ?? null,
        billingCardExpiryYear: data.settings.billingCardExpiryYear ?? null,
      })
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
          <p style={{ margin: 0, fontSize: "0.88rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.7, maxWidth: 560 }}>
            Let EventSlot accept extra attendees beyond your included plan limit at $0.05 per person instead of stopping registrations.
          </p>
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontSize: "0.88rem" }}>
          <input
            type="checkbox"
            checked={settings.isEnabled}
            disabled={loading || saving}
            onChange={(event) => setSettings((current) => ({ ...current, isEnabled: event.target.checked }))}
          />
          Enable PAYG
        </label>
      </div>

      <div style={{ display: "grid", gap: "0.9rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: "1rem" }}>
        <div>
          <label style={{ display: "block", marginBottom: "0.4rem", color: "rgba(240,237,230,0.45)", fontSize: "0.74rem", letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)" }}>
            Monthly spend cap (USD)
          </label>
          <input
            type="number"
            min="1"
            max="5000"
            disabled={loading || saving}
            value={settings.monthlyCapUsd}
            onChange={(event) => setSettings((current) => ({ ...current, monthlyCapUsd: Number(event.target.value || 0) }))}
            style={{
              width: "100%",
              borderRadius: 10,
              border: "0.5px solid rgba(240,237,230,0.12)",
              background: "#0F0F0F",
              color: "#F0EDE6",
              padding: "0.75rem 0.9rem",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "0.9rem",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.4rem", color: "rgba(240,237,230,0.45)", fontSize: "0.74rem", letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)" }}>
            M-Pesa number
          </label>
          <input
            type="tel"
            disabled={loading || saving}
            value={settings.mpesaPhone ?? ""}
            onChange={(event) => setSettings((current) => ({ ...current, mpesaPhone: event.target.value }))}
            placeholder="07XXXXXXXX or 2547XXXXXXXX"
            style={{
              width: "100%",
              borderRadius: 10,
              border: "0.5px solid rgba(240,237,230,0.12)",
              background: "#0F0F0F",
              color: "#F0EDE6",
              padding: "0.75rem 0.9rem",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "0.9rem",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.4rem", color: "rgba(240,237,230,0.45)", fontSize: "0.74rem", letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)" }}>
            Cardholder name
          </label>
          <input
            type="text"
            disabled={loading || saving}
            value={settings.cardholderName ?? ""}
            onChange={(event) => setSettings((current) => ({ ...current, cardholderName: event.target.value }))}
            placeholder="Name on card"
            style={{
              width: "100%",
              borderRadius: 10,
              border: "0.5px solid rgba(240,237,230,0.12)",
              background: "#0F0F0F",
              color: "#F0EDE6",
              padding: "0.75rem 0.9rem",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "0.9rem",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.4rem", color: "rgba(240,237,230,0.45)", fontSize: "0.74rem", letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)" }}>
            Card brand
          </label>
          <input
            type="text"
            disabled={loading || saving}
            value={settings.billingCardBrand ?? ""}
            onChange={(event) => setSettings((current) => ({ ...current, billingCardBrand: event.target.value }))}
            placeholder="Visa, Mastercard..."
            style={{
              width: "100%",
              borderRadius: 10,
              border: "0.5px solid rgba(240,237,230,0.12)",
              background: "#0F0F0F",
              color: "#F0EDE6",
              padding: "0.75rem 0.9rem",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "0.9rem",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.4rem", color: "rgba(240,237,230,0.45)", fontSize: "0.74rem", letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)" }}>
            Card last 4 digits
          </label>
          <input
            type="text"
            inputMode="numeric"
            disabled={loading || saving}
            value={settings.billingCardLast4 ?? ""}
            onChange={(event) => setSettings((current) => ({ ...current, billingCardLast4: event.target.value.replace(/\D/g, "").slice(0, 4) }))}
            placeholder="1234"
            style={{
              width: "100%",
              borderRadius: 10,
              border: "0.5px solid rgba(240,237,230,0.12)",
              background: "#0F0F0F",
              color: "#F0EDE6",
              padding: "0.75rem 0.9rem",
              fontFamily: "var(--font-dm-sans)",
              fontSize: "0.9rem",
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", marginBottom: "0.4rem", color: "rgba(240,237,230,0.45)", fontSize: "0.74rem", letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)" }}>
            Expiry
          </label>
          <div style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
            <input
              type="number"
              min="1"
              max="12"
              disabled={loading || saving}
              value={settings.billingCardExpiryMonth ?? ""}
              onChange={(event) => setSettings((current) => ({ ...current, billingCardExpiryMonth: Number(event.target.value || 0) || null }))}
              placeholder="MM"
              style={{
                width: "100%",
                borderRadius: 10,
                border: "0.5px solid rgba(240,237,230,0.12)",
                background: "#0F0F0F",
                color: "#F0EDE6",
                padding: "0.75rem 0.9rem",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.9rem",
              }}
            />
            <input
              type="number"
              min={new Date().getFullYear()}
              disabled={loading || saving}
              value={settings.billingCardExpiryYear ?? ""}
              onChange={(event) => setSettings((current) => ({ ...current, billingCardExpiryYear: Number(event.target.value || 0) || null }))}
              placeholder="YYYY"
              style={{
                width: "100%",
                borderRadius: 10,
                border: "0.5px solid rgba(240,237,230,0.12)",
                background: "#0F0F0F",
                color: "#F0EDE6",
                padding: "0.75rem 0.9rem",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "0.9rem",
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: "0.9rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.48)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.7 }}>
        Charges are tracked monthly and applied to your IntaSend-backed billing profile. EventSlot only stores masked card details here so you can explicitly authorize PAYG before overflow billing is used.
      </div>

      <label style={{ display: "flex", alignItems: "flex-start", gap: "0.7rem", marginTop: "1rem", color: "rgba(240,237,230,0.7)", fontFamily: "var(--font-dm-sans)", fontSize: "0.84rem", lineHeight: 1.6 }}>
        <input
          type="checkbox"
          checked={settings.billingAuthorizationAccepted}
          disabled={loading || saving}
          onChange={(event) => setSettings((current) => ({ ...current, billingAuthorizationAccepted: event.target.checked }))}
        />
        <span>
          I authorize EventSlot to use this stored billing method for PAYG overflow charges when my included attendee limit is exceeded.
        </span>
      </label>

      {settings.billingAuthorizedAt ? (
        <p style={{ margin: "0.7rem 0 0", color: "rgba(200,245,90,0.72)", fontSize: "0.78rem", fontFamily: "var(--font-dm-sans)" }}>
          PAYG authorization on file.
        </p>
      ) : null}

      {message ? <p style={{ margin: "0.8rem 0 0", color: "#C8F55A", fontSize: "0.84rem", fontFamily: "var(--font-dm-sans)" }}>{message}</p> : null}
      {error ? <p style={{ margin: "0.8rem 0 0", color: "#FF8E7D", fontSize: "0.84rem", fontFamily: "var(--font-dm-sans)" }}>{error}</p> : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={loading || saving}
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
          cursor: loading || saving ? "default" : "pointer",
          opacity: loading || saving ? 0.7 : 1,
        }}
      >
        {saving ? "Saving..." : "Save PAYG settings"}
      </button>
    </section>
  )
}
