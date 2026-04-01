"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

// ─── Types ────────────────────────────────────────────────────────────────────

type OrgEvent = {
  id: string
  title: string
  slug: string
  capacity: number | null
  deadline: string | null
  confirmedCount: number
  waitlistCount: number
  dashboardToken: string
  createdAt: string
  archived: boolean
  status: string
  eventDate: string | null
  location: string | null
  dataExpired: boolean
}

type TabKey = "active" | "past" | "archived"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifyEvent(event: OrgEvent): TabKey {
  if (event.archived || event.status === "archived") return "archived"
  const now = new Date()
  if (event.deadline && new Date(event.deadline) < now) return "past"
  return "active"
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ event }: { event: OrgEvent }) {
  const tab = classifyEvent(event)
  if (event.dataExpired || event.status === "expired") {
    return (
      <span
        style={{
          fontSize: "0.65rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          background: "rgba(240,237,230,0.06)",
          color: "rgba(240,237,230,0.3)",
          borderRadius: 100,
          padding: "2px 8px",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        DATA EXPIRED
      </span>
    )
  }
  if (tab === "archived") {
    return (
      <span
        style={{
          fontSize: "0.65rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          background: "rgba(240,237,230,0.08)",
          color: "rgba(240,237,230,0.4)",
          borderRadius: 100,
          padding: "2px 8px",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        ARCHIVED
      </span>
    )
  }
  if (tab === "past" || event.status === "closed") {
    return (
      <span
        style={{
          fontSize: "0.65rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          background: "rgba(255,107,107,0.12)",
          color: "#FF6B6B",
          borderRadius: 100,
          padding: "2px 8px",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        CLOSED
      </span>
    )
  }
  return (
    <span
      style={{
        fontSize: "0.65rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
        background: "rgba(200,245,90,0.12)",
        color: "#C8F55A",
        borderRadius: 100,
        padding: "2px 8px",
        fontFamily: "var(--font-dm-sans)",
      }}
    >
      ACTIVE
    </span>
  )
}

// ─── Three-dot menu ───────────────────────────────────────────────────────────

interface ThreeDotMenuProps {
  event: OrgEvent
  onRename: () => void
  onArchive: () => void
  onDelete: () => void
  onDuplicate: () => void
  onClose: () => void
  duplicating: boolean
}

function ThreeDotMenu({
  event,
  onRename,
  onArchive,
  onDelete,
  onDuplicate,
  onClose,
  duplicating,
}: ThreeDotMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const isArchived = classifyEvent(event) === "archived"
  const isClosed = event.status === "closed"
  const isExpired = event.dataExpired || event.status === "expired"

  const itemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    padding: "0.5rem 0.875rem",
    fontSize: "0.82rem",
    fontFamily: "var(--font-dm-sans)",
    color: "rgba(240,237,230,0.7)",
    cursor: "pointer",
    borderRadius: 6,
    whiteSpace: "nowrap",
  }

  const dangerStyle: React.CSSProperties = {
    ...itemStyle,
    color: "#FF6B6B",
  }

  return (
    <div ref={ref} style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          background: "transparent",
          border: "0.5px solid rgba(240,237,230,0.1)",
          borderRadius: 8,
          width: 30,
          height: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "rgba(240,237,230,0.5)",
          fontSize: "1rem",
          letterSpacing: "0.1em",
        }}
        aria-label="Event options"
      >
        ···
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "#1A1A1A",
            border: "0.5px solid rgba(240,237,230,0.1)",
            borderRadius: 8,
            padding: "0.25rem",
            zIndex: 20,
            minWidth: 180,
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <button
            className="dot-menu-item"
            style={itemStyle}
            onClick={() => { setOpen(false); onRename() }}
          >
            Rename
          </button>

          {!isExpired && (
            <button
              className="dot-menu-item"
              style={itemStyle}
              onClick={() => { setOpen(false); onDuplicate() }}
              disabled={duplicating}
            >
              {duplicating ? "Duplicating…" : "Duplicate"}
            </button>
          )}

          {!isArchived && !isExpired && (
            <button
              className="dot-menu-item"
              style={itemStyle}
              onClick={() => { setOpen(false); onClose() }}
            >
              {isClosed ? "Reopen registrations" : "Close registrations"}
            </button>
          )}

          {!isArchived && !isExpired && (
            <button
              className="dot-menu-item"
              style={itemStyle}
              onClick={() => { setOpen(false); onArchive() }}
            >
              Archive
            </button>
          )}

          <div
            style={{
              height: "0.5px",
              background: "rgba(240,237,230,0.08)",
              margin: "0.25rem 0.5rem",
            }}
          />

          <button
            className="dot-menu-item"
            style={dangerStyle}
            onClick={() => { setOpen(false); onDelete() }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function Backdrop({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 60,
      }}
    />
  )
}

function RenameModal({
  event,
  onClose,
  onSuccess,
}: {
  event: OrgEvent
  onClose: () => void
  onSuccess: (slug: string, title: string) => void
}) {
  const [value, setValue] = useState(event.title)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async () => {
    if (!value.trim()) { setError("Title cannot be empty."); return }
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/events/${event.slug}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess(event.slug, value.trim())
        onClose()
      } else {
        setError(data.error || "Failed to rename.")
      }
    } catch {
      setError("Unexpected error.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Backdrop onClick={onClose} />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 61,
          background: "#1A1A1A",
          border: "0.5px solid rgba(240,237,230,0.1)",
          borderRadius: 16,
          padding: "1.75rem",
          width: "min(92vw, 420px)",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.2rem",
            color: "#F0EDE6",
            marginBottom: "1rem",
          }}
        >
          Rename event
        </h3>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={e => { setValue(e.target.value); setError("") }}
          onKeyDown={e => e.key === "Enter" && handleSave()}
          style={{
            width: "100%",
            background: "#141414",
            border: "0.5px solid rgba(240,237,230,0.15)",
            borderRadius: 8,
            padding: "0.625rem 0.875rem",
            fontSize: "0.875rem",
            color: "#F0EDE6",
            fontFamily: "var(--font-dm-sans)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {error && (
          <p style={{ fontSize: "0.78rem", color: "#FF6B6B", marginTop: "0.4rem", fontFamily: "var(--font-dm-sans)" }}>
            {error}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.625rem", marginTop: "1.25rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  )
}

function ArchiveConfirm({
  event,
  onClose,
  onSuccess,
}: {
  event: OrgEvent
  onClose: () => void
  onSuccess: (slug: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleConfirm = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/events/${event.slug}/archive`, { method: "PATCH" })
      const data = await res.json()
      if (res.ok) {
        onSuccess(event.slug)
        onClose()
      } else {
        setError(data.error || "Failed to archive.")
      }
    } catch {
      setError("Unexpected error.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Backdrop onClick={onClose} />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 61,
          background: "#1A1A1A",
          border: "0.5px solid rgba(240,237,230,0.1)",
          borderRadius: 16,
          padding: "1.75rem",
          width: "min(92vw, 420px)",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.2rem",
            color: "#F0EDE6",
            marginBottom: "0.5rem",
          }}
        >
          Archive this event?
        </h3>
        <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.25rem" }}>
          It will be moved to your archived tab.
        </p>
        {error && (
          <p style={{ fontSize: "0.78rem", color: "#FF6B6B", marginBottom: "0.75rem", fontFamily: "var(--font-dm-sans)" }}>
            {error}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: saving ? 0.7 : 1 }}
          >
            {saving ? "Archiving…" : "Archive"}
          </button>
        </div>
      </div>
    </>
  )
}

function DeleteModal({
  event,
  onClose,
  onSuccess,
}: {
  event: OrgEvent
  onClose: () => void
  onSuccess: (slug: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState("")

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/events/${event.slug}`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok) {
        onSuccess(event.slug)
        onClose()
      } else {
        setError(data.error || "Failed to delete.")
      }
    } catch {
      setError("Unexpected error.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Backdrop onClick={onClose} />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 61,
          background: "#1A1A1A",
          border: "0.5px solid rgba(240,237,230,0.1)",
          borderRadius: 16,
          padding: "1.75rem",
          width: "min(92vw, 440px)",
        }}
      >
        {/* Warning icon */}
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: "rgba(255,107,107,0.12)",
            border: "0.5px solid rgba(255,107,107,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1rem",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16.5 15H1.5L9 2z" stroke="#FF6B6B" strokeWidth="1.25" strokeLinejoin="round" />
            <path d="M9 7v4" stroke="#FF6B6B" strokeWidth="1.25" strokeLinecap="round" />
            <circle cx="9" cy="13" r="0.75" fill="#FF6B6B" />
          </svg>
        </div>

        <h3
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.2rem",
            color: "#F0EDE6",
            marginBottom: "0.5rem",
          }}
        >
          Delete this event?
        </h3>
        <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.5rem", lineHeight: 1.6 }}>
          This will permanently delete{" "}
          <strong style={{ color: "rgba(240,237,230,0.75)" }}>{event.title}</strong> and all its
          registrations. This cannot be undone.
        </p>
        {error && (
          <p style={{ fontSize: "0.78rem", color: "#FF6B6B", marginBottom: "0.75rem", fontFamily: "var(--font-dm-sans)" }}>
            {error}
          </p>
        )}
        <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ background: "#FF6B6B", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, color: "#fff", cursor: deleting ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: deleting ? 0.7 : 1 }}
          >
            {deleting ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Event card ───────────────────────────────────────────────────────────────

interface EventCardProps {
  event: OrgEvent
  origin: string
  onRenameSuccess: (slug: string, title: string) => void
  onArchiveSuccess: (slug: string) => void
  onDeleteSuccess: (slug: string) => void
  onDuplicateSuccess: (newSlug: string) => void
  onCloseSuccess: (slug: string, status: string) => void
}

function EventCard({
  event,
  origin,
  onRenameSuccess,
  onArchiveSuccess,
  onDeleteSuccess,
  onDuplicateSuccess,
  onCloseSuccess,
}: EventCardProps) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [modal, setModal] = useState<"rename" | "archive" | "delete" | null>(null)
  const [duplicating, setDuplicating] = useState(false)

  const regLink = `${origin}/events/${event.slug}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(regLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const handleDuplicate = async () => {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/events/${event.slug}/duplicate`, { method: "POST" })
      const data = await res.json()
      if (res.ok && data.slug) {
        onDuplicateSuccess(data.slug)
        router.push(`/edit/${data.slug}`)
      }
    } finally {
      setDuplicating(false)
    }
  }

  const handleClose = async () => {
    try {
      const res = await fetch(`/api/events/${event.slug}/close`, { method: "PATCH" })
      const data = await res.json()
      if (res.ok) onCloseSuccess(event.slug, data.status)
    } catch {}
  }

  return (
    <>
      {modal === "rename" && (
        <RenameModal
          event={event}
          onClose={() => setModal(null)}
          onSuccess={onRenameSuccess}
        />
      )}
      {modal === "archive" && (
        <ArchiveConfirm
          event={event}
          onClose={() => setModal(null)}
          onSuccess={onArchiveSuccess}
        />
      )}
      {modal === "delete" && (
        <DeleteModal
          event={event}
          onClose={() => setModal(null)}
          onSuccess={onDeleteSuccess}
        />
      )}

      <div
        onClick={() => router.push(`/dashboard/events/${event.slug}?token=${event.dashboardToken}`)}
        style={{
          background: "#141414",
          border: "0.5px solid rgba(240,237,230,0.08)",
          borderRadius: 12,
          padding: "1.25rem",
          cursor: "pointer",
        }}
      >
        {/* Card header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flexWrap: "wrap", marginBottom: "0.3rem" }}>
              <h3
                style={{
                  fontFamily: "var(--font-instrument-serif)",
                  fontSize: "1.1rem",
                  fontWeight: 400,
                  color: "#F0EDE6",
                  margin: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {event.title}
              </h3>
              <StatusBadge event={event} />
            </div>

            {/* Meta */}
            {event.dataExpired ? (
              <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)", fontStyle: "italic" }}>
                Registration data has been deleted. Upgrade to recover future data.
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: "0.78rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)" }}>
                {event.confirmedCount} confirmed · {event.waitlistCount} waitlisted ·{" "}
                {event.capacity ? `${event.capacity} capacity` : "Unlimited"}
              </p>
            )}

            {/* Date / location */}
            {(event.eventDate || event.location) && (
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                {event.eventDate && formatDate(event.eventDate)}
                {event.eventDate && event.location && " · "}
                {event.location}
              </p>
            )}
          </div>

          <ThreeDotMenu
            event={event}
            onRename={() => setModal("rename")}
            onArchive={() => setModal("archive")}
            onDelete={() => setModal("delete")}
            onDuplicate={handleDuplicate}
            onClose={handleClose}
            duplicating={duplicating}
          />
        </div>

        {/* Registration link */}
        <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            readOnly
            value={regLink}
            style={{
              flex: 1,
              background: "rgba(240,237,230,0.04)",
              border: "0.5px solid rgba(240,237,230,0.08)",
              borderRadius: 6,
              padding: "0.375rem 0.625rem",
              fontSize: "0.72rem",
              color: "rgba(240,237,230,0.4)",
              fontFamily: "var(--font-dm-sans)",
              outline: "none",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          />
          <button
            onClick={handleCopy}
            style={{
              background: "transparent",
              border: "0.5px solid rgba(240,237,230,0.12)",
              borderRadius: 6,
              padding: "0.375rem 0.75rem",
              fontSize: "0.72rem",
              fontWeight: 500,
              color: copied ? "#C8F55A" : "rgba(240,237,230,0.5)",
              cursor: "pointer",
              fontFamily: "var(--font-dm-sans)",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: TabKey }) {
  const messages: Record<TabKey, { heading: string; body: string }> = {
    active: {
      heading: "No active events",
      body: "Create your first event to get started.",
    },
    past: {
      heading: "No past events",
      body: "Events with a past deadline will appear here.",
    },
    archived: {
      heading: "Nothing archived",
      body: "Archived events will appear here.",
    },
  }

  const { heading, body } = messages[tab]

  return (
    <div
      style={{
        background: "#141414",
        border: "0.5px solid rgba(240,237,230,0.08)",
        borderRadius: 12,
        padding: "2.5rem 1.5rem",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "1.1rem",
          color: "#F0EDE6",
          marginBottom: "0.4rem",
        }}
      >
        {heading}
      </p>
      {tab === "active" ? (
        <Link
          href="/create"
          style={{
            display: "inline-block",
            marginTop: "0.75rem",
            background: "#C8F55A",
            color: "#0A0A0A",
            borderRadius: 8,
            padding: "0.5rem 1.25rem",
            fontSize: "0.82rem",
            fontWeight: 600,
            fontFamily: "var(--font-dm-sans)",
            textDecoration: "none",
          }}
        >
          Create new event
        </Link>
      ) : (
        <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>
          {body}
        </p>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardEventsPage() {
  const [events, setEvents] = useState<OrgEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>("active")
  const [origin, setOrigin] = useState("")

  useEffect(() => {
    setOrigin(window.location.origin)
    fetch("/api/my-events")
      .then(r => r.json())
      .then(data => { if (data.success) setEvents(data.events) })
      .finally(() => setLoading(false))
  }, [])

  const handleRenameSuccess = (slug: string, title: string) => {
    setEvents(prev => prev.map(e => e.slug === slug ? { ...e, title } : e))
  }

  const handleArchiveSuccess = (slug: string) => {
    setEvents(prev =>
      prev.map(e => e.slug === slug ? { ...e, archived: true, status: "archived" } : e)
    )
    setActiveTab("archived")
  }

  const handleDeleteSuccess = (slug: string) => {
    setEvents(prev => prev.filter(e => e.slug !== slug))
  }

  const handleCloseSuccess = (slug: string, status: string) => {
    setEvents(prev => prev.map(e => e.slug === slug ? { ...e, status } : e))
  }

  const handleDuplicateSuccess = (newSlug: string) => {
    // After redirect to edit page, fresh fetch not needed — router handles it
    void newSlug
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: "active", label: "Active" },
    { key: "past", label: "Past" },
    { key: "archived", label: "Archived" },
  ]

  const filtered = events.filter(e => classifyEvent(e) === activeTab)

  const counts: Record<TabKey, number> = {
    active: events.filter(e => classifyEvent(e) === "active").length,
    past: events.filter(e => classifyEvent(e) === "past").length,
    archived: events.filter(e => classifyEvent(e) === "archived").length,
  }

  return (
    <>
      <style>{`
        .dot-menu-item:hover {
          background: rgba(240,237,230,0.06) !important;
        }
      `}</style>

      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "1.75rem",
            flexWrap: "wrap",
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "1.6rem",
              fontWeight: 400,
              color: "#F0EDE6",
              margin: 0,
            }}
          >
            Your events
          </h1>
          <Link
            href="/create"
            style={{
              background: "#C8F55A",
              color: "#0A0A0A",
              borderRadius: 8,
              padding: "0.55rem 1.1rem",
              fontSize: "0.82rem",
              fontWeight: 600,
              fontFamily: "var(--font-dm-sans)",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Create new event
          </Link>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            gap: "0",
            borderBottom: "0.5px solid rgba(240,237,230,0.08)",
            marginBottom: "1.5rem",
          }}
        >
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: activeTab === tab.key
                  ? "2px solid #C8F55A"
                  : "2px solid transparent",
                padding: "0.6rem 1.1rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-dm-sans)",
                color: activeTab === tab.key ? "#F0EDE6" : "rgba(240,237,230,0.4)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                marginBottom: "-0.5px",  // overlap the border-bottom
                transition: "color 0.15s ease",
              }}
            >
              {tab.label}
              {!loading && counts[tab.key] > 0 && (
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    background: activeTab === tab.key
                      ? "rgba(200,245,90,0.12)"
                      : "rgba(240,237,230,0.06)",
                    color: activeTab === tab.key ? "#C8F55A" : "rgba(240,237,230,0.35)",
                    borderRadius: 100,
                    padding: "1px 6px",
                  }}
                >
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {[1, 2, 3].map(i => (
              <div
                key={i}
                style={{
                  height: 140,
                  borderRadius: 12,
                  background: "#141414",
                  border: "0.5px solid rgba(240,237,230,0.06)",
                  animation: "ev-pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
            {filtered.map(event => (
              <EventCard
                key={event.slug}
                event={event}
                origin={origin}
                onRenameSuccess={handleRenameSuccess}
                onArchiveSuccess={handleArchiveSuccess}
                onDeleteSuccess={handleDeleteSuccess}
                onDuplicateSuccess={handleDuplicateSuccess}
                onCloseSuccess={handleCloseSuccess}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes ev-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </>
  )
}
