"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Calendar, CheckCircle2, Lock, Video, AlertCircle, Clock, ExternalLink } from "lucide-react"

interface Props {
  eventId: string
  eventSlug: string
  eventTitle: string
  eventType: "PHYSICAL" | "VIRTUAL"
  startDate: string | Date | null
  endDate?: string | Date | null
  opensAt?: string | Date | null
  initialTicketCode?: string | null
  attendeeEmail?: string | null
  isEventCancelled?: boolean
  isEventEnded?: boolean
  calendarUrl?: string | null
  icsUrl?: string | null
}

type VerifyResponse = {
  success: boolean
  attendeeName?: string
  ticketId?: string
  meetingLink?: string | null
  eventType?: string
  message: string
  reason?: string
  opensAt?: string
  minutesUntil?: number
}

export function VirtualEventAccessPortal({
  eventId,
  eventSlug,
  eventTitle,
  eventType,
  startDate,
  endDate,
  opensAt,
  initialTicketCode,
  attendeeEmail,
  isEventCancelled = false,
  isEventEnded = false,
  calendarUrl,
  icsUrl,
}: Props) {
  const [ticketInput, setTicketInput] = useState(initialTicketCode || "")
  const [loading, setLoading] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isWindowOpen, setIsWindowOpen] = useState(false)
  const [isEnded, setIsEnded] = useState(isEventEnded)
  const [countdownText, setCountdownText] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null)

  const start = startDate ? new Date(startDate) : null
  const end = endDate ? new Date(endDate) : start ? new Date(start.getTime() + 4 * 60 * 60 * 1000) : null
  const openTime = opensAt
    ? new Date(opensAt)
    : start
    ? new Date(start.getTime() - 30 * 60 * 1000)
    : null

  // Recalculate countdown and window status every second
  useEffect(() => {
    if (!openTime) return

    function updateTimer() {
      const now = new Date()

      if (end && now > end) {
        setIsEnded(true)
        setIsWindowOpen(false)
        setCountdownText(null)
        return
      }

      const diff = openTime!.getTime() - now.getTime()
      if (diff <= 0) {
        setIsWindowOpen(true)
        setCountdownText(null)
      } else {
        setIsWindowOpen(false)
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
        const minutes = Math.floor((diff / 1000 / 60) % 60)
        const seconds = Math.floor((diff / 1000) % 60)
        setCountdownText({ days, hours, minutes, seconds })
      }
    }

    updateTimer()
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [openTime, end])

  const handleJoin = useCallback(async (codeToVerify?: string) => {
    const code = (codeToVerify || ticketInput).trim()
    if (!code) {
      setErrorMessage("Please provide your ticket confirmation code or email.")
      return
    }

    setLoading(true)
    setErrorMessage(null)

    try {
      // First attempt direct verification via verify-entry
      const res = await fetch(`/api/events/${eventSlug}/verify-entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookupTicketId: code }),
      })

      const data = (await res.json()) as VerifyResponse
      if (!res.ok || !data.success) {
        // If lookup by ticket id didn't find it, try fallback lookup by email/name
        if (data.reason === "TICKET_NOT_FOUND" && code.includes("@")) {
          const lookupRes = await fetch(`/api/events/id/${eventId}/lookup?q=${encodeURIComponent(code)}`)
          const lookupData = await lookupRes.json()
          if (lookupData.found && lookupData.ticketId) {
            return handleJoin(lookupData.ticketId)
          }
        }
        setErrorMessage(data.message || "Access verification failed.")
        setVerifyResult(data)
        return
      }

      setVerifyResult(data)
      if (data.meetingLink) {
        // Open provider room seamlessly
        window.open(data.meetingLink, "_blank", "noopener,noreferrer")
      }
    } catch {
      setErrorMessage("Could not verify access. Please check your network connection.")
    } finally {
      setLoading(false)
    }
  }, [eventId, eventSlug, ticketInput])

  // If initialTicketCode is present and window opens, automatically authorize when ready
  useEffect(() => {
    if (initialTicketCode && isWindowOpen && !verifyResult && !loading) {
      handleJoin(initialTicketCode)
    }
  }, [initialTicketCode, isWindowOpen, verifyResult, loading, handleJoin])

  if (eventType !== "VIRTUAL") return null

  // STATE 6: EVENT CANCELLED
  if (isEventCancelled) {
    return (
      <div className="rounded-2xl border p-6 text-center space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center bg-red-500/10 text-red-500">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-red-600">Event Cancelled</h3>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Virtual access is no longer available because this event has been cancelled by the organizer.
        </p>
      </div>
    )
  }

  // STATE 3: EVENT ENDED
  if (isEnded) {
    return (
      <div className="rounded-2xl border p-6 text-center space-y-3" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center bg-amber-500/10 text-amber-500">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>Event Ended</h3>
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Thank you for attending <strong>{eventTitle}</strong>. The virtual room is now closed.
        </p>
      </div>
    )
  }

  // STATE 2: ACCESS AVAILABLE (Window Open)
  if (isWindowOpen) {
    return (
      <div className="rounded-2xl border p-6 shadow-sm space-y-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border-subtle, rgba(255,255,255,0.08))" }}>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">Live Virtual Access</span>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            ✓ Access Available
          </span>
        </div>

        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-4 text-center space-y-1.5">
          <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
            You&apos;re Ready!
          </h3>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            The virtual event room is open. Click below to authorize your ticket and enter.
          </p>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 text-xs text-center font-medium">
            {errorMessage}
          </div>
        )}

        {!initialTicketCode && !verifyResult?.success && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
              Ticket Code or Registered Email
            </label>
            <input
              type="text"
              placeholder="e.g. CONF-1234 or your email..."
              value={ticketInput}
              onChange={(e) => setTicketInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition"
              style={{ background: "var(--surface-2, #18181b)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
          </div>
        )}

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => handleJoin()}
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-xl font-bold text-sm text-center text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/25 transition transform active:scale-[0.99] flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Video className="w-4 h-4" />
            {loading ? "Authorizing Access..." : verifyResult?.meetingLink ? "Re-enter Virtual Event →" : "Join Live Event →"}
          </button>

          <p className="text-[11px] text-center" style={{ color: "var(--text-muted)" }}>
            💡 If joining Google Meet, use your registered Google account to be admitted automatically without knocking.
          </p>
        </div>

        {verifyResult?.meetingLink && (
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-center space-y-1">
            <p className="text-xs text-emerald-600 font-semibold">
              ✓ Verified as {verifyResult.attendeeName || "Attendee"}
            </p>
            <a
              href={verifyResult.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-600 underline font-medium inline-flex items-center gap-1"
            >
              Open meeting link directly <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}
      </div>
    )
  }

  // STATE 1: ACCESS LOCKED (Before joinOpensAt)
  return (
    <div className="rounded-2xl border p-6 shadow-sm space-y-5" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: "var(--border-subtle, rgba(255,255,255,0.08))" }}>
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Virtual Access Pass</span>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/20">
          🔒 Access Locked
        </span>
      </div>

      <div className="bg-[var(--surface-2,#f9fafb)] rounded-xl p-4 border border-[var(--border)] space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <span style={{ color: "var(--text-secondary)" }}>Event Date</span>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {start ? start.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "Scheduled"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ color: "var(--text-secondary)" }}>Start Time</span>
          <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
            {start ? start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }) : "TBA"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span style={{ color: "var(--text-secondary)" }}>Access Window Opens</span>
          <span className="font-semibold text-emerald-600">
            {openTime ? openTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }) : "30 mins before start"}
          </span>
        </div>
      </div>

      {countdownText && (
        <div className="text-center py-5 px-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--text-secondary)" }}>
            Access Opens In
          </p>
          <div className="flex justify-center items-center gap-2.5 font-mono text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            {countdownText.days > 0 && (
              <>
                <div className="bg-[var(--surface)] border px-2.5 py-1.5 rounded-lg text-center" style={{ borderColor: "var(--border)" }}>
                  <span>{String(countdownText.days).padStart(2, "0")}</span>
                  <span className="block text-[10px] font-sans font-normal" style={{ color: "var(--text-muted)" }}>DAYS</span>
                </div>
                <span>:</span>
              </>
            )}
            <div className="bg-[var(--surface)] border px-2.5 py-1.5 rounded-lg text-center" style={{ borderColor: "var(--border)" }}>
              <span>{String(countdownText.hours).padStart(2, "0")}</span>
              <span className="block text-[10px] font-sans font-normal" style={{ color: "var(--text-muted)" }}>HOURS</span>
            </div>
            <span>:</span>
            <div className="bg-[var(--surface)] border px-2.5 py-1.5 rounded-lg text-center" style={{ borderColor: "var(--border)" }}>
              <span>{String(countdownText.minutes).padStart(2, "0")}</span>
              <span className="block text-[10px] font-sans font-normal" style={{ color: "var(--text-muted)" }}>MINS</span>
            </div>
            <span>:</span>
            <div className="bg-[var(--surface)] border px-2.5 py-1.5 rounded-lg text-center" style={{ borderColor: "var(--border)" }}>
              <span>{String(countdownText.seconds).padStart(2, "0")}</span>
              <span className="block text-[10px] font-sans font-normal" style={{ color: "var(--text-muted)" }}>SECS</span>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
        🔒 Meeting room links are securely encrypted. Your verified ticket will unlock instant access once the countdown completes.
      </p>

      {/* Calendar reminder links */}
      {(calendarUrl || icsUrl) && (
        <div className="pt-2 flex gap-2">
          {calendarUrl && (
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2.5 px-3 rounded-xl border text-center text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
            >
              <Calendar className="w-3.5 h-3.5" />
              Add to Google Calendar
            </a>
          )}
          {icsUrl && (
            <a
              href={icsUrl}
              download
              className="py-2.5 px-3 rounded-xl border text-center text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              Download .ics
            </a>
          )}
        </div>
      )}
    </div>
  )
}
