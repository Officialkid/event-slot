"use client"

import { useCallback, useEffect, useState } from "react"

interface MessageAuthor {
  id: string
  name: string | null
  email: string | null
}

interface Message {
  id: string
  type: "USER_FEEDBACK" | "ADMIN_BROADCAST"
  subject: string
  content: string
  isPublic: boolean
  createdAt: string
  author: MessageAuthor | null
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [feedbackCount, setFeedbackCount] = useState(0)
  const [broadcastCount, setBroadcastCount] = useState(0)
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  const fetchMessages = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/messages?filter=${filter}`)
      .then(r => r.json())
      .then(d => {
        setMessages(d.messages ?? [])
        setTotalCount(d.totalCount ?? 0)
        setFeedbackCount(d.feedbackCount ?? 0)
        setBroadcastCount(d.broadcastCount ?? 0)
      })
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  const filterTabs = [
    { key: "all", label: `All (${totalCount})` },
    { key: "feedback", label: `User feedback (${feedbackCount})` },
    { key: "broadcast", label: `Announcements (${broadcastCount})` },
  ]

  const badgeFor = (type: Message["type"]) =>
    type === "ADMIN_BROADCAST"
      ? { label: "Announcement", bg: "rgba(200,245,90,0.12)", color: "#C8F55A" }
      : { label: "Feedback", bg: "rgba(240,237,230,0.06)", color: "rgba(240,237,230,0.55)" }

  const skeletonCards = [1, 2, 3]

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.4rem", flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", fontWeight: 400, color: "#F0EDE6" }}>
          Messages
        </h1>
      </div>
      <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.75rem" }}>
        Public announcements and user feedback submitted through the comms channel.
      </p>

      <div style={{ display: "flex", gap: "0.35rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
        {filterTabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setFilter(t.key)}
            style={{
              padding: "0.35rem 0.85rem",
              borderRadius: 100,
              border: "0.5px solid " + (filter === t.key ? "rgba(200,245,90,0.4)" : "rgba(240,237,230,0.1)"),
              background: filter === t.key ? "rgba(200,245,90,0.1)" : "transparent",
              color: filter === t.key ? "#C8F55A" : "rgba(240,237,230,0.45)",
              fontSize: "0.78rem",
              fontFamily: "var(--font-dm-sans)",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {skeletonCards.map((card) => (
            <div
              key={`skeleton-${card}`}
              style={{
                background: "#111",
                border: "0.5px solid rgba(240,237,230,0.07)",
                borderRadius: 12,
                padding: "1.25rem 1.5rem",
              }}
            >
              <div style={{ display: "flex", gap: "0.65rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ height: 20, width: 92, borderRadius: 100, background: "#1A1A1A", animation: "pulse 1.4s ease-in-out infinite" }} />
                <div style={{ height: 12, width: 120, borderRadius: 6, background: "#1A1A1A", animation: "pulse 1.4s ease-in-out infinite" }} />
              </div>
              <div style={{ height: 14, width: "58%", borderRadius: 6, background: "#1A1A1A", animation: "pulse 1.4s ease-in-out infinite", marginBottom: "0.55rem" }} />
              <div style={{ height: 10, width: "92%", borderRadius: 6, background: "#1A1A1A", animation: "pulse 1.4s ease-in-out infinite", marginBottom: "0.4rem" }} />
              <div style={{ height: 10, width: "80%", borderRadius: 6, background: "#1A1A1A", animation: "pulse 1.4s ease-in-out infinite" }} />
            </div>
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div style={{ textAlign: "center", padding: "3rem 0", color: "rgba(240,237,230,0.2)", fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem" }}>
          No messages found.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {messages.map(msg => {
            const badge = badgeFor(msg.type)
            return (
              <article
                key={msg.id}
                style={{
                  background: "#111",
                  border: "0.5px solid rgba(240,237,230,0.07)",
                  borderRadius: 12,
                  padding: "1.25rem 1.5rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.65rem" }}>
                  <span style={{ fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0.15rem 0.5rem", borderRadius: 100, background: badge.bg, color: badge.color, fontFamily: "var(--font-dm-sans)" }}>
                    {badge.label}
                  </span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 500, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>
                    {msg.author?.name ?? msg.author?.email ?? "Anonymous"}
                  </span>
                  {msg.author?.email && (
                    <span style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", overflowWrap: "anywhere" }}>
                      {msg.author.email}
                    </span>
                  )}
                  <span style={{ marginLeft: "auto", fontSize: "0.72rem", color: "rgba(240,237,230,0.25)", fontFamily: "var(--font-dm-sans)" }}>
                    {new Date(msg.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                <h2 style={{ margin: "0 0 0.55rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontSize: "1rem" }}>
                  {msg.subject}
                </h2>
                <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.65)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap" }}>
                  {msg.content}
                </p>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
