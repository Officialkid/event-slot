"use client"

import { useEffect, useState, useCallback } from "react"

interface Message {
  id: string
  senderName: string | null
  senderEmail: string | null
  eventId: string | null
  eventTitle: string | null
  type: string
  rating: number | null
  body: string
  read: boolean
  archived: boolean
  createdAt: string
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ fontSize: "0.75rem", color: n <= rating ? "#C8F55A" : "rgba(240,237,230,0.15)" }}>★</span>
      ))}
    </div>
  )
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  const fetchMessages = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/messages?filter=${filter}`)
      .then(r => r.json())
      .then(d => {
        setMessages(d.messages ?? [])
        setUnreadCount(d.unreadCount ?? 0)
      })
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => { fetchMessages() }, [fetchMessages])

  async function markRead(id: string) {
    await fetch("/api/admin/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, read: true }) })
    fetchMessages()
  }

  async function archiveMsg(id: string) {
    await fetch("/api/admin/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, archived: true }) })
    fetchMessages()
  }

  const filterTabs = [
    { key: "all", label: "All" },
    { key: "unread", label: unreadCount > 0 ? `Unread (${unreadCount})` : "Unread" },
    { key: "organizer", label: "Organizer Feedback" },
    { key: "attendee", label: "Attendee Feedback" },
  ]

  function typeBadge(type: string) {
    return type === "organizer"
      ? { bg: "rgba(200,245,90,0.08)", color: "rgba(200,245,90,0.7)", label: "Organizer" }
      : { bg: "rgba(240,237,230,0.06)", color: "rgba(240,237,230,0.45)", label: "Attendee" }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.4rem" }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", fontWeight: 400, color: "#F0EDE6" }}>
          Messages
        </h1>
        {unreadCount > 0 && (
          <span style={{ background: "#C8F55A", color: "#0A0A0A", borderRadius: 100, fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.55rem", fontFamily: "var(--font-dm-sans)" }}>
            {unreadCount} unread
          </span>
        )}
      </div>
      <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.75rem" }}>
        Feedback and messages sent through the platform.
      </p>

      <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
        {filterTabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            style={{ padding: "0.35rem 0.85rem", borderRadius: 100, border: "0.5px solid " + (filter === t.key ? "rgba(200,245,90,0.4)" : "rgba(240,237,230,0.1)"), background: filter === t.key ? "rgba(200,245,90,0.1)" : "transparent", color: filter === t.key ? "#C8F55A" : "rgba(240,237,230,0.45)", fontSize: "0.78rem", fontFamily: "var(--font-dm-sans)", cursor: "pointer" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: "rgba(240,237,230,0.25)", fontFamily: "var(--font-dm-sans)", fontSize: "0.82rem" }}>Loading…</div>
      ) : messages.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "rgba(240,237,230,0.2)", fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem" }}>
          No messages found.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {messages.map(msg => {
            const badge = typeBadge(msg.type)
            return (
              <div
                key={msg.id}
                style={{
                  background: "#111",
                  border: "0.5px solid " + (msg.read ? "rgba(240,237,230,0.07)" : "rgba(200,245,90,0.2)"),
                  borderRadius: 12,
                  padding: "1.25rem 1.5rem",
                  position: "relative",
                }}
              >
                {!msg.read && (
                  <span style={{ position: "absolute", top: "1.25rem", right: "1.5rem", width: 8, height: 8, borderRadius: "50%", background: "#C8F55A" }} />
                )}
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                  <span style={{ fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0.15rem 0.5rem", borderRadius: 100, background: badge.bg, color: badge.color, fontFamily: "var(--font-dm-sans)" }}>
                    {badge.label}
                  </span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 500, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>
                    {msg.senderName ?? "Anonymous"}
                  </span>
                  {msg.senderEmail && (
                    <span style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
                      {msg.senderEmail}
                    </span>
                  )}
                  {msg.eventTitle && (
                    <span style={{ fontSize: "0.75rem", color: "rgba(200,245,90,0.5)", fontFamily: "var(--font-dm-sans)" }}>
                      re: {msg.eventTitle}
                    </span>
                  )}
                  {msg.rating != null && <StarRating rating={msg.rating} />}
                  <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "rgba(240,237,230,0.25)", fontFamily: "var(--font-dm-sans)" }}>
                    {new Date(msg.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.65)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.6, margin: "0 0 0.75rem" }}>
                  {msg.body}
                </p>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  {!msg.read && (
                    <button type="button" onClick={() => markRead(msg.id)} style={{ fontSize: "0.75rem", color: "#C8F55A", background: "transparent", border: "0.5px solid rgba(200,245,90,0.3)", borderRadius: 100, padding: "0.25rem 0.75rem", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>
                      Mark as read
                    </button>
                  )}
                  <button type="button" onClick={() => archiveMsg(msg.id)} style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.35)", background: "transparent", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 100, padding: "0.25rem 0.75rem", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>
                    Archive
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
