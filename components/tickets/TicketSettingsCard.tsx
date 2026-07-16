"use client"

import { useEffect, useState } from "react"

type TicketSettingsCardProps = {
  eventId: string
  initialEnabled: boolean
  registrationCount: number
  onUpdated?: (enabled: boolean) => void
}

const ticketSurface = "var(--surface)"
const ticketSurfaceAlt = "var(--surface-2)"
const ticketBorder = "var(--border-subtle)"
const ticketTextPrimary = "var(--text-primary)"
const ticketTextSecondary = "var(--text-secondary)"
const ticketTextMuted = "var(--text-muted)"

export default function TicketSettingsCard({
  eventId,
  initialEnabled,
  registrationCount,
  onUpdated,
}: TicketSettingsCardProps) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setEnabled(initialEnabled)
  }, [initialEnabled])

  async function handleToggle() {
    setLoading(true)
    setError("")

    try {
      const res = await fetch(`/api/organizer/events/${eventId}/tickets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketsEnabled: !enabled }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || "Unable to update ticket settings")
        return
      }

      const nextEnabled = Boolean(data?.ticketsEnabled)
      setEnabled(nextEnabled)
      onUpdated?.(nextEnabled)
    } catch {
      setError("Unable to update ticket settings")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        background: ticketSurface,
        border: `0.5px solid ${ticketBorder}`,
        borderRadius: 12,
        padding: "1.25rem",
      }}
    >
      <p
        style={{
          margin: 0,
          marginBottom: "0.45rem",
          fontSize: "0.72rem",
          color: "#C8F55A",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        Ticket Settings
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p
            style={{
              margin: 0,
              color: ticketTextPrimary,
              fontSize: "0.85rem",
              fontFamily: "var(--font-dm-sans)",
              fontWeight: 600,
            }}
          >
            Generate tickets for attendees
          </p>
          <p
            style={{
              margin: "0.35rem 0 0",
              color: ticketTextSecondary,
              fontSize: "0.8rem",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            {enabled
              ? `Tickets are active. ${registrationCount} attendee${registrationCount === 1 ? "" : "s"} can download their ticket.`
              : "Tickets are off. Attendees can still look up their confirmation status."}
          </p>
        </div>

        <button
          onClick={() => void handleToggle()}
          disabled={loading}
          aria-label="Toggle ticket generation"
          style={{
            position: "relative",
            width: 48,
            height: 24,
            borderRadius: 999,
            border: "none",
            background: enabled ? "#C8F55A" : "#2A2A2A",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            transition: "background 160ms ease",
            padding: 0,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 4,
              left: enabled ? 28 : 4,
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: enabled ? "#0A0A0A" : ticketSurfaceAlt,
              transition: "left 160ms ease",
            }}
          />
        </button>
      </div>

      <p
        style={{
          margin: "0.75rem 0 0",
          color: ticketTextMuted,
          fontSize: "0.74rem",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        {enabled
          ? "Tickets are available for confirmed attendees through confirmation lookup."
          : "Confirmation lookup still works, but ticket download is hidden while tickets are off."}
      </p>

      {error && (
        <p style={{ margin: "0.6rem 0 0", fontSize: "0.75rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>
          {error}
        </p>
      )}
    </div>
  )
}
