"use client"

import { useState } from "react"

export interface ComingSoonProps {
  featureName: string
  description?: string
}

export default function ComingSoon({ featureName, description }: ComingSoonProps) {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMessage("Please enter a valid email address.")
      return
    }
    setState("loading")
    setErrorMessage("")
    try {
      const res = await fetch("/api/notify-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, featureName }),
      })
      if (res.ok) {
        setState("success")
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorMessage(data.error ?? "Something went wrong. Please try again.")
        setState("error")
      }
    } catch {
      setErrorMessage("Network error. Please try again.")
      setState("error")
    }
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "0.5px solid var(--border)",
        borderRadius: 16,
        padding: "clamp(2rem, 5vw, 3.5rem) clamp(1.5rem, 4vw, 3rem)",
        maxWidth: 560,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 14,
          background: "rgba(200,245,90,0.08)",
          border: "0.5px solid rgba(200,245,90,0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "1.5rem",
          fontSize: "1.05rem",
          color: "#C8F55A",
          fontWeight: 700,
        }}
      >
        ES
      </div>

      <span
        style={{
          display: "inline-block",
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(200,245,90,0.7)",
          marginBottom: "0.6rem",
        }}
      >
        {featureName}
      </span>

      <h2
        style={{
          fontFamily: "var(--font-instrument-serif, Georgia, serif)",
          fontSize: "clamp(1.4rem, 4vw, 2rem)",
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 0.875rem",
          lineHeight: 1.2,
        }}
      >
        Hold tight - this feature is coming soon!
      </h2>

      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--text-muted)",
          lineHeight: 1.65,
          margin: "0 0 2rem",
          maxWidth: 440,
        }}
      >
        {description ??
          "We're working hard on this. This area is still being prepared for the live rollout, and you'll be among the first to know when it is ready."}
      </p>

      <div
        style={{
          width: "100%",
          height: 1,
          background: "var(--border)",
          marginBottom: "1.75rem",
        }}
      />

      {state === "success" ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span style={{ fontSize: "1rem", color: "var(--accent)", fontWeight: 700 }}>Success</span>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#C8F55A",
              fontWeight: 500,
              margin: 0,
            }}
          >
            You&apos;re on the list!
          </p>
          <p
            style={{
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            We&apos;ll notify you at{" "}
            <strong style={{ color: "var(--text-secondary)" }}>{email}</strong>{" "}
            when {featureName} launches.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{ width: "100%", maxWidth: 400 }}
          noValidate
        >
          <p
            style={{
              fontSize: "0.78rem",
              fontWeight: 600,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              marginBottom: "0.625rem",
            }}
          >
            Get notified when it launches
          </p>

          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => {
                setEmail(e.target.value)
                if (errorMessage) setErrorMessage("")
                if (state === "error") setState("idle")
              }}
              disabled={state === "loading"}
              style={{
                flex: 1,
                minWidth: 180,
                background: "var(--surface-muted)",
                border: `0.5px solid ${errorMessage ? "rgba(255,107,107,0.5)" : "var(--border)"}`,
                borderRadius: 8,
                padding: "0.6rem 0.875rem",
                fontSize: "0.875rem",
                color: "var(--text-primary)",
                fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={state === "loading"}
              style={{
                background: "#C8F55A",
                border: "none",
                borderRadius: 8,
                padding: "0.6rem 1.25rem",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "#0A0A0A",
                cursor: state === "loading" ? "not-allowed" : "pointer",
                opacity: state === "loading" ? 0.65 : 1,
              }}
            >
              {state === "loading" ? "Saving..." : "Notify me"}
            </button>
          </div>

          {errorMessage && (
            <p
              style={{
                marginTop: "0.7rem",
                fontSize: "0.78rem",
                color: "#FF6B6B",
                textAlign: "left",
              }}
            >
              {errorMessage}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
