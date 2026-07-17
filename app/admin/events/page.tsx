"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"

interface AdminEvent {
  id: string
  title: string
  slug: string
  organizerEmail: string
  confirmedCount: number
  waitlistCount: number
  status: string
  archived: boolean
  createdAt: string
}

export default function AdminEventsPage() {
  const searchParamsHook = useSearchParams()
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [entering, setEntering] = useState<string | null>(null)
  const router = useRouter()

  const userId = searchParamsHook.get("user") ?? ""

  const fetchEvents = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (statusFilter !== "all") params.set("status", statusFilter)
    if (userId) params.set("user", userId)
    fetch(`/api/admin/events?${params}`)
      .then(r => r.json())
      .then(d => setEvents(d.events ?? []))
      .finally(() => setLoading(false))
  }, [search, statusFilter, userId])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  async function enterAdminMode(eventId: string) {
    setEntering(eventId)
    try {
      const res = await fetch('/api/admin/event-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      })
      const data = await res.json()
      if (res.ok && data.redirectTo) {
        router.push(data.redirectTo)
      } else {
        alert(data.error ?? 'Failed to enter Admin Mode')
      }
    } catch {
      alert('Network error. Please try again.')
    } finally {
      setEntering(null)
    }
  }

  async function deleteEvent(id: string) {
    await fetch("/api/admin/events", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setConfirmDelete(null)
    fetchEvents()
  }

  const statusTabs = ["all", "active", "closed", "archived"]
  const skeletonRows = [1, 2, 3, 4]

  function getStatusBadge(e: AdminEvent) {
    if (e.archived) return { label: "Archived", bg: "var(--surface-muted)", color: "var(--text-muted)" }
    if (e.status === "active") return { label: "Active", bg: "var(--accent-dim)", color: "var(--accent)" }
    if (e.status === "closed") return { label: "Closed", bg: "color-mix(in srgb, var(--error) 10%, transparent)", color: "var(--error)" }
    return { label: e.status, bg: "var(--surface-muted)", color: "var(--text-muted)" }
  }

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", fontWeight: 400, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
        Events
      </h1>
      <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.75rem" }}>
        All events on the platform.{userId ? " (Filtered by user)" : ""}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <input
          type="text"
          placeholder="Search by title or organizer email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: "var(--bg-input)", border: "0.5px solid var(--border)", borderRadius: 8, padding: "0.6rem 1rem", color: "var(--text-primary)", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)", outline: "none", maxWidth: 400 }}
        />
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {statusTabs.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setStatusFilter(t)}
              style={{ padding: "0.35rem 0.85rem", borderRadius: 100, border: "0.5px solid " + (statusFilter === t ? "var(--border-emphasis)" : "var(--border)"), background: statusFilter === t ? "var(--accent-dim)" : "transparent", color: statusFilter === t ? "var(--accent)" : "var(--text-secondary)", fontSize: "0.78rem", fontFamily: "var(--font-dm-sans)", cursor: "pointer", textTransform: "capitalize" }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: "auto", borderRadius: 12, border: "0.5px solid var(--border)", background: "var(--surface)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border)", background: "var(--surface-muted)" }}>
              {["Title", "Organizer", "Registrations", "Status", "Created", ""].map(h => (
                <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              skeletonRows.map((row) => (
                <tr key={`skeleton-${row}`} style={{ borderBottom: "0.5px solid var(--border-subtle)" }}>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 12, borderRadius: 6, background: "var(--bg-elevated)", width: "78%", animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 12, borderRadius: 6, background: "var(--bg-elevated)", width: "66%", animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 12, borderRadius: 6, background: "var(--bg-elevated)", width: 48, margin: "0 auto", animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 20, borderRadius: 100, background: "var(--bg-elevated)", width: 72, animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 12, borderRadius: 6, background: "var(--bg-elevated)", width: "52%", animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 12, borderRadius: 6, background: "var(--bg-elevated)", width: "65%", animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                </tr>
              ))
            ) : events.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "2rem 1rem", textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", fontSize: "0.82rem" }}>No events found.</td></tr>
            ) : events.map((ev, i) => {
              const badge = getStatusBadge(ev)
              return (
                <tr key={ev.id} style={{ borderBottom: "0.5px solid var(--border-subtle)", background: i % 2 !== 0 ? "color-mix(in srgb, var(--text-primary) 2%, transparent)" : "transparent" }}>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ev.title}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)" }}>{ev.organizerEmail}</td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", textAlign: "center" }}>
                    <span style={{ color: "var(--accent)" }}>{ev.confirmedCount}</span>
                    <span style={{ color: "var(--text-muted)" }}> +{ev.waitlistCount}wl</span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0.15rem 0.5rem", borderRadius: 100, background: badge.bg, color: badge.color, fontFamily: "var(--font-dm-sans)" }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>
                    {new Date(ev.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                      <a
                        href={`/${ev.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "0.75rem", color: "var(--accent)", textDecoration: "none", fontFamily: "var(--font-dm-sans)" }}
                      >
                        {'View ->'}
                      </a>
                      <button
                        type="button"
                        onClick={() => enterAdminMode(ev.id)}
                        disabled={entering === ev.id}
                        style={{ fontSize: "0.72rem", color: "#0A0A0A", background: entering === ev.id ? "rgba(200,245,90,0.5)" : "#C8F55A", border: "none", cursor: entering === ev.id ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", padding: "0.2rem 0.55rem", borderRadius: 6, fontWeight: 700 }}
                      >
                        {entering === ev.id ? "Entering..." : "Admin Mode"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(ev.id)}
                        style={{ fontSize: "0.75rem", color: "var(--error)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-dm-sans)", padding: 0 }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "var(--surface)", border: "0.5px solid var(--border)", borderRadius: 16, padding: "2rem", maxWidth: 380, width: "90%" }}>
            <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", fontWeight: 400, color: "var(--text-primary)", marginBottom: "0.75rem" }}>Delete event?</h3>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.5rem", lineHeight: 1.55 }}>
              This will permanently delete the event and all its registrations. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setConfirmDelete(null)} style={{ padding: "0.55rem 1.25rem", borderRadius: 100, border: "0.5px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)" }}>Cancel</button>
              <button type="button" onClick={() => deleteEvent(confirmDelete)} style={{ padding: "0.55rem 1.25rem", borderRadius: 100, border: "none", background: "#FF6B6B", color: "#fff", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
