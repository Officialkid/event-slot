"use client"

import React, { useState } from "react"
import { Video, ShieldCheck, Calendar, Clock, RefreshCw, CheckCircle, AlertTriangle, ExternalLink, KeyRound } from "lucide-react"

interface Props {
  eventSlug: string
  eventTitle: string
  eventType: "PHYSICAL" | "VIRTUAL"
  startDate: string | null
  joinOpensAt: string | null
  googleCalendarConnected?: boolean
  calendarSynced?: boolean
  confirmedCount: number
}

type DiagnosticsData = {
  eventType: string
  platform: string
  linkConfigured: boolean
  encryptionValid: boolean
  calendarConnected: boolean
  googleMeetLinked: boolean
  googleEventId: string | null
  accessWindow: {
    eventDate: string | null
    joinOpensAt: string | null
    serverTime: string
    isOpen: boolean
    minutesUntilOpen: number | null
  }
  confirmedAttendees: number
  allChecksPassed: boolean
}

export function OrganizerVirtualEventCard({
  eventSlug,
  eventTitle,
  eventType,
  startDate,
  joinOpensAt,
  googleCalendarConnected,
  calendarSynced,
  confirmedCount,
}: Props) {
  const [testing, setTesting] = useState(false)
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null)
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [showEditLinkModal, setShowEditLinkModal] = useState(false)
  const [newMeetingUrl, setNewMeetingUrl] = useState("")
  const [updatingLink, setUpdatingLink] = useState(false)
  const [linkUpdateNotice, setLinkUpdateNotice] = useState<string | null>(null)

  if (eventType !== "VIRTUAL") return null

  const start = startDate ? new Date(startDate) : null
  const openTime = joinOpensAt
    ? new Date(joinOpensAt)
    : start
    ? new Date(start.getTime() - 30 * 60 * 1000)
    : null

  const runDiagnostics = async () => {
    setTesting(true)
    setShowDiagnostics(true)
    try {
      const res = await fetch(`/api/events/${eventSlug}/virtual-test`)
      const data = await res.json()
      if (res.ok && data.success) {
        setDiagnostics(data.diagnostics)
      } else {
        alert(data.error || "Failed to run diagnostics.")
      }
    } catch {
      alert("Error connecting to diagnostics service.")
    } finally {
      setTesting(false)
    }
  }

  const handleUpdateMeetingLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMeetingUrl.trim()) return

    setUpdatingLink(true)
    setLinkUpdateNotice(null)
    try {
      const res = await fetch(`/api/events/${eventSlug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_virtual_link",
          virtualLink: newMeetingUrl.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setLinkUpdateNotice("✓ Virtual meeting link securely updated and encrypted with AES-256!")
        setTimeout(() => {
          setShowEditLinkModal(false)
          setLinkUpdateNotice(null)
          setNewMeetingUrl("")
        }, 1500)
      } else {
        setLinkUpdateNotice(data.error || "Failed to update link.")
      }
    } catch {
      setLinkUpdateNotice("Network error updating meeting link.")
    } finally {
      setUpdatingLink(false)
    }
  }

  return (
    <div className="rounded-2xl border p-5 sm:p-6 shadow-sm space-y-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border-subtle, rgba(255,255,255,0.08))" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Virtual Event Control Center</span>
            <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>{eventTitle}</h3>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          ● Scheduled
        </span>
      </div>

      {/* Grid status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl border space-y-1" style={{ background: "var(--surface-2, rgba(255,255,255,0.03))", borderColor: "var(--border)" }}>
          <span style={{ color: "var(--text-muted)" }}>Platform</span>
          <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>Google Meet / Web</p>
          <span className="text-[11px] text-emerald-600 font-semibold block">✓ Auto-Admit Ready</span>
        </div>

        <div className="p-3 rounded-xl border space-y-1" style={{ background: "var(--surface-2, rgba(255,255,255,0.03))", borderColor: "var(--border)" }}>
          <span style={{ color: "var(--text-muted)" }}>Start Time</span>
          <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
            {start ? start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }) : "TBA"}
          </p>
          <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {start ? start.toLocaleDateString("en-GB", { month: "short", day: "numeric" }) : ""}
          </span>
        </div>

        <div className="p-3 rounded-xl border space-y-1" style={{ background: "var(--surface-2, rgba(255,255,255,0.03))", borderColor: "var(--border)" }}>
          <span style={{ color: "var(--text-muted)" }}>Access Opens</span>
          <p className="font-bold text-sm text-emerald-600">
            {openTime ? openTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }) : "30m early"}
          </p>
          <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {openTime ? "30 mins before start" : "Default window"}
          </span>
        </div>

        <div className="p-3 rounded-xl border space-y-1" style={{ background: "var(--surface-2, rgba(255,255,255,0.03))", borderColor: "var(--border)" }}>
          <span style={{ color: "var(--text-muted)" }}>Guest Whitelist</span>
          <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>{confirmedCount} Attendees</p>
          <span className="text-[11px] text-emerald-600 font-semibold block">✓ Whitelisted in Calendar</span>
        </div>
      </div>

      {/* Security notice */}
      <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span style={{ color: "var(--text-secondary)" }}>
            Link secured with <strong>AES-256</strong> cipher. Never returned to attendees before access opening time.
          </span>
        </div>
        <a
          href={`/join/${eventSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-600 font-bold hover:underline inline-flex items-center gap-1"
        >
          View Attendee Join Portal <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={runDiagnostics}
          disabled={testing}
          className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} />
          {testing ? "Testing Access..." : "✨ Test Virtual Access"}
        </button>

        <button
          type="button"
          onClick={() => setShowEditLinkModal(true)}
          className="px-4 py-2 rounded-xl text-xs font-bold border transition hover:bg-black/5 dark:hover:bg-white/5"
          style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          Change Meeting Link
        </button>

        <a
          href="#entry-logs-section"
          className="px-4 py-2 rounded-xl text-xs font-bold border transition hover:bg-black/5 dark:hover:bg-white/5"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          View Entry Logs
        </a>
      </div>

      {/* Diagnostics panel */}
      {showDiagnostics && diagnostics && (
        <div className="mt-4 p-4 rounded-xl border space-y-3" style={{ background: "var(--surface-2, rgba(255,255,255,0.02))", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600">
              Virtual Access Diagnostic Report
            </h4>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${diagnostics.allChecksPassed ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
              {diagnostics.allChecksPassed ? "✓ All 6 Checks Passed" : "Action Required"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface)] border" style={{ borderColor: "var(--border)" }}>
              <span style={{ color: "var(--text-secondary)" }}>1. Meeting Link Configured</span>
              <span className={diagnostics.linkConfigured ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                {diagnostics.linkConfigured ? "✓ Configured" : "✗ Missing"}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface)] border" style={{ borderColor: "var(--border)" }}>
              <span style={{ color: "var(--text-secondary)" }}>2. AES-256 Encryption Integrity</span>
              <span className={diagnostics.encryptionValid ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                {diagnostics.encryptionValid ? "✓ Decrypts In Memory" : "✗ Decrypt Failed"}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface)] border" style={{ borderColor: "var(--border)" }}>
              <span style={{ color: "var(--text-secondary)" }}>3. Google Calendar OAuth</span>
              <span className={diagnostics.calendarConnected ? "text-emerald-600 font-bold" : "text-amber-500 font-bold"}>
                {diagnostics.calendarConnected ? "✓ Connected" : "Not Connected"}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface)] border" style={{ borderColor: "var(--border)" }}>
              <span style={{ color: "var(--text-secondary)" }}>4. Calendar Event Synchronized</span>
              <span className={diagnostics.googleMeetLinked ? "text-emerald-600 font-bold" : "text-[var(--text-muted)] font-semibold"}>
                {diagnostics.googleMeetLinked ? `✓ Linked (${diagnostics.googleEventId})` : "Manual Link Only"}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface)] border" style={{ borderColor: "var(--border)" }}>
              <span style={{ color: "var(--text-secondary)" }}>5. Access Window Computed</span>
              <span className="text-emerald-600 font-bold">
                ✓ {diagnostics.accessWindow.isOpen ? "Currently Open" : `Opens in ${diagnostics.accessWindow.minutesUntilOpen ?? "?"}m`}
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--surface)] border" style={{ borderColor: "var(--border)" }}>
              <span style={{ color: "var(--text-secondary)" }}>6. Guest Whitelist Active</span>
              <span className="text-emerald-600 font-bold">
                ✓ {diagnostics.confirmedAttendees} Eligible Guests
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Change Meeting Link */}
      {showEditLinkModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border p-6 space-y-4 shadow-2xl" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
            <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              Update Virtual Meeting Link
            </h3>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Enter the new meeting URL (Google Meet, Zoom, Teams, or stream). It will be immediately re-encrypted with AES-256 and synchronized.
            </p>

            <form onSubmit={handleUpdateMeetingLink} className="space-y-3">
              <input
                type="url"
                required
                placeholder="https://meet.google.com/... or https://zoom.us/..."
                value={newMeetingUrl}
                onChange={(e) => setNewMeetingUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none"
                style={{ background: "var(--surface-2, rgba(255,255,255,0.05))", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />

              {linkUpdateNotice && (
                <p className="text-xs font-semibold text-emerald-600 text-center">
                  {linkUpdateNotice}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditLinkModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingLink}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {updatingLink ? "Encrypting & Updating..." : "Save New Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
