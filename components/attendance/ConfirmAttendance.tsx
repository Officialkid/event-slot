"use client"

import { useState } from "react"

type LookupResult = {
  found: boolean
  status: "CONFIRMED" | "WAITLISTED" | "NOT_REGISTERED"
  attendeeName?: string
  registrationNumber?: number | null
  waitlistPosition?: number | null
  canDownloadTicket?: boolean
  ticketUrl?: string | null
  message?: string
}

export default function ConfirmAttendance({ eventSlug }: { eventSlug: string }) {
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<LookupResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError("")
    setResult(null)

    try {
      const res = await fetch(`/api/events/${encodeURIComponent(eventSlug)}/lookup?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()

      if (!res.ok && data?.error) {
        setError(data.error)
        return
      }

      setResult(data as LookupResult)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 16,
        padding: "1.75rem 1.5rem",
        maxWidth: 480,
        margin: "0 auto",
        fontFamily: "var(--font-dm-sans, system-ui, sans-serif)",
        boxShadow: "0 16px 36px rgba(0,0,0,0.12)",
      }}
    >
      <h2
        style={{
          fontSize: "1.1rem",
          fontWeight: 600,
          color: "var(--text-primary)",
          margin: "0 0 0.35rem",
          fontFamily: "var(--font-instrument-serif, Georgia, serif)",
        }}
      >
        Check your registration
      </h2>
      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 1.25rem", lineHeight: 1.5 }}>
        Search by your name or email address.
      </p>

      <form onSubmit={handleSearch} style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Your name or email..."
          disabled={loading}
          style={{
            flex: 1,
            background: "var(--surface-muted)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "0.65rem 0.85rem",
            fontSize: "0.88rem",
            color: "var(--text-primary)",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          style={{
            background: loading || !query.trim() ? "rgba(200,245,90,0.35)" : "#C8F55A",
            color: "#0A0A0A",
            border: "none",
            borderRadius: 10,
            padding: "0.65rem 1rem",
            fontSize: "0.83rem",
            fontWeight: 700,
            cursor: loading || !query.trim() ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "..." : "Search"}
        </button>
      </form>

      {error && (
        <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#FF6B6B" }}>
          {error}
        </p>
      )}

      {result && (
        <div style={{ marginTop: "1rem" }}>
          {result.status === "CONFIRMED" && (
            <div style={{ background: "var(--surface-muted)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, padding: "0.85rem" }}>
              <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 600 }}>Confirmed</p>
              {result.attendeeName && (
                <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.82rem" }}>{result.attendeeName}</p>
              )}
              <p style={{ margin: "0.35rem 0 0", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                Confirmation #{result.registrationNumber ?? "N/A"}
              </p>
              {result.canDownloadTicket && result.ticketUrl ? (
                <a
                  href={result.ticketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    marginTop: "0.65rem",
                    padding: "0.45rem 0.8rem",
                    borderRadius: 8,
                    background: "#C8F55A",
                    color: "#0A0A0A",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  Download Ticket
                </a>
              ) : (
                <p style={{ margin: "0.6rem 0 0", color: "var(--text-muted)", fontSize: "0.72rem" }}>
                  Tickets are currently disabled for this event.
                </p>
              )}
            </div>
          )}

          {result.status === "WAITLISTED" && (
            <div style={{ background: "var(--surface-muted)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 10, padding: "0.85rem" }}>
              <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 600 }}>
                Waitlisted{typeof result.waitlistPosition === "number" ? ` - Position #${result.waitlistPosition}` : ""}
              </p>
              {result.attendeeName && (
                <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.82rem" }}>{result.attendeeName}</p>
              )}
            </div>
          )}

          {result.status === "NOT_REGISTERED" && (
            <div style={{ background: "var(--surface-muted)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "0.85rem" }}>
              <p style={{ margin: 0, color: "var(--text-primary)", fontSize: "0.9rem", fontWeight: 600 }}>Not registered</p>
              <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                {result.message ?? "No registration found for that name or email."}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
