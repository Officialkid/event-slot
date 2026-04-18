"use client"

import { useState } from "react"
import ConfirmationTicket from "@/components/tickets/ConfirmationTicket"
import type { TicketData } from "@/components/tickets/ConfirmationTicket"

type LookupState =
  | { stage: "idle" }
  | { stage: "loading" }
  | { stage: "confirmed"; ticket: TicketData }
  | { stage: "waitlisted"; message: string }
  | { stage: "not_found"; message: string }
  | { stage: "error"; message: string }

export default function ConfirmAttendance({ eventId }: { eventId: string }) {
  const [email, setEmail] = useState("")
  const [state, setState] = useState<LookupState>({ stage: "idle" })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedEmail = email.trim()
    if (!trimmedEmail) return

    setState({ stage: "loading" })

    try {
      const res = await fetch("/api/attendance/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, eventId }),
      })

      const data = await res.json()

      if (res.status === 429) {
        setState({ stage: "error", message: data.error ?? "Too many attempts. Please wait and try again." })
        return
      }
      if (!res.ok) {
        setState({ stage: "error", message: data.error ?? "Something went wrong. Please try again." })
        return
      }

      if (!data.found) {
        setState({ stage: "not_found", message: data.message ?? "No registration found for this event with those details." })
        return
      }

      if (data.status === "waitlisted") {
        setState({ stage: "waitlisted", message: data.message })
        return
      }

      if (data.status === "confirmed" && data.ticket) {
        setState({ stage: "confirmed", ticket: data.ticket })
        return
      }

      setState({ stage: "not_found", message: "No confirmed registration found." })
    } catch {
      setState({ stage: "error", message: "Network error. Please check your connection and try again." })
    }
  }

  const handleReset = () => {
    setState({ stage: "idle" })
    setEmail("")
  }

  // ── Confirmed: show ticket ─────────────────────────────────────────────
  if (state.stage === "confirmed") {
    return (
      <div
        style={{
          background: "#141414",
          border: "1px solid rgba(240,237,230,0.08)",
          borderRadius: 16,
          padding: "2rem 1.5rem",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(200,245,90,0.12)",
              border: "1px solid rgba(200,245,90,0.3)",
              marginBottom: "0.75rem",
            }}
          >
            <span style={{ fontSize: "1.25rem" }}>✓</span>
          </div>
          <h2
            style={{
              fontSize: "1.15rem",
              fontWeight: 600,
              color: "#F0EDE6",
              margin: "0 0 0.25rem",
              fontFamily: "var(--font-instrument-serif, Georgia, serif)",
            }}
          >
            You&apos;re registered!
          </h2>
          <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.45)", margin: 0 }}>
            Your confirmed ticket is below.
          </p>
        </div>

        <ConfirmationTicket ticket={state.ticket} />

        <div style={{ marginTop: "1.25rem", textAlign: "center" }}>
          <button
            onClick={handleReset}
            style={{
              background: "transparent",
              border: "none",
              color: "rgba(240,237,230,0.35)",
              fontSize: "0.78rem",
              cursor: "pointer",
              textDecoration: "underline",
              padding: 0,
            }}
          >
            Look up a different email
          </button>
        </div>
      </div>
    )
  }

  // ── Waitlisted ─────────────────────────────────────────────────────────
  if (state.stage === "waitlisted") {
    return (
      <div
        style={{
          background: "#141414",
          border: "1px solid rgba(240,237,230,0.08)",
          borderRadius: 16,
          padding: "2rem 1.5rem",
          maxWidth: 480,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255,200,50,0.12)",
            border: "1px solid rgba(255,200,50,0.3)",
            marginBottom: "0.75rem",
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>⏳</span>
        </div>
        <h2
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "#F0EDE6",
            margin: "0 0 0.5rem",
            fontFamily: "var(--font-instrument-serif, Georgia, serif)",
          }}
        >
          On the waitlist
        </h2>
        <p style={{ fontSize: "0.85rem", color: "rgba(240,237,230,0.55)", margin: "0 0 1.25rem" }}>
          {state.message}
        </p>
        <button
          onClick={handleReset}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(240,237,230,0.35)",
            fontSize: "0.78rem",
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
          }}
        >
          Try a different email
        </button>
      </div>
    )
  }

  // ── Not found ──────────────────────────────────────────────────────────
  if (state.stage === "not_found") {
    return (
      <div
        style={{
          background: "#141414",
          border: "1px solid rgba(240,237,230,0.08)",
          borderRadius: 16,
          padding: "2rem 1.5rem",
          maxWidth: 480,
          margin: "0 auto",
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: "rgba(255,107,107,0.1)",
            border: "1px solid rgba(255,107,107,0.3)",
            marginBottom: "0.75rem",
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>✗</span>
        </div>
        <h2
          style={{
            fontSize: "1rem",
            fontWeight: 600,
            color: "#F0EDE6",
            margin: "0 0 0.5rem",
            fontFamily: "var(--font-instrument-serif, Georgia, serif)",
          }}
        >
          Not found
        </h2>
        <p style={{ fontSize: "0.85rem", color: "rgba(240,237,230,0.55)", margin: "0 0 1.25rem" }}>
          {state.message}
        </p>
        <button
          onClick={handleReset}
          style={{
            background: "transparent",
            border: "none",
            color: "rgba(240,237,230,0.35)",
            fontSize: "0.78rem",
            cursor: "pointer",
            textDecoration: "underline",
            padding: 0,
          }}
        >
          Try again
        </button>
      </div>
    )
  }

  // ── Lookup form (idle / loading / error) ────────────────────────────────
  return (
    <div
      style={{
        background: "#141414",
        border: "1px solid rgba(240,237,230,0.08)",
        borderRadius: 16,
        padding: "1.75rem 1.5rem",
        maxWidth: 480,
        margin: "0 auto",
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
      }}
    >
      <h2
        style={{
          fontSize: "1.1rem",
          fontWeight: 600,
          color: "#F0EDE6",
          margin: "0 0 0.35rem",
          fontFamily: "var(--font-instrument-serif, Georgia, serif)",
        }}
      >
        Already Registered?
      </h2>
      <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.45)", margin: "0 0 1.25rem", lineHeight: 1.5 }}>
        Enter your details to confirm your attendance and download your ticket.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {/* Email */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <label
            htmlFor="confirm-email"
            style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.55)", fontWeight: 500 }}
          >
            Email address <span style={{ color: "#C8F55A" }}>*</span>
          </label>
          <input
            id="confirm-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            disabled={state.stage === "loading"}
            style={{
              background: "rgba(240,237,230,0.04)",
              border: "1px solid rgba(240,237,230,0.12)",
              borderRadius: 8,
              padding: "0.6rem 0.85rem",
              fontSize: "0.88rem",
              color: "#F0EDE6",
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
              transition: "border-color 0.15s",
              opacity: state.stage === "loading" ? 0.6 : 1,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(200,245,90,0.4)" }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(240,237,230,0.12)" }}
          />
        </div>

        {/* Error message */}
        {state.stage === "error" && (
          <p
            style={{
              fontSize: "0.8rem",
              color: "#FF6B6B",
              margin: 0,
              padding: "0.5rem 0.75rem",
              background: "rgba(255,107,107,0.08)",
              borderRadius: 6,
              border: "1px solid rgba(255,107,107,0.2)",
            }}
          >
            {state.message}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={state.stage === "loading" || !email.trim()}
          style={{
            background: state.stage === "loading" || !email.trim() ? "rgba(200,245,90,0.35)" : "#C8F55A",
            color: "#0A0A0A",
            border: "none",
            borderRadius: 8,
            padding: "0.65rem 1.25rem",
            fontSize: "0.88rem",
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: state.stage === "loading" || !email.trim() ? "not-allowed" : "pointer",
            transition: "background 0.15s",
            width: "100%",
          }}
        >
          {state.stage === "loading" ? "Looking up…" : "Find My Registration"}
        </button>
      </form>
    </div>
  )
}
