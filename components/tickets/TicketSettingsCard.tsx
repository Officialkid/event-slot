"use client"

import { useEffect, useState } from "react"

type TicketSettingsCardProps = {
  eventId: string
  initialEnabled: boolean
  registrationCount: number
  onUpdated?: (enabled: boolean) => void
}

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
    <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.25rem" }}>
      <p style={{ margin: 0, fontSize: "0.72rem", color: "#C8F55A", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)", marginBottom: "0.45rem" }}>
        ✦ Ticket Settings
      </p>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <p style={{ margin: 0, color: "#F0EDE6", fontSize: "0.85rem", fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}>
            Generate tickets for attendees
          </p>
          <p style={{ margin: "0.35rem 0 0", color: "rgba(240,237,230,0.5)", fontSize: "0.8rem", fontFamily: "var(--font-dm-sans)" }}>
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
              background: "#0A0A0A",
              transition: "left 160ms ease",
            }}
          />
        </button>
      </div>

      {enabled ? (
        <p style={{ margin: "0.75rem 0 0", color: "rgba(240,237,230,0.35)", fontSize: "0.74rem", fontFamily: "var(--font-dm-sans)" }}>
          Tickets are available for confirmed attendees through confirmation lookup.
        </p>
      ) : (
        <p style={{ margin: "0.75rem 0 0", color: "rgba(240,237,230,0.35)", fontSize: "0.74rem", fontFamily: "var(--font-dm-sans)" }}>
          Confirmation lookup still works, but ticket download is hidden while tickets are off.
        </p>
      )}

      {error && (
        <p style={{ margin: "0.6rem 0 0", fontSize: "0.75rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>
          {error}
        </p>
      )}
    </div>
  )
}
