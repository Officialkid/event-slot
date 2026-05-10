"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface CommsMessage {
  id: string
  subject: string
  content: string
  createdAt: string
  author?: { name: string | null; email: string | null } | null
}

export default function PublicCommsPage() {
  const [messages, setMessages] = useState<CommsMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/comms")
      .then(r => r.json())
      .then(d => setMessages(d.messages ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth: 840, margin: "0 auto", padding: "2.5rem 1rem" }}>
      <div style={{ marginBottom: "1.75rem" }}>
        <p style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
          Comms Board
        </p>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.8rem, 4vw, 2.6rem)", color: "#F0EDE6", fontWeight: 400, margin: "0.4rem 0 0.75rem" }}>
          Public announcements and community updates
        </h1>
        <p style={{ margin: 0, fontSize: "0.9rem", lineHeight: 1.7, color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)", maxWidth: 680 }}>
          EventSlot announcements, maintenance notices, and platform updates live here. Signed-in users can use the dashboard feedback channel to send the team a message.
        </p>
      </div>

      <div style={{ marginBottom: "1.5rem" }}>
        <Link href="/dashboard/feedback" style={{ display: "inline-block", background: "#C8F55A", color: "#0A0A0A", borderRadius: 10, padding: "0.7rem 1rem", textDecoration: "none", fontSize: "0.85rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>
          Open feedback channel
        </Link>
      </div>

      {loading ? (
        <div style={{ color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>Loading announcements…</div>
      ) : messages.length === 0 ? (
        <div style={{ padding: "2.5rem 1rem", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 14, color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
          No public announcements yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {messages.map(message => (
            <article key={message.id} style={{ background: "#111", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 14, padding: "1.25rem 1.35rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "0.55rem", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontSize: "1rem" }}>{message.subject}</h2>
                <span style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                  {new Date(message.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
              <p style={{ margin: 0, color: "rgba(240,237,230,0.65)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {message.content}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
