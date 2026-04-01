"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"

// ─── Types ────────────────────────────────────────────────────────────────────

type Question = {
  id: string
  label: string
  type: string
  options?: string[]
  required: boolean
}

type Registration = {
  id: string
  registrationNumber?: number | null
  answers: Array<{ questionId: string; value: string }>
  submittedAt: string
  status?: string
  waitlistPosition?: number | null
  isDuplicate?: boolean
}

type DupReg = {
  id: string
  registrationNumber: number | null
  answers: Array<{ questionId: string; value: string }>
  status: string
  waitlistPosition: number | null
  submittedAt: string
  isDuplicate: boolean
}

type EventData = {
  title: string
  description: string | null
  capacity: number | null
  deadline: string | null
  confirmedCount: number
  waitlistCount: number
  slug: string
  questions: Question[]
  eventDate: string | null
  location: string | null
  communityLink: string | null
  archived: boolean
  status: string
  dashboardToken: string
}

type TabKey = "overview" | "confirmed" | "waitlist" | "settings"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function isEventArchived(e: EventData): boolean {
  return e.archived || e.status === "archived"
}

function isEventPast(e: EventData): boolean {
  if (isEventArchived(e)) return false
  return !!(e.deadline && new Date(e.deadline) < new Date())
}

function isEventClosed(e: EventData): boolean {
  return e.status === "closed"
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ event }: { event: EventData }) {
  if (isEventArchived(event)) {
    return (
      <span style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.04em", background: "rgba(240,237,230,0.08)", color: "rgba(240,237,230,0.4)", borderRadius: 100, padding: "2px 8px", fontFamily: "var(--font-dm-sans)" }}>
        ARCHIVED
      </span>
    )
  }
  if (isEventClosed(event) || isEventPast(event)) {
    return (
      <span style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.04em", background: "rgba(255,107,107,0.12)", color: "#FF6B6B", borderRadius: 100, padding: "2px 8px", fontFamily: "var(--font-dm-sans)" }}>
        CLOSED
      </span>
    )
  }
  return (
    <span style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.04em", background: "rgba(200,245,90,0.12)", color: "#C8F55A", borderRadius: 100, padding: "2px 8px", fontFamily: "var(--font-dm-sans)" }}>
      ACTIVE
    </span>
  )
}

// ─── Three-dot menu ───────────────────────────────────────────────────────────

interface HeaderMenuProps {
  onRename: () => void
  onArchive: () => void
  onDelete: () => void
  onClose: () => void
  onEdit: () => void
  archived: boolean
  closed: boolean
}

function HeaderMenu({ onRename, onArchive, onDelete, onClose, onEdit, archived, closed }: HeaderMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [open])

  const item: React.CSSProperties = {
    display: "block", width: "100%", textAlign: "left", background: "transparent",
    border: "none", padding: "0.5rem 0.875rem", fontSize: "0.82rem",
    fontFamily: "var(--font-dm-sans)", color: "rgba(240,237,230,0.7)",
    cursor: "pointer", borderRadius: 6, whiteSpace: "nowrap",
  }

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "rgba(240,237,230,0.5)", fontSize: "1rem", letterSpacing: "0.1em" }}
        aria-label="Event options"
      >
        ···
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: "#1A1A1A", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 8, padding: "0.25rem", zIndex: 20, minWidth: 180, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
          <button className="hdr-menu-item" style={item} onClick={() => { setOpen(false); onEdit() }}>Edit event</button>
          <button className="hdr-menu-item" style={item} onClick={() => { setOpen(false); onRename() }}>Rename</button>
          {!archived && (
            <button className="hdr-menu-item" style={item} onClick={() => { setOpen(false); onClose() }}>
              {closed ? "Reopen registrations" : "Close registrations"}
            </button>
          )}
          {!archived && (
            <button className="hdr-menu-item" style={item} onClick={() => { setOpen(false); onArchive() }}>Archive</button>
          )}
          <div style={{ height: "0.5px", background: "rgba(240,237,230,0.08)", margin: "0.25rem 0.5rem" }} />
          <button className="hdr-menu-item" style={{ ...item, color: "#FF6B6B" }} onClick={() => { setOpen(false); onDelete() }}>Delete</button>
        </div>
      )}
    </div>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function Backdrop({ onClick }: { onClick: () => void }) {
  return <div onClick={onClick} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 60 }} />
}

function RenameModal({ current, onClose, onSave }: { current: string; onClose: () => void; onSave: (t: string) => Promise<void> }) {
  const [value, setValue] = useState(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async () => {
    if (!value.trim()) { setError("Title cannot be empty."); return }
    setSaving(true)
    try { await onSave(value.trim()); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to rename.") }
    finally { setSaving(false) }
  }

  return (
    <>
      <Backdrop onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 61, background: "#1A1A1A", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 16, padding: "1.75rem", width: "min(92vw,420px)" }}>
        <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6", marginBottom: "1rem" }}>Rename event</h3>
        <input autoFocus type="text" value={value} onChange={e => { setValue(e.target.value); setError("") }} onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onClose() }}
          style={{ width: "100%", background: "#141414", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.625rem 0.875rem", fontSize: "0.875rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", outline: "none", boxSizing: "border-box" }} />
        {error && <p style={{ fontSize: "0.78rem", color: "#FF6B6B", marginTop: "0.4rem", fontFamily: "var(--font-dm-sans)" }}>{error}</p>}
        <div style={{ display: "flex", gap: "0.625rem", marginTop: "1.25rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </>
  )
}

function ArchiveConfirm({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => Promise<void> }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const handle = async () => {
    setSaving(true)
    try { await onConfirm(); onClose() }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to archive.") }
    finally { setSaving(false) }
  }
  return (
    <>
      <Backdrop onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 61, background: "#1A1A1A", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 16, padding: "1.75rem", width: "min(92vw,420px)" }}>
        <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6", marginBottom: "0.5rem" }}>Archive this event?</h3>
        <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.25rem" }}>It will be moved to your archived tab.</p>
        {error && <p style={{ fontSize: "0.78rem", color: "#FF6B6B", marginBottom: "0.75rem", fontFamily: "var(--font-dm-sans)" }}>{error}</p>}
        <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>Cancel</button>
          <button onClick={handle} disabled={saving} style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: saving ? 0.7 : 1 }}>{saving ? "Archiving…" : "Archive"}</button>
        </div>
      </div>
    </>
  )
}

function DeleteModal({ title, slug, token, onClose, onSuccess }: { title: string; slug: string; token: string; onClose: () => void; onSuccess: () => void }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")
  const handle = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/events/${slug}?token=${encodeURIComponent(token)}`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok) { onSuccess(); onClose() }
      else setError(data.error || "Failed to delete.")
    } catch { setError("Unexpected error.") }
    finally { setDeleting(false) }
  }
  return (
    <>
      <Backdrop onClick={onClose} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 61, background: "#1A1A1A", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 16, padding: "1.75rem", width: "min(92vw,440px)" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,107,107,0.12)", border: "0.5px solid rgba(255,107,107,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16.5 15H1.5L9 2z" stroke="#FF6B6B" strokeWidth="1.25" strokeLinejoin="round" />
            <path d="M9 7v4" stroke="#FF6B6B" strokeWidth="1.25" strokeLinecap="round" />
            <circle cx="9" cy="13" r="0.75" fill="#FF6B6B" />
          </svg>
        </div>
        <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6", marginBottom: "0.5rem" }}>Delete this event?</h3>
        <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
          This will permanently delete <strong style={{ color: "rgba(240,237,230,0.75)" }}>{title}</strong> and all its registrations. This cannot be undone.
        </p>
        {error && <p style={{ fontSize: "0.78rem", color: "#FF6B6B", marginBottom: "0.75rem", fontFamily: "var(--font-dm-sans)" }}>{error}</p>}
        <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>Cancel</button>
          <button onClick={handle} disabled={deleting} style={{ background: "#FF6B6B", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, color: "#fff", cursor: deleting ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: deleting ? 0.7 : 1 }}>{deleting ? "Deleting…" : "Delete permanently"}</button>
        </div>
      </div>
    </>
  )
}

// ─── Registration tables ──────────────────────────────────────────────────────

function RegTable({
  rows, questions, showPosition = false, emptyText, token, onRemove,
}: {
  rows: Registration[]
  questions: Question[]
  showPosition?: boolean
  emptyText: string
  token: string
  onRemove: (id: string) => void
}) {
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null)
  const [removingId, setRemovingId] = React.useState<string | null>(null)

  const handleRemove = async (regId: string) => {
    setRemovingId(regId)
    try {
      const res = await fetch(`/api/registrations/${regId}?token=${encodeURIComponent(token)}`, { method: "DELETE" })
      if (res.ok) {
        onRemove(regId)
      }
    } finally {
      setRemovingId(null)
      setConfirmingId(null)
    }
  }

  const labels = questions.map(q => q.label)
  return (
    <div style={{ overflowX: "auto", borderRadius: 12, border: "0.5px solid rgba(240,237,230,0.08)" }}>
      <table style={{ minWidth: "100%", borderCollapse: "collapse" }}>
        <thead style={{ background: "#141414" }}>
          <tr>
            {showPosition && <th style={thStyle}>#</th>}
            {labels.map(label => <th key={label} style={thStyle}>{label}</th>)}
            <th style={thStyle}>Registered</th>
            <th style={thStyle}>Remove</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={labels.length + (showPosition ? 3 : 2)} style={{ padding: "2rem", textAlign: "center", fontSize: "0.85rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map(reg => (
              <tr key={reg.id} style={{ borderTop: "0.5px solid rgba(240,237,230,0.06)" }} className="reg-row">
                {showPosition && <td style={tdStyle}>{reg.waitlistPosition}</td>}
                {questions.map(q => {
                  const answer = reg.answers.find(a => a.questionId === q.id)?.value || ""
                  return <td key={q.id} style={tdStyle}>{answer}</td>
                })}
                <td style={{ ...tdStyle, color: "rgba(240,237,230,0.4)", fontSize: "0.75rem" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    {new Date(reg.submittedAt).toLocaleString()}
                    {reg.isDuplicate && (
                      <span style={{ fontSize: "0.62rem", fontWeight: 600, letterSpacing: "0.04em", background: "rgba(255,168,0,0.12)", color: "#FFA800", border: "0.5px solid rgba(255,168,0,0.3)", borderRadius: 100, padding: "1px 7px", whiteSpace: "nowrap" }}>
                        DIFFERENT
                      </span>
                    )}
                  </span>
                </td>
                <td style={{ ...tdStyle, width: 80 }}>
                  {confirmingId === reg.id ? (
                    <span style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                      <button
                        onClick={() => handleRemove(reg.id)}
                        disabled={removingId === reg.id}
                        style={{ background: "#FF6B6B", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: "0.72rem", fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "var(--font-dm-sans)", opacity: removingId === reg.id ? 0.6 : 1 }}
                      >
                        {removingId === reg.id ? "…" : "Yes"}
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 6, padding: "3px 8px", fontSize: "0.72rem", color: "rgba(240,237,230,0.4)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                      >
                        No
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmingId(reg.id)}
                      style={{ background: "transparent", border: "0.5px solid rgba(255,107,107,0.3)", borderRadius: 6, padding: "3px 10px", fontSize: "0.72rem", color: "rgba(255,107,107,0.7)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: "0.625rem 1rem",
  textAlign: "left",
  fontSize: "0.65rem",
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "rgba(240,237,230,0.35)",
  fontFamily: "var(--font-dm-sans)",
  whiteSpace: "nowrap",
}

const tdStyle: React.CSSProperties = {
  padding: "0.75rem 1rem",
  fontSize: "0.82rem",
  color: "#F0EDE6",
  fontFamily: "var(--font-dm-sans)",
}

// ─── Settings tab ─────────────────────────────────────────────────────────────

function SettingsTab({ event, hasRegistrations, onSaved }: { event: EventData; hasRegistrations: boolean; onSaved: (updates: Partial<EventData>) => void }) {
  const [description, setDescription] = useState(event.description ?? "")
  const [eventDate, setEventDate] = useState(toDatetimeLocal(event.eventDate))
  const [location, setLocation] = useState(event.location ?? "")
  const [communityLink, setCommunityLink] = useState(event.communityLink ?? "")
  const [deadline, setDeadline] = useState(toDatetimeLocal(event.deadline))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async () => {
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const res = await fetch(`/api/events/${event.slug}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description || null,
          eventDate: eventDate || null,
          location: location || null,
          communityLink: communityLink || null,
          deadline: deadline || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setSaved(true)
        onSaved({ description: description || null, eventDate: eventDate || null, location: location || null, communityLink: communityLink || null, deadline: deadline || null })
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(data.error || "Failed to save.")
      }
    } catch {
      setError("Unexpected error.")
    } finally {
      setSaving(false)
    }
  }

  const fieldLabel: React.CSSProperties = {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 500,
    letterSpacing: "0.04em",
    color: "rgba(240,237,230,0.45)",
    marginBottom: "0.4rem",
    fontFamily: "var(--font-dm-sans)",
    textTransform: "uppercase",
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#0A0A0A",
    border: "0.5px solid rgba(240,237,230,0.12)",
    borderRadius: 8,
    padding: "0.625rem 0.875rem",
    fontSize: "0.875rem",
    color: "#F0EDE6",
    fontFamily: "var(--font-dm-sans)",
    outline: "none",
    boxSizing: "border-box",
  }

  return (
    <div style={{ maxWidth: 560 }}>
      {hasRegistrations && (
        <div style={{ background: "rgba(240,237,230,0.04)", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 10, padding: "0.75rem 1rem", marginBottom: "1.5rem", display: "flex", gap: "0.625rem", alignItems: "flex-start" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="rgba(240,237,230,0.35)" strokeWidth="1.25" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 5v3.5M8 10.5v.5" />
          </svg>
          <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.5 }}>
            Questions cannot be edited after registrations have been received.
          </p>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        {/* Description */}
        <div>
          <label style={fieldLabel}>Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={4}
            placeholder="Tell attendees what this event is about…"
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
          />
        </div>

        {/* Date / Location row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={fieldLabel}>Event date &amp; time</label>
            <input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} style={inputStyle} className="dt-input" />
          </div>
          <div>
            <label style={fieldLabel}>Location</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Venue or city" style={inputStyle} />
          </div>
        </div>

        {/* Deadline */}
        <div>
          <label style={fieldLabel}>Registration deadline</label>
          <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ ...inputStyle, maxWidth: 280 }} className="dt-input" />
          <p style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
            After this time, new registrations will be rejected.
          </p>
        </div>

        {/* Community link */}
        <div>
          <label style={fieldLabel}>Community link</label>
          <input type="url" value={communityLink} onChange={e => setCommunityLink(e.target.value)} placeholder="https://chat.whatsapp.com/…" style={inputStyle} />
          <p style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
            Sent to confirmed attendees automatically.
          </p>
        </div>
      </div>

      {error && <p style={{ marginTop: "1rem", fontSize: "0.82rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", marginTop: "1.75rem" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.6rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#0A0A0A", cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {saved && (
          <span style={{ fontSize: "0.82rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)" }}>
            ✓ Saved
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EventDashboardPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params?.slug as string
  const token = searchParams?.get("token") || ""
  const router = useRouter()
  useSession()

  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [error, setError] = useState("")
  const [eventData, setEventData] = useState<EventData | null>(null)
  const [confirmed, setConfirmed] = useState<Registration[]>([])
  const [waitlist, setWaitlist] = useState<Registration[]>([])
  const [origin, setOrigin] = useState("")
  const [activeTab, setActiveTab] = useState<TabKey>("overview")
  const [copied, setCopied] = useState(false)

  // Modals
  const [modal, setModal] = useState<"rename" | "archive" | "delete" | null>(null)

  // Capacity
  const [newCapacity, setNewCapacity] = useState("")
  const [capacityMessage, setCapacityMessage] = useState("")
  const [capacityError, setCapacityError] = useState("")
  const [updatingCapacity, setUpdatingCapacity] = useState(false)

  // Duplicate scanner
  const [dupGroups, setDupGroups] = useState<DupReg[][] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState("")
  const [removingDup, setRemovingDup] = useState<Set<string>>(new Set())

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const fetchDashboard = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    setAccessDenied(false)
    setError("")
    try {
      const url = `/api/events/${slug}${token ? `?token=${encodeURIComponent(token)}` : ""}`
      const res = await fetch(url)
      const data = await res.json()
      if (res.status === 401) { setAccessDenied(true); return }
      if (!res.ok || !data.success) { setError(data.error || "Unable to load dashboard"); return }
      setEventData(data.event)
      setConfirmed(data.confirmed)
      setWaitlist(data.waitlist)
    } catch {
      setError("Unable to load dashboard. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [slug, token])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  const regLink = origin && eventData ? `${origin}/${eventData.slug}` : ""

  const handleCopy = async () => {
    if (!regLink) return
    try { await navigator.clipboard.writeText(regLink); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  const handleShare = async () => {
    if (!regLink || !eventData) return
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: eventData.title,
          text: `Register for ${eventData.title}`,
          url: regLink,
        })
        return
      } catch {
        // user cancelled or not supported — fall through to copy
      }
    }
    handleCopy()
  }

  const handleClose = async () => {
    if (!eventData) return
    try {
      const res = await fetch(`/api/events/${slug}/close`, { method: "PATCH" })
      const data = await res.json()
      if (res.ok) {
        setEventData(prev => prev ? { ...prev, status: data.status } : null)
      }
    } catch {}
  }

  const handleRename = async (title: string) => {
    const res = await fetch(`/api/events/${slug}/rename`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Failed to rename.")
    setEventData(prev => prev ? { ...prev, title } : null)
  }

  const handleArchive = async () => {
    const res = await fetch(`/api/events/${slug}/archive`, { method: "PATCH" })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Failed to archive.")
    setEventData(prev => prev ? { ...prev, archived: true, status: "archived" } : null)
  }

  const handleSettingsSaved = (updates: Partial<EventData>) => {
    setEventData(prev => prev ? { ...prev, ...updates } : null)
  }

  const handleCapacityUpdate = async () => {
    if (!eventData) return
    setCapacityMessage("")
    setCapacityError("")
    const parsed = Number(newCapacity)
    if (!Number.isInteger(parsed) || parsed <= 0) { setCapacityError("Please enter a valid positive number."); return }
    if (eventData.capacity !== null && parsed <= eventData.capacity) { setCapacityError("New capacity must be greater than current capacity."); return }
    setUpdatingCapacity(true)
    try {
      const res = await fetch(`/api/events/${slug}/capacity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newCapacity: parsed, token }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setCapacityError(data.error || "Unable to update capacity."); return }
      setCapacityMessage(`✓ ${data.promoted} ${data.promoted === 1 ? "person" : "people"} moved from waitlist to confirmed`)
      setNewCapacity("")
      await fetchDashboard()
    } catch { setCapacityError("Unable to update capacity.") }
    finally { setUpdatingCapacity(false) }
  }

  const runDuplicateScan = async () => {
    if (!eventData) return
    setScanning(true)
    setScanError("")
    setDupGroups(null)
    try {
      const res = await fetch(`/api/events/${slug}/duplicates?token=${encodeURIComponent(token || eventData.dashboardToken)}`)
      const data = await res.json()
      if (!res.ok) { setScanError(data.error || "Scan failed."); return }
      setDupGroups(data.groups)
    } catch { setScanError("Unable to run scan.") }
    finally { setScanning(false) }
  }

  const removeDupReg = async (regId: string) => {
    if (!eventData) return
    setRemovingDup(prev => new Set(prev).add(regId))
    try {
      const res = await fetch(`/api/registrations/${regId}?token=${encodeURIComponent(token || eventData.dashboardToken)}`, { method: "DELETE" })
      if (res.ok) {
        // Remove from main lists
        setConfirmed(prev => prev.filter(r => r.id !== regId))
        setWaitlist(prev => prev.filter(r => r.id !== regId))
        // Remove from dup groups, drop groups that fall below 2
        setDupGroups(prev => {
          if (!prev) return prev
          const next = prev
            .map(grp => grp.filter(r => r.id !== regId))
            .filter(grp => grp.length >= 2)
          return next.length > 0 ? next : []
        })
      }
    } finally {
      setRemovingDup(prev => { const s = new Set(prev); s.delete(regId); return s })
    }
  }

  const keepDupReg = (regId: string) => {
    // Locally dismiss this entry from the scanner results
    setDupGroups(prev => {
      if (!prev) return prev
      const next = prev
        .map(grp => grp.filter(r => r.id !== regId))
        .filter(grp => grp.length >= 2)
      return next.length > 0 ? next : []
    })
  }

  // ── Renders ────────────────────────────────────────────────────────────────

  if (accessDenied) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "3rem 0" }}>
        <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 16, padding: "2.5rem", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.5rem", color: "#F0EDE6", marginBottom: "0.75rem" }}>Access denied</h1>
          <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)" }}>Invalid or missing access credentials.</p>
          <Link href="/dashboard/events" style={{ display: "inline-block", marginTop: "1.5rem", color: "#C8F55A", fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)", textDecoration: "none" }}>← Back to My Events</Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ height: 32, borderRadius: 8, background: "#141414", marginBottom: "1.5rem", animation: "epage-pulse 1.4s ease-in-out infinite" }} />
        <div style={{ height: 20, width: "40%", borderRadius: 8, background: "#141414", marginBottom: "2rem", animation: "epage-pulse 1.4s ease-in-out infinite" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {[1,2,3,4].map(i => <div key={i} style={{ height: 90, borderRadius: 10, background: "#141414", animation: "epage-pulse 1.4s ease-in-out infinite" }} />)}
        </div>
        <div style={{ height: 300, borderRadius: 12, background: "#141414", animation: "epage-pulse 1.4s ease-in-out infinite" }} />
      </div>
    )
  }

  if (error && !eventData) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "3rem 0" }}>
        <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 16, padding: "2.5rem", textAlign: "center" }}>
          <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)" }}>{error}</p>
        </div>
      </div>
    )
  }

  if (!eventData) return null

  const capacityDisplay = eventData.capacity === null ? "Unlimited" : eventData.capacity
  const slotsRemaining = eventData.capacity === null ? "Unlimited" : Math.max(0, eventData.capacity - eventData.confirmedCount)
  const hasRegistrations = confirmed.length + waitlist.length > 0
  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "confirmed", label: `Confirmed (${confirmed.length})` },
    { key: "waitlist", label: `Waitlist (${waitlist.length})` },
    { key: "settings", label: "Settings" },
  ]

  return (
    <>
      <style>{`
        .hdr-menu-item:hover { background: rgba(240,237,230,0.06) !important; }
        .reg-row:hover { background: rgba(240,237,230,0.02); }
        .dt-input::-webkit-calendar-picker-indicator { filter: invert(0.5); cursor: pointer; }
        @keyframes epage-pulse { 0%,100%{opacity:0.45} 50%{opacity:0.9} }
      `}</style>

      {/* Modals */}
      {modal === "rename" && (
        <RenameModal current={eventData.title} onClose={() => setModal(null)} onSave={handleRename} />
      )}
      {modal === "archive" && (
        <ArchiveConfirm onClose={() => setModal(null)} onConfirm={handleArchive} />
      )}
      {modal === "delete" && (
        <DeleteModal title={eventData.title} slug={slug} token={token || eventData.dashboardToken} onClose={() => setModal(null)} onSuccess={() => router.replace("/dashboard/events")} />
      )}

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* ── Back breadcrumb ─────────────────────────────────────────── */}
        <Link
          href="/dashboard/events"
          style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", fontSize: "0.78rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", textDecoration: "none", marginBottom: "1.5rem" }}
          className="back-link"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8.5 2.5L4 7l4.5 4.5" />
          </svg>
          My Events
        </Link>

        {/* ── Event header ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: "1.75rem" }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.6rem", fontWeight: 400, color: "#F0EDE6", margin: 0 }}>
                  {eventData.title}
                </h1>
                <StatusBadge event={eventData} />
                {/* Pencil */}
                <button
                  onClick={() => setModal("rename")}
                  title="Rename event"
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: "rgba(240,237,230,0.3)", padding: "2px", display: "flex", alignItems: "center", borderRadius: 4, flexShrink: 0 }}
                  className="pencil-btn"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11.5 2.5a2.121 2.121 0 013 3L5 15H1.5l.5-3.5L11.5 2.5z" />
                  </svg>
                </button>
              </div>

              {/* Meta: date, location, deadline */}
              {(eventData.eventDate || eventData.location || eventData.deadline) && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.875rem", marginTop: "0.5rem" }}>
                  {eventData.eventDate && (
                    <span style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="3" width="13" height="11" rx="2"/><path d="M1.5 7h13M5 1.5v3M11 1.5v3"/></svg>
                      {formatDate(eventData.eventDate)}
                    </span>
                  )}
                  {eventData.location && (
                    <span style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="6.5" r="2.5"/><path d="M8 1C4.686 1 2 3.686 2 7c0 4 6 8 6 8s6-4 6-7c0-3.314-2.686-6-6-6z"/></svg>
                      {eventData.location}
                    </span>
                  )}
                  {eventData.deadline && (
                    <span style={{ fontSize: "0.78rem", color: isEventPast(eventData) ? "rgba(255,107,107,0.6)" : "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6.5"/><path d="M8 4.5v4l2.5 2"/></svg>
                      {isEventPast(eventData) ? "Closed" : "Closes"} {formatDate(eventData.deadline)}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Three-dot menu */}
            <HeaderMenu
              onEdit={() => router.push(`/edit/${slug}`)}
              onRename={() => setModal("rename")}
              onArchive={() => setModal("archive")}
              onDelete={() => setModal("delete")}
              onClose={handleClose}
              archived={isEventArchived(eventData)}
              closed={isEventClosed(eventData)}
            />
          </div>

          {/* Registration link row */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px", display: "flex", alignItems: "center", background: "rgba(240,237,230,0.04)", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 8, overflow: "hidden", minWidth: 0 }}>
              <input
                readOnly
                value={regLink}
                style={{ flex: 1, background: "transparent", border: "none", padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", outline: "none", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              />
            </div>
            <button
              onClick={handleCopy}
              style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.45rem 0.875rem", fontSize: "0.78rem", fontWeight: 500, color: copied ? "#C8F55A" : "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={handleShare}
              style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.45rem 0.875rem", fontSize: "0.78rem", fontWeight: 500, color: "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap", flexShrink: 0, display: "flex", alignItems: "center", gap: "0.375rem" }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13" cy="3" r="2"/><circle cx="3" cy="8" r="2"/><circle cx="13" cy="13" r="2"/>
                <path d="M5 7l6-3M5 9l6 3"/>
              </svg>
              Share
            </button>
          </div>
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", borderBottom: "0.5px solid rgba(240,237,230,0.08)", marginBottom: "2rem", overflowX: "auto" }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === tab.key ? "2px solid #C8F55A" : "2px solid transparent",
                padding: "0.6rem 1.1rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-dm-sans)",
                color: activeTab === tab.key ? "#F0EDE6" : "rgba(240,237,230,0.4)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                marginBottom: "-0.5px",
                flexShrink: 0,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Overview ─────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }} className="stat-grid">
              {[
                { label: "Confirmed", value: eventData.confirmedCount },
                { label: "Waitlist", value: eventData.waitlistCount },
                { label: "Capacity", value: capacityDisplay },
                { label: "Slots remaining", value: slotsRemaining },
              ].map(stat => (
                <div key={stat.label} style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "1.1rem 1.25rem" }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>{stat.label}</div>
                  <div style={{ fontSize: "1.6rem", fontFamily: "var(--font-instrument-serif)", color: "#F0EDE6" }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Capacity panel */}
            <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.5rem", marginBottom: "0.5rem" }}>
              <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.1rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 0.375rem" }}>
                Increase Capacity
              </h2>
              <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.125rem" }}>
                Increase the number of confirmed spots — waitlisted attendees are promoted automatically.
              </p>
              <div style={{ display: "flex", gap: "0.625rem", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="number"
                  min="1"
                  value={newCapacity}
                  onChange={e => { setNewCapacity(e.target.value); setCapacityError(""); setCapacityMessage("") }}
                  placeholder="New capacity"
                  style={{ maxWidth: 160, background: "#0A0A0A", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.5rem 0.875rem", fontSize: "0.875rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", outline: "none" }}
                />
                <button
                  onClick={handleCapacityUpdate}
                  disabled={updatingCapacity}
                  style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.875rem", fontWeight: 600, color: "#0A0A0A", cursor: updatingCapacity ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: updatingCapacity ? 0.7 : 1 }}
                >
                  {updatingCapacity ? "Updating…" : "Update capacity"}
                </button>
              </div>
              {capacityMessage && <p style={{ marginTop: "0.75rem", fontSize: "0.82rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)" }}>{capacityMessage}</p>}
              {capacityError && <p style={{ marginTop: "0.75rem", fontSize: "0.82rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{capacityError}</p>}
            </div>

            {/* Community link (if set) */}
            {eventData.communityLink && (
              <div style={{ background: "rgba(200,245,90,0.04)", border: "0.5px solid rgba(200,245,90,0.12)", borderRadius: 10, padding: "0.875rem 1.125rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(200,245,90,0.5)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.25rem" }}>Community link</div>
                  <a href={eventData.communityLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.82rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)", textDecoration: "none", wordBreak: "break-all" }}>{eventData.communityLink}</a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Confirmed ─────────────────────────────────────────────── */}
        {activeTab === "confirmed" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
              <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6", margin: 0 }}>
                Confirmed registrations
              </h2>
              <span style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.04em", background: "rgba(200,245,90,0.12)", color: "#C8F55A", borderRadius: 100, padding: "3px 10px", fontFamily: "var(--font-dm-sans)" }}>
                {confirmed.length} confirmed
              </span>
            </div>
            <RegTable
              rows={confirmed}
              questions={eventData.questions}
              emptyText="No confirmed registrations yet"
              token={token || eventData.dashboardToken}
              onRemove={id => {
                setConfirmed(prev => prev.filter(r => r.id !== id))
                setEventData(prev => prev ? { ...prev, confirmedCount: Math.max(0, prev.confirmedCount - 1) } : null)
              }}
            />
          </div>
        )}

        {/* ── Tab: Waitlist ─────────────────────────────────────────────── */}
        {activeTab === "waitlist" && (
          <div>
            {/* ── Duplicate Scanner panel ─────────────────────────────── */}
            <div style={{ background: "rgba(240,237,230,0.03)", border: "0.5px solid rgba(240,237,230,0.09)", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.2rem" }}>Duplicate Scanner</div>
                  <div style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                    Scan all registrations for identical responses
                  </div>
                </div>
                <button
                  onClick={runDuplicateScan}
                  disabled={scanning}
                  style={{ background: scanning ? "rgba(200,245,90,0.08)" : "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.1rem", fontSize: "0.8rem", fontWeight: 600, color: scanning ? "#C8F55A" : "#0A0A0A", cursor: scanning ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", flexShrink: 0, opacity: scanning ? 0.7 : 1 }}
                >
                  {scanning ? "Scanning…" : "Run scan"}
                </button>
              </div>

              {scanError && (
                <p style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{scanError}</p>
              )}

              {dupGroups !== null && dupGroups.length === 0 && (
                <p style={{ marginTop: "0.75rem", fontSize: "0.82rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)" }}>✓ No duplicates found</p>
              )}

              {dupGroups !== null && dupGroups.length > 0 && (
                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                  <div style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
                    Found <strong style={{ color: "rgba(240,237,230,0.6)" }}>{dupGroups.length}</strong> duplicate {dupGroups.length === 1 ? "group" : "groups"}
                  </div>
                  {dupGroups.map((group, gi) => (
                    <div key={gi} style={{ background: "rgba(255,168,0,0.05)", border: "0.5px solid rgba(255,168,0,0.2)", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ padding: "0.5rem 0.875rem", background: "rgba(255,168,0,0.08)", borderBottom: "0.5px solid rgba(255,168,0,0.15)", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,168,0,0.6)", fontFamily: "var(--font-dm-sans)" }}>
                        Group {gi + 1} — {group.length} identical submissions
                      </div>
                      {group.map((reg, ri) => {
                        const firstName = reg.answers[0]?.value || `#${reg.registrationNumber ?? ri + 1}`
                        const isRemoving = removingDup.has(reg.id)
                        return (
                          <div key={reg.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0.625rem 0.875rem", borderTop: ri > 0 ? "0.5px solid rgba(255,168,0,0.1)" : undefined, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap", flex: 1, minWidth: 0 }}>
                              <span style={{ fontSize: "0.62rem", fontWeight: 600, letterSpacing: "0.04em", borderRadius: 100, padding: "2px 8px", fontFamily: "var(--font-dm-sans)", background: reg.status === "confirmed" ? "rgba(200,245,90,0.12)" : "rgba(240,237,230,0.06)", color: reg.status === "confirmed" ? "#C8F55A" : "rgba(240,237,230,0.4)", whiteSpace: "nowrap" }}>
                                {reg.status === "confirmed" ? "CONFIRMED" : "WAITLIST"}
                              </span>
                              {reg.registrationNumber && (
                                <span style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>#{reg.registrationNumber}</span>
                              )}
                              <span style={{ fontSize: "0.82rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstName}</span>
                              <span style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap" }}>
                                {new Date(reg.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                              <button
                                onClick={() => keepDupReg(reg.id)}
                                style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 6, padding: "3px 10px", fontSize: "0.72rem", color: "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                              >
                                Keep
                              </button>
                              <button
                                onClick={() => removeDupReg(reg.id)}
                                disabled={isRemoving}
                                style={{ background: "transparent", border: "0.5px solid rgba(255,107,107,0.3)", borderRadius: 6, padding: "3px 10px", fontSize: "0.72rem", color: isRemoving ? "rgba(255,107,107,0.4)" : "rgba(255,107,107,0.7)", cursor: isRemoving ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)" }}
                              >
                                {isRemoving ? "…" : "Remove"}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
              <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6", margin: 0 }}>
                Waitlist
              </h2>
              <span style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.04em", background: "rgba(240,237,230,0.06)", color: "rgba(240,237,230,0.4)", borderRadius: 100, padding: "3px 10px", fontFamily: "var(--font-dm-sans)" }}>
                {waitlist.length} waiting
              </span>
            </div>
            <RegTable
              rows={waitlist}
              questions={eventData.questions}
              showPosition
              emptyText="Waitlist is empty"
              token={token || eventData.dashboardToken}
              onRemove={id => {
                setWaitlist(prev => prev.filter(r => r.id !== id))
                setEventData(prev => prev ? { ...prev, waitlistCount: Math.max(0, prev.waitlistCount - 1) } : null)
              }}
            />
          </div>
        )}

        {/* ── Tab: Settings ─────────────────────────────────────────────── */}
        {activeTab === "settings" && (
          <div>
            <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 1.5rem" }}>
              Event settings
            </h2>
            <SettingsTab event={eventData} hasRegistrations={hasRegistrations} onSaved={handleSettingsSaved} />
          </div>
        )}
      </div>

      <style>{`
        .pencil-btn:hover { color: rgba(240,237,230,0.65) !important; }
        .back-link:hover { color: rgba(240,237,230,0.6) !important; }
        @media (min-width: 640px) { .stat-grid { grid-template-columns: repeat(4,1fr) !important; } }
      `}</style>
    </>
  )
}
