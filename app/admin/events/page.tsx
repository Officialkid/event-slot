"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"

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
    if (e.archived) return { label: "Archived", bg: "rgba(240,237,230,0.06)", color: "rgba(240,237,230,0.3)" }
    if (e.status === "active") return { label: "Active", bg: "rgba(200,245,90,0.08)", color: "rgba(200,245,90,0.7)" }
    if (e.status === "closed") return { label: "Closed", bg: "rgba(255,107,107,0.08)", color: "#FF6B6B" }
    return { label: e.status, bg: "rgba(240,237,230,0.06)", color: "rgba(240,237,230,0.3)" }
  }

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", fontWeight: 400, color: "#F0EDE6", marginBottom: "0.4rem" }}>
        Events
      </h1>
      <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.75rem" }}>
        All events on the platform.{userId ? " (Filtered by user)" : ""}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
        <input
          type="text"
          placeholder="Search by title or organizer email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ background: "#111", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.6rem 1rem", color: "#F0EDE6", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)", outline: "none", maxWidth: 400 }}
        />
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {statusTabs.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setStatusFilter(t)}
              style={{ padding: "0.35rem 0.85rem", borderRadius: 100, border: "0.5px solid " + (statusFilter === t ? "rgba(200,245,90,0.4)" : "rgba(240,237,230,0.1)"), background: statusFilter === t ? "rgba(200,245,90,0.1)" : "transparent", color: statusFilter === t ? "#C8F55A" : "rgba(240,237,230,0.45)", fontSize: "0.78rem", fontFamily: "var(--font-dm-sans)", cursor: "pointer", textTransform: "capitalize" }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: "auto", borderRadius: 12, border: "0.5px solid rgba(240,237,230,0.08)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 680 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(240,237,230,0.08)", background: "#111" }}>
              {["Title", "Organizer", "Registrations", "Status", "Created", ""].map(h => (
                <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              skeletonRows.map((row) => (
                <tr key={`skeleton-${row}`} style={{ borderBottom: "0.5px solid rgba(240,237,230,0.04)" }}>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 12, borderRadius: 6, background: "#1A1A1A", width: "78%", animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 12, borderRadius: 6, background: "#1A1A1A", width: "66%", animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 12, borderRadius: 6, background: "#1A1A1A", width: 48, margin: "0 auto", animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 20, borderRadius: 100, background: "#1A1A1A", width: 72, animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 12, borderRadius: 6, background: "#1A1A1A", width: "52%", animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                  <td style={{ padding: "0.75rem 1rem" }}><div style={{ height: 12, borderRadius: 6, background: "#1A1A1A", width: "65%", animation: "pulse 1.4s ease-in-out infinite" }} /></td>
                </tr>
              ))
            ) : events.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "2rem 1rem", textAlign: "center", color: "rgba(240,237,230,0.25)", fontFamily: "var(--font-dm-sans)", fontSize: "0.82rem" }}>No events found.</td></tr>
            ) : events.map((ev, i) => {
              const badge = getStatusBadge(ev)
              return (
                <tr key={ev.id} style={{ borderBottom: "0.5px solid rgba(240,237,230,0.04)", background: i % 2 !== 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {ev.title}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)" }}>{ev.organizerEmail}</td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", textAlign: "center" }}>
                    <span style={{ color: "#C8F55A" }}>{ev.confirmedCount}</span>
                    <span style={{ color: "rgba(240,237,230,0.25)" }}> +{ev.waitlistCount}wl</span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0.15rem 0.5rem", borderRadius: 100, background: badge.bg, color: badge.color, fontFamily: "var(--font-dm-sans)" }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.75rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                    {new Date(ev.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                      <a
                        href={`/${ev.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "0.75rem", color: "rgba(200,245,90,0.6)", textDecoration: "none", fontFamily: "var(--font-dm-sans)" }}
                      >
                        View ↗
                      </a>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(ev.id)}
                        style={{ fontSize: "0.75rem", color: "#FF6B6B", background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-dm-sans)", padding: 0 }}
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
          <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 16, padding: "2rem", maxWidth: 380, width: "90%" }}>
            <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", fontWeight: 400, color: "#F0EDE6", marginBottom: "0.75rem" }}>Delete event?</h3>
            <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.5rem", lineHeight: 1.55 }}>
              This will permanently delete the event and all its registrations. This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setConfirmDelete(null)} style={{ padding: "0.55rem 1.25rem", borderRadius: 100, border: "0.5px solid rgba(240,237,230,0.15)", background: "transparent", color: "rgba(240,237,230,0.55)", cursor: "pointer", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)" }}>Cancel</button>
              <button type="button" onClick={() => deleteEvent(confirmDelete)} style={{ padding: "0.55rem 1.25rem", borderRadius: 100, border: "none", background: "#FF6B6B", color: "#fff", cursor: "pointer", fontSize: "0.875rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
