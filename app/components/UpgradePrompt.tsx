"use client"

import React, { useState } from "react"

interface UpgradePromptProps {
  feature: string
  requiredPlan: "pro" | "business"
  onClose: () => void
}

export default function UpgradePrompt({ feature, requiredPlan, onClose }: UpgradePromptProps) {
  const planLabel = requiredPlan === "business" ? "Business" : "Pro"
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly")
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: requiredPlan, billingCycle }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setLoading(false)
      }
    } catch {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.65)",
          zIndex: 60,
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 61,
          background: "#1A1A1A",
          border: "0.5px solid rgba(240,237,230,0.1)",
          borderRadius: 16,
          padding: "2rem",
          width: "min(92vw,400px)",
          textAlign: "center",
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "rgba(200,245,90,0.1)",
            border: "0.5px solid rgba(200,245,90,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#C8F55A"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        <h3
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.25rem",
            fontWeight: 400,
            color: "#F0EDE6",
            margin: "0 0 0.5rem",
          }}
        >
          {feature} is a {planLabel} feature
        </h3>

        <p
          style={{
            fontSize: "0.875rem",
            color: "rgba(240,237,230,0.45)",
            fontFamily: "var(--font-dm-sans)",
            margin: "0 0 1.75rem",
            lineHeight: 1.6,
          }}
        >
          Upgrade to {planLabel} or higher to unlock {feature.toLowerCase()} and other
          powerful tools for your events.
        </p>

        {/* Billing cycle toggle */}
        <div
          style={{
            display: "flex",
            gap: "0.375rem",
            background: "rgba(240,237,230,0.06)",
            borderRadius: 8,
            padding: "0.25rem",
            marginBottom: "1rem",
          }}
        >
          {(["monthly", "annual"] as const).map((cycle) => (
            <button
              key={cycle}
              onClick={() => setBillingCycle(cycle)}
              style={{
                flex: 1,
                padding: "0.4rem 0",
                borderRadius: 6,
                border: "none",
                fontSize: "0.8125rem",
                fontFamily: "var(--font-dm-sans)",
                cursor: "pointer",
                fontWeight: billingCycle === cycle ? 600 : 400,
                background: billingCycle === cycle ? "rgba(200,245,90,0.15)" : "transparent",
                color: billingCycle === cycle ? "#C8F55A" : "rgba(240,237,230,0.45)",
                transition: "all 0.15s",
              }}
            >
              {cycle === "monthly" ? "Monthly" : "Annual"}
              {cycle === "annual" && (
                <span
                  style={{
                    marginLeft: "0.375rem",
                    fontSize: "0.6875rem",
                    color: "#C8F55A",
                    opacity: billingCycle === "annual" ? 1 : 0.6,
                  }}
                >
                  –20%
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <button
            onClick={handleUpgrade}
            disabled={loading}
            style={{
              display: "block",
              width: "100%",
              background: loading ? "rgba(200,245,90,0.5)" : "#C8F55A",
              border: "none",
              borderRadius: 10,
              padding: "0.65rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#0A0A0A",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            {loading ? "Redirecting…" : `Upgrade to ${planLabel}`}
          </button>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "0.5px solid rgba(240,237,230,0.12)",
              borderRadius: 10,
              padding: "0.65rem 1.25rem",
              fontSize: "0.875rem",
              color: "rgba(240,237,230,0.45)",
              cursor: "pointer",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </>
  )
}
