"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import UpgradePrompt from "@/app/components/UpgradePrompt"
import { useToast } from "@/components/Toast"
import CountdownTimer from "@/components/CountdownTimer"
import ComingSoon from "@/components/ui/ComingSoon"
import { normalizeCommunityLink } from "@/lib/communityLink"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

// ─── Types ────────────────────────────────────────────────────────────────────

type Question = {
  id: string
  label: string
  type: string
  options?: string[]
  required: boolean
  allowMultiple?: boolean
}

type Registration = {
  id: string
  registrationNumber?: number | null
  answers: Array<{ questionId: string; value: string }>
  submittedAt: string
  status?: string
  waitlistPosition?: number | null
  isDuplicate?: boolean
  source?: string
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
  organizerPlan: string
  imageUrl?: string | null
}

type TabKey = "overview" | "confirmed" | "waitlist" | "analytics" | "feedback" | "checkin" | "settings"

type FeedbackData = {
  feedback: { id: string; rating: number; enjoyed: string | null; improve: string | null; complaint: string | null; submittedAt: string }[]
  totalResponses: number
  averageRating: number | null
  confirmedCount: number
}

type AnalyticsData = {
  totalViews: number
  totalRegistrations: number
  conversionRate: number
  confirmedCount: number
  waitlistCount: number
  waitlistConversionRate: number
  registrationsByDay: { date: string; count: number }[]
  registrationsByHour: { hour: number; count: number }[]
}

type InsightCard = {
  type: "success" | "warning" | "tip" | "info"
  title: string
  body: string
}

type QAItem = {
  question: string
  answer: string
  timestamp: string
}

type CheckInResult = {
  success: boolean
  valid?: boolean
  alreadyVerified?: boolean
  message?: string
  error?: string
  ticket?: {
    registrationId: string
    registrationNumber: number | null
    attendeeName: string
    attendeeEmail: string | null
    confirmationCode: string | null
    checkedInAt: string | null
  }
}

type WaitlistEmailDiagnosticsSummary = {
  attempted: number
  sent: number
  failed: number
  skippedNoEmail: number
}

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
        <p style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.28)", marginTop: "0.4rem", fontFamily: "var(--font-dm-sans)" }}>Note: Your public registration link stays the same after renaming.</p>
        {error && <p style={{ fontSize: "0.78rem", color: "#FF6B6B", marginTop: "0.4rem", fontFamily: "var(--font-dm-sans)" }}>{error}</p>}
        <div style={{ display: "flex", gap: "0.625rem", marginTop: "1.25rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: saving ? 0.7 : 1 }}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </>
  )
}

const REPORT_THEMES = [
  { id: 'navy',     label: 'Midnight Navy', color: '#1F3864' },
  { id: 'forest',   label: 'Deep Forest',   color: '#1B4332' },
  { id: 'wine',     label: 'Wine',          color: '#4A0E2E' },
  { id: 'graphite', label: 'Graphite',      color: '#1C1C1C' },
] as const

function ReportOptionsModal({ onClose, onGenerate, downloading, plan, creditBalance }: { onClose: () => void; onGenerate: (theme: string) => void; downloading: boolean; plan: string; creditBalance: number }) {
  const [selected, setSelected] = useState('navy')
  const isAI = plan === 'pro' || plan === 'business' || creditBalance >= 50
  const btnLabel = downloading ? "Generating…" : isAI
    ? plan === 'free' ? `Download AI Report (50 pts)` : "Download AI Report"
    : "Download Standard Report"
  const subLabel = !downloading && plan === 'free' && isAI
    ? `You have ${creditBalance} points`
    : null
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={onClose}>
      <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 16, padding: "2rem", maxWidth: 420, width: "90%" }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 0.35rem" }}>Download Report</h3>
        <p style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", margin: "0 0 1.25rem" }}>Choose a cover style for your report</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {REPORT_THEMES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t.id)}
              style={{ background: t.color, border: selected === t.id ? "2px solid #C8F55A" : "2px solid transparent", borderRadius: 10, padding: "1.1rem 1rem", cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ color: "#FFFFFF", fontWeight: 600, fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>{t.label}</div>
              <div style={{ height: 3, background: "rgba(255,255,255,0.25)", borderRadius: 2, marginBottom: "0.25rem" }} />
              <div style={{ height: 3, width: "60%", background: "rgba(255,255,255,0.12)", borderRadius: 2 }} />
            </button>
          ))}
        </div>
        {isAI && (
          <p style={{ fontSize: "0.75rem", color: "rgba(200,245,90,0.7)", fontFamily: "var(--font-dm-sans)", margin: "0 0 0.75rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span>⚡</span> AI-enhanced analysis will be included
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.35rem" }}>
          <div style={{ display: "flex", gap: "0.625rem" }}>
            <button type="button" onClick={onClose} style={{ padding: "0.55rem 1.25rem", borderRadius: 100, border: "0.5px solid rgba(240,237,230,0.15)", background: "transparent", color: "rgba(240,237,230,0.55)", cursor: "pointer", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)" }}>Cancel</button>
            <button type="button" onClick={() => onGenerate(selected)} disabled={downloading} style={{ padding: "0.55rem 1.5rem", borderRadius: 100, border: "none", background: downloading ? "rgba(200,245,90,0.4)" : "#C8F55A", color: "#0A0A0A", cursor: downloading ? "default" : "pointer", fontSize: "0.875rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>{btnLabel}</button>
          </div>
          {subLabel && <span style={{ fontSize: "0.72rem", color: "rgba(200,245,90,0.55)", fontFamily: "var(--font-dm-sans)" }}>{subLabel}</span>}
        </div>
      </div>
    </div>
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

function EditRegModal({
  registration, questions, token, onClose, onSaved,
}: {
  registration: Registration
  questions: Question[]
  token: string
  onClose: () => void
  onSaved: (updated: Registration) => void
}) {
  const [values, setValues] = React.useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const q of questions) {
      init[q.id] = registration.answers.find(a => a.questionId === q.id)?.value ?? ""
    }
    return init
  })
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")

  const handleSave = async () => {
    setSaving(true)
    setError("")
    const answers = questions.map(q => ({ questionId: q.id, value: values[q.id] ?? "" }))
    try {
      const res = await fetch(
        `/api/registrations/${registration.id}?token=${encodeURIComponent(token)}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) }
      )
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Failed to save."); return }
      onSaved({ ...registration, answers })
    } catch { setError("Unexpected error.") }
    finally { setSaving(false) }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }} onClick={onClose}>
      <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 16, padding: "2rem", maxWidth: 480, width: "90%", maxHeight: "80vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.25rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 1.25rem" }}>Edit registration</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.25rem" }}>
          {questions.map(q => (
            <div key={q.id}>
              <label style={{ display: "block", fontSize: "0.72rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.35rem" }}>
                {q.label}{q.required && <span style={{ color: "#FF6B6B", marginLeft: 2 }}>*</span>}
              </label>
              <input
                value={values[q.id] ?? ""}
                onChange={e => setValues(prev => ({ ...prev, [q.id]: e.target.value }))}
                style={{ width: "100%", background: "#111", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.6rem 0.9rem", color: "#F0EDE6", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)", outline: "none", boxSizing: "border-box" }}
              />
            </div>
          ))}
          {error && <p style={{ fontSize: "0.78rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)", margin: 0 }}>{error}</p>}
        </div>
        <div style={{ display: "flex", gap: "0.625rem", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={{ padding: "0.5rem 1.25rem", borderRadius: 100, border: "0.5px solid rgba(240,237,230,0.15)", background: "transparent", color: "rgba(240,237,230,0.55)", cursor: "pointer", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)" }}>Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} style={{ padding: "0.5rem 1.25rem", borderRadius: 100, border: "none", background: saving ? "rgba(200,245,90,0.4)" : "#C8F55A", color: "#0A0A0A", cursor: saving ? "default" : "pointer", fontSize: "0.875rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </div>
  )
}

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
  const [editingReg, setEditingReg] = React.useState<Registration | null>(null)

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
  const [rowData, setRowData] = React.useState<Registration[]>(rows)
  React.useEffect(() => { setRowData(rows) }, [rows])
  return (
    <>
    {editingReg && (
      <EditRegModal
        registration={editingReg}
        questions={questions}
        token={token}
        onClose={() => setEditingReg(null)}
        onSaved={updated => {
          setRowData(prev => prev.map(r => r.id === updated.id ? updated : r))
          setEditingReg(null)
        }}
      />
    )}
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
          {rowData.length === 0 ? (
            <tr>
              <td colSpan={labels.length + (showPosition ? 3 : 2)} style={{ padding: "2rem", textAlign: "center", fontSize: "0.85rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                {emptyText}
              </td>
            </tr>
          ) : (
            rowData.map(reg => (
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
                  {reg.source === 'manual' && (
                    <span style={{ fontSize: "0.65rem", background: "rgba(240,237,230,0.06)", color: "rgba(240,237,230,0.4)", borderRadius: 100, padding: "1px 7px", whiteSpace: "nowrap", fontFamily: "var(--font-dm-sans)" }}>
                      Manual
                    </span>
                  )}
                  </span>
                </td>
                <td style={{ ...tdStyle, width: 120 }}>
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
                    <span style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                      <button
                        onClick={() => setEditingReg(reg)}
                        style={{ background: "transparent", border: "0.5px solid rgba(200,245,90,0.3)", borderRadius: 6, padding: "3px 10px", fontSize: "0.72rem", color: "rgba(200,245,90,0.7)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmingId(reg.id)}
                        style={{ background: "transparent", border: "0.5px solid rgba(255,107,107,0.3)", borderRadius: 6, padding: "3px 10px", fontSize: "0.72rem", color: "rgba(255,107,107,0.7)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                      >
                        Remove
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
    </>
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
          communityLink: normalizeCommunityLink(communityLink),
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

// ─── Manual Registration Modal ────────────────────────────────────────────────

type ManualAttendee = Record<string, string>

function emptyManualAttendee(questions: Question[]): ManualAttendee {
  const init: ManualAttendee = {}
  for (const q of questions) init[q.id] = ""
  return init
}

function ManualRegModal({
  questions, slug, token, onClose, onSuccess, confirmedCount, capacity,
}: {
  questions: Question[]
  slug: string
  token: string
  onClose: () => void
  onSuccess: () => void
  confirmedCount: number
  capacity: number | null
}) {
  const [attendees, setAttendees] = React.useState<ManualAttendee[]>([emptyManualAttendee(questions)])
  const [regStatus, setRegStatus] = React.useState<'confirmed' | 'waitlist'>('confirmed')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")
  const [results, setResults] = React.useState<Array<{ registrationNumber: number; status: string; name: string }>>([])
  const [dupWarning, setDupWarning] = React.useState<{ attendeeIdx: number; regNumber: number } | null>(null)
  const [forceIndexes, setForceIndexes] = React.useState<Set<number>>(new Set())

  const atCapacity = !!(capacity && confirmedCount >= capacity)
  const slotsLeft = capacity ? Math.max(0, capacity - confirmedCount) : null

  const addAttendee = () => setAttendees(a => [...a, emptyManualAttendee(questions)])
  const removeAttendee = (idx: number) => {
    setAttendees(a => a.filter((_, i) => i !== idx))
    setForceIndexes(s => { const n = new Set(s); n.delete(idx); return n })
  }
  const handleChange = (idx: number, qId: string, val: string) => {
    setAttendees(a => { const next = [...a]; next[idx] = { ...next[idx], [qId]: val }; return next })
  }

  const parseCheckboxValue = (raw: string | undefined): string[] => {
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string")
    } catch {
      return raw.split("|").map(v => v.trim()).filter(Boolean)
    }
    return []
  }

  const serializeCheckboxValue = (values: string[]): string => {
    const uniqueSorted = Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
    return JSON.stringify(uniqueSorted)
  }

  const handleSubmit = async () => {
    setError("")
    setDupWarning(null)
    for (let i = 0; i < attendees.length; i++) {
      for (const q of questions) {
        if (!q.required) continue
        const answer = attendees[i][q.id] ?? ""
        const hasValue = q.type === "checkbox"
          ? parseCheckboxValue(answer).length > 0
          : answer.trim().length > 0
        if (!hasValue) {
          setError(`${attendees.length > 1 ? `Attendee ${i + 1}: ` : ""}"${q.label}" is required`)
          return
        }
      }
    }
    setSaving(true)
    const nameQ = questions.find(q => q.label.toLowerCase().includes('name') && q.type === 'text')
    const registered: Array<{ registrationNumber: number; status: string; name: string }> = []
    try {
      for (let i = 0; i < attendees.length; i++) {
        const answers = questions.map(q => ({ questionId: q.id, value: attendees[i][q.id] ?? "" }))
        const res = await fetch(`/api/events/${slug}/manual-register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers, status: regStatus, token, forceDuplicate: forceIndexes.has(i) }),
        })
        const data = await res.json()
        if (res.status === 409 && data.duplicate) {
          setSaving(false)
          setDupWarning({ attendeeIdx: i, regNumber: data.existing?.registrationNumber ?? 0 })
          return
        }
        if (!res.ok) {
          setSaving(false)
          setError(`${attendees.length > 1 ? `Attendee ${i + 1}: ` : ""}${data.error || "Failed to register."}`)
          return
        }
        const name = nameQ ? (attendees[i][nameQ.id]?.trim() || `Attendee ${i + 1}`) : `Attendee ${i + 1}`
        registered.push({ registrationNumber: data.registrationNumber, status: data.status, name })
      }
      setResults(registered)
      onSuccess()
    } catch {
      setSaving(false)
      setError("Unexpected error.")
    } finally {
      setSaving(false)
    }
  }

  const handleForce = () => {
    if (!dupWarning) return
    setForceIndexes(s => new Set(s).add(dupWarning.attendeeIdx))
    setDupWarning(null)
    void handleSubmit()
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#141414", border: "0.5px solid rgba(240,237,230,0.15)",
    borderRadius: 8, padding: "0.6rem 0.875rem", fontSize: "0.875rem", color: "#F0EDE6",
    fontFamily: "var(--font-dm-sans)", outline: "none", boxSizing: "border-box",
  }

  if (results.length > 0) {
    return (
      <>
        <Backdrop onClick={onClose} />
        <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 61, background: "#1A1A1A", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 16, padding: "1.75rem", width: "min(92vw,460px)", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
          <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6", marginBottom: "1rem" }}>
            {results.length === 1 ? "Registered" : `${results.length} people registered`}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {results.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#101010", borderRadius: 8, padding: "0.6rem 0.875rem" }}>
                <span style={{ fontSize: "0.85rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>{r.name}</span>
                <span style={{ fontSize: "0.72rem", color: r.status === "confirmed" ? "#C8F55A" : "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", textTransform: "capitalize" }}>#{r.registrationNumber} · {r.status}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
            <button onClick={onClose} style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>Done</button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Backdrop onClick={onClose} />
      <div
        style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 61, background: "#1A1A1A", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 16, padding: "1.75rem", width: "min(92vw,480px)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6", margin: 0 }}>Register manually</h3>
          <button onClick={addAttendee} style={{ display: "flex", alignItems: "center", gap: "0.35rem", background: "rgba(200,245,90,0.1)", border: "0.5px solid rgba(200,245,90,0.25)", borderRadius: 8, padding: "0.3rem 0.75rem", fontSize: "0.75rem", color: "#C8F55A", cursor: "pointer", fontFamily: "var(--font-dm-sans)", flexShrink: 0 }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M5 1v8M1 5h8" /></svg>
            Add person
          </button>
        </div>
        <p style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", margin: "0.25rem 0 1rem" }}>
          Add registrations directly without the public form.
        </p>

        {atCapacity && regStatus === 'confirmed' && (
          <div style={{ background: "rgba(255,168,0,0.08)", border: "0.5px solid rgba(255,168,0,0.25)", borderRadius: 8, padding: "0.6rem 0.875rem", marginBottom: "1rem", fontSize: "0.78rem", color: "rgba(255,168,0,0.9)", fontFamily: "var(--font-dm-sans)" }}>
            Event is at capacity — people will be added to the waitlist.
          </div>
        )}
        {!atCapacity && slotsLeft !== null && slotsLeft <= 5 && (
          <div style={{ background: "rgba(255,168,0,0.05)", border: "0.5px solid rgba(255,168,0,0.18)", borderRadius: 8, padding: "0.6rem 0.875rem", marginBottom: "1rem", fontSize: "0.78rem", color: "rgba(255,168,0,0.7)", fontFamily: "var(--font-dm-sans)" }}>
            {slotsLeft} slot{slotsLeft !== 1 ? "s" : ""} remaining before event is full.
          </div>
        )}

        {dupWarning && (
          <div style={{ background: "rgba(255,107,107,0.08)", border: "0.5px solid rgba(255,107,107,0.25)", borderRadius: 8, padding: "0.875rem", marginBottom: "1rem" }}>
            <p style={{ fontSize: "0.82rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)", margin: "0 0 0.625rem" }}>
              {attendees.length > 1 ? `Attendee ${dupWarning.attendeeIdx + 1} appears` : "This person appears"} to already be registered (#{dupWarning.regNumber}). Add anyway?
            </p>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button onClick={handleForce} style={{ background: "#C8F55A", border: "none", borderRadius: 6, padding: "0.375rem 0.875rem", fontSize: "0.78rem", fontWeight: 600, color: "#0A0A0A", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>Add anyway</button>
              <button onClick={() => setDupWarning(null)} style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 6, padding: "0.375rem 0.875rem", fontSize: "0.78rem", color: "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>Cancel</button>
            </div>
          </div>
        )}

        {attendees.map((form, idx) => (
          <div key={idx} style={idx > 0 ? { borderTop: "0.5px solid rgba(240,237,230,0.08)", paddingTop: "1.25rem", marginTop: "1.25rem" } : {}}>
            {attendees.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                <span style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-dm-sans)" }}>Attendee {idx + 1}</span>
                {idx > 0 && <button type="button" onClick={() => removeAttendee(idx)} style={{ background: "transparent", border: "none", color: "rgba(240,237,230,0.3)", cursor: "pointer", fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", padding: 0 }}>Remove</button>}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {questions.map(q => (
                <div key={q.id}>
                  <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.35rem" }}>
                    {q.label}{q.required && <span style={{ color: "#C8F55A", marginLeft: 2 }}>*</span>}
                  </label>
                  {q.type === "select" && q.options ? (
                    <select value={form[q.id] ?? ""} onChange={e => handleChange(idx, q.id, e.target.value)} style={{ ...inputStyle }}>
                      <option value="">Select…</option>
                      {q.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : q.type === "checkbox" && q.options ? (
                    <div style={{ ...inputStyle, display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.75rem" }}>
                      {q.options.map(opt => {
                        const selectedValues = parseCheckboxValue(form[q.id])
                        const isChecked = selectedValues.includes(opt)
                        return (
                          <label key={`${q.id}-${opt}`} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={e => {
                                const nextValues = e.target.checked
                                  ? (q.allowMultiple ? [...selectedValues, opt] : [opt])
                                  : selectedValues.filter(value => value !== opt)
                                handleChange(idx, q.id, serializeCheckboxValue(nextValues))
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        )
                      })}
                    </div>
                  ) : q.type === "textarea" ? (
                    <textarea rows={3} value={form[q.id] ?? ""} onChange={e => handleChange(idx, q.id, e.target.value)} style={{ ...inputStyle, resize: "vertical" }} />
                  ) : (
                    <input type={q.type === "tel" ? "tel" : q.type === "email" ? "email" : q.type === "number" ? "number" : "text"} value={form[q.id] ?? ""} onChange={e => handleChange(idx, q.id, e.target.value)} style={inputStyle} />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Status selector */}
        <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "0.5px solid rgba(240,237,230,0.08)" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.625rem" }}>Status</div>
          <div style={{ display: "flex", gap: "1rem" }}>
            {(['confirmed', 'waitlist'] as const).map(s => (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: "0.45rem", cursor: "pointer", fontSize: "0.82rem", color: regStatus === s ? "#F0EDE6" : "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)" }}>
                <input type="radio" name="regStatus" value={s} checked={regStatus === s} onChange={() => setRegStatus(s)} style={{ accentColor: "#C8F55A" }} />
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </label>
            ))}
          </div>
          <p style={{ marginTop: "0.4rem", fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
            {atCapacity && regStatus === 'confirmed' ? "Capacity full — will be added to waitlist." : "Confirmed adds directly to your attendee list. Capacity rules apply."}
          </p>
        </div>
        {error && <p style={{ fontSize: "0.78rem", color: "#FF6B6B", marginTop: "0.75rem", fontFamily: "var(--font-dm-sans)" }}>{error}</p>}
        <div style={{ display: "flex", gap: "0.625rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Registering…" : attendees.length > 1 ? `Register ${attendees.length} people` : "Add registration"}
          </button>
        </div>
      </div>
    </>
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
  const { showToast } = useToast()

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
  const [showManualReg, setShowManualReg] = useState(false)

  // Capacity
  const [newCapacity, setNewCapacity] = useState("")
  const [capacityMessage, setCapacityMessage] = useState("")
  const [capacityError, setCapacityError] = useState("")
  const [updatingCapacity, setUpdatingCapacity] = useState(false)
  const [waitlistEmailDiagnostics, setWaitlistEmailDiagnostics] = useState<WaitlistEmailDiagnosticsSummary | null>(null)

  // Duplicate scanner
  const [dupGroups, setDupGroups] = useState<DupReg[][] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState("")
  const [removingDup, setRemovingDup] = useState<Set<string>>(new Set())

  // Report download
  const [downloadingReport, setDownloadingReport] = useState(false)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const [showReportOptions, setShowReportOptions] = useState(false)
  const [reportCreditBalance, setReportCreditBalance] = useState(0)

  // CSV export
  const [csvExporting, setCsvExporting] = useState(false)
  const [csvCost, setCsvCost] = useState<number | null>(null)
  const [csvEventId, setCsvEventId] = useState<string | null>(null)
  const [csvUnlockLoading, setCsvUnlockLoading] = useState(false)
  const [csvError, setCsvError] = useState("")

  // Analytics
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState("")
  const [showAnalyticsUpgrade, setShowAnalyticsUpgrade] = useState(false)

  // AI Insights
  const [insightsData, setInsightsData] = useState<InsightCard[] | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsLocked, setInsightsLocked] = useState(false)
  const [insightsRequiredCredits, setInsightsRequiredCredits] = useState(2)
  const [insightsGeneratedAt, setInsightsGeneratedAt] = useState<string | null>(null)
  const [insightsEventId, setInsightsEventId] = useState<string | null>(null)
  const [insightsUnlockLoading, setInsightsUnlockLoading] = useState(false)

  // AI Q&A
  const [qaHistory, setQaHistory] = useState<QAItem[]>([])
  const [qaInput, setQaInput] = useState("")
  const [qaLoading, setQaLoading] = useState(false)
  const [qaLocked, setQaLocked] = useState(false)

  // Feedback
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState("")
  const [showFeedbackUpgrade, setShowFeedbackUpgrade] = useState(false)

  // Check-in
  const [ticketCodeInput, setTicketCodeInput] = useState("")
  const [scanCodeInput, setScanCodeInput] = useState("")
  const [identityInput, setIdentityInput] = useState("")
  const [checkInLoading, setCheckInLoading] = useState(false)
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null)

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

  useEffect(() => {
    fetch('/api/user/credits').then(r => r.ok ? r.json() : null).then(d => { if (d?.balance !== undefined) setReportCreditBalance(d.balance) }).catch(() => {})
  }, [])

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
    const accessToken = token || eventData.dashboardToken
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
        body: JSON.stringify({ newCapacity: parsed, token: accessToken }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setCapacityError(data.error || "Unable to update capacity."); return }
      setCapacityMessage(`✓ ${data.promoted} ${data.promoted === 1 ? "person" : "people"} moved from waitlist to confirmed`)
      if (data.emailDiagnostics) {
        setWaitlistEmailDiagnostics(data.emailDiagnostics)
      }
      setNewCapacity("")
      await fetchDashboard()

      const diagnosticsRes = await fetch(`/api/events/${slug}/capacity/email-diagnostics?token=${encodeURIComponent(accessToken)}`)
      if (diagnosticsRes.ok) {
        const diagnosticsData = await diagnosticsRes.json()
        if (diagnosticsData?.latest?.summary) {
          setWaitlistEmailDiagnostics(diagnosticsData.latest.summary)
        }
      }
    } catch { setCapacityError("Unable to update capacity.") }
    finally { setUpdatingCapacity(false) }
  }

  useEffect(() => {
    if (activeTab !== "waitlist" || !eventData) return
    const accessToken = token || eventData.dashboardToken
    fetch(`/api/events/${slug}/capacity/email-diagnostics?token=${encodeURIComponent(accessToken)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.latest?.summary) {
          setWaitlistEmailDiagnostics(data.latest.summary)
        }
      })
      .catch(() => {})
  }, [activeTab, eventData, slug, token])

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

  const handleDownloadReport = async (theme = 'navy') => {
    if (!eventData) return
    setDownloadingReport(true)
    const reportUrl = `/api/events/${slug}/report?token=${encodeURIComponent(token || eventData.dashboardToken)}&theme=${encodeURIComponent(theme)}`
    try {
      let res = await fetch(reportUrl)
      if (res.status === 403) {
        const json = await res.json()
        if (json.creditsRequired && json.eventId && reportCreditBalance >= json.creditsRequired) {
          const unlockRes = await fetch('/api/features/unlock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ feature: 'ai_report', eventId: json.eventId }),
          })
          const unlockData = await unlockRes.json()
          if (!unlockRes.ok || !unlockData.success) {
            router.push('/dashboard/billing')
            return
          }
          res = await fetch(reportUrl)
          if (!res.ok) return
          showToast({ featureName: 'Event Report', creditsUsed: json.creditsRequired, creditsRemaining: unlockData.creditsRemaining })
        } else {
          router.push('/dashboard/billing')
          return
        }
      } else if (!res.ok) {
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `event-report-${slug}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* silent */ }
    finally { setDownloadingReport(false) }
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

  const handleExportCSV = async () => {
    if (!eventData) return
    setCsvExporting(true)
    setCsvError("")
    setCsvCost(null)
    try {
      const res = await fetch(`/api/events/${slug}/export${token ? `?token=${encodeURIComponent(token)}` : ""}`)
      if (res.status === 403) {
        const data = await res.json()
        setCsvCost(data.creditsRequired ?? null)
        setCsvEventId(data.eventId ?? null)
        return
      }
      if (!res.ok) {
        const data = await res.json()
        setCsvError(data.error || "Export failed.")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `registrations-${slug}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setCsvError("Unable to export CSV.")
    } finally {
      setCsvExporting(false)
    }
  }

  const handleBuyAndExport = async () => {
    if (!csvEventId) return
    setCsvUnlockLoading(true)
    setCsvError("")
    try {
      const res = await fetch("/api/features/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature: "export_csv", eventId: csvEventId }),
      })
      const data = await res.json()
      if (res.status === 402) {
        router.push("/dashboard/billing")
        return
      }
      if (!res.ok || !data.success) {
        setCsvError(data.error || "Failed to unlock CSV export.")
        return
      }
      setCsvCost(null)
      setCsvEventId(null)
      showToast({ featureName: "CSV Export", creditsUsed: 15, creditsRemaining: data.creditsRemaining })
      await handleExportCSV()
    } catch {
      setCsvError("Unable to complete purchase.")
    } finally {
      setCsvUnlockLoading(false)
    }
  }

  const verifyTicket = async (payload: { code?: string; identity?: string }) => {
    if (!eventData) return
    setCheckInLoading(true)
    setCheckInResult(null)
    try {
      const res = await fetch(`/api/events/${slug}/verify-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token || eventData.dashboardToken,
          ...payload,
        }),
      })
      const data = (await res.json()) as CheckInResult
      setCheckInResult(data)

      if (res.ok && data.success && data.valid) {
        setTicketCodeInput("")
        setScanCodeInput("")
        setIdentityInput("")
        await fetchDashboard()
      }
    } catch {
      setCheckInResult({ success: false, error: "Unable to verify ticket right now." })
    } finally {
      setCheckInLoading(false)
    }
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
  const organizerPlan = eventData?.organizerPlan ?? 'free'
  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "confirmed", label: `Confirmed (${confirmed.length})` },
    { key: "waitlist", label: `Waitlist (${waitlist.length})` },
    { key: "analytics", label: organizerPlan === 'free' ? "Analytics ⚡" : "Analytics" },
    { key: "feedback", label: organizerPlan !== 'business' ? "Feedback ✦" : "Feedback" },
    { key: "checkin" as TabKey, label: "Verify Ticket" },
    { key: "settings", label: "Settings" },
  ]

  const loadInsights = async (force = false) => {
    if (!eventData || insightsLoading) return
    setInsightsLoading(true)
    try {
      const params = new URLSearchParams()
      if (token) params.set('token', token)
      if (force) params.set('force', 'true')
      const qs = params.toString() ? `?${params.toString()}` : ''
      const res = await fetch(`/api/events/${slug}/insights${qs}`)
      const data = await res.json()
      if (res.status === 403 && data.locked) {
        setInsightsLocked(true)
        setInsightsRequiredCredits(data.creditsRequired ?? 20)
        setInsightsEventId(data.eventId ?? null)
        return
      }
      if (!res.ok) return
      setInsightsData(data.cards)
      setInsightsGeneratedAt(data.generatedAt ?? null)
      setInsightsLocked(false)
    } catch {}
    finally { setInsightsLoading(false) }
  }

  const handleUnlockInsights = async () => {
    if (!insightsEventId) return
    setInsightsUnlockLoading(true)
    try {
      const res = await fetch('/api/features/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'ai_insights', eventId: insightsEventId }),
      })
      const data = await res.json()
      if (res.status === 402) {
        router.push('/dashboard/billing')
        return
      }
      if (!res.ok || !data.success) return
      showToast({ featureName: 'AI Insights', creditsUsed: insightsRequiredCredits, creditsRemaining: data.creditsRemaining })
      setInsightsLocked(false)
      await loadInsights(true)
    } catch {}
    finally { setInsightsUnlockLoading(false) }
  }

  const submitQuestion = async (question: string) => {
    const q = question.trim()
    if (!q || qaLoading) return
    setQaInput("")
    setQaLoading(true)
    try {
      const params = token ? `?token=${encodeURIComponent(token)}` : ""
      const res = await fetch(`/api/events/${slug}/ask${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      if (res.status === 402 && data.locked) {
        setQaLocked(true)
        return
      }
      if (!res.ok) return
      setQaHistory(prev => [...prev.slice(-4), { question: q, answer: data.answer, timestamp: new Date().toISOString() }])
    } catch {}
    finally { setQaLoading(false) }
  }

  const loadAnalytics = async () => {
    if (!eventData || analyticsLoading) return
    setAnalyticsLoading(true)
    setAnalyticsError("")
    try {
      const res = await fetch(`/api/events/${slug}/analytics${token ? `?token=${encodeURIComponent(token)}` : ""}`)
      const data = await res.json()
      if (res.status === 403 && data.upgradeRequired) {
        setShowAnalyticsUpgrade(true)
        return
      }
      if (!res.ok) { setAnalyticsError(data.error || "Failed to load analytics"); return }
      setAnalyticsData(data)
      loadInsights()
    } catch { setAnalyticsError("Unable to load analytics.") }
    finally { setAnalyticsLoading(false) }
  }

  const loadFeedback = async () => {
    if (!eventData || feedbackLoading) return
    setFeedbackLoading(true)
    setFeedbackError("")
    try {
      const res = await fetch(`/api/events/${slug}/feedback${token ? `?token=${encodeURIComponent(token)}` : ""}`)
      const data = await res.json()
      if (res.status === 403 && data.upgradeRequired) {
        setShowFeedbackUpgrade(true)
        return
      }
      if (!res.ok) { setFeedbackError(data.error || "Failed to load feedback"); return }
      setFeedbackData(data)
    } catch { setFeedbackError("Unable to load feedback.") }
    finally { setFeedbackLoading(false) }
  }

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

      {showManualReg && eventData?.questions && (
        <ManualRegModal
          questions={eventData.questions}
          slug={slug}
          token={token || eventData.dashboardToken}
          confirmedCount={confirmed.length}
          capacity={eventData.capacity ?? null}
          onClose={() => setShowManualReg(false)}
          onSuccess={() => { fetchDashboard() }}
        />
      )}

      {showUpgradePrompt && (
        <UpgradePrompt feature="Event Reports" requiredPlan="pro" onClose={() => setShowUpgradePrompt(false)} />
      )}

      {showReportOptions && (
        <ReportOptionsModal
          downloading={downloadingReport}
          plan={eventData?.organizerPlan ?? 'free'}
          creditBalance={reportCreditBalance}
          onClose={() => setShowReportOptions(false)}
          onGenerate={theme => { setShowReportOptions(false); handleDownloadReport(theme) }}
        />
      )}
      {showAnalyticsUpgrade && (
        <UpgradePrompt feature="Event Analytics" requiredPlan="pro" onClose={() => setShowAnalyticsUpgrade(false)} />
      )}
      {showFeedbackUpgrade && (
        <UpgradePrompt feature="Attendee Feedback" requiredPlan="business" onClose={() => setShowFeedbackUpgrade(false)} />
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

        {/* ── Cover image ──────────────────────────────────────────────── */}
        {eventData.imageUrl && (
          <div style={{ width: '100%', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.25rem', backgroundColor: '#0A0A0A', lineHeight: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={eventData.imageUrl}
              alt={eventData.title}
              style={{ width: '100%', height: 'auto', maxHeight: '320px', objectFit: 'contain', objectPosition: 'center top', display: 'block', borderRadius: '10px' }}
            />
          </div>
        )}

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
              {eventData.deadline && (
                <div style={{ marginTop: "0.75rem" }}>
                  <CountdownTimer deadline={eventData.deadline} urgentMode={false} />
                </div>
              )}
            </div>

            {/* Three-dot menu */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
              <button
                onClick={() => {
                  const plan = eventData?.organizerPlan ?? 'free'
                  if (plan === 'free' && reportCreditBalance < 50) { router.push('/dashboard/billing') } else { setShowReportOptions(true) }
                }}
                disabled={downloadingReport}
                title="Download event report"
                style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.375rem 0.75rem", fontSize: "0.75rem", fontWeight: 500, color: downloadingReport ? "rgba(240,237,230,0.3)" : "rgba(240,237,230,0.5)", cursor: downloadingReport ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", display: "flex", alignItems: "center", gap: "0.35rem", whiteSpace: "nowrap" }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v8M5 7l3 3 3-3" />
                  <path d="M2 12h12" />
                </svg>
                {downloadingReport ? "Generating…" : "Report"}
              </button>
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
          </div>

          {/* Registration link row */}
          <div data-tutorial="event-link" style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
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

            {/* Register someone button */}
            <div>
              <button
                onClick={() => setShowManualReg(true)}
                style={{ background: "transparent", border: "0.5px solid rgba(200,245,90,0.35)", borderRadius: 8, padding: "0.55rem 1.1rem", fontSize: "0.82rem", fontWeight: 500, color: "#C8F55A", cursor: "pointer", fontFamily: "var(--font-dm-sans)", display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="5" r="3"/><path d="M1 14c0-3.866 3.134-7 7-7s7 3.134 7 7"/>
                  <path d="M12 11v4M10 13h4" />
                </svg>
                Register someone
              </button>
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

            {/* Export CSV */}
            <div style={{ background: "rgba(240,237,230,0.03)", border: "0.5px solid rgba(240,237,230,0.09)", borderRadius: 12, padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.2rem" }}>Export Registrations</div>
                  <div style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>Download all confirmed registrations as a CSV file</div>
                </div>
                {csvCost === null && (
                  <button
                    onClick={handleExportCSV}
                    disabled={csvExporting || confirmed.length === 0}
                    style={{ background: csvExporting ? "rgba(200,245,90,0.08)" : "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.1rem", fontSize: "0.8rem", fontWeight: 600, color: csvExporting ? "#C8F55A" : "#0A0A0A", cursor: (csvExporting || confirmed.length === 0) ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", flexShrink: 0, opacity: (confirmed.length === 0 || csvExporting) ? 0.5 : 1 }}
                  >
                    {csvExporting ? "Exporting…" : "Export CSV"}
                  </button>
                )}
              </div>
              {csvCost !== null && (
                <div style={{ marginTop: "0.875rem", background: "rgba(200,245,90,0.06)", border: "0.5px solid rgba(200,245,90,0.2)", borderRadius: 10, padding: "0.875rem 1rem" }}>
                  <p style={{ margin: "0 0 0.625rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.65)", fontFamily: "var(--font-dm-sans)" }}>
                    Export this data for <strong style={{ color: "#C8F55A" }}>${csvCost.toFixed(2)} credits</strong>
                  </p>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      onClick={handleBuyAndExport}
                      disabled={csvUnlockLoading}
                      style={{ background: csvUnlockLoading ? "rgba(200,245,90,0.4)" : "#C8F55A", border: "none", borderRadius: 8, padding: "0.45rem 1rem", fontSize: "0.8rem", fontWeight: 600, color: "#0A0A0A", cursor: csvUnlockLoading ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)" }}
                    >
                      {csvUnlockLoading ? "Processing…" : "Buy & Export"}
                    </button>
                    <button
                      onClick={() => { setCsvCost(null); setCsvEventId(null) }}
                      style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.45rem 0.875rem", fontSize: "0.8rem", color: "rgba(240,237,230,0.4)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {csvError && <p style={{ marginTop: "0.5rem", fontSize: "0.78rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)", margin: "0.5rem 0 0" }}>{csvError}</p>}
            </div>

            {/* Duplicate Scanner */}
            <div style={{ background: "rgba(240,237,230,0.03)", border: "0.5px solid rgba(240,237,230,0.09)", borderRadius: 12, padding: "1rem 1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.2rem" }}>Duplicate Scanner</div>
                  <div style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>Scan all registrations for identical responses</div>
                </div>
                <button
                  onClick={runDuplicateScan}
                  disabled={scanning}
                  style={{ background: scanning ? "rgba(200,245,90,0.08)" : "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.1rem", fontSize: "0.8rem", fontWeight: 600, color: scanning ? "#C8F55A" : "#0A0A0A", cursor: scanning ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", flexShrink: 0, opacity: scanning ? 0.7 : 1 }}
                >
                  {scanning ? "Scanning…" : "Run scan"}
                </button>
              </div>
              {scanError && <p style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{scanError}</p>}
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
                              <span style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap" }}>{new Date(reg.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                            </div>
                            <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                              <button onClick={() => keepDupReg(reg.id)} style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 6, padding: "3px 10px", fontSize: "0.72rem", color: "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>Keep</button>
                              <button onClick={() => removeDupReg(reg.id)} disabled={isRemoving} style={{ background: "transparent", border: "0.5px solid rgba(255,107,107,0.3)", borderRadius: 6, padding: "3px 10px", fontSize: "0.72rem", color: isRemoving ? "rgba(255,107,107,0.4)" : "rgba(255,107,107,0.7)", cursor: isRemoving ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)" }}>{isRemoving ? "…" : "Remove"}</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Community link (if set) */}
            {eventData.communityLink && (
              <div style={{ background: "rgba(200,245,90,0.04)", border: "0.5px solid rgba(200,245,90,0.12)", borderRadius: 10, padding: "0.875rem 1.125rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(200,245,90,0.5)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.25rem" }}>Community link</div>
                  <a href={normalizeCommunityLink(eventData.communityLink) || eventData.communityLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.82rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)", textDecoration: "none", wordBreak: "break-all" }}>{normalizeCommunityLink(eventData.communityLink) || eventData.communityLink}</a>
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
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <button
                  onClick={() => setShowManualReg(true)}
                  style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.35rem 0.75rem", fontSize: "0.75rem", color: "rgba(240,237,230,0.55)", cursor: "pointer", fontFamily: "var(--font-dm-sans)", display: "inline-flex", alignItems: "center", gap: "0.3rem" }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M5 1v8M1 5h8" />
                  </svg>
                  Add registrant
                </button>
                <span style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.04em", background: "rgba(200,245,90,0.12)", color: "#C8F55A", borderRadius: 100, padding: "3px 10px", fontFamily: "var(--font-dm-sans)" }}>
                  {confirmed.length} confirmed
                </span>
              </div>
            </div>
            {confirmed.length === 0 ? (
              <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "2rem", textAlign: "center" }}>
                <div style={{ fontSize: "2.2rem", marginBottom: "0.6rem" }}>RG</div>
                <p style={{ margin: "0 0 0.4rem", fontFamily: "var(--font-instrument-serif)", fontSize: "1.15rem", color: "#F0EDE6" }}>No registrations yet</p>
                <p style={{ margin: "0 auto 0.95rem", maxWidth: 420, fontSize: "0.84rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
                  Share your registration link to start collecting attendees; new signups will appear here automatically.
                </p>
                <button
                  onClick={handleCopy}
                  style={{ background: "#a3e635", border: "none", borderRadius: 10, padding: "0.55rem 1rem", fontSize: "0.82rem", fontWeight: 700, color: "#0A0A0A", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                >
                  Copy Registration Link
                </button>
              </div>
            ) : (
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
            )}
          </div>
        )}

        {/* ── Tab: Waitlist ─────────────────────────────────────────────── */}
        {activeTab === "waitlist" && (
          <div data-tutorial="waitlist-section">
            {waitlistEmailDiagnostics && waitlistEmailDiagnostics.attempted > 0 && (
              <div
                style={{
                  background: waitlistEmailDiagnostics.failed > 0 ? "rgba(255,107,107,0.08)" : "rgba(200,245,90,0.08)",
                  border: waitlistEmailDiagnostics.failed > 0 ? "0.5px solid rgba(255,107,107,0.25)" : "0.5px solid rgba(200,245,90,0.25)",
                  borderRadius: 10,
                  padding: "0.75rem 0.9rem",
                  marginBottom: "0.9rem",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.8rem", color: waitlistEmailDiagnostics.failed > 0 ? "#FF6B6B" : "#C8F55A", fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}>
                  Promotion email status: {waitlistEmailDiagnostics.sent} sent, {waitlistEmailDiagnostics.failed} failed, {waitlistEmailDiagnostics.skippedNoEmail} skipped (no email)
                </p>
              </div>
            )}

            {/* ── Duplicate Scanner panel ─────────────────────────────── */}
            <div style={{ background: "rgba(240,237,230,0.03)", border: "0.5px solid rgba(240,237,230,0.09)", borderRadius: 12, padding: "1rem 1.25rem", marginTop: "0.5rem", marginBottom: "1.5rem" }}>
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

        {/* ── Tab: Analytics ────────────────────────────────────────────── */}
        {activeTab === "analytics" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", gap: "0.75rem", flexWrap: "wrap" }}>
              <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6", margin: 0 }}>Event Analytics</h2>
              {organizerPlan !== 'free' && !analyticsData && !analyticsLoading && !analyticsError && (
                <button
                  onClick={loadAnalytics}
                  style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.45rem 1.1rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                >
                  Load analytics
                </button>
              )}
            </div>

            {/* Pro plan lock for free users */}
            {organizerPlan === 'free' && (
              <ComingSoon featureName="Event Analytics" description="Track views, registrations, conversion rates, and registration trends. Available on the Pro plan once our payment system goes live." />
            )}

            {analyticsLoading && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.75rem", marginBottom: "1.25rem" }}>
                {[1,2,3,4].map(i => <div key={i} style={{ height: 80, borderRadius: 10, background: "#141414", animation: "epage-pulse 1.4s ease-in-out infinite" }} />)}
              </div>
            )}

            {analyticsError && (
              <p style={{ fontSize: "0.875rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{analyticsError}</p>
            )}

            {analyticsData && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* AI Insights */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>AI Insights</span>
                      {insightsGeneratedAt && (
                        <span style={{ fontSize: "0.65rem", color: "rgba(240,237,230,0.2)", fontFamily: "var(--font-dm-sans)" }}>· {new Date(insightsGeneratedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                    {insightsData && !insightsLoading && (
                      <button
                        onClick={() => loadInsights(true)}
                        style={{ background: "none", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 6, padding: "0.25rem 0.6rem", fontSize: "0.7rem", color: "rgba(240,237,230,0.4)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                      >
                        Regenerate{organizerPlan === 'free' ? ` (${insightsRequiredCredits} pts)` : ""}
                      </button>
                    )}
                  </div>

                  {insightsLocked && (
                    <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "1rem" }}>🔒</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "0.82rem", fontWeight: 500, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", margin: "0 0 0.15rem 0" }}>AI Insights — {insightsRequiredCredits} credits</p>
                        <p style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>Get 3 personalised insights about your event performance.</p>
                      </div>
                      {reportCreditBalance >= insightsRequiredCredits ? (
                        <button
                          onClick={handleUnlockInsights}
                          disabled={insightsUnlockLoading}
                          style={{ background: "#C8F55A", color: "#0A0A0A", borderRadius: 6, padding: "0.35rem 0.85rem", fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", border: "none", cursor: insightsUnlockLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: insightsUnlockLoading ? 0.6 : 1 }}
                        >
                          {insightsUnlockLoading ? "Unlocking…" : `Unlock (${insightsRequiredCredits} credits)`}
                        </button>
                      ) : (
                        <a href="/dashboard/billing#credits" style={{ background: "#C8F55A", color: "#0A0A0A", borderRadius: 6, padding: "0.35rem 0.85rem", fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", textDecoration: "none", whiteSpace: "nowrap" }}>Buy credits</a>
                      )}
                    </div>
                  )}

                  {insightsLoading && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem" }} className="insight-grid">
                      {[1,2,3].map(i => <div key={i} style={{ height: 100, borderRadius: 8, background: "#141414", animation: "epage-pulse 1.4s ease-in-out infinite" }} />)}
                    </div>
                  )}

                  {insightsData && !insightsLoading && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem" }} className="insight-grid">
                      {insightsData.map((card, i) => (
                        <div key={i} style={{
                          borderLeft: `3px solid ${card.type === 'warning' ? '#FF6B6B' : card.type === 'info' ? 'rgba(240,237,230,0.2)' : '#C8F55A'}`,
                          borderTop: "0.5px solid rgba(240,237,230,0.06)",
                          borderRight: "0.5px solid rgba(240,237,230,0.06)",
                          borderBottom: "0.5px solid rgba(240,237,230,0.06)",
                          background: card.type === 'warning' ? "rgba(255,107,107,0.04)" : card.type === 'info' ? "rgba(240,237,230,0.03)" : "rgba(200,245,90,0.04)",
                          borderRadius: 8,
                          padding: "0.875rem 1rem",
                        }}>
                          <div style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: card.type === 'warning' ? '#FF6B6B' : card.type === 'info' ? 'rgba(240,237,230,0.35)' : '#C8F55A', fontFamily: "var(--font-dm-sans)", marginBottom: "0.4rem" }}>{card.type}</div>
                          <div style={{ fontSize: "0.82rem", fontWeight: 500, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", marginBottom: "0.35rem", lineHeight: 1.35 }}>{card.title}</div>
                          <div style={{ fontSize: "0.76rem", fontWeight: 300, color: "rgba(240,237,230,0.6)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.5 }}>{card.body}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stat cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.75rem" }} className="stat-grid">
                  {[
                    { label: "Total Views", value: analyticsData.totalViews },
                    { label: "Total Registrations", value: analyticsData.totalRegistrations },
                    { label: "Conversion Rate", value: `${analyticsData.conversionRate}%` },
                    { label: "Confirmed → Waitlist", value: `${analyticsData.waitlistConversionRate}%` },
                  ].map(stat => (
                    <div key={stat.label} style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "1.1rem 1.25rem" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>{stat.label}</div>
                      <div style={{ fontSize: "1.5rem", fontFamily: "var(--font-instrument-serif)", color: "#F0EDE6" }}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Registrations by day */}
                <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.25rem 1.5rem" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "1rem" }}>Registrations — last 30 days</div>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={analyticsData.registrationsByDay} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,237,230,0.06)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }} tickFormatter={v => v.slice(5)} interval={4} />
                      <YAxis tick={{ fontSize: 9, fill: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "#1A1A1A", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 8, fontSize: "0.78rem", fontFamily: "var(--font-dm-sans)", color: "#F0EDE6" }} />
                      <Line type="monotone" dataKey="count" stroke="#C8F55A" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Registrations by hour */}
                <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.25rem 1.5rem" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "1rem" }}>Registrations by hour of day</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={analyticsData.registrationsByHour} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,237,230,0.06)" />
                      <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }} tickFormatter={h => `${h}h`} />
                      <YAxis tick={{ fontSize: 9, fill: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "#1A1A1A", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 8, fontSize: "0.78rem", fontFamily: "var(--font-dm-sans)", color: "#F0EDE6" }} />
                      <Bar dataKey="count" fill="rgba(200,245,90,0.6)" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {!analyticsData && !analyticsLoading && !analyticsError && (
              <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "2rem", textAlign: "center" }}>
                <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>Click &ldquo;Load analytics&rdquo; to see views, conversions, and registration trends.</p>
              </div>
            )}

            {/* ── AI Q&A ───────────────────────────────────────────────── */}
            <div style={{ marginTop: "2rem", borderTop: "0.5px solid rgba(240,237,230,0.07)", paddingTop: "1.75rem" }}>
              <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.1rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 0.25rem 0" }}>Ask about your event</h3>
              <p style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", margin: "0 0 1.25rem 0" }}>Ask anything about your registration data.</p>

              {qaLocked ? (
                <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "1rem" }}>🔒</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.82rem", fontWeight: 500, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", margin: "0 0 0.15rem 0" }}>AI Q&A — 1 credit per question</p>
                    <p style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>Purchase credits to ask questions about your event data.</p>
                  </div>
                  <a href="/dashboard/billing#credits" style={{ background: "#C8F55A", color: "#0A0A0A", borderRadius: 6, padding: "0.35rem 0.85rem", fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", textDecoration: "none", whiteSpace: "nowrap" }}>Buy credits</a>
                </div>
              ) : (
                <>
                  {/* Suggested questions */}
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                    {[
                      "How does this compare to my last event?",
                      "When should I share my next event link?",
                      "Why was my conversion rate low?",
                      "What does my waitlist tell me?",
                    ].map(q => (
                      <button
                        key={q}
                        onClick={() => setQaInput(q)}
                        style={{ background: "none", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 20, padding: "0.3rem 0.7rem", fontSize: "0.72rem", color: "rgba(240,237,230,0.55)", cursor: "pointer", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap" }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>

                  {/* Input row */}
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <input
                        value={qaInput}
                        onChange={e => setQaInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitQuestion(qaInput) } }}
                        placeholder="Ask a question about this event..."
                        disabled={qaLoading}
                        style={{ width: "100%", background: "#141414", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.65rem 0.875rem", fontSize: "0.82rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", outline: "none", boxSizing: "border-box" }}
                      />
                      {organizerPlan !== "business" && (
                        <p style={{ fontSize: "0.65rem", color: "rgba(240,237,230,0.25)", fontFamily: "var(--font-dm-sans)", margin: "0.3rem 0 0 0" }}>1 credit per question</p>
                      )}
                    </div>
                    <button
                      onClick={() => submitQuestion(qaInput)}
                      disabled={qaLoading || !qaInput.trim()}
                      style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.65rem 1.1rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: qaLoading || !qaInput.trim() ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: qaLoading || !qaInput.trim() ? 0.55 : 1, whiteSpace: "nowrap", flexShrink: 0 }}
                    >
                      {qaLoading ? "…" : "Ask"}
                    </button>
                  </div>

                  {/* Loading indicator */}
                  {qaLoading && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "1.25rem" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#C8F55A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#0A0A0A", fontFamily: "var(--font-dm-sans)" }}>AI</span>
                      </div>
                      <div style={{ background: "#141414", borderRadius: "2px 12px 12px 12px", padding: "0.55rem 0.875rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", animation: "epage-pulse 1.4s ease-in-out infinite" }}>
                        Thinking…
                      </div>
                    </div>
                  )}

                  {/* Q&A history */}
                  {qaHistory.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginTop: "1.5rem" }}>
                      {qaHistory.map((item, i) => (
                        <div key={i}>
                          {/* Question bubble */}
                          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
                            <div style={{ background: "#1E1E1E", border: "0.5px solid rgba(240,237,230,0.07)", borderRadius: "12px 12px 2px 12px", padding: "0.55rem 0.875rem", maxWidth: "80%", fontSize: "0.82rem", color: "rgba(240,237,230,0.8)", fontFamily: "var(--font-dm-sans)" }}>
                              {item.question}
                            </div>
                          </div>
                          {/* Answer bubble */}
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem" }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#C8F55A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}>
                              <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#0A0A0A", fontFamily: "var(--font-dm-sans)" }}>AI</span>
                            </div>
                            <div>
                              <p style={{ fontSize: "0.875rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontWeight: 300, lineHeight: 1.65, margin: "0 0 0.2rem 0" }}>{item.answer}</p>
                              <span style={{ fontSize: "0.6rem", color: "rgba(240,237,230,0.25)", fontFamily: "var(--font-dm-sans)" }}>{new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Feedback ─────────────────────────────────────────────── */}
        {activeTab === "feedback" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", gap: "0.75rem", flexWrap: "wrap" }}>
              <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6", margin: 0 }}>Attendee Feedback</h2>
              {organizerPlan === 'business' && !feedbackData && !feedbackLoading && !feedbackError && (
                <button
                  onClick={loadFeedback}
                  style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.45rem 1.1rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                >
                  Load feedback
                </button>
              )}
            </div>

            {/* Business plan lock for free/pro users */}
            {organizerPlan !== 'business' && (
              <ComingSoon featureName="Attendee Feedback" description="Collect post-event ratings and written feedback from your attendees. Available on the Business plan once our payment system goes live." />
            )}

            {feedbackLoading && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {[1, 2, 3].map(i => <div key={i} style={{ height: 80, borderRadius: 10, background: "#141414", animation: "epage-pulse 1.4s ease-in-out infinite" }} />)}
              </div>
            )}

            {feedbackError && (
              <p style={{ fontSize: "0.875rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{feedbackError}</p>
            )}

            {feedbackData && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Summary stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.75rem" }} className="stat-grid">
                  <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "1.1rem 1.25rem" }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>Response Rate</div>
                    <div style={{ fontSize: "1.6rem", fontFamily: "var(--font-instrument-serif)", color: "#F0EDE6" }}>
                      {feedbackData.totalResponses} of {feedbackData.confirmedCount}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)", marginTop: "0.25rem" }}>attendees responded</div>
                  </div>
                  <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "1.1rem 1.25rem" }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>Average Rating</div>
                    <div style={{ fontSize: "1.6rem", fontFamily: "var(--font-instrument-serif)", color: "#F0EDE6" }}>
                      {feedbackData.averageRating !== null ? `${feedbackData.averageRating} / 5` : "—"}
                    </div>
                  </div>
                </div>

                {feedbackData.feedback.length === 0 ? (
                  <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "2rem", textAlign: "center" }}>
                    <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>No feedback submitted yet. Feedback request emails are sent automatically after the event date.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {feedbackData.feedback.map(fb => (
                      <div key={fb.id} style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.25rem 1.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: fb.enjoyed || fb.improve || fb.complaint ? "1rem" : 0, flexWrap: "wrap", gap: "0.5rem" }}>
                          <div style={{ display: "flex", gap: "2px" }}>
                            {[1, 2, 3, 4, 5].map(s => (
                              <span key={s} style={{ fontSize: "1rem", color: s <= fb.rating ? "#C8F55A" : "rgba(240,237,230,0.15)" }}>★</span>
                            ))}
                          </div>
                          <span style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                            {new Date(fb.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                        </div>
                        {(fb.enjoyed || fb.improve || fb.complaint) && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                            {fb.enjoyed && (
                              <div>
                                <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(200,245,90,0.5)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.2rem" }}>Enjoyed</div>
                                <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.65)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>{fb.enjoyed}</p>
                              </div>
                            )}
                            {fb.improve && (
                              <div>
                                <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.2rem" }}>Improve</div>
                                <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.65)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>{fb.improve}</p>
                              </div>
                            )}
                            {fb.complaint && (
                              <div>
                                <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,107,107,0.5)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.2rem" }}>Complaint</div>
                                <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.65)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>{fb.complaint}</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!feedbackData && !feedbackLoading && !feedbackError && (
              <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "2rem", textAlign: "center" }}>
                <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>Click &ldquo;Load feedback&rdquo; to see attendee responses.</p>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Check-in ─────────────────────────────────────────────── */}
        {activeTab === "checkin" && (
          <div data-tutorial="confirm-attendance">
            <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 1.5rem" }}>
              Ticket Verification
            </h2>
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.84rem", color: "rgba(240,237,230,0.45)", margin: "0 0 1rem" }}>
              Verify by ticket code, scanned QR value, or attendee email/name. Once verified, a ticket cannot be verified again.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.9rem" }}>
              <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1rem" }}>
                <p style={{ margin: "0 0 0.55rem", fontSize: "0.72rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Ticket code</p>
                <input
                  value={ticketCodeInput}
                  onChange={e => setTicketCodeInput(e.target.value)}
                  placeholder="Enter confirmation code"
                  style={{ width: "100%", background: "#0A0A0A", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.55rem 0.75rem", fontSize: "0.84rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", outline: "none" }}
                />
                <button
                  onClick={() => verifyTicket({ code: ticketCodeInput })}
                  disabled={checkInLoading || !ticketCodeInput.trim()}
                  style={{ marginTop: "0.55rem", width: "100%", background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.8rem", fontWeight: 600, color: "#0A0A0A", cursor: checkInLoading || !ticketCodeInput.trim() ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: checkInLoading || !ticketCodeInput.trim() ? 0.6 : 1 }}
                >
                  Verify code
                </button>
              </div>

              <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1rem" }}>
                <p style={{ margin: "0 0 0.55rem", fontSize: "0.72rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Scan code</p>
                <input
                  value={scanCodeInput}
                  onChange={e => setScanCodeInput(e.target.value)}
                  placeholder="Paste scanned QR/URL/code"
                  style={{ width: "100%", background: "#0A0A0A", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.55rem 0.75rem", fontSize: "0.84rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", outline: "none" }}
                />
                <button
                  onClick={() => verifyTicket({ code: scanCodeInput })}
                  disabled={checkInLoading || !scanCodeInput.trim()}
                  style={{ marginTop: "0.55rem", width: "100%", background: "transparent", border: "0.5px solid rgba(200,245,90,0.35)", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.8rem", fontWeight: 600, color: "#C8F55A", cursor: checkInLoading || !scanCodeInput.trim() ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: checkInLoading || !scanCodeInput.trim() ? 0.5 : 1 }}
                >
                  Verify scan
                </button>
              </div>

              <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1rem" }}>
                <p style={{ margin: "0 0 0.55rem", fontSize: "0.72rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", letterSpacing: "0.06em", textTransform: "uppercase" }}>Owner email or name</p>
                <input
                  value={identityInput}
                  onChange={e => setIdentityInput(e.target.value)}
                  placeholder="jane@email.com or Jane Doe"
                  style={{ width: "100%", background: "#0A0A0A", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.55rem 0.75rem", fontSize: "0.84rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", outline: "none" }}
                />
                <button
                  onClick={() => verifyTicket({ identity: identityInput })}
                  disabled={checkInLoading || !identityInput.trim()}
                  style={{ marginTop: "0.55rem", width: "100%", background: "transparent", border: "0.5px solid rgba(240,237,230,0.18)", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.8rem", fontWeight: 600, color: "rgba(240,237,230,0.7)", cursor: checkInLoading || !identityInput.trim() ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: checkInLoading || !identityInput.trim() ? 0.5 : 1 }}
                >
                  Find and verify
                </button>
              </div>
            </div>

            {checkInResult && (
              <div style={{ marginTop: "1rem", background: "#141414", border: checkInResult.valid ? "0.5px solid rgba(200,245,90,0.3)" : checkInResult.alreadyVerified ? "0.5px solid rgba(255,168,0,0.3)" : "0.5px solid rgba(255,107,107,0.3)", borderRadius: 12, padding: "1rem" }}>
                <p style={{ margin: 0, fontSize: "0.88rem", color: checkInResult.valid ? "#C8F55A" : checkInResult.alreadyVerified ? "rgba(255,168,0,0.9)" : "#FF6B6B", fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}>
                  {checkInResult.message || checkInResult.error || "Verification complete."}
                </p>
                {checkInResult.ticket && (
                  <div style={{ marginTop: "0.55rem", display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.8rem", color: "rgba(240,237,230,0.6)", fontFamily: "var(--font-dm-sans)" }}>
                    <span>Name: {checkInResult.ticket.attendeeName || "Not provided"}</span>
                    <span>Email: {checkInResult.ticket.attendeeEmail || "Not provided"}</span>
                    <span>Ticket code: {checkInResult.ticket.confirmationCode || "Not provided"}</span>
                    {checkInResult.ticket.registrationNumber && <span>Registration #: {checkInResult.ticket.registrationNumber}</span>}
                    {checkInResult.ticket.checkedInAt && <span>Verified at: {new Date(checkInResult.ticket.checkedInAt).toLocaleString()}</span>}
                  </div>
                )}
              </div>
            )}
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
        @media (max-width: 639px) { .insight-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </>
  )
}
