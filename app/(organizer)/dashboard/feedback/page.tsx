"use client"

import { useEffect, useState, useCallback } from "react"
import { markFeatureUsed } from "@/lib/markFeatureUsed"

const FG = "var(--text-primary)"
const BG = "var(--bg-page)"
const SURFACE = "var(--surface)"
const LIME = "var(--accent)"
const MUTED = "var(--text-secondary)"
const BORDER = "var(--border-subtle)"
const ACCENT_TEXT = "#0A0A0A"

type FeedbackType = "complaint" | "compliment" | "suggestion" | "general"

type TabKey = "announcements" | "submit" | "submissions"

interface FeedbackItem {
  id: string
  type: string
  subject: string
  rating: number | null
  status: string
  createdAt: string
}

interface AnnouncementItem {
  id: string
  subject: string
  content: string
  createdAt: string
}

const TYPE_CONFIG: Record<FeedbackType, { label: string; color: string; bg: string }> = {
  complaint: { label: "Complaint", color: "#FF6B6B", bg: "rgba(255,107,107,0.1)" },
  compliment: { label: "Compliment", color: "#4ADE80", bg: "rgba(74,222,128,0.1)" },
  suggestion: { label: "Suggestion", color: "#60A5FA", bg: "rgba(96,165,250,0.1)" },
  general: { label: "General", color: MUTED, bg: "color-mix(in srgb, var(--text-primary) 6%, transparent)" },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  unread: { label: "Unread", color: "#FBBF24", bg: "rgba(251,191,36,0.1)" },
  read: { label: "Read", color: MUTED, bg: "color-mix(in srgb, var(--text-primary) 6%, transparent)" },
  resolved: { label: "Resolved", color: "#4ADE80", bg: "rgba(74,222,128,0.1)" },
}

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type as FeedbackType] ?? TYPE_CONFIG.general
  return (
    <span style={{
      fontSize: "0.65rem",
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      padding: "0.2rem 0.55rem",
      borderRadius: 100,
      background: cfg.bg,
      color: cfg.color,
      fontFamily: "var(--font-dm-sans)",
    }}>
      {cfg.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unread
  return (
    <span style={{
      fontSize: "0.65rem",
      fontWeight: 500,
      letterSpacing: "0.04em",
      padding: "0.2rem 0.55rem",
      borderRadius: 100,
      background: cfg.bg,
      color: cfg.color,
      fontFamily: "var(--font-dm-sans)",
    }}>
      {cfg.label}
    </span>
  )
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: "1.4rem",
            color: n <= (hover || value) ? LIME : "var(--text-dim)",
            padding: "0 2px",
            lineHeight: 1,
          }}
          aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function AnnouncementsTab({ onStartSubmit }: { onStartSubmit: () => void }) {
  const [messages, setMessages] = useState<AnnouncementItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/comms")
      .then(r => r.json())
      .then(d => setMessages(d.messages ?? []))
      .catch(() => setMessages([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ color: MUTED, fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem" }}>Loading announcements…</div>
  }

  if (messages.length === 0) {
    return (
      <div style={{ padding: "2.5rem 0", color: MUTED, fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.2rem", marginBottom: "0.65rem" }}>N</div>
        <p style={{ margin: "0 0 0.45rem", color: FG, fontSize: "1rem" }}>No announcements yet</p>
        <p style={{ margin: "0 auto 1rem", maxWidth: 380, lineHeight: 1.6, color: MUTED }}>
          Public updates from the EventSlot team will appear here.
        </p>
        <button
          type="button"
          onClick={onStartSubmit}
          style={{
            padding: "0.55rem 1rem",
            borderRadius: 10,
            border: "none",
            background: LIME,
            color: ACCENT_TEXT,
            cursor: "pointer",
            fontSize: "0.82rem",
            fontWeight: 700,
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          Send feedback
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {messages.map(message => (
        <article key={message.id} style={{ background: SURFACE, border: `0.5px solid ${BORDER}`, borderRadius: 10, padding: "1rem 1.1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.45rem" }}>
            <h3 style={{ margin: 0, fontSize: "0.96rem", color: FG, fontFamily: "var(--font-dm-sans)" }}>{message.subject}</h3>
            <span style={{ fontSize: "0.72rem", color: MUTED, fontFamily: "var(--font-dm-sans)" }}>
              {new Date(message.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {message.content}
          </p>
        </article>
      ))}
    </div>
  )
}

function SubmitTab() {
  const [type, setType] = useState<FeedbackType>("general")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [rating, setRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const showRating = type === "compliment" || type === "general"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (!subject.trim()) { setError("Subject is required."); return }
    if (!message.trim()) { setError("Message is required."); return }
    if (showRating && rating === 0) { setError("Please select a rating."); return }

    setSubmitting(true)
    try {
      const res = await fetch("/api/organizer/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          subject: subject.trim(),
          message: message.trim(),
          rating: showRating ? rating : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Submission failed."); return }
      setSuccess(true)
      setType("general")
      setSubject("")
      setMessage("")
      setRating(0)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "3rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem" }}>✓</div>
        <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.5rem", color: FG, fontWeight: 400 }}>
          Feedback sent!
        </div>
        <p style={{ fontSize: "0.875rem", color: MUTED, fontFamily: "var(--font-dm-sans)", maxWidth: 360, margin: 0 }}>
          We review all feedback and use it to improve EventSlot. Thank you for taking the time.
        </p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          style={{
            marginTop: "0.5rem",
            padding: "0.6rem 1.5rem",
            borderRadius: 100,
            border: "0.5px solid var(--border)",
            background: "transparent",
            color: MUTED,
            cursor: "pointer",
            fontSize: "0.875rem",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          Submit another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxWidth: 560 }}>
      <div>
        <label style={labelStyle}>Feedback type</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.4rem" }}>
          {(Object.keys(TYPE_CONFIG) as FeedbackType[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { setType(t); setRating(0) }}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: 100,
                border: `0.5px solid ${type === t ? TYPE_CONFIG[t].color : BORDER}`,
                background: type === t ? TYPE_CONFIG[t].bg : "transparent",
                color: type === t ? TYPE_CONFIG[t].color : MUTED,
                cursor: "pointer",
                fontSize: "0.8rem",
                fontFamily: "var(--font-dm-sans)",
                fontWeight: type === t ? 600 : 400,
                transition: "all 0.15s",
              }}
            >
              {TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={labelStyle}>
          Subject
          <span style={{ color: MUTED, fontWeight: 400, marginLeft: "0.25rem" }}>({subject.length}/100)</span>
        </label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          maxLength={100}
          placeholder="Brief summary of your feedback"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>
          Message
          <span style={{ color: MUTED, fontWeight: 400, marginLeft: "0.25rem" }}>({message.length}/2000)</span>
        </label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          maxLength={2000}
          rows={5}
          placeholder="Describe your feedback in detail…"
          style={{ ...inputStyle, resize: "vertical", minHeight: 120 }}
        />
      </div>

      {showRating && (
        <div>
          <label style={labelStyle}>Overall experience</label>
          <div style={{ marginTop: "0.4rem" }}>
            <StarPicker value={rating} onChange={setRating} />
          </div>
        </div>
      )}

      {error && (
        <p style={{ fontSize: "0.8rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)", margin: 0 }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          alignSelf: "flex-start",
          padding: "0.65rem 1.75rem",
          borderRadius: 100,
          border: "none",
          background: submitting ? "rgba(200,245,90,0.4)" : LIME,
          color: ACCENT_TEXT,
          cursor: submitting ? "default" : "pointer",
          fontSize: "0.875rem",
          fontWeight: 700,
          fontFamily: "var(--font-dm-sans)",
          transition: "background 0.15s",
        }}
      >
        {submitting ? "Sending…" : "Send feedback"}
      </button>
    </form>
  )
}

function SubmissionsTab({ onStartSubmit }: { onStartSubmit: () => void }) {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchItems = useCallback(() => {
    setLoading(true)
    fetch(`/api/organizer/feedback?page=${page}`)
      .then(r => r.json())
      .then(d => {
        setItems(d.items ?? [])
        setTotal(d.total ?? 0)
        setPages(d.pages ?? 1)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page])

  useEffect(() => { fetchItems() }, [fetchItems])

  if (loading) {
    return <div style={{ padding: "2rem 0", color: MUTED, fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem" }}>Loading submissions…</div>
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: "2.5rem 0", color: MUTED, fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.2rem", marginBottom: "0.65rem" }}>FB</div>
        <p style={{ margin: "0 0 0.45rem", color: FG, fontSize: "1rem" }}>No feedback submitted yet</p>
        <p style={{ margin: "0 auto 0.95rem", maxWidth: 380, lineHeight: 1.6, color: MUTED }}>
          Share what is working or what could be better so EventSlot can keep improving for you.
        </p>
        <button
          type="button"
          onClick={onStartSubmit}
          style={{
            padding: "0.55rem 1rem",
            borderRadius: 10,
            border: "none",
            background: LIME,
            color: ACCENT_TEXT,
            cursor: "pointer",
            fontSize: "0.82rem",
            fontWeight: 700,
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          Send feedback
        </button>
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontSize: "0.78rem", color: MUTED, fontFamily: "var(--font-dm-sans)", marginBottom: "1rem" }}>
        {total} submission{total === 1 ? "" : "s"} total
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {items.map(item => (
          <div key={item.id} style={{ background: SURFACE, border: `0.5px solid ${BORDER}`, borderRadius: 10, padding: "0.875rem 1.125rem", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.25rem" }}>
                <TypeBadge type={item.type} />
                <StatusBadge status={item.status} />
                {item.rating !== null && (
                  <span style={{ fontSize: "0.75rem", color: LIME, letterSpacing: "0.02em" }}>
                    {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.875rem", fontWeight: 500, color: FG, fontFamily: "var(--font-dm-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {item.subject}
              </div>
            </div>
            <div style={{ fontSize: "0.72rem", color: MUTED, fontFamily: "var(--font-dm-sans)", flexShrink: 0, whiteSpace: "nowrap" }}>
              {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem", alignItems: "center" }}>
          <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={paginationBtn(page === 1)}>
            ← Prev
          </button>
          <span style={{ fontSize: "0.78rem", color: MUTED, fontFamily: "var(--font-dm-sans)" }}>
            {page} / {pages}
          </span>
          <button type="button" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={paginationBtn(page === pages)}>
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.72rem",
  color: MUTED,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  fontFamily: "var(--font-dm-sans)",
  fontWeight: 600,
  marginBottom: "0.35rem",
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--bg-input)",
  border: `0.5px solid var(--border)`,
  borderRadius: 8,
  padding: "0.65rem 0.9rem",
  color: FG,
  fontSize: "0.875rem",
  fontFamily: "var(--font-dm-sans)",
  outline: "none",
  boxSizing: "border-box",
}

function paginationBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "0.45rem 1rem",
    borderRadius: 100,
    border: `0.5px solid ${BORDER}`,
    background: "transparent",
    color: disabled ? "var(--text-dim)" : MUTED,
    cursor: disabled ? "default" : "pointer",
    fontSize: "0.8rem",
    fontFamily: "var(--font-dm-sans)",
  }
}

export default function FeedbackPage() {
  const [tab, setTab] = useState<TabKey>("announcements")

  useEffect(() => {
    markFeatureUsed("feedback")
  }, [])

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: "1.5rem" }}>
        <p style={{ margin: 0, fontSize: "0.72rem", color: MUTED, letterSpacing: "0.14em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)" }}>
          Comms
        </p>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", fontWeight: 400, color: FG, margin: "0.35rem 0 0.4rem" }}>
          Public updates and feedback
        </h1>
        <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: 1.65, color: MUTED, fontFamily: "var(--font-dm-sans)", maxWidth: 620 }}>
          See platform announcements, send the team feedback, and track your own submissions in one place.
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        {([
          { key: "announcements" as const, label: "Announcements" },
          { key: "submit" as const, label: "Send feedback" },
          { key: "submissions" as const, label: "My submissions" },
        ]).map(item => {
          const active = tab === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              style={{
                padding: "0.35rem 0.85rem",
                borderRadius: 100,
                border: `0.5px solid ${active ? "rgba(200,245,90,0.35)" : BORDER}`,
                background: active ? "rgba(200,245,90,0.1)" : "transparent",
                color: active ? LIME : MUTED,
                fontSize: "0.8rem",
                fontFamily: "var(--font-dm-sans)",
                cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          )
        })}
      </div>

      <section style={{ background: BG, border: `0.5px solid ${BORDER}`, borderRadius: 14, padding: "1.25rem" }}>
        {tab === "announcements" ? <AnnouncementsTab onStartSubmit={() => setTab("submit")} /> : null}
        {tab === "submit" ? <SubmitTab /> : null}
        {tab === "submissions" ? <SubmissionsTab onStartSubmit={() => setTab("submit")} /> : null}
      </section>
    </div>
  )
}
