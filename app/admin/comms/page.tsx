"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

interface CommsMessage {
  id: string
  subject: string
  content: string
  createdAt: string
}

export default function AdminCommsPage() {
  const [subject, setSubject] = useState("")
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [announcements, setAnnouncements] = useState<CommsMessage[]>([])

  const parseJsonSafely = async (res: Response): Promise<Record<string, unknown>> => {
    const bodyText = await res.text()
    if (!bodyText) return {}
    try {
      return JSON.parse(bodyText) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  const snippet = useMemo(() => {
    const trimmed = content.trim()
    return trimmed.length > 120 ? `${trimmed.slice(0, 120).trim()}...` : trimmed
  }, [content])

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/comms")
      const data = await parseJsonSafely(res)
      setAnnouncements(Array.isArray(data.messages) ? (data.messages as CommsMessage[]) : [])
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to load announcements.")
      }
    } catch {
      setError("Network error while loading announcements.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  const submit = async () => {
    setError("")
    setSuccess("")
    if (!subject.trim() || !content.trim()) {
      setError("Subject and content are required.")
      return
    }

    setSending(true)
    try {
      const res = await fetch("/api/admin/comms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, content }),
      })
      const data = await parseJsonSafely(res)
      if (typeof data.error === "string") {
        setError(data.error)
        return
      }
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Failed to publish announcement.")
        return
      }
      setSubject("")
      setContent("")
      setSuccess("Announcement published and notifications sent.")
      await fetchAnnouncements()
    } catch {
      setError("Network error while publishing announcement.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", fontWeight: 400, color: "var(--text-primary)", margin: 0 }}>
          Comms
        </h1>
        <p style={{ margin: "0.35rem 0 0", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem" }}>
          Post public announcements that appear on the comms board and as platform notifications.
        </p>
      </div>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <section style={{ background: "var(--surface)", border: "0.5px solid var(--border-subtle)", borderRadius: 14, padding: "1.25rem" }}>
          <h2 style={{ margin: "0 0 1rem", color: "var(--text-primary)", fontSize: "1rem", fontFamily: "var(--font-dm-sans)" }}>
            New Announcement
          </h2>

          <label style={labelStyle}>Subject</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle} placeholder="Maintenance update, feature launch, or important notice" />

          <label style={{ ...labelStyle, marginTop: "0.9rem" }}>Content</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={8} style={{ ...inputStyle, resize: "vertical", minHeight: 180 }} placeholder="Write the announcement content here..." />

          <div style={{ marginTop: "0.9rem", fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>
            Preview snippet: {snippet || "No content yet"}
          </div>

          {error && <p style={{ color: "#FF6B6B", fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)" }}>{error}</p>}
          {success && <p style={{ color: "#C8F55A", fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)" }}>{success}</p>}

          <button type="button" onClick={submit} disabled={sending} style={actionBtnStyle}>
            {sending ? "Publishing..." : "Publish announcement"}
          </button>
        </section>

        <section style={{ background: "var(--surface)", border: "0.5px solid var(--border-subtle)", borderRadius: 14, padding: "1.25rem" }}>
          <h2 style={{ margin: "0 0 1rem", color: "var(--text-primary)", fontSize: "1rem", fontFamily: "var(--font-dm-sans)" }}>
            Recent Public Notices
          </h2>
          {loading ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ background: "var(--surface-muted)", border: "0.5px solid var(--border-subtle)", borderRadius: 12, padding: "1rem" }}>
                  <div style={{ height: 12, width: "48%", borderRadius: 6, background: "var(--bg-elevated)", marginBottom: "0.55rem", animation: "pulse 1.4s ease-in-out infinite" }} />
                  <div style={{ height: 10, width: "92%", borderRadius: 6, background: "var(--bg-elevated)", marginBottom: "0.35rem", animation: "pulse 1.4s ease-in-out infinite" }} />
                  <div style={{ height: 10, width: "74%", borderRadius: 6, background: "var(--bg-elevated)", animation: "pulse 1.4s ease-in-out infinite" }} />
                </div>
              ))}
            </div>
          ) : announcements.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>
              No announcements published yet.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {announcements.map(item => (
                <article key={item.id} style={{ background: "var(--surface-muted)", border: "0.5px solid var(--border-subtle)", borderRadius: 12, padding: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.45rem", flexWrap: "wrap" }}>
                    <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)", fontSize: "0.95rem" }}>{item.subject}</strong>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)" }}>{new Date(item.createdAt).toLocaleDateString("en-GB")}</span>
                  </div>
                  <p style={{ margin: 0, color: "var(--text-secondary)", lineHeight: 1.7, fontFamily: "var(--font-dm-sans)", whiteSpace: "pre-wrap" }}>{item.content}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "0.35rem",
  color: "var(--text-muted)",
  fontSize: "0.72rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  fontFamily: "var(--font-dm-sans)",
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "0.5px solid var(--border)",
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  padding: "0.75rem 0.9rem",
  fontFamily: "var(--font-dm-sans)",
  fontSize: "0.875rem",
  outline: "none",
  boxSizing: "border-box",
}

const actionBtnStyle: React.CSSProperties = {
  marginTop: "1rem",
  padding: "0.7rem 1rem",
  borderRadius: 10,
  border: "none",
  background: "#C8F55A",
  color: "#0A0A0A",
  fontFamily: "var(--font-dm-sans)",
  fontWeight: 700,
  cursor: "pointer",
}
