"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import CountdownTimer from "@/components/CountdownTimer"
import ReportDownloadModal from "@/components/ReportDownloadModal"
import { EventExpiryBanner } from "@/components/EventExpiryBanner"
import EventImageWithFallback from "@/components/ui/EventImageWithFallback"
import TicketSettingsCard from "@/components/tickets/TicketSettingsCard"
import { EntryDashboard } from "@/components/EntryDashboard"
import { ScannerHome } from "@/components/scanner/ScannerHome"
import { normalizeCommunityLink } from "@/lib/communityLink"
import { getPublicEventUrl } from "@/lib/eventUrls"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, type PieLabelRenderProps,
} from "recharts"

// --- Types ---

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
  id: string
  title: string
  description: string | null
  accessType?: "REGISTRATION" | "WALK_IN"
  eventType?: "PHYSICAL" | "VIRTUAL"
  isPaid?: boolean
  capacity: number | null
  deadline: string | null
  confirmedCount: number
  waitlistCount: number
  slug: string
  questions: Question[]
  eventDate: string | null
  eventEndAt?: string | null
  joinOpensAt: string | null
  location: string | null
  communityLink: string | null
  whatsappNumber?: string | null
  contactMode?: "WHATSAPP" | "CALL"
  archived: boolean
  status: string
  ticketsEnabled: boolean
  expiresAt?: string | null
  dashboardToken: string
  organizerPlan: string
  canEdit?: boolean
  imageUrl?: string | null
  calendarSynced?: boolean
  googleCalendarConnected?: boolean
  ticketTiers?: Array<{
    id: string
    name: string
    priceKes: number
    capacity: number
    description?: string | null
    bundleSize?: number
    sortOrder: number
    soldCount: number
    waitlistCount: number
    status: string
  }>
}

type TabKey = "overview" | "confirmed" | "waitlist" | "analytics" | "feedback" | "checkin" | "settings" | "team"

type EventTeamMember = {
  teamMemberId: string
  email: string
  status: "pending" | "accepted"
  member: { name: string | null; email: string | null; image: string | null } | null
  createdAt: string
}

type FeedbackData = {
  feedback: { id: string; rating: number; enjoyed: string | null; improve: string | null; complaint: string | null; submittedAt: string }[]
  totalResponses: number
  averageRating: number | null
  confirmedCount: number
}

type AnalyticsData = {
  mode?: "registration" | "walk_in"
  totalViews: number
  totalRegistrations: number
  conversionRate: number
  confirmedCount: number
  checkedInCount: number
  checkInRate: number
  waitlistCount: number
  waitlistedCount: number
  promotedCount: number
  stillWaitingCount: number
  waitlistConversionRate: number
  sourceBreakdown: { source: string; count: number }[]
  feedbackScore: number | null
  feedbackCount: number
  vsAverage: number | null
  avgRegistrations: number | null
  aiInsightsFreeUsed: boolean
  event?: { capacity: number | null }
  registrationsByDay: { date: string; count: number }[]
  registrationsByHour: { hour: number; count: number }[]
  walkInTodayCount?: number
  walkInActiveDays?: number
  paidRevenueKes?: number
  paidCommissionKes?: number
  paidNetKes?: number
  paidTicketsSold?: number
  paidAdmissionsIssued?: number
  pendingPaidOrders?: number
  tierBreakdown?: Array<{
    id: string
    name: string
    priceKes: number
    soldCount: number
    waitlistCount: number
    bundleSize: number
    grossKes: number
    admissionsIssued: number
  }>
}

type WalkInDashboard = {
  eventTitle: string
  startDate: string
  endDate: string
  status: "NOT_STARTED" | "ACTIVE" | "ENDED"
  days: {
    date: string
    dayNumber: number
    label: string
    count: number
    status: "CLOSED" | "ACTIVE" | "UPCOMING"
  }[]
  totalCheckins: number
}

const SOURCE_COLORS: Record<string, string> = {
  direct: '#C8F55A',
  shared: '#3B82F6',
  referral: '#F59E0B',
  qr: '#22C55E',
  unknown: '#525252',
  form: '#7A7A7A',
  manual: '#A855F7',
}

type InsightCard = {
  type: "success" | "warning" | "tip" | "info" | "action"
  title: string
  body: string
}

type QAItem = {
  question: string
  answer: string
  timestamp: string
}

type WaitlistEmailDiagnosticsSummary = {
  attempted: number
  sent: number
  failed: number
  skippedNoEmail: number
}

type ReportPreviewData = {
  success: boolean
  reportReady?: boolean
  generatedAt?: string
  message?: string
  isSuperAdmin?: boolean
  downloadsRemaining: number
  requiresSignIn?: boolean
  downloadCostDownloads?: number
  downloadPriceKsh?: number
  accessNote?: string
}

const REPORT_PROGRESS_STEPS = [
  'Reading registrations...',
  'Analyzing trends...',
  'Generating insights...',
]

// --- Helpers ---

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

function formatCompactDate(value: string | null | undefined): string {
  if (!value) return ""
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
}

function formatDateRange(startDate: string | null | undefined, endDate: string | null | undefined): string {
  if (!startDate && !endDate) return ""
  if (!endDate || startDate === endDate) return formatCompactDate(startDate)
  return `${formatCompactDate(startDate)} - ${formatCompactDate(endDate)}`
}

function hasActiveWalkInDay(dashboard: WalkInDashboard | null): boolean {
  return !!dashboard?.days.some((day) => day.status === "ACTIVE")
}

function walkInDashboardHeaderLabel(dashboard: WalkInDashboard | null): string {
  if (!dashboard) return "Walk-In Event"
  if (dashboard.status === "ENDED") return "Walk-In Event - Completed"
  if (dashboard.status === "NOT_STARTED") return `Walk-In Event - Starts ${formatDateRange(dashboard.startDate, dashboard.startDate)}`
  return `Walk-In Event - Live ${formatDateRange(dashboard.startDate, dashboard.endDate)}`
}

function isEventArchived(e: EventData): boolean {
  return e.archived || e.status === "archived"
}

function isEventPast(e: EventData): boolean {
  if (isEventArchived(e)) return false
  return !!(e.deadline && new Date(e.deadline) < new Date())
}

function isEventClosed(e: EventData): boolean {
  return e.status === "closed" || e.status === "COMPLETED"
}

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function extractResendVerificationDomain(message: string | null | undefined): string | null {
  if (!message) return null
  const match = message.match(/(?:the\s+)?([a-z0-9.-]+\.[a-z]{2,})\s+domain is not verified/i)
  return match?.[1]?.toLowerCase() ?? null
}

function buildDomainVerificationHelp(message: string | null | undefined): string {
  const domain = extractResendVerificationDomain(message) ?? "eventsslot.com"
  return `Email delivery is paused because ${domain} is not verified in Resend. Verify the domain, then resend the invite or share the direct invite link below.`
}

function toIsoFromDatetimeLocal(value: string): string | null {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

// --- Status badge ---

function StatusBadge({ event }: { event: EventData }) {
  if (isEventArchived(event)) {
    return (
      <span style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.04em", background: "rgba(240,237,230,0.08)", color: "rgba(240,237,230,0.4)", borderRadius: 100, padding: "2px 8px", fontFamily: "var(--font-dm-sans)" }}>
        ARCHIVED
      </span>
    )
  }
  if (event.status === "COMPLETED") {
    return (
      <span style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.04em", background: "rgba(255,168,0,0.12)", color: "#FFA800", borderRadius: 100, padding: "2px 8px", fontFamily: "var(--font-dm-sans)" }}>
        COMPLETED
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

// --- Three-dot menu ---

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
        ---
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

// --- Modals ---

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
          <button onClick={handleSave} disabled={saving} style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: saving ? 0.7 : 1 }}>{saving ? "Saving..." : "Save"}</button>
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
          <button onClick={handle} disabled={saving} style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: saving ? 0.7 : 1 }}>{saving ? "Archiving..." : "Archive"}</button>
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
          <button onClick={handle} disabled={deleting} style={{ background: "#FF6B6B", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, color: "#fff", cursor: deleting ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: deleting ? 0.7 : 1 }}>{deleting ? "Deleting..." : "Delete permanently"}</button>
        </div>
      </div>
    </>
  )
}

// --- Registration tables ---

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
          <button type="button" onClick={handleSave} disabled={saving} style={{ padding: "0.5rem 1.25rem", borderRadius: 100, border: "none", background: saving ? "rgba(200,245,90,0.4)" : "#C8F55A", color: "#0A0A0A", cursor: saving ? "default" : "pointer", fontSize: "0.875rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>{saving ? "Saving..." : "Save changes"}</button>
        </div>
      </div>
    </div>
  )
}

function RegTable({
  rows, questions, showPosition = false, emptyText, token, onRemove, slug, registrationStatus = 'confirmed',
}: {
  rows: Registration[]
  questions: Question[]
  showPosition?: boolean
  emptyText: string
  token: string
  onRemove: (id: string) => void
  slug: string
  registrationStatus?: string
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
            <th style={thStyle}>View</th>
            <th style={thStyle}>Remove</th>
          </tr>
        </thead>
        <tbody>
          {rowData.length === 0 ? (
            <tr>
              <td colSpan={labels.length + (showPosition ? 4 : 3)} style={{ padding: "2rem", textAlign: "center", fontSize: "0.85rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
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
                <td style={{ ...tdStyle, width: 60 }}>
                  <Link
                    href={`/dashboard/events/${slug}/registrations/${reg.id}${registrationStatus !== 'confirmed' ? `?from=${registrationStatus}` : ''}`}
                    style={{ fontSize: "0.72rem", color: "#C8F55A", textDecoration: "none", whiteSpace: "nowrap", fontFamily: "var(--font-dm-sans)" }}
                    onClick={e => e.stopPropagation()}
                  >
                    View
                  </Link>
                </td>
                <td style={{ ...tdStyle, width: 120 }}>
                  {confirmingId === reg.id ? (
                    <span style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                      <button
                        onClick={() => handleRemove(reg.id)}
                        disabled={removingId === reg.id}
                        style={{ background: "#FF6B6B", border: "none", borderRadius: 6, padding: "3px 8px", fontSize: "0.72rem", fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "var(--font-dm-sans)", opacity: removingId === reg.id ? 0.6 : 1 }}
                      >
                        {removingId === reg.id ? "..." : "Yes"}
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

// --- Settings tab ---

function SettingsTab({ event, hasRegistrations, onSaved }: { event: EventData; hasRegistrations: boolean; onSaved: (updates: Partial<EventData>) => void }) {
  const [description, setDescription] = useState(event.description ?? "")
  const [eventDate, setEventDate] = useState(toDatetimeLocal(event.eventDate))
  const [eventEndAt, setEventEndAt] = useState(toDatetimeLocal(event.eventEndAt))
  const [joinOpensAt, setJoinOpensAt] = useState(toDatetimeLocal(event.joinOpensAt))
  const [location, setLocation] = useState(event.location ?? "")
  const [communityLink, setCommunityLink] = useState(event.communityLink ?? "")
  const [whatsappNumber, setWhatsappNumber] = useState(event.whatsappNumber ?? "")
  const [contactMode, setContactMode] = useState<"WHATSAPP" | "CALL">(event.contactMode ?? "WHATSAPP")
  const [deadline, setDeadline] = useState(toDatetimeLocal(event.deadline))
  const [ticketTiers, setTicketTiers] = useState(event.ticketTiers ?? [])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setDescription(event.description ?? "")
    setEventDate(toDatetimeLocal(event.eventDate))
    setEventEndAt(toDatetimeLocal(event.eventEndAt))
    setJoinOpensAt(toDatetimeLocal(event.joinOpensAt))
    setLocation(event.location ?? "")
    setCommunityLink(event.communityLink ?? "")
    setWhatsappNumber(event.whatsappNumber ?? "")
    setContactMode(event.contactMode ?? "WHATSAPP")
    setDeadline(toDatetimeLocal(event.deadline))
    setTicketTiers(event.ticketTiers ?? [])
  }, [event.description, event.eventDate, event.eventEndAt, event.joinOpensAt, event.location, event.communityLink, event.whatsappNumber, event.contactMode, event.deadline, event.ticketTiers])

  const handleSave = async () => {
    setSaving(true)
    setError("")
    setSaved(false)
    const normalizedCommunityLink = normalizeCommunityLink(communityLink)
    const payload = {
      description: description || null,
      eventDate: toIsoFromDatetimeLocal(eventDate),
      eventEndAt: toIsoFromDatetimeLocal(eventEndAt),
      joinOpensAt: toIsoFromDatetimeLocal(joinOpensAt),
      location: location || null,
      communityLink: normalizedCommunityLink,
      whatsappNumber: whatsappNumber || null,
      contactMode,
      deadline: toIsoFromDatetimeLocal(deadline),
    }
    try {
      const res = await fetch(`/api/events/${event.slug}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (res.ok) {
        setSaved(true)
        onSaved(data.event ?? payload)
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

  const saveTicketTiers = async () => {
    setSaving(true)
    setError("")
    setSaved(false)
    try {
      const res = await fetch(`/api/events/${event.slug}/ticket-tiers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketTiers: ticketTiers.map((tier) => ({
            id: tier.id.startsWith("new-") ? undefined : tier.id,
            name: tier.name,
            priceKes: Number(tier.priceKes),
            capacity: Number(tier.capacity),
            description: tier.description ?? null,
            bundleSize: Number(tier.bundleSize ?? 1),
          })),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setTicketTiers(data.ticketTiers ?? [])
        onSaved({
          ticketTiers: data.ticketTiers ?? [],
          capacity: (data.ticketTiers ?? []).reduce((sum: number, tier: { capacity: number }) => sum + tier.capacity, 0),
        })
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(data.error || "Failed to save ticket tiers.")
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
            placeholder="Tell attendees what this event is about..."
            style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6 }}
          />
        </div>

        {/* Date / Location row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={fieldLabel}>Event start</label>
            <input type="datetime-local" value={eventDate} onChange={e => setEventDate(e.target.value)} style={inputStyle} className="dt-input" />
          </div>
          <div>
            <label style={fieldLabel}>Location</label>
            <input type="text" value={location} onChange={e => setLocation(e.target.value)} placeholder="Venue or city" style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={fieldLabel}>Event end</label>
          <input type="datetime-local" value={eventEndAt} onChange={e => setEventEndAt(e.target.value)} style={{ ...inputStyle, maxWidth: 320 }} className="dt-input" />
          <p style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
            If the deadline is empty, registrations close when this event end time is reached.
          </p>
        </div>

        <div>
          <label style={fieldLabel}>Link opens at (optional)</label>
          <input type="datetime-local" value={joinOpensAt} onChange={e => setJoinOpensAt(e.target.value)} style={{ ...inputStyle, maxWidth: 320 }} className="dt-input" />
          <p style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
            If left empty, attendee join access opens 30 minutes before the event start.
          </p>
        </div>

        {/* Deadline */}
        <div>
          <label style={fieldLabel}>Registration deadline (optional)</label>
          <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} style={{ ...inputStyle, maxWidth: 280 }} className="dt-input" />
          <p style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
            Leave this empty if people should keep registering until the event ends.
          </p>
        </div>

        {/* Community link */}
        <div>
          <label style={fieldLabel}>Community link</label>
          <input type="url" value={communityLink} onChange={e => setCommunityLink(e.target.value)} placeholder="https://chat.whatsapp.com/..." style={inputStyle} />
          <p style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
            Sent to confirmed attendees automatically.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "1rem" }}>
          <div>
            <label style={fieldLabel}>Contact action</label>
            <select value={contactMode} onChange={e => setContactMode(e.target.value as "WHATSAPP" | "CALL")} style={inputStyle}>
              <option value="WHATSAPP">Text on WhatsApp</option>
              <option value="CALL">Call organiser</option>
            </select>
          </div>
          <div>
            <label style={fieldLabel}>Organizer contact number</label>
            <input
              type="tel"
              value={whatsappNumber}
              onChange={e => setWhatsappNumber(e.target.value)}
              placeholder="+254712345678"
              style={inputStyle}
            />
            <p style={{ marginTop: "0.4rem", fontSize: "0.75rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
              Must include country code. {contactMode === "WHATSAPP" ? "Attendees will open WhatsApp with a prefilled message." : "Attendees will copy the number and open their phone dialer."}
            </p>
          </div>
        </div>

        {event.isPaid && (
          <div style={{ borderTop: "0.5px solid rgba(240,237,230,0.08)", paddingTop: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
              <label style={fieldLabel}>Ticket tiers</label>
              <button
                type="button"
                onClick={() => setTicketTiers((current) => [
                  ...current,
                  {
                    id: `new-${Date.now()}-${current.length}`,
                    name: "",
                    priceKes: 500,
                    capacity: 1,
                    description: null,
                    bundleSize: 1,
                    sortOrder: current.length,
                    soldCount: 0,
                    waitlistCount: 0,
                    status: "ACTIVE",
                  },
                ])}
                style={{ background: "transparent", border: "0.5px solid rgba(255,184,77,0.25)", borderRadius: 999, padding: "0.35rem 0.75rem", color: "#FFB84D", fontSize: "0.75rem", fontFamily: "var(--font-dm-sans)" }}
              >
                + Add tier
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              {ticketTiers.map((tier) => (
                <div key={tier.id} style={{ border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "0.85rem", background: "#141414" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 0.8fr", gap: "0.75rem" }}>
                    <input value={tier.name} onChange={e => setTicketTiers(items => items.map(item => item.id === tier.id ? { ...item, name: e.target.value } : item))} placeholder="Tier name" style={inputStyle} />
                    <input type="number" min="50" value={tier.priceKes} onChange={e => setTicketTiers(items => items.map(item => item.id === tier.id ? { ...item, priceKes: Number(e.target.value) } : item))} placeholder="Price" style={inputStyle} />
                    <input type="number" min="1" value={tier.capacity} onChange={e => setTicketTiers(items => items.map(item => item.id === tier.id ? { ...item, capacity: Number(e.target.value) } : item))} placeholder="Capacity" style={inputStyle} />
                  </div>
                  <textarea value={tier.description ?? ""} onChange={e => setTicketTiers(items => items.map(item => item.id === tier.id ? { ...item, description: e.target.value } : item))} placeholder="Optional tier description" rows={2} style={{ ...inputStyle, marginTop: "0.75rem", resize: "vertical" }} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.65rem" }}>
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
                      Sold: {tier.soldCount} - Waiting: {tier.waitlistCount}
                    </p>
                    <button type="button" onClick={() => setTicketTiers(items => items.filter(item => item.id !== tier.id))} style={{ background: "transparent", border: "none", color: "#FF6B6B", fontSize: "0.75rem", fontFamily: "var(--font-dm-sans)" }}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: "1rem" }}>
              <button
                type="button"
                onClick={saveTicketTiers}
                disabled={saving}
                style={{ background: "#FFB84D", border: "none", borderRadius: 8, padding: "0.6rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#0A0A0A", cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Saving tiers..." : "Save ticket tiers"}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p style={{ marginTop: "1rem", fontSize: "0.82rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{error}</p>}

      <div style={{ display: "flex", alignItems: "center", gap: "0.875rem", marginTop: "1.75rem" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.6rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, color: "#0A0A0A", cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        {saved && (
          <span style={{ fontSize: "0.82rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)" }}>
            Saved
          </span>
        )}
      </div>
    </div>
  )
}

// --- Manual Registration Modal ---

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

  React.useEffect(() => {
    if (results.length === 0) return
    const timer = window.setTimeout(() => onClose(), 2200)
    return () => window.clearTimeout(timer)
  }, [results, onClose])

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
                <span style={{ fontSize: "0.72rem", color: r.status === "confirmed" ? "#C8F55A" : "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", textTransform: "capitalize" }}>#{r.registrationNumber} - {r.status}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>Closing automatically...</span>
              <button onClick={onClose} style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>Done</button>
            </div>
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
            Event is at capacity - people will be added to the waitlist.
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
                      <option value="">Select...</option>
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
            {atCapacity && regStatus === 'confirmed' ? "Capacity full - will be added to waitlist." : "Confirmed adds directly to your attendee list. Capacity rules apply."}
          </p>
        </div>
        {error && <p style={{ fontSize: "0.78rem", color: "#FF6B6B", marginTop: "0.75rem", fontFamily: "var(--font-dm-sans)" }}>{error}</p>}
        <div style={{ display: "flex", gap: "0.625rem", marginTop: "1.5rem", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving} style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: saving ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: saving ? 0.7 : 1 }}>
            {saving ? "Registering..." : attendees.length > 1 ? `Register ${attendees.length} people` : "Add registration"}
          </button>
        </div>
      </div>
    </>
  )
}

// --- Page ---

export default function EventDashboardPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params?.slug as string
  const token = searchParams?.get("token") || ""
  const router = useRouter()
  const { data: session, status } = useSession()

  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [error, setError] = useState("")
  const [eventData, setEventData] = useState<EventData | null>(null)
  const [confirmed, setConfirmed] = useState<Registration[]>([])
  const [waitlist, setWaitlist] = useState<Registration[]>([])
  const [origin, setOrigin] = useState("")
  const [activeTab, setActiveTab] = useState<TabKey>("overview")
  const [copied, setCopied] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrGenerating, setQrGenerating] = useState(false)

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
  const [reportData, setReportData] = useState<ReportPreviewData | null>(null)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportLoadingText, setReportLoadingText] = useState('')
  const [reportProgress, setReportProgress] = useState(0)
  const [downloadingReport, setDownloadingReport] = useState(false)
  const [showReportPaymentModal, setShowReportPaymentModal] = useState(false)
  const [downloadBalance, setDownloadBalance] = useState<number | null>(null)
  const [reportCreditBalance, setReportCreditBalance] = useState(0)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [reportError, setReportError] = useState("")
  const [reportNotice, setReportNotice] = useState("")

  // Export downloads
  const [csvExporting, setCsvExporting] = useState(false)
  const [csvError, setCsvError] = useState("")

  // Analytics
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState("")
  const [walkInDashboard, setWalkInDashboard] = useState<WalkInDashboard | null>(null)
  const [walkInLoading, setWalkInLoading] = useState(false)
  const [walkInError, setWalkInError] = useState("")
  const [walkInExportFormat, setWalkInExportFormat] = useState<'csv' | 'xlsx'>('xlsx')

  // Recent registrations ticker (30s poll)
  const [recentRegs, setRecentRegs] = useState<{ id: string; name: string; submittedAt: string; status: string }[]>([])

  // AI Insights
  const [insightsData, setInsightsData] = useState<InsightCard[] | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState("")
  const [insightsLocked, setInsightsLocked] = useState(false)
  const [insightsRequiredCredits] = useState(20)
  const [insightsGeneratedAt, setInsightsGeneratedAt] = useState<string | null>(null)
  const [insightsUnlockLoading] = useState(false)

  // AI Q&A
  const [qaHistory, setQaHistory] = useState<QAItem[]>([])
  const [qaInput, setQaInput] = useState("")
  const [qaLoading, setQaLoading] = useState(false)
  const [qaLocked, setQaLocked] = useState(false)

  // Feedback
  const [feedbackData, setFeedbackData] = useState<FeedbackData | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)
  const [feedbackError, setFeedbackError] = useState("")

  // Team tab (per-event)
  const [eventTeam, setEventTeam] = useState<EventTeamMember[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [teamInviteEmails, setTeamInviteEmails] = useState(["", ""])
  const [teamInviting, setTeamInviting] = useState(false)
  const [teamInviteError, setTeamInviteError] = useState("")
  const [teamInviteSuccess, setTeamInviteSuccess] = useState("")
  const [teamInviteAcceptLinks, setTeamInviteAcceptLinks] = useState<{ email: string; acceptUrl: string }[]>([])
  const [removingTeamMember, setRemovingTeamMember] = useState<string | null>(null)
  const [resendingTeamMember, setResendingTeamMember] = useState<string | null>(null)
  const [resendTeamSuccessId, setResendTeamSuccessId] = useState<string | null>(null)
  const [resendTeamFailedUrls, setResendTeamFailedUrls] = useState<Record<string, string>>({})
  const [copiedTeamInviteKey, setCopiedTeamInviteKey] = useState<string | null>(null)
  const [shareFeedback, setShareFeedback] = useState("")

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const fetchDashboard = useCallback(async () => {
    if (!slug) return
    if (!token && status === "loading") return
    if (!token && status === "unauthenticated") {
      router.replace(`/${slug}`)
      return
    }

    setLoading(true)
    setAccessDenied(false)
    setError("")
    try {
      const url = `/api/events/${slug}${token ? `?token=${encodeURIComponent(token)}` : ""}`
      const res = await fetch(url)
      const data = await res.json()
      if (res.status === 401) {
        setAccessDenied(true)
        return
      }
      if (!res.ok || !data.success) { setError(data.error || "Unable to load dashboard"); return }
      setEventData(data.event)
      setConfirmed(data.confirmed)
      setWaitlist(data.waitlist)
    } catch {
      setError("Unable to load dashboard. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [slug, token, status, router])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  useEffect(() => {
    if (!eventData || eventData.accessType !== "WALK_IN") return
    if (activeTab === "confirmed" || activeTab === "waitlist" || activeTab === "feedback" || activeTab === "checkin") {
      setActiveTab("overview")
    }
  }, [activeTab, eventData])

  useEffect(() => {
    if (!eventData) return
    if (eventData.accessType !== "WALK_IN") {
      setWalkInDashboard(null)
      setWalkInError("")
      return
    }

    let cancelled = false
    let intervalId: number | null = null

    const stopPolling = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    const schedulePolling = (isActive: boolean) => {
      stopPolling()
      if (!isActive || document.visibilityState !== "visible") return
      intervalId = window.setInterval(() => {
        void run()
      }, 45_000)
    }

    const run = async () => {
      if (document.visibilityState !== "visible") return
      setWalkInLoading(true)
      setWalkInError("")
      try {
        const res = await fetch(`/api/walkin/${slug}/dashboard`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok || !data?.days) {
          setWalkInError(data.error || "Unable to load walk-in summary.")
          stopPolling()
          return
        }
        setWalkInDashboard(data)
        schedulePolling(data.status === "ACTIVE" && hasActiveWalkInDay(data))
      } catch {
        if (!cancelled) {
          setWalkInError("Unable to load walk-in summary.")
          stopPolling()
        }
      } finally {
        if (!cancelled) setWalkInLoading(false)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        stopPolling()
        return
      }
      void run()
    }

    const handleFocus = () => {
      void run()
    }

    void run()
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)

    return () => {
      cancelled = true
      stopPolling()
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
    }
  }, [eventData, slug])

  useEffect(() => {
    fetch('/api/user/credits').then(r => r.ok ? r.json() : null).then(d => { if (d?.balance !== undefined) setReportCreditBalance(d.balance) }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/me').then(r => r.ok ? r.json() : null).then(d => { if (d?.isAdmin) setIsSuperAdmin(true) }).catch(() => {})
  }, [session?.user?.id])

  const regLink = origin && eventData
    ? getPublicEventUrl(origin, eventData.slug, eventData.accessType === "WALK_IN" ? "WALK_IN" : "REGISTRATION")
    : ""

  const reportDescription = (() => {
    if (isSuperAdmin) return "Preview and download are free for super admins."
    if (reportData?.requiresSignIn) {
      return "Preview is free. Download requires a signed-in organiser or team member."
    }
    const downloadCount = reportData?.downloadCostDownloads ?? 1
    const priceLabel = reportData?.downloadPriceKsh ? ` (KSh ${reportData.downloadPriceKsh})` : ""
    return `Preview is free. Download uses ${downloadCount} paid report download${downloadCount === 1 ? "" : "s"}${priceLabel}.`
  })()

  const aiInsightsAccessNote = isSuperAdmin
    ? "Super admins can generate and regenerate AI insights freely."
    : "Standard plan and above can generate AI insights. The first insight for an event is free while your monthly quota lasts; regenerations use 20 credits."

  const handleCopy = async () => {
    if (!regLink) return
    try {
      await navigator.clipboard.writeText(regLink)
      setCopied(true)
      setShareFeedback(eventData?.accessType === "WALK_IN" ? "Check-in link copied." : "Registration link copied.")
      setTimeout(() => setCopied(false), 2000)
      setTimeout(() => setShareFeedback(""), 2500)
    } catch {
      setShareFeedback(eventData?.accessType === "WALK_IN" ? "Could not copy the check-in link." : "Could not copy the registration link.")
      setTimeout(() => setShareFeedback(""), 2500)
    }
  }

  const handleShare = async () => {
    if (!regLink || !eventData) return
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: eventData.title,
          text: eventData.accessType === "WALK_IN" ? `Check in for ${eventData.title}` : `Register for ${eventData.title}`,
          url: regLink,
        })
        setShareFeedback("Share sheet opened.")
        setTimeout(() => setShareFeedback(""), 2500)
        return
      } catch {
        // user cancelled or not supported - fall through to copy
      }
    }
    await handleCopy()
  }

  const handleGenerateQR = async () => {
    if (!eventData || !regLink) return
    setQrGenerating(true)
    try {
      const QRCode = (await import("qrcode")).default
      const dataUrl = await QRCode.toDataURL(regLink, {
        width: 300,
        margin: 2,
        color: { dark: "#0A0A0A", light: "#F0EDE6" },
        errorCorrectionLevel: "H",
      })
      setQrDataUrl(dataUrl)
      setShowQrModal(true)
    } finally {
      setQrGenerating(false)
    }
  }

  const handleDownloadQR = async () => {
    if (!eventData) return
    try {
      const qrUrl = `/api/events/${eventData.slug}/qr`
      const link = document.createElement("a")
      link.href = qrUrl
      link.download = `qr-${eventData.slug}.png`
      link.rel = "noopener"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch {
      window.location.assign(`/api/events/${eventData.slug}/qr`)
    }
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
      setCapacityMessage(`OK ${data.promoted} ${data.promoted === 1 ? "person" : "people"} moved from waitlist to confirmed`)
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

  const generateReportPreview = async () => {
    if (!eventData || reportLoading) return
    setReportError("")
    setReportNotice("")
    let progressIndex = 0
    setReportLoadingText(REPORT_PROGRESS_STEPS[0])
    setReportProgress(12)
    setReportLoading(true)
    const progressTimer = window.setInterval(() => {
      progressIndex = Math.min(progressIndex + 1, REPORT_PROGRESS_STEPS.length - 1)
      setReportLoadingText(REPORT_PROGRESS_STEPS[progressIndex])
      setReportProgress((prev) => Math.min(prev + 11, 92))
    }, 1100)

    try {
      const params = new URLSearchParams({
        mode: 'preview',
        token: token || eventData.dashboardToken,
      })
      const minWait = new Promise((resolve) => setTimeout(resolve, 3200))
      const resPromise = fetch(`/api/events/${slug}/report?${params.toString()}`)
      const [res] = await Promise.all([resPromise, minWait])
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        setReportError(data?.error || "Unable to prepare the report preview right now.")
        return
      }
      setReportProgress(100)
      setReportData(data)
      setIsSuperAdmin(Boolean(data.isSuperAdmin))
      setDownloadBalance(typeof data.downloadsRemaining === 'number' ? data.downloadsRemaining : 0)
      setReportNotice(typeof data.accessNote === "string" ? data.accessNote : "")
    } catch {
      setReportError("Unable to prepare the report preview right now.")
    } finally {
      window.clearInterval(progressTimer)
      setReportLoadingText('')
      setReportProgress(0)
      setReportLoading(false)
    }
  }

  const downloadReport = async () => {
    if (!eventData || downloadingReport) return
    setReportError("")
    setReportNotice("")

    if (!session?.user?.id) {
      const callbackUrl = typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : `/dashboard/events/${slug}`
      router.push(`/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`)
      return
    }

    setDownloadingReport(true)
    try {
      const params = new URLSearchParams({
        mode: 'download',
        token: token || eventData.dashboardToken,
      })
      const res = await fetch(`/api/events/${slug}/report?${params.toString()}`)

      if (res.status === 402) {
        const data = await res.json().catch(() => null)
        setReportError(data?.message || "You need more paid report downloads before this report can be downloaded.")
        setShowReportPaymentModal(true)
        return
      }

      if (res.status === 401) {
        const data = await res.json().catch(() => null)
        setReportError(data?.error || "Sign in again to download this report.")
        return
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setReportError(data?.error || "The report could not be downloaded right now.")
        return
      }

      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = getFilenameFromDisposition(res.headers.get("content-disposition"), `event-report-${slug}.docx`)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)

      setDownloadBalance((prev) => (prev !== null ? Math.max(0, prev - 1) : prev))
      setReportNotice("Report download started.")
    } catch {
      setReportError("The report could not be downloaded right now.")
    } finally {
      setDownloadingReport(false)
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

  const getFilenameFromDisposition = (disposition: string | null, fallback: string) => {
    if (!disposition) return fallback
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1].replace(/"/g, ""))
    const regularMatch = disposition.match(/filename="?([^";]+)"?/i)
    return regularMatch?.[1] ?? fallback
  }

  const downloadExportFile = async (url: string, fallbackFilename: string) => {
    setCsvExporting(true)
    setCsvError("")
    try {
      const res = await fetch(url)
      if (!res.ok) {
        const contentType = res.headers.get("content-type") ?? ""
        const data = contentType.includes("application/json") ? await res.json().catch(() => null) : null
        setCsvError(data?.error || "Export failed. Please try again.")
        return
      }

      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = getFilenameFromDisposition(res.headers.get("content-disposition"), fallbackFilename)
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(objectUrl)
    } catch {
      setCsvError("Unable to download export. Please try again.")
    } finally {
      setCsvExporting(false)
    }
  }

  const loadInsights = useCallback(async (force = false) => {
    if (!eventData || insightsLoading) return
    setInsightsLoading(true)
    setInsightsError("")
    try {
      const params = new URLSearchParams()
      if (token) params.set('token', token)
      if (force) params.set('force', 'true')
      const qs = params.toString() ? `?${params.toString()}` : ''
      const res = await fetch(`/api/events/${slug}/insights${qs}`)
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 402 && data.insufficientCredits) {
          setInsightsLocked(true)
        }
        setInsightsError(data.error || 'Unable to load AI insights. Please retry.')
        return
      }
      if (!Array.isArray(data.cards) || data.cards.length === 0) {
        setInsightsData(null)
        setInsightsError('No insight cards returned. Please regenerate.')
        return
      }
      setInsightsData(data.cards)
      setInsightsGeneratedAt(data.generatedAt ?? null)
      setInsightsLocked(false)
      if (analyticsData && typeof data.aiInsightsFreeUsed === 'boolean') {
        setAnalyticsData({ ...analyticsData, aiInsightsFreeUsed: data.aiInsightsFreeUsed })
      }
      if (typeof data.message === 'string' && data.message.trim().length > 0) {
        setInsightsError(data.message)
      }
    } catch {
      setInsightsError('AI insights are currently unavailable due to a network issue. Please retry.')
    }
    finally { setInsightsLoading(false) }
  }, [eventData, insightsLoading, token, slug, analyticsData])

  const loadAnalytics = useCallback(async () => {
    if (!eventData || analyticsLoading) return
    setAnalyticsLoading(true)
    setAnalyticsError("")
    try {
      const res = await fetch(`/api/events/${slug}/analytics${token ? `?token=${encodeURIComponent(token)}` : ""}`)
      const data = await res.json()
      if (!res.ok) {
        setAnalyticsError(data.error || "Failed to load analytics")
        return
      }
      setAnalyticsData(data)
      if (eventData.accessType !== "WALK_IN") {
        loadInsights()
      }
    } catch {
      setAnalyticsError("Unable to load analytics.")
    } finally {
      setAnalyticsLoading(false)
    }
  }, [analyticsLoading, eventData, loadInsights, slug, token])

  useEffect(() => {
    if (activeTab !== "analytics") return
    if (!eventData || analyticsData || analyticsLoading) return

    let cancelled = false
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 8000)
    const autoLoadAnalytics = async () => {
      setAnalyticsLoading(true)
      setAnalyticsError("")
      try {
        const res = await fetch(`/api/events/${slug}/analytics${token ? `?token=${encodeURIComponent(token)}` : ""}`, {
          signal: controller.signal,
        })
        const data = await res.json()
        if (!res.ok) {
          if (!cancelled) setAnalyticsError(data.error || "Failed to load analytics")
          return
        }
        if (!cancelled) {
          setAnalyticsData(data)
          if (eventData.accessType !== "WALK_IN") {
            loadInsights()
          }
        }
      } catch (error) {
        if (!cancelled) {
          const isAbort = error instanceof DOMException && error.name === "AbortError"
          setAnalyticsError(
            isAbort
              ? "Analytics is taking too long to load right now. Please retry in a moment."
              : "Unable to load analytics."
          )
        }
      } finally {
        window.clearTimeout(timeoutId)
        if (!cancelled) setAnalyticsLoading(false)
      }
    }

    void autoLoadAnalytics()
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      controller.abort()
    }
  }, [activeTab, eventData, analyticsData, analyticsLoading, slug, token, loadInsights])

  // Recent registrations polling (30s, only when on overview tab)
  useEffect(() => {
    if (!slug) return
    const tokenParam = token ? `?token=${encodeURIComponent(token)}` : ''
    const load = () =>
      fetch(`/api/events/${slug}/recent-registrations${tokenParam}`)
        .then(r => r.json())
        .then(d => { if (d.recent) setRecentRegs(d.recent) })
        .catch(() => {/* ignore */ })
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [slug, token])

  // -- Renders ---

  if (accessDenied) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "3rem 0" }}>
        <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 16, padding: "2.5rem", textAlign: "center" }}>
          <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.5rem", color: "#F0EDE6", marginBottom: "0.75rem" }}>Access denied</h1>
          <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)" }}>Invalid or missing access credentials.</p>
          <Link href="/dashboard/events" style={{ display: "inline-block", marginTop: "1.5rem", color: "#C8F55A", fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)", textDecoration: "none" }}>Back to My Events</Link>
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

  const isWalkInEvent = eventData.accessType === "WALK_IN"
  const isFreePlan = (eventData.organizerPlan ?? "free").toLowerCase() === "free"
  const capacityDisplay = eventData.capacity === null ? "Unlimited" : eventData.capacity
  const slotsRemaining = eventData.capacity === null ? "Unlimited" : Math.max(0, eventData.capacity - eventData.confirmedCount)
  const hasRegistrations = confirmed.length + waitlist.length > 0
  const invalidTeamInviteEntries = teamInviteEmails
    .map((email, index) => ({ email: email.trim(), index }))
    .filter(({ email }) => email.length > 0 && !isValidEmailAddress(email))
  const tabs: { key: TabKey; label: string }[] = isWalkInEvent
    ? [
        { key: "overview", label: "Overview" },
        { key: "analytics", label: "Analytics" },
        ...(eventData.canEdit ? [{ key: "settings" as TabKey, label: "Settings" }] : []),
        ...(eventData.canEdit ? [{ key: "team" as TabKey, label: "Team" }] : []),
      ]
    : [
        { key: "overview", label: "Overview" },
        { key: "confirmed", label: `Confirmed (${confirmed.length})` },
        { key: "waitlist", label: `Waitlist (${waitlist.length})` },
        { key: "analytics", label: "Analytics" },
        { key: "feedback", label: "Feedback" },
        { key: "checkin" as TabKey, label: "Verify Ticket" },
        ...(eventData.canEdit ? [{ key: "settings" as TabKey, label: "Settings" }] : []),
        ...(eventData.canEdit ? [{ key: "team" as TabKey, label: "Team" }] : []),
      ]

  const loadEventTeam = async () => {
    if (!eventData?.canEdit) return
    setTeamLoading(true)
    try {
      const res = await fetch(`/api/events/${slug}/team`)
      const data = await res.json()
      if (res.ok) setEventTeam(data.members ?? [])
    } finally {
      setTeamLoading(false)
    }
  }

  const copyTeamInviteLink = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedTeamInviteKey(key)
      window.setTimeout(() => setCopiedTeamInviteKey((current) => (current === key ? null : current)), 2500)
    } catch {
      setTeamInviteError("Couldn't copy the invite link. Please copy it manually.")
    }
  }

  const handleTeamInvite = async () => {
    const emails = teamInviteEmails.map(e => e.trim().toLowerCase()).filter(Boolean)
    if (emails.length === 0) return
    const invalidEmails = emails.filter(email => !isValidEmailAddress(email))
    if (invalidEmails.length > 0) {
      setTeamInviteError(`Enter a valid email address for ${invalidEmails.join(", ")}.`)
      return
    }
    const uniqueEmails = [...new Set(emails)]
    if (uniqueEmails.length !== emails.length) {
      setTeamInviteError("Each invite email must be unique.")
      return
    }
    setTeamInviting(true)
    setTeamInviteError("")
    setTeamInviteSuccess("")
    setTeamInviteAcceptLinks([])
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: uniqueEmails, eventId: eventData?.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTeamInviteError(data.error || 'Failed to send invites')
        return
      }
      setTeamInviteEmails(["", ""])
      const results = (data.results ?? []) as Array<{ ok: boolean; email: string; emailFailed?: boolean; acceptUrl?: string; error?: string }>
      if (data.emailFailed) {
        // DB records created but email delivery failed - surface the accept links
        const failureReason = results.find(r => r.emailFailed && r.error)?.error
        setTeamInviteError(buildDomainVerificationHelp(failureReason))
        setTeamInviteAcceptLinks(
          results.filter(r => r.acceptUrl).map(r => ({ email: r.email, acceptUrl: r.acceptUrl! }))
        )
      } else {
        const sent = results.filter(r => r.ok && !r.emailFailed).length
        setTeamInviteSuccess(`Invite${sent !== 1 ? 's' : ''} sent to ${sent} email${sent !== 1 ? 's' : ''}.`)
      }
      await loadEventTeam()
    } finally {
      setTeamInviting(false)
    }
  }

  const handleResendTeamInvite = async (memberId: string) => {
    setResendingTeamMember(memberId)
    setResendTeamSuccessId(null)
    setTeamInviteError("")
    try {
      const res = await fetch("/api/team/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setTeamInviteError(data.error || "Failed to resend invite.")
        return
      }
      if (data.emailFailed && data.acceptUrl) {
        setResendTeamFailedUrls(prev => ({ ...prev, [memberId]: data.acceptUrl }))
        setTeamInviteError(buildDomainVerificationHelp("eventsslot.com domain is not verified"))
        return
      }
      setResendTeamFailedUrls(prev => {
        const next = { ...prev }
        delete next[memberId]
        return next
      })
      setResendTeamSuccessId(memberId)
      window.setTimeout(() => setResendTeamSuccessId(current => current === memberId ? null : current), 3000)
    } finally {
      setResendingTeamMember(null)
    }
  }

  const handleRemoveTeamMember = async (memberId: string) => {
    setRemovingTeamMember(memberId)
    try {
      await fetch(`/api/events/${slug}/team?memberId=${encodeURIComponent(memberId)}`, { method: 'DELETE' })
      setEventTeam(prev => prev.filter(m => m.teamMemberId !== memberId))
    } finally {
      setRemovingTeamMember(null)
    }
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

  const loadFeedback = async () => {
    if (!eventData || feedbackLoading) return
    setFeedbackLoading(true)
    setFeedbackError("")
    try {
      const res = await fetch(`/api/events/${slug}/feedback${token ? `?token=${encodeURIComponent(token)}` : ""}`)
      const data = await res.json()
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

      {showReportPaymentModal && (
        <ReportDownloadModal
          currentBalance={reportCreditBalance}
          onClose={() => setShowReportPaymentModal(false)}
        />
      )}

      {showQrModal && qrDataUrl && (
        <div
          onClick={() => setShowQrModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#141414",
              border: "0.5px solid rgba(240,237,230,0.1)",
              borderRadius: "16px",
              padding: "2rem",
              maxWidth: "360px",
              width: "100%",
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6", margin: 0 }}>
                Event QR Code
              </h3>
              <button
                onClick={() => setShowQrModal(false)}
                style={{ background: "none", border: "none", color: "rgba(240,237,230,0.4)", fontSize: "1.2rem", cursor: "pointer" }}
              >
                X
              </button>
            </div>

            <div
              style={{
                background: "#F0EDE6",
                borderRadius: "12px",
                padding: "1rem",
                marginBottom: "1rem",
                display: "inline-block",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Event QR Code" style={{ width: "220px", height: "220px", display: "block" }} />
            </div>

            <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.55)", marginBottom: "1.25rem", fontFamily: "var(--font-dm-sans)" }}>
                {eventData.accessType === "WALK_IN" ? "Scan to check in for " : "Scan to register for "}<strong style={{ color: "#F0EDE6" }}>{eventData.title}</strong>
            </p>

            <p style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.35)", marginBottom: "1.25rem", lineHeight: "1.55", fontFamily: "var(--font-dm-sans)" }}>
              Add this QR code to your poster, flyer, or WhatsApp image. Attendees scan it to open the registration form directly.
            </p>

            <button
              onClick={handleDownloadQR}
              style={{
                background: "#C8F55A",
                color: "#0A0A0A",
                border: "none",
                borderRadius: "100px",
                padding: "0.7rem 1.8rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                width: "100%",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              Download High-Res PNG
            </button>

            <p style={{ fontSize: "0.7rem", color: "rgba(240,237,230,0.25)", marginTop: "0.75rem", fontFamily: "var(--font-dm-sans)" }}>
              1024x1024px - Print-ready resolution
            </p>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* -- Back breadcrumb --- */}
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

        {/* -- Cover image --- */}
        {eventData.imageUrl && (
          <div className="md:hidden" style={{ width: '100%', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.25rem', backgroundColor: '#0A0A0A', lineHeight: 0, minHeight: 220 }}>
            <EventImageWithFallback
              src={eventData.imageUrl}
              alt={eventData.title}
              width={1200}
              height={630}
              objectFit="contain"
              objectPosition="center top"
              borderRadius={10}
              fallbackText="Event poster could not be loaded"
              containerStyle={{ minHeight: 220 }}
            />
          </div>
        )}

        {/* -- Event header --- */}
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
                {eventData.canEdit && (
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
                )}
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
                  setActiveTab('overview')
                  void generateReportPreview()
                }}
                disabled={reportLoading}
                title="Generate report preview"
                style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.375rem 0.75rem", fontSize: "0.75rem", fontWeight: 500, color: reportLoading ? "rgba(240,237,230,0.3)" : "rgba(240,237,230,0.5)", cursor: reportLoading ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", display: "flex", alignItems: "center", gap: "0.35rem", whiteSpace: "nowrap" }}
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v8M5 7l3 3 3-3" />
                  <path d="M2 12h12" />
                </svg>
                {reportLoading ? "Generating..." : reportData ? "Report Ready" : "Generate Report"}
              </button>
              {eventData.canEdit && (
                <HeaderMenu
                  onEdit={() => router.push(`/edit/${slug}`)}
                  onRename={() => setModal("rename")}
                  onArchive={() => setModal("archive")}
                  onDelete={() => setModal("delete")}
                  onClose={handleClose}
                  archived={isEventArchived(eventData)}
                  closed={isEventClosed(eventData)}
                />
              )}
            </div>
          </div>

          <EventExpiryBanner
            expiresAt={eventData.expiresAt ? new Date(eventData.expiresAt) : null}
            plan={eventData.organizerPlan}
          />

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
            {shareFeedback && (
              <span style={{ fontSize: "0.75rem", color: shareFeedback.includes("Could not") ? "#FF6B6B" : "rgba(200,245,90,0.85)", fontFamily: "var(--font-dm-sans)" }}>
                {shareFeedback}
              </span>
            )}
            <button
              onClick={() => void handleGenerateQR()}
              disabled={qrGenerating}
              style={{
                background: "transparent",
                border: "0.5px solid rgba(240,237,230,0.15)",
                borderRadius: "100px",
                padding: "0.5rem 1rem",
                color: "rgba(240,237,230,0.6)",
                fontSize: "0.82rem",
                cursor: qrGenerating ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontFamily: "var(--font-dm-sans)",
                whiteSpace: "nowrap",
                opacity: qrGenerating ? 0.6 : 1,
              }}
            >
              QR {qrGenerating ? "Generating..." : "QR Code"}
            </button>
          </div>
        </div>

        {/* -- Tabs --- */}
        <div style={{ display: "flex", borderBottom: "0.5px solid rgba(240,237,230,0.08)", marginBottom: "2rem", overflowX: "auto" }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key)
                if (tab.key === "team" && eventTeam.length === 0) void loadEventTeam()
              }}
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
          {/* Email Attendees - navigates to the dedicated email campaigns page */}
          {!isWalkInEvent && (
            <Link
              href={`/dashboard/events/${slug}/emails`}
              style={{
                background: "transparent",
                border: "none",
                borderBottom: "2px solid transparent",
                padding: "0.6rem 1.1rem",
                fontSize: "0.875rem",
                fontFamily: "var(--font-dm-sans)",
                color: "rgba(240,237,230,0.4)",
                whiteSpace: "nowrap",
                marginBottom: "-0.5px",
                flexShrink: 0,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/>
              </svg>
              Email Attendees
            </Link>
          )}
        </div>

        {/* -- Tab: Overview --- */}
        {activeTab === "overview" && isWalkInEvent && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                <div>
                  <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.45rem", fontWeight: 400, color: "#F0EDE6", margin: 0 }}>
                    {eventData.title}
                  </h2>
                  <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)" }}>
                    {walkInDashboardHeaderLabel(walkInDashboard)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleGenerateQR()}
                  disabled={qrGenerating}
                  style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.55rem 1rem", fontSize: "0.82rem", fontWeight: 700, color: "#0A0A0A", cursor: qrGenerating ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: qrGenerating ? 0.65 : 1 }}
                >
                  {qrGenerating ? "Generating..." : "QR Code"}
                </button>
              </div>

              {walkInDashboard?.status === "ACTIVE" && (
                <div style={{ marginBottom: "1rem", background: "rgba(200,245,90,0.08)", border: "0.5px solid rgba(200,245,90,0.18)", borderRadius: 10, padding: "0.9rem 1rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)" }}>
                      Live
                    </p>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.92rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>
                      {walkInDashboard.days.find((day) => day.status === "ACTIVE")?.count.toLocaleString() ?? "0"} check-ins today
                    </p>
                  </div>
                  <div style={{ fontSize: "1.35rem", fontWeight: 700, color: "#C8F55A", fontFamily: "var(--font-instrument-serif)" }}>
                    {(walkInDashboard.days.find((day) => day.status === "ACTIVE")?.count ?? 0).toLocaleString()}
                  </div>
                </div>
              )}

              {walkInDashboard?.status === "ENDED" && (
                <div style={{ marginBottom: "1rem", background: "rgba(255,168,0,0.08)", border: "0.5px solid rgba(255,168,0,0.2)", borderRadius: 10, padding: "0.9rem 1rem" }}>
                  <p style={{ margin: 0, fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)" }}>
                    Completed
                  </p>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.92rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>
                    {(walkInDashboard.totalCheckins ?? 0).toLocaleString()} total check-ins across all days
                  </p>
                </div>
              )}

              {walkInError && (
                <p style={{ fontSize: "0.82rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)", margin: "0 0 1rem" }}>
                  {walkInError}
                </p>
              )}

              <div style={{ overflowX: "auto", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
                  <thead>
                    <tr style={{ background: "rgba(240,237,230,0.04)" }}>
                      {["Day", "Check-ins", "Peak Hour", "Status"].map((heading) => (
                        <th key={heading} style={{ padding: "0.75rem 0.9rem", textAlign: "left", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", borderBottom: "0.5px solid rgba(240,237,230,0.08)" }}>
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {walkInLoading && !walkInDashboard ? (
                      <tr>
                        <td colSpan={4} style={{ padding: "1rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", fontSize: "0.84rem" }}>
                          Loading walk-in dashboard...
                        </td>
                      </tr>
                    ) : (walkInDashboard?.days ?? []).map((day) => (
                      <tr key={day.date}>
                        <td style={{ padding: "0.8rem 0.9rem", borderBottom: "0.5px solid rgba(240,237,230,0.06)", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontSize: "0.88rem" }}>
                          Day {day.dayNumber} ({day.label.split(",")[0]})
                        </td>
                        <td style={{ padding: "0.8rem 0.9rem", borderBottom: "0.5px solid rgba(240,237,230,0.06)", color: day.status === "UPCOMING" ? "rgba(240,237,230,0.35)" : "#C8F55A", fontFamily: "var(--font-dm-sans)", fontSize: "0.88rem", fontWeight: 700 }}>
                          {day.status === "UPCOMING" && day.count === 0 ? "-" : day.count.toLocaleString()}{day.status === "ACTIVE" ? " (Live)" : ""}
                        </td>
                        <td style={{ padding: "0.8rem 0.9rem", borderBottom: "0.5px solid rgba(240,237,230,0.06)", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", fontSize: "0.88rem" }}>
                          -
                        </td>
                        <td style={{ padding: "0.8rem 0.9rem", borderBottom: "0.5px solid rgba(240,237,230,0.06)", color: day.status === "ACTIVE" ? "#C8F55A" : "rgba(240,237,230,0.6)", fontFamily: "var(--font-dm-sans)", fontSize: "0.88rem" }}>
                          {day.status === "CLOSED" ? "Closed" : day.status === "ACTIVE" ? "Active" : "Upcoming"}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ padding: "0.9rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", fontWeight: 700 }}>Total</td>
                      <td style={{ padding: "0.9rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)", fontWeight: 800 }}>
                        {(walkInDashboard?.totalCheckins ?? 0).toLocaleString()}
                      </td>
                      <td />
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", marginTop: "1.25rem", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleDownloadQR}
                  style={{ background: "transparent", border: "0.5px solid rgba(200,245,90,0.35)", borderRadius: 8, padding: "0.6rem 1rem", fontSize: "0.82rem", color: "#C8F55A", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                >
                  Download QR Code
                </button>
                {isFreePlan ? (
                  <button
                    type="button"
                    onClick={() => setShowReportPaymentModal(true)}
                    style={{ background: "transparent", border: "0.5px solid rgba(124,198,255,0.22)", borderRadius: 8, padding: "0.6rem 1rem", fontSize: "0.82rem", color: "#7CC6FF", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                  >
                    Export Attendance Data (Locked)
                  </button>
                ) : (
                  <>
                    <select
                      value={walkInExportFormat}
                      onChange={(e) => setWalkInExportFormat(e.target.value === "xlsx" ? "xlsx" : "csv")}
                      style={{ background: "#0A0A0A", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.48rem 0.6rem", color: "rgba(240,237,230,0.7)", fontSize: "0.78rem", fontFamily: "var(--font-dm-sans)" }}
                    >
                      <option value="xlsx">XLSX</option>
                      <option value="csv">CSV</option>
                    </select>
                    <a
                      href={`/api/walkin/${slug}/export?format=${walkInExportFormat}`}
                      style={{ background: "transparent", border: "0.5px solid rgba(124,198,255,0.22)", borderRadius: 8, padding: "0.6rem 1rem", fontSize: "0.82rem", color: "#7CC6FF", textDecoration: "none", fontFamily: "var(--font-dm-sans)" }}
                    >
                      Export Attendance Data
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
        )}        {activeTab === "overview" && !isWalkInEvent && (
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

            {/* Register someone + Email Attendees buttons */}
            <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>

            {/* Google Calendar sync status */}
            {eventData.calendarSynced ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)", background: "rgba(200,245,90,0.08)", border: "0.5px solid rgba(200,245,90,0.2)", borderRadius: 100, padding: "0.3rem 0.75rem" }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="5" cy="5" r="4" stroke="#C8F55A" strokeWidth="1.2"/><path d="M3 5l1.5 1.5L7 3.5" stroke="#C8F55A" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                In your Google Calendar
              </span>
            ) : eventData.googleCalendarConnected === false ? (
              <a href="/dashboard/profile#calendar" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", fontSize: "0.78rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", textDecoration: "none" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                Connect Google Calendar
              </a>
            ) : null}
            </div>

            {/* Register someone + Email Attendees action buttons */}
            <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
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
              <Link
                href={`/dashboard/events/${slug}/emails`}
                style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.55rem 1.1rem", fontSize: "0.82rem", fontWeight: 500, color: "rgba(240,237,230,0.6)", cursor: "pointer", fontFamily: "var(--font-dm-sans)", display: "inline-flex", alignItems: "center", gap: "0.4rem", textDecoration: "none" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/>
                </svg>
                Email Attendees
              </Link>
            </div>

            <TicketSettingsCard
              eventId={eventData.id}
              initialEnabled={eventData.ticketsEnabled}
              registrationCount={eventData.confirmedCount}
              onUpdated={(enabled) => {
                setEventData((prev) => (prev ? { ...prev, ticketsEnabled: enabled } : prev))
              }}
            />

            {/* Report preview + paid download */}
            <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "0.72rem", color: "#C8F55A", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)", marginBottom: "0.3rem" }}>
                    Event Report
                  </div>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)" }}>
                    {reportDescription}
                  </p>
                </div>
                {!reportData && (
                  <div style={{ minWidth: 280 }}>
                    <button
                      onClick={() => void generateReportPreview()}
                      disabled={reportLoading}
                      style={{
                        background: reportLoading ? "rgba(200,245,90,0.3)" : "#C8F55A",
                        color: "#0A0A0A",
                        border: "none",
                        borderRadius: "100px",
                        padding: "0.65rem 1.6rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        cursor: reportLoading ? "not-allowed" : "pointer",
                        fontFamily: "var(--font-dm-sans)",
                        width: '100%',
                      }}
                    >
                      {reportLoading ? reportLoadingText || 'Generating insights...' : 'Generate Report'}
                    </button>
                    {reportLoading && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ height: 6, borderRadius: 999, background: 'rgba(240,237,230,0.12)', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              width: `${reportProgress}%`,
                              background: 'linear-gradient(90deg, #7AB648 0%, #C8F55A 100%)',
                              transition: 'width 300ms ease',
                            }}
                          />
                        </div>
                        <p style={{ margin: '0.35rem 0 0', fontSize: '0.72rem', color: 'rgba(240,237,230,0.5)', fontFamily: 'var(--font-dm-sans)' }}>
                          {Math.max(reportProgress, 5)}% complete
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {reportData && (
                <div style={{
                  background: "#141414",
                  border: "0.5px solid rgba(240,237,230,0.08)",
                  borderRadius: "12px",
                  padding: "1.5rem",
                  marginTop: "1rem",
                }}>
                  <p style={{ marginTop: "0.9rem", marginBottom: 0, fontSize: "0.86rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.7 }}>
                    {reportData.message || 'Your professional report is ready.'}
                  </p>
                  {(reportNotice || reportData.accessNote) && (
                    <p style={{ marginTop: "0.75rem", marginBottom: 0, fontSize: "0.78rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
                      {reportNotice || reportData.accessNote}
                    </p>
                  )}
                  {reportError && (
                    <p style={{ marginTop: "0.75rem", marginBottom: 0, fontSize: "0.78rem", color: "#FFB3B3", fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
                      {reportError}
                    </p>
                  )}

                  <div style={{
                    borderTop: "0.5px solid rgba(240,237,230,0.08)",
                    paddingTop: "1rem",
                    marginTop: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}>
                    <div>
                      <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.45)", margin: 0, fontFamily: "var(--font-dm-sans)" }}>
                        {reportData.reportReady
                          ? 'Download the full report as a Word document.'
                          : 'Preparing your report document...'}
                      </p>
                      {!isSuperAdmin && (
                        <p style={{ fontSize: "0.75rem", color: "#C8F55A", marginTop: "0.2rem", marginBottom: 0, fontFamily: "var(--font-dm-sans)" }}>
                          {reportData.requiresSignIn
                            ? "Sign in first, then buy report downloads from billing to download this report."
                            : `Download pricing: ${reportData.downloadCostDownloads ?? 1} paid report download${(reportData.downloadCostDownloads ?? 1) === 1 ? "" : "s"}${reportData.downloadPriceKsh ? ` (KSh ${reportData.downloadPriceKsh})` : ""}`}
                        </p>
                      )}
                      {!isSuperAdmin && !reportData.requiresSignIn && downloadBalance !== null && (
                        <p style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.38)", marginTop: "0.24rem", marginBottom: 0, fontFamily: "var(--font-dm-sans)" }}>
                          Remaining paid report downloads on this account: {downloadBalance}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => void downloadReport()}
                      disabled={downloadingReport}
                      style={{
                        background: "#C8F55A",
                        color: "#0A0A0A",
                        border: "none",
                        borderRadius: "100px",
                        padding: "0.6rem 1.4rem",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        cursor: downloadingReport ? "not-allowed" : "pointer",
                        fontFamily: "var(--font-dm-sans)",
                        opacity: downloadingReport ? 0.6 : 1,
                      }}
                    >
                      {downloadingReport
                        ? 'Preparing...'
                        : reportData.requiresSignIn
                        ? 'Sign in to download'
                        : 'Download report (.docx)'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Capacity panel */}
            <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.5rem", marginBottom: "0.5rem" }}>
              <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.1rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 0.375rem" }}>
                Increase Capacity
              </h2>
              <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.125rem" }}>
                Increase the number of confirmed spots - waitlisted attendees are promoted automatically.
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
                  {updatingCapacity ? "Updating..." : "Update capacity"}
                </button>
              </div>
              {capacityMessage && <p style={{ marginTop: "0.75rem", fontSize: "0.82rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)" }}>{capacityMessage}</p>}
              {capacityError && <p style={{ marginTop: "0.75rem", fontSize: "0.82rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{capacityError}</p>}
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
                  {scanning ? "Scanning..." : "Run scan"}
                </button>
              </div>
              {scanError && <p style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{scanError}</p>}
              {dupGroups !== null && dupGroups.length === 0 && (
                <p style={{ marginTop: "0.75rem", fontSize: "0.82rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)" }}>No duplicates found</p>
              )}
              {dupGroups !== null && dupGroups.length > 0 && (
                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                  <div style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
                    Found <strong style={{ color: "rgba(240,237,230,0.6)" }}>{dupGroups.length}</strong> duplicate {dupGroups.length === 1 ? "group" : "groups"}
                  </div>
                  {dupGroups.map((group, gi) => (
                    <div key={gi} style={{ background: "rgba(255,168,0,0.05)", border: "0.5px solid rgba(255,168,0,0.2)", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ padding: "0.5rem 0.875rem", background: "rgba(255,168,0,0.08)", borderBottom: "0.5px solid rgba(255,168,0,0.15)", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,168,0,0.6)", fontFamily: "var(--font-dm-sans)" }}>
                        Group {gi + 1} - {group.length} identical submissions
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
                              <button onClick={() => removeDupReg(reg.id)} disabled={isRemoving} style={{ background: "transparent", border: "0.5px solid rgba(255,107,107,0.3)", borderRadius: 6, padding: "3px 10px", fontSize: "0.72rem", color: isRemoving ? "rgba(255,107,107,0.4)" : "rgba(255,107,107,0.7)", cursor: isRemoving ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)" }}>{isRemoving ? "..." : "Remove"}</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* M2 - Waitlist Intelligence */}
            {eventData.waitlistCount > 0 && (
              <div style={{ border: "0.5px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "1rem 1.25rem", background: "rgba(245,158,11,0.05)" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#F59E0B", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>Featured WAITLIST INTELLIGENCE</div>
                <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", margin: "0 0 0.375rem 0" }}>
                  {eventData.waitlistCount} {eventData.waitlistCount === 1 ? 'person is' : 'people are'} on the waitlist
                </p>
                <p style={{ fontSize: "0.8rem", color: "#A3A3A3", fontFamily: "var(--font-dm-sans)", margin: "0 0 0.875rem 0", lineHeight: 1.5 }}>
                  {eventData.capacity
                    ? `Increasing capacity by ${Math.min(eventData.waitlistCount, 10)} would automatically promote the next ${Math.min(eventData.waitlistCount, 10)} attendees.`
                    : 'You have unlimited capacity - all waitlisted attendees can be promoted.'}
                </p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    onClick={() => setActiveTab('settings')}
                    style={{ background: "#C8F55A", border: "none", borderRadius: 10, padding: "0.5rem 1rem", fontSize: "0.82rem", fontWeight: 700, color: "#0A0A0A", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                  >
                    Increase Capacity
                  </button>
                  <button
                    onClick={() => setActiveTab('waitlist')}
                    style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 10, padding: "0.5rem 1rem", fontSize: "0.82rem", color: "#A3A3A3", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                  >
                    View Waitlist
                  </button>
                </div>
              </div>
            )}

            {/* M3 - Recent Registrations Ticker */}
            {recentRegs.length > 0 && (
              <div style={{ border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1rem 1.25rem", background: "#141414" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#C8F55A", fontFamily: "var(--font-dm-sans)", marginBottom: "0.75rem" }}>Featured RECENT REGISTRATIONS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  {recentRegs.map((r) => (
                    <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(200,245,90,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: "#C8F55A", flexShrink: 0, fontFamily: "var(--font-dm-sans)" }}>
                          {r.name[0]?.toUpperCase() ?? '?'}
                        </div>
                        <span style={{ fontSize: "0.82rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>{r.name}</span>
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "#525252", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap" }}>
                        {formatDistanceToNow(new Date(r.submittedAt), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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

        {/* -- Tab: Confirmed --- */}
        {activeTab === "confirmed" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", gap: "0.75rem", flexWrap: "wrap" }}>
              <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6", margin: 0 }}>
                Confirmed registrations
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", flex: "1 1 320px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem", WebkitOverflowScrolling: "touch", scrollbarWidth: "thin" }}>
                <button
                  onClick={() => setShowManualReg(true)}
                  style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.35rem 0.75rem", fontSize: "0.75rem", color: "rgba(240,237,230,0.55)", cursor: "pointer", fontFamily: "var(--font-dm-sans)", display: "inline-flex", alignItems: "center", gap: "0.3rem", flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M5 1v8M1 5h8" />
                  </svg>
                  Add registrant
                </button>
                <a
                  href={`/api/events/${slug}/export?status=confirmed${token ? `&token=${encodeURIComponent(token)}` : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    void downloadExportFile(e.currentTarget.href, `eventslot-${slug}-confirmed.csv`)
                  }}
                  download
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", border: "0.5px solid rgba(200,245,90,0.2)", borderRadius: 8, padding: "0.35rem 0.7rem", textDecoration: "none", color: "rgba(200,245,90,0.7)", fontSize: "0.73rem", fontFamily: "var(--font-dm-sans)", flexShrink: 0, whiteSpace: "nowrap", pointerEvents: csvExporting ? "none" : "auto", opacity: csvExporting ? 0.55 : 1 }}
                >
                  Download Confirmed CSV
                </a>
                <a
                  href={`/api/events/${slug}/export/pdf?status=confirmed${token ? `&token=${encodeURIComponent(token)}` : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    void downloadExportFile(e.currentTarget.href, `eventslot-${slug}-confirmed-responses.pdf`)
                  }}
                  download
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.35rem 0.7rem", textDecoration: "none", color: "rgba(240,237,230,0.4)", fontSize: "0.73rem", fontFamily: "var(--font-dm-sans)", flexShrink: 0, whiteSpace: "nowrap", pointerEvents: csvExporting ? "none" : "auto", opacity: csvExporting ? 0.55 : 1 }}
                >
                  Download PDF (Individual responses)
                </a>
                <a
                  href={`/api/events/${slug}/export/pdf?status=all${token ? `&token=${encodeURIComponent(token)}` : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    void downloadExportFile(e.currentTarget.href, `eventslot-${slug}-all-responses.pdf`)
                  }}
                  download
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 8, padding: "0.35rem 0.7rem", textDecoration: "none", color: "rgba(240,237,230,0.35)", fontSize: "0.73rem", fontFamily: "var(--font-dm-sans)", flexShrink: 0, whiteSpace: "nowrap", pointerEvents: csvExporting ? "none" : "auto", opacity: csvExporting ? 0.55 : 1 }}
                >
                  Download All PDF (Individual responses)
                </a>
                <span style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.04em", background: "rgba(200,245,90,0.12)", color: "#C8F55A", borderRadius: 100, padding: "3px 10px", fontFamily: "var(--font-dm-sans)", flexShrink: 0, whiteSpace: "nowrap" }}>
                  {confirmed.length} confirmed
                </span>
                </div>
                <p style={{ margin: 0, fontSize: "0.7rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
                  {csvExporting ? "Preparing your export..." : "Swipe sideways on mobile to reveal the rest of the actions."}
                </p>
                {csvError && (
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "#FFB3B3", fontFamily: "var(--font-dm-sans)" }}>
                    {csvError}
                  </p>
                )}
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
                slug={slug}
                registrationStatus="confirmed"
                onRemove={id => {
                  setConfirmed(prev => prev.filter(r => r.id !== id))
                  setEventData(prev => prev ? { ...prev, confirmedCount: Math.max(0, prev.confirmedCount - 1) } : null)
                }}
              />
            )}
          </div>
        )}

        {/* -- Tab: Waitlist --- */}
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

            {/* -- Duplicate Scanner panel --- */}
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
                  {scanning ? "Scanning..." : "Run scan"}
                </button>
              </div>

              {scanError && (
                <p style={{ marginTop: "0.75rem", fontSize: "0.78rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{scanError}</p>
              )}

              {dupGroups !== null && dupGroups.length === 0 && (
                <p style={{ marginTop: "0.75rem", fontSize: "0.82rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)" }}>No duplicates found</p>
              )}

              {dupGroups !== null && dupGroups.length > 0 && (
                <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                  <div style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
                    Found <strong style={{ color: "rgba(240,237,230,0.6)" }}>{dupGroups.length}</strong> duplicate {dupGroups.length === 1 ? "group" : "groups"}
                  </div>
                  {dupGroups.map((group, gi) => (
                    <div key={gi} style={{ background: "rgba(255,168,0,0.05)", border: "0.5px solid rgba(255,168,0,0.2)", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ padding: "0.5rem 0.875rem", background: "rgba(255,168,0,0.08)", borderBottom: "0.5px solid rgba(255,168,0,0.15)", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,168,0,0.6)", fontFamily: "var(--font-dm-sans)" }}>
                        Group {gi + 1} - {group.length} identical submissions
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
                                {isRemoving ? "..." : "Remove"}
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
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <a
                  href={`/api/events/${slug}/export?status=waitlist${token ? `&token=${encodeURIComponent(token)}` : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    void downloadExportFile(e.currentTarget.href, `eventslot-${slug}-waitlist.csv`)
                  }}
                  download
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.35rem 0.7rem", textDecoration: "none", color: "rgba(240,237,230,0.4)", fontSize: "0.73rem", fontFamily: "var(--font-dm-sans)", pointerEvents: csvExporting ? "none" : "auto", opacity: csvExporting ? 0.55 : 1 }}
                >
                  Download Waitlisted CSV
                </a>
                <a
                  href={`/api/events/${slug}/export/pdf?status=waitlist${token ? `&token=${encodeURIComponent(token)}` : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    void downloadExportFile(e.currentTarget.href, `eventslot-${slug}-waitlist-responses.pdf`)
                  }}
                  download
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.35rem 0.7rem", textDecoration: "none", color: "rgba(240,237,230,0.4)", fontSize: "0.73rem", fontFamily: "var(--font-dm-sans)", pointerEvents: csvExporting ? "none" : "auto", opacity: csvExporting ? 0.55 : 1 }}
                >
                  Download Waitlisted PDF (Individual responses)
                </a>
                <span style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.04em", background: "rgba(240,237,230,0.06)", color: "rgba(240,237,230,0.4)", borderRadius: 100, padding: "3px 10px", fontFamily: "var(--font-dm-sans)" }}>
                  {waitlist.length} waiting
                </span>
              </div>
            </div>
            {csvError && (
              <p style={{ margin: "0 0 1rem", fontSize: "0.72rem", color: "#FFB3B3", fontFamily: "var(--font-dm-sans)" }}>
                {csvError}
              </p>
            )}
            <RegTable
              rows={waitlist}
              questions={eventData.questions}
              showPosition
              emptyText="Waitlist is empty"
              token={token || eventData.dashboardToken}
              slug={slug}
              registrationStatus="waitlist"
              onRemove={id => {
                setWaitlist(prev => prev.filter(r => r.id !== id))
                setEventData(prev => prev ? { ...prev, waitlistCount: Math.max(0, prev.waitlistCount - 1) } : null)
              }}
            />
          </div>
        )}

        {/* -- Tab: Analytics --- */}
        {activeTab === "analytics" && isWalkInEvent && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", gap: "0.75rem", flexWrap: "wrap" }}>
              <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6", margin: 0 }}>Walk-In Analytics</h2>
              {!analyticsData && !analyticsLoading && (
                <button
                  onClick={() => void loadAnalytics()}
                  style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.45rem 1.1rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                >
                  Load analytics
                </button>
              )}
            </div>

            {analyticsLoading && (
              <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
                Loading analytics...
              </p>
            )}

            {analyticsError && (
              <p style={{ fontSize: "0.875rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{analyticsError}</p>
            )}

            {analyticsData && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.75rem" }} className="stat-grid">
                  {[
                    { label: "Page Views", value: analyticsData.totalViews },
                    { label: "Total Check-Ins", value: analyticsData.totalRegistrations },
                    { label: "Today", value: analyticsData.walkInTodayCount ?? 0 },
                    { label: "Conversion", value: `${analyticsData.conversionRate}%` },
                  ].map((stat) => (
                    <div key={stat.label} style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "1.1rem 1.25rem" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>{stat.label}</div>
                      <div style={{ fontSize: "1.6rem", fontFamily: "var(--font-instrument-serif)", color: "#F0EDE6" }}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.25rem" }}>
                  <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.05rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 1rem" }}>
                    Check-Ins by Day
                  </h3>
                  <div style={{ width: "100%", height: 280 }}>
                    <ResponsiveContainer>
                      <BarChart data={analyticsData.registrationsByDay}>
                        <CartesianGrid stroke="rgba(240,237,230,0.08)" vertical={false} />
                        <XAxis dataKey="date" stroke="rgba(240,237,230,0.35)" tickLine={false} axisLine={false} />
                        <YAxis stroke="rgba(240,237,230,0.35)" tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#7CC6FF" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === "analytics" && !isWalkInEvent && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", gap: "0.75rem", flexWrap: "wrap" }}>
              <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6", margin: 0 }}>Event Analytics</h2>
              <a
                href={`/api/events/${slug}/analytics/export${token ? `?token=${encodeURIComponent(token)}` : ''}`}
                download
                style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 10, padding: "0.45rem 0.75rem", textDecoration: "none", color: "rgba(240,237,230,0.72)", fontSize: "0.8rem", fontFamily: "var(--font-dm-sans)" }}
              >
                <span>Download</span>
                Export CSV
              </a>
            </div>

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
                        <span style={{ fontSize: "0.65rem", color: "rgba(240,237,230,0.2)", fontFamily: "var(--font-dm-sans)" }}>- {new Date(insightsGeneratedAt).toLocaleDateString()}</span>
                      )}
                    </div>
                    {!insightsLoading && (
                      <button
                        onClick={() => loadInsights(true)}
                        style={{ background: "none", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 6, padding: "0.25rem 0.6rem", fontSize: "0.7rem", color: "rgba(240,237,230,0.4)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                      >
                        {analyticsData.aiInsightsFreeUsed
                          ? `Regenerate - ${insightsRequiredCredits} credits`
                          : "Generate AI Insights - Free"}
                      </button>
                    )}
                  </div>

                  <p style={{ margin: "0 0 0.85rem", fontSize: "0.74rem", color: "rgba(240,237,230,0.42)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
                    {aiInsightsAccessNote}
                  </p>

                  {insightsLocked && (
                    <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "1rem" }}>Locked</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "0.82rem", fontWeight: 500, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", margin: "0 0 0.15rem 0" }}>AI Insights - {insightsRequiredCredits} credits</p>
                        <p style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>Get 3 personalised insights about your event performance.</p>
                      </div>
                      {reportCreditBalance >= insightsRequiredCredits ? (
                        <button
                          onClick={() => loadInsights(true)}
                          disabled={insightsUnlockLoading}
                          style={{ background: "#C8F55A", color: "#0A0A0A", borderRadius: 6, padding: "0.35rem 0.85rem", fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", border: "none", cursor: insightsUnlockLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: insightsUnlockLoading ? 0.6 : 1 }}
                        >
                          {insightsUnlockLoading ? "Generating..." : `Regenerate (${insightsRequiredCredits} credits)`}
                        </button>
                      ) : (
                        <a href="/dashboard/billing#report-downloads" style={{ background: "#C8F55A", color: "#0A0A0A", borderRadius: 6, padding: "0.35rem 0.85rem", fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", textDecoration: "none", whiteSpace: "nowrap" }}>Buy report downloads</a>
                      )}
                    </div>
                  )}

                  {insightsLoading && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem" }} className="insight-grid">
                      {[1,2,3].map(i => <div key={i} style={{ height: 100, borderRadius: 8, background: "#141414", animation: "epage-pulse 1.4s ease-in-out infinite" }} />)}
                    </div>
                  )}

                  {insightsError && !insightsLoading && (
                    <div style={{ background: "rgba(255,107,107,0.06)", border: "0.5px solid rgba(255,107,107,0.25)", borderRadius: 10, padding: "0.8rem 1rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
                      <p style={{ margin: 0, fontSize: "0.78rem", color: "#FFB3B3", fontFamily: "var(--font-dm-sans)", lineHeight: 1.5 }}>
                        {insightsError}
                      </p>
                      <button
                        onClick={() => loadInsights(true)}
                        style={{ background: "transparent", border: "0.5px solid rgba(255,179,179,0.35)", borderRadius: 6, padding: "0.25rem 0.6rem", fontSize: "0.7rem", color: "#FFB3B3", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {insightsData && !insightsLoading && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem" }} className="insight-grid">
                      {insightsData.map((card, i) => (
                        <div key={i} style={{
                          borderLeft: `3px solid ${
                            card.type === 'warning' ? '#FF6B6B' :
                            card.type === 'action'  ? '#C8F55A' :
                            card.type === 'info'    ? 'rgba(240,237,230,0.2)' :
                            '#C8F55A'
                          }`,
                          borderTop: "0.5px solid rgba(240,237,230,0.06)",
                          borderRight: "0.5px solid rgba(240,237,230,0.06)",
                          borderBottom: "0.5px solid rgba(240,237,230,0.06)",
                          background:
                            card.type === 'warning' ? "rgba(255,107,107,0.04)" :
                            card.type === 'action'  ? "rgba(200,245,90,0.06)" :
                            card.type === 'info'    ? "rgba(240,237,230,0.03)" :
                            "rgba(200,245,90,0.04)",
                          borderRadius: 8,
                          padding: "0.875rem 1rem",
                        }}>
                          <div style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color:
                            card.type === 'warning' ? '#FF6B6B' :
                            card.type === 'action'  ? '#C8F55A' :
                            card.type === 'info'    ? 'rgba(240,237,230,0.35)' :
                            '#C8F55A',
                            fontFamily: "var(--font-dm-sans)", marginBottom: "0.4rem" }}>
                            {card.type === 'action' ? '-> action' : card.type}
                          </div>
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
                    { label: "Confirmed -> Waitlist", value: `${analyticsData.waitlistConversionRate}%` },
                  ].map(stat => (
                    <div key={stat.label} style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "1.1rem 1.25rem" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>{stat.label}</div>
                      <div style={{ fontSize: "1.5rem", fontFamily: "var(--font-instrument-serif)", color: "#F0EDE6" }}>{stat.value}</div>
                    </div>
                  ))}
                  <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "1.1rem 1.25rem" }}>
                    <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>Check-in Rate</div>
                    <div style={{ fontSize: "1.5rem", fontFamily: "var(--font-instrument-serif)", color: "#F0EDE6" }}>{analyticsData.checkInRate}%</div>
                    <div style={{ fontSize: "0.75rem", marginTop: "0.35rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
                      {analyticsData.checkedInCount} of {analyticsData.confirmedCount} confirmed
                    </div>
                    {analyticsData.checkInRate >= 70 && (
                      <div style={{ fontSize: "0.72rem", marginTop: "0.35rem", color: "#22C55E", fontFamily: "var(--font-dm-sans)" }}>Strong turnout</div>
                    )}
                    {analyticsData.checkInRate < 50 && analyticsData.confirmedCount > 0 && (
                      <div style={{ fontSize: "0.72rem", marginTop: "0.35rem", color: "#F59E0B", fontFamily: "var(--font-dm-sans)" }}>Low turnout</div>
                    )}
                  </div>
                  {analyticsData.feedbackScore !== null && (
                    <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "1.1rem 1.25rem" }}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>Feedback Score</div>
                      <div style={{ fontSize: "1.5rem", fontFamily: "var(--font-instrument-serif)", color: "#F0EDE6" }}>{analyticsData.feedbackScore} / 5</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.18rem", marginTop: "0.35rem" }}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <span key={n} style={{ fontSize: "0.86rem", color: n <= Math.round(analyticsData.feedbackScore ?? 0) ? '#C8F55A' : 'rgba(240,237,230,0.15)' }}>
                            Star
                          </span>
                        ))}
                      </div>
                      <div style={{ fontSize: "0.75rem", marginTop: "0.35rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
                        {analyticsData.feedbackCount} response{analyticsData.feedbackCount !== 1 ? 's' : ''} -{' '}
                        <button
                          onClick={() => setActiveTab('feedback')}
                          style={{ background: "transparent", border: "none", padding: 0, color: "#C8F55A", cursor: "pointer", fontFamily: "var(--font-dm-sans)", fontSize: "0.75rem" }}
                        >
                          View feedback
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {eventData.isPaid && (
                  <div style={{ background: "#141414", border: "0.5px solid rgba(255,184,77,0.14)", borderRadius: 12, padding: "1rem 1.25rem" }}>
                    <div style={{ fontSize: "0.7rem", color: "#FFB84D", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.85rem", fontFamily: "var(--font-dm-sans)" }}>
                      Paid Event Snapshot
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "0.75rem" }} className="stat-grid">
                      {[
                        { label: "Gross Sales", value: `KES ${(analyticsData.paidRevenueKes ?? 0).toLocaleString()}` },
                        { label: "Organizer Net", value: `KES ${(analyticsData.paidNetKes ?? 0).toLocaleString()}` },
                        { label: "Platform Commission", value: `KES ${(analyticsData.paidCommissionKes ?? 0).toLocaleString()}` },
                        { label: "Pending Payments", value: analyticsData.pendingPaidOrders ?? 0 },
                        { label: "Tickets Sold", value: analyticsData.paidTicketsSold ?? 0 },
                        { label: "Admissions Issued", value: analyticsData.paidAdmissionsIssued ?? 0 },
                      ].map((stat) => (
                        <div key={stat.label} style={{ background: "#0F0F0F", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "1rem" }}>
                          <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.45rem" }}>{stat.label}</div>
                          <div style={{ fontSize: "1.25rem", fontFamily: "var(--font-instrument-serif)", color: "#F0EDE6" }}>{stat.value}</div>
                        </div>
                      ))}
                    </div>

                    {!!analyticsData.tierBreakdown?.length && (
                      <div style={{ marginTop: "1rem", display: "grid", gap: "0.65rem" }}>
                        {analyticsData.tierBreakdown.map((tier) => (
                          <div key={tier.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0.85rem 1rem", borderRadius: 10, background: "#0F0F0F", border: "0.5px solid rgba(240,237,230,0.08)", flexWrap: "wrap" }}>
                            <div>
                              <div style={{ color: "#F0EDE6", fontSize: "0.9rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)" }}>{tier.name}</div>
                              <div style={{ color: "rgba(240,237,230,0.4)", fontSize: "0.74rem", fontFamily: "var(--font-dm-sans)" }}>
                                KES {tier.priceKes.toLocaleString()} - {tier.soldCount} sold - {tier.waitlistCount} waitlist
                                {tier.bundleSize > 1 ? ` - ${tier.bundleSize} entries each` : ""}
                              </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ color: "#FFB84D", fontSize: "0.9rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)" }}>KES {tier.grossKes.toLocaleString()}</div>
                              <div style={{ color: "rgba(240,237,230,0.35)", fontSize: "0.74rem", fontFamily: "var(--font-dm-sans)" }}>{tier.admissionsIssued} admissions issued</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {(analyticsData.waitlistedCount > 0 || analyticsData.promotedCount > 0) && (
                  <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1rem 1.25rem" }}>
                    <div style={{ fontSize: "0.7rem", color: "#C8F55A", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.75rem", fontFamily: "var(--font-dm-sans)" }}>
                      Featured Waitlist Funnel
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ color: "#F0EDE6", fontSize: "1.25rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>{analyticsData.waitlistedCount}</div>
                        <div style={{ color: "#525252", fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)" }}>Total Waitlisted</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ color: "#22C55E", fontSize: "1.25rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>{analyticsData.promotedCount}</div>
                        <div style={{ color: "#525252", fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)" }}>Promoted</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ color: "#F59E0B", fontSize: "1.25rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)" }}>{analyticsData.stillWaitingCount}</div>
                        <div style={{ color: "#525252", fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)" }}>Still Waiting</div>
                      </div>
                    </div>

                    {analyticsData.stillWaitingCount > 0 && (
                      <div style={{ marginTop: "0.75rem", borderLeft: "4px solid #C8F55A", paddingLeft: "0.75rem", background: "rgba(200,245,90,0.05)", borderTopRightRadius: 10, borderBottomRightRadius: 10, paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>
                        <p style={{ color: "#A3A3A3", fontSize: "0.75rem", fontFamily: "var(--font-dm-sans)", margin: 0 }}>
                          {analyticsData.stillWaitingCount} people are waiting.
                          {analyticsData.event?.capacity && (
                            <> Increasing capacity by {Math.min(analyticsData.stillWaitingCount, 10)} would promote the next {Math.min(analyticsData.stillWaitingCount, 10)} attendees.</>
                          )}
                        </p>
                        <button
                          onClick={() => setActiveTab("settings")}
                          style={{ marginTop: "0.3rem", background: "transparent", border: "none", padding: 0, color: "#C8F55A", fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", cursor: "pointer" }}
                        >
                          Adjust capacity
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {analyticsData.sourceBreakdown?.length > 0 && (
                  <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1rem 1.25rem" }}>
                    <div style={{ fontSize: "0.7rem", color: "#C8F55A", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.75rem", fontFamily: "var(--font-dm-sans)" }}>
                      Featured Registration Sources
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={analyticsData.sourceBreakdown}
                          dataKey="count"
                          nameKey="source"
                          cx="50%"
                          cy="50%"
                          outerRadius={78}
                          label={(props: PieLabelRenderProps) => `${props.payload?.source ?? ''}: ${props.payload?.count ?? ''}`}
                        >
                          {analyticsData.sourceBreakdown.map((item) => (
                            <Cell key={item.source} fill={SOURCE_COLORS[item.source] ?? '#525252'} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ background: '#141414', border: '1px solid rgba(240,237,230,0.15)', borderRadius: 8 }}
                          labelStyle={{ color: 'rgba(240,237,230,0.6)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Registrations by day */}
                <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.25rem 1.5rem" }}>
                  <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "1rem" }}>Registrations - last 30 days</div>
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

                {/* M1 - Comparative performance vs own average */}
                {analyticsData.vsAverage !== null && analyticsData.avgRegistrations !== null && (
                  <div style={{ borderLeft: `4px solid ${analyticsData.vsAverage >= 0 ? '#22C55E' : '#F59E0B'}`, paddingLeft: "1rem", paddingTop: "0.625rem", paddingBottom: "0.625rem", background: analyticsData.vsAverage >= 0 ? "rgba(34,197,94,0.05)" : "rgba(245,158,11,0.05)", borderTopRightRadius: 12, borderBottomRightRadius: 12 }}>
                    <p style={{ color: "#A3A3A3", fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)", margin: "0 0 0.25rem 0", lineHeight: 1.5 }}>
                      {analyticsData.vsAverage >= 0 ? (
                        <>This event has{' '}
                          <span style={{ color: "#22C55E", fontWeight: 700 }}>{analyticsData.vsAverage}% more</span>
                          {' '}registrations than your average event.</>
                      ) : (
                        <>This event has{' '}
                          <span style={{ color: "#F59E0B", fontWeight: 700 }}>{Math.abs(analyticsData.vsAverage)}% fewer</span>
                          {' '}registrations than your average event.</>
                      )}
                    </p>
                    <p style={{ color: "#525252", fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", margin: 0 }}>
                      Your average: {analyticsData.avgRegistrations} registrations per event
                    </p>
                  </div>
                )}
              </div>
            )}

            {!analyticsData && !analyticsLoading && (
              <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "2rem", textAlign: "center" }}>
                <p style={{ fontSize: "0.875rem", color: analyticsError ? "#FFB3B3" : "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>
                  {analyticsError || "Could not load analytics yet."}
                </p>
                <button
                  onClick={() => void loadAnalytics()}
                  style={{ marginTop: "0.85rem", background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.45rem 0.85rem", color: "#F0EDE6", fontSize: "0.78rem", fontFamily: "var(--font-dm-sans)", cursor: "pointer" }}
                >
                  Retry analytics
                </button>
              </div>
            )}

            {/* -- AI Q&A --- */}
            <div style={{ marginTop: "2rem", borderTop: "0.5px solid rgba(240,237,230,0.07)", paddingTop: "1.75rem" }}>
              <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.1rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 0.25rem 0" }}>Ask about your event</h3>
              <p style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", margin: "0 0 1.25rem 0" }}>Ask anything about your registration data.</p>

              {qaLocked ? (
                <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "1rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "1rem" }}>Locked</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.82rem", fontWeight: 500, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", margin: "0 0 0.15rem 0" }}>AI Q&A - 1 credit per question</p>
                    <p style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>Purchase credits to ask questions about your event data.</p>
                  </div>
                  <a href="/dashboard/billing#report-downloads" style={{ background: "#C8F55A", color: "#0A0A0A", borderRadius: 6, padding: "0.35rem 0.85rem", fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", textDecoration: "none", whiteSpace: "nowrap" }}>Buy report downloads</a>
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
                      <p style={{ fontSize: "0.65rem", color: "rgba(240,237,230,0.25)", fontFamily: "var(--font-dm-sans)", margin: "0.3rem 0 0 0" }}>1 credit per question</p>
                    </div>
                    <button
                      onClick={() => submitQuestion(qaInput)}
                      disabled={qaLoading || !qaInput.trim()}
                      style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.65rem 1.1rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: qaLoading || !qaInput.trim() ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", opacity: qaLoading || !qaInput.trim() ? 0.55 : 1, whiteSpace: "nowrap", flexShrink: 0 }}
                    >
                      {qaLoading ? "..." : "Ask"}
                    </button>
                  </div>

                  {/* Loading indicator */}
                  {qaLoading && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "1.25rem" }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#C8F55A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#0A0A0A", fontFamily: "var(--font-dm-sans)" }}>AI</span>
                      </div>
                      <div style={{ background: "#141414", borderRadius: "2px 12px 12px 12px", padding: "0.55rem 0.875rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", animation: "epage-pulse 1.4s ease-in-out infinite" }}>
                        Thinking...
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

        {/* -- Tab: Feedback --- */}
        {activeTab === "feedback" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", gap: "0.75rem", flexWrap: "wrap" }}>
              <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6", margin: 0 }}>Attendee Feedback</h2>
              {!feedbackData && !feedbackLoading && !feedbackError && (
                <button
                  onClick={loadFeedback}
                  style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.45rem 1.1rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
                >
                  Load feedback
                </button>
              )}
            </div>

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
                      {feedbackData.averageRating !== null ? `${feedbackData.averageRating} / 5` : "-"}
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
                              <span key={s} style={{ fontSize: "1rem", color: s <= fb.rating ? "#C8F55A" : "rgba(240,237,230,0.15)" }}>Star</span>
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

        {/* -- Tab: Check-in --- */}
        {activeTab === "checkin" && (
          <div data-tutorial="confirm-attendance">
            <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 1.5rem" }}>
              Ticket Verification
            </h2>
            {eventData && <EntryDashboard eventId={eventData.id} />}
            <p style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.84rem", color: "rgba(240,237,230,0.45)", margin: "0 0 1rem" }}>
              Choose scan mode. Both Quick Scan and Deep Scan support camera scanning, uploaded ticket images, and manual lookup by ticket code or attendee email/name.
            </p>

            <ScannerHome
              eventSlug={slug}
              accessToken={token || eventData.dashboardToken}
              onVerified={() => {
                void fetchDashboard()
              }}
            />
          </div>
        )}

        {/* -- Tab: Settings --- */}
        {activeTab === "settings" && (
          <div>
            <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 1.5rem" }}>
              Event settings
            </h2>
            <SettingsTab event={eventData} hasRegistrations={hasRegistrations} onSaved={handleSettingsSaved} />
          </div>
        )}

        {/* -- Tab: Team --- */}
        {activeTab === "team" && eventData.canEdit && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Current team members */}
            <div>
              <h3 style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.75rem" }}>
                Team members with access to this event
              </h3>
              {teamLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "0.875rem 1rem", animation: "epage-pulse 1.4s ease-in-out infinite" }}>
                      <div style={{ height: 12, width: "42%", borderRadius: 6, background: "#1A1A1A", marginBottom: "0.4rem" }} />
                      <div style={{ height: 10, width: "58%", borderRadius: 6, background: "#1A1A1A" }} />
                    </div>
                  ))}
                </div>
              ) : eventTeam.length === 0 ? (
                <p style={{ color: "rgba(240,237,230,0.35)", fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)" }}>No team members have access to this event yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {eventTeam.map(m => (
                    <div key={m.teamMemberId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "0.875rem 1rem", gap: "0.75rem", flexWrap: "wrap" }}>
                      <div style={{ minWidth: 0, flex: "1 1 220px" }}>
                        <p style={{ margin: 0, fontSize: "0.875rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>
                          {m.member?.name ?? m.email}
                        </p>
                        {m.member?.name && (
                          <p style={{ margin: "2px 0 0", fontSize: "0.75rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>{m.email}</p>
                        )}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <span style={{ fontSize: "0.7rem", padding: "2px 8px", borderRadius: 100, background: m.status === "accepted" ? "rgba(200,245,90,0.1)" : "rgba(240,180,0,0.1)", color: m.status === "accepted" ? "#C8F55A" : "#F0C040", border: `0.5px solid ${m.status === "accepted" ? "rgba(200,245,90,0.3)" : "rgba(240,180,0,0.3)"}`, fontFamily: "var(--font-dm-sans)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          {m.status}
                        </span>
                        {m.status === "pending" && (
                          <button
                            onClick={() => void handleResendTeamInvite(m.teamMemberId)}
                            disabled={resendingTeamMember === m.teamMemberId}
                            style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 7, color: resendTeamSuccessId === m.teamMemberId ? "#C8F55A" : "rgba(240,237,230,0.55)", fontSize: "0.75rem", fontFamily: "var(--font-dm-sans)", padding: "0.3rem 0.625rem", cursor: "pointer", opacity: resendingTeamMember === m.teamMemberId ? 0.6 : 1 }}
                          >
                            {resendTeamSuccessId === m.teamMemberId ? "Sent!" : resendingTeamMember === m.teamMemberId ? "Sending..." : "Resend"}
                          </button>
                        )}
                        {m.status === "pending" && resendTeamFailedUrls[m.teamMemberId] && (
                          <button
                            onClick={() => void copyTeamInviteLink(resendTeamFailedUrls[m.teamMemberId], `resend-${m.teamMemberId}`)}
                            style={{ background: "transparent", border: "0.5px solid rgba(200,245,90,0.2)", borderRadius: 7, color: copiedTeamInviteKey === `resend-${m.teamMemberId}` ? "#C8F55A" : "rgba(200,245,90,0.7)", fontSize: "0.75rem", fontFamily: "var(--font-dm-sans)", padding: "0.3rem 0.625rem", cursor: "pointer" }}
                          >
                            {copiedTeamInviteKey === `resend-${m.teamMemberId}` ? "Copied!" : "Copy link"}
                          </button>
                        )}
                        <button
                          onClick={() => void handleRemoveTeamMember(m.teamMemberId)}
                          disabled={removingTeamMember === m.teamMemberId}
                          style={{ background: "transparent", border: m.status === "pending" ? "0.5px solid rgba(239,68,68,0.2)" : "none", cursor: "pointer", color: "rgba(239,68,68,0.75)", fontSize: "0.75rem", fontFamily: "var(--font-dm-sans)", padding: "4px 8px", borderRadius: 6 }}
                        >
                          {removingTeamMember === m.teamMemberId ? "..." : m.status === "pending" ? "Cancel" : "Remove"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Invite form */}
            <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.25rem" }}>
              <h3 style={{ fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.875rem" }}>
                Invite a team member to this event
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {teamInviteEmails.map((email, i) => (
                  <input
                    key={i}
                    type="email"
                    value={email}
                    onChange={e => { const arr = [...teamInviteEmails]; arr[i] = e.target.value; setTeamInviteEmails(arr) }}
                    placeholder={i === 0 ? "teammate@example.com" : "second@example.com (optional)"}
                    style={{ width: "100%", background: "#0A0A0A", border: invalidTeamInviteEntries.some(entry => entry.index === i) ? "0.5px solid rgba(239,68,68,0.6)" : "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.6rem 0.875rem", fontSize: "0.875rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", outline: "none", boxSizing: "border-box" }}
                  />
                ))}
              </div>
              {invalidTeamInviteEntries.length > 0 && (
                <p style={{ color: "#EF4444", fontSize: "0.78rem", marginTop: "0.5rem", fontFamily: "var(--font-dm-sans)" }}>
                  Enter a valid email address before sending the invite.
                </p>
              )}
              {teamInviteError && <p style={{ color: "#EF4444", fontSize: "0.8rem", marginTop: "0.5rem", fontFamily: "var(--font-dm-sans)" }}>{teamInviteError}</p>}
              {teamInviteAcceptLinks.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
                  {teamInviteAcceptLinks.map(({ email, acceptUrl }) => (
                    <div key={email} style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "#0A0A0A", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 8, padding: "0.5rem 0.75rem" }}>
                      <span style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</span>
                      <button
                        onClick={() => void copyTeamInviteLink(acceptUrl, `new-${email}`)}
                        style={{ background: "transparent", border: "0.5px solid rgba(200,245,90,0.3)", borderRadius: 6, padding: "2px 8px", fontSize: "0.72rem", color: "#C8F55A", cursor: "pointer", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap" }}
                      >
                        {copiedTeamInviteKey === `new-${email}` ? "Copied!" : "Copy link"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {teamInviteSuccess && <p style={{ color: "#C8F55A", fontSize: "0.8rem", marginTop: "0.5rem", fontFamily: "var(--font-dm-sans)" }}>{teamInviteSuccess}</p>}
              <button
                onClick={() => void handleTeamInvite()}
                disabled={teamInviting || teamInviteEmails.every(e => !e.trim()) || invalidTeamInviteEntries.length > 0}
                style={{ marginTop: "0.875rem", background: "#C8F55A", color: "#0A0A0A", border: "none", borderRadius: 8, padding: "0.6rem 1.5rem", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-dm-sans)", opacity: teamInviting || invalidTeamInviteEntries.length > 0 ? 0.6 : 1 }}
              >
                {teamInviting ? "Sending..." : "Send Invite"}
              </button>
              <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                Invited members receive an email with a link to accept. If delivery is paused, copy the direct invite link and resend after the sender domain is verified.
              </p>
            </div>
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

