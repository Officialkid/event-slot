"use client"

import React from "react"

interface UpgradePromptProps {
  feature: string
  requiredPlan: "pro" | "business"
  onClose: () => void
}

export default function UpgradePrompt({ feature, requiredPlan, onClose }: UpgradePromptProps) {
  const planLabel = requiredPlan === "business" ? "Business" : "Pro"

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

        <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <a
            href="/dashboard/billing"
            style={{
              display: "block",
              background: "#C8F55A",
              border: "none",
              borderRadius: 10,
              padding: "0.65rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#0A0A0A",
              cursor: "pointer",
              fontFamily: "var(--font-dm-sans)",
              textDecoration: "none",
            }}
          >
            Upgrade to {planLabel}
          </a>
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
