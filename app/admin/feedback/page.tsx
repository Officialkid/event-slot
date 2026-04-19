"use client"

import { useEffect, useState, useCallback } from "react"

// ─── Types ────────────────────────────────────────────────────────────────────
interface OrganizerInfo {
  id: string
  name: string | null
  email: string | null
}

interface FeedbackItem {
  id: string
  type: string
  subject: string
  message: string
  rating: number | null
  status: string
  createdAt: string
  organizer: OrganizerInfo
}

// ─── Badges ───────────────────────────────────────────────────────────────────
const TYPE_COLOR: Record<string, { color: string; bg: string }> = {
  complaint: { color: "#FF6B6B", bg: "rgba(255,107,107,0.1)" },
  compliment: { color: "#4ADE80", bg: "rgba(74,222,128,0.1)" },
  suggestion: { color: "#60A5FA", bg: "rgba(96,165,250,0.1)" },
  general: { color: "rgba(240,237,230,0.45)", bg: "rgba(240,237,230,0.06)" },
}

const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  unread: { color: "#FBBF24", bg: "rgba(251,191,36,0.1)" },
  read: { color: "rgba(240,237,230,0.45)", bg: "rgba(240,237,230,0.06)" },
  resolved: { color: "#4ADE80", bg: "rgba(74,222,128,0.1)" },
}

function Badge({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span style={{
      fontSize: "0.65rem",
      fontWeight: 600,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
      padding: "0.2rem 0.55rem",
      borderRadius: 100,
      background: bg,
      color,
      fontFamily: "var(--font-dm-sans)",
    }}>
      {text}
    </span>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────
function DetailPanel({ item, onClose, onStatusChange }: {
  item: FeedbackItem
  onClose: () => void
  onStatusChange: (id: string, status: string) => void
}) {
  const [updating, setUpdating] = useState(false)
  const typeStyle = TYPE_COLOR[item.type] ?? TYPE_COLOR.general
  const statusStyle = STATUS_COLOR[item.status] ?? STATUS_COLOR.unread

  async function setStatus(status: string) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/admin/feedback/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (res.ok) onStatusChange(item.id, status)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "1rem" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 16, padding: "2rem", maxWidth: 560, width: "100%", maxHeight: "85vh", overflowY: "auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", gap: "0.75rem" }}>
          <div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
              <Badge text={item.type} color={typeStyle.color} bg={typeStyle.bg} />
              <Badge text={item.status} color={statusStyle.color} bg={statusStyle.bg} />
              {item.rating !== null && (
                <span style={{ fontSize: "0.8rem", color: "#C8F55A" }}>{"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}</span>
              )}
            </div>
            <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.25rem", fontWeight: 400, color: "#F0EDE6", margin: 0 }}>{item.subject}</h3>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(240,237,230,0.4)", fontSize: "1.2rem", lineHeight: 1, padding: "0.15rem" }} aria-label="Close">✕</button>
        </div>

        {/* Organizer info */}
        <div style={{ background: "#111", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.25rem" }}>From organizer</div>
          <div style={{ fontSize: "0.875rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}>{item.organizer.name ?? "—"}</div>
          <div style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)" }}>{item.organizer.email}</div>
        </div>

        {/* Message */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.4rem" }}>Message</div>
          <p style={{ fontSize: "0.875rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>{item.message}</p>
        </div>

        <div style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.5rem" }}>
          Submitted {new Date(item.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
          {item.status !== "read" && (
            <button
              type="button"
              onClick={() => setStatus("read")}
              disabled={updating}
              style={{ padding: "0.55rem 1.25rem", borderRadius: 100, border: "0.5px solid rgba(240,237,230,0.15)", background: "transparent", color: "rgba(240,237,230,0.6)", cursor: updating ? "default" : "pointer", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)" }}
            >
              Mark as read
            </button>
          )}
          {item.status !== "resolved" && (
            <button
              type="button"
              onClick={() => setStatus("resolved")}
              disabled={updating}
              style={{ padding: "0.55rem 1.25rem", borderRadius: 100, border: "none", background: updating ? "rgba(74,222,128,0.3)" : "rgba(74,222,128,0.15)", color: "#4ADE80", cursor: updating ? "default" : "pointer", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}
            >
              Mark as resolved
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selected, setSelected] = useState<FeedbackItem | null>(null)

  const fetchItems = useCallback(() => {
    setLoading(true)
    fetch(`/api/admin/feedback?type=${typeFilter}&status=${statusFilter}&page=${page}`)
      .then(r => r.json())
      .then(d => {
        setItems(d.items ?? [])
        setTotal(d.total ?? 0)
        setPages(d.pages ?? 1)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [typeFilter, statusFilter, page])

  useEffect(() => { fetchItems() }, [fetchItems])

  function handleStatusChange(id: string, status: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    if (selected?.id === id) setSelected(prev => prev ? { ...prev, status } : prev)
  }

  return (
    <div>
      <div style={{ marginBottom: "1.75rem" }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.75rem", fontWeight: 400, color: "#F0EDE6", margin: 0, marginBottom: "0.25rem" }}>
          Organizer Feedback
        </h1>
        <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>
          All feedback submitted by organizers.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <select
          value={typeFilter}
          onChange={e => { setTypeFilter(e.target.value); setPage(1) }}
          style={selectStyle}
        >
          <option value="all">All types</option>
          <option value="complaint">Complaint</option>
          <option value="compliment">Compliment</option>
          <option value="suggestion">Suggestion</option>
          <option value="general">General</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          style={selectStyle}
        >
          <option value="all">All statuses</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
          <option value="resolved">Resolved</option>
        </select>
        {!loading && (
          <span style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", alignSelf: "center" }}>
            {total} item{total === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: "2rem 0", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem" }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ padding: "2.5rem 0", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem", textAlign: "center" }}>No feedback matches the selected filters.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {items.map(item => {
            const typeStyle = TYPE_COLOR[item.type] ?? TYPE_COLOR.general
            const statusStyle = STATUS_COLOR[item.status] ?? STATUS_COLOR.unread
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: "0.75rem",
                  alignItems: "center",
                  background: "#141414",
                  border: "0.5px solid rgba(240,237,230,0.07)",
                  borderRadius: 10,
                  padding: "0.875rem 1.125rem",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  transition: "border-color 0.15s",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
                    <Badge text={item.type} color={typeStyle.color} bg={typeStyle.bg} />
                    <Badge text={item.status} color={statusStyle.color} bg={statusStyle.bg} />
                    {item.rating !== null && (
                      <span style={{ fontSize: "0.72rem", color: "#C8F55A" }}>{"★".repeat(item.rating)}</span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", marginBottom: "0.2rem" }}>
                    {item.subject}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)" }}>
                    {item.organizer.name ?? item.organizer.email} · {item.organizer.email}
                  </div>
                </div>
                <div style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap" }}>
                  {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem", alignItems: "center" }}>
          <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={paginationBtn(page === 1)}>← Prev</button>
          <span style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)" }}>{page} / {pages}</span>
          <button type="button" onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} style={paginationBtn(page === pages)}>Next →</button>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <DetailPanel
          item={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  background: "#141414",
  border: "0.5px solid rgba(240,237,230,0.1)",
  borderRadius: 8,
  padding: "0.5rem 0.9rem",
  color: "rgba(240,237,230,0.7)",
  fontSize: "0.825rem",
  fontFamily: "var(--font-dm-sans)",
  outline: "none",
  cursor: "pointer",
}

function paginationBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "0.45rem 1rem",
    borderRadius: 100,
    border: "0.5px solid rgba(240,237,230,0.08)",
    background: "transparent",
    color: disabled ? "rgba(240,237,230,0.2)" : "rgba(240,237,230,0.45)",
    cursor: disabled ? "default" : "pointer",
    fontSize: "0.8rem",
    fontFamily: "var(--font-dm-sans)",
  }
}
