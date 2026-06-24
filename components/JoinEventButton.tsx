"use client"

import { useEffect, useState } from "react"
import { TierBadge } from "@/components/TierBadge"

interface Props {
  eventId: string
  eventType: "PHYSICAL" | "VIRTUAL"
  startDate: Date | string
  endDate: Date | string | null
  opensAt?: Date | string | null
}

type VerifyResult = {
  success: boolean
  attendeeName?: string
  meetingLink?: string
  ticketTierName?: string
  badgeColor?: string | null
  textColor?: string | null
  metallic?: boolean | null
  message: string
  reason?: string
  minutesUntil?: number
  opensAt?: string
}

export function JoinEventButton({ eventId, eventType, startDate, endDate, opensAt }: Props) {
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [isWindowOpen, setIsWindowOpen] = useState(false)
  const [fallbackQuery, setFallbackQuery] = useState("")
  const [fallbackLoading, setFallbackLoading] = useState(false)

  useEffect(() => {
    const start = startDate instanceof Date ? startDate : new Date(startDate)
    const end = endDate ? (endDate instanceof Date ? endDate : new Date(endDate)) : null
    const customOpen = opensAt ? (opensAt instanceof Date ? opensAt : new Date(opensAt)) : null
    const openWindow = customOpen ?? new Date(start.getTime() - 30 * 60 * 1000)
    const eventEndTime = end ?? new Date(start.getTime() + 4 * 60 * 60 * 1000)

    function updateStatus() {
      const now = new Date()

      if (now >= openWindow && now <= eventEndTime) {
        setIsWindowOpen(true)
        setCountdown(null)
        return
      }

      if (now > eventEndTime) {
        setCountdown("Event has ended")
        setIsWindowOpen(false)
        return
      }

      const diff = openWindow.getTime() - now.getTime()
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)

      setCountdown(
        days > 0
          ? `Opens in ${days}d ${hours}h ${minutes}m`
          : hours > 0
            ? `Opens in ${hours}h ${minutes}m`
            : `Opens in ${minutes} minute${minutes !== 1 ? "s" : ""}`
      )
    }

    updateStatus()
    const interval = window.setInterval(updateStatus, 30000)

    return () => {
      clearInterval(interval)
    }
  }, [startDate, endDate, opensAt])

  // Auto-open meeting link for virtual events once confirmed
  useEffect(() => {
    if (result?.success && result.meetingLink) {
      window.open(result.meetingLink, "_blank", "noopener,noreferrer")
    }
  }, [result])

  async function handleFallback() {
    if (!fallbackQuery.trim()) return

    setFallbackLoading(true)
    setResult(null)

    try {
      const lookupRes = await fetch(`/api/events/id/${eventId}/lookup?q=${encodeURIComponent(fallbackQuery)}`)
      const lookupData = (await lookupRes.json()) as {
        found?: boolean
        status?: string
        message?: string
        ticketId?: string
      }

      if (!lookupData.found || lookupData.status !== "CONFIRMED") {
        setResult({
          success: false,
          message: lookupData.message ?? "No confirmed registration found.",
        })
        return
      }

      const verifyRes = await fetch(`/api/events/${eventId}/verify-entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lookupTicketId: lookupData.ticketId ?? "" }),
      })

      const verifyData = (await verifyRes.json()) as VerifyResult
      setResult(verifyData)
    } catch {
      setResult({ success: false, message: "Lookup failed. Please try again." })
    } finally {
      setFallbackLoading(false)
    }
  }

  if (eventType === "PHYSICAL") return null

  return (
    <div className="mt-6">
      {!isWindowOpen && countdown && (
        <div className="rounded-xl border border-[#2A2A2A] p-4 text-center">
          <p className="text-sm text-[#525252]">{countdown}</p>
          <p className="mt-1 text-xs text-[#525252]">Have your email or name ready to join when the event opens.</p>
        </div>
      )}

      {isWindowOpen && !result && (
        <div className="space-y-3 rounded-xl border border-[#2A2A2A] p-4">
          <p className="text-sm font-medium text-white">Enter your name or email to join</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={fallbackQuery}
              onChange={(e) => setFallbackQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleFallback()
                }
              }}
              placeholder="Your name or email..."
              className="flex-1 rounded-lg border border-[#2A2A2A] bg-[#0A0A0A] px-3 py-2 text-sm text-white placeholder:text-[#525252] focus:border-[#C8F55A] focus:outline-none"
            />
            <button
              onClick={() => void handleFallback()}
              disabled={fallbackLoading || !fallbackQuery.trim()}
              className="rounded-lg bg-[#C8F55A] px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
            >
              {fallbackLoading ? "…" : "Join"}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div
          className={`rounded-xl border p-5 ${
            result.success
              ? "border-[#22C55E]/30 bg-[#22C55E]/5"
              : "border-[#EF4444]/30 bg-[#EF4444]/5"
          }`}
        >
          <div className="mb-3 flex items-center gap-2">
            <span className="text-2xl">{result.success ? "✓" : "✕"}</span>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-white">
                {result.success ? `Welcome, ${result.attendeeName ?? "Attendee"}!` : "Access Denied"}
              </p>
              {result.success && result.ticketTierName ? (
                <TierBadge
                  name={result.ticketTierName}
                  badgeColor={result.badgeColor ?? "#A8A9AD"}
                  textColor={result.textColor ?? "#1A1A1A"}
                  metallic={Boolean(result.metallic)}
                  size="sm"
                />
              ) : null}
            </div>
          </div>
          <p className="mb-4 text-sm text-[#A3A3A3]">{result.message}</p>

          {result.success && result.meetingLink && (
            <a
              href={result.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#C8F55A] px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-[#b8e040]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 10l4.553-2.069A1 1 0 0121 8.879V15.12a1 1 0 01-1.447.894L15 14"/><rect x="3" y="8" width="12" height="8" rx="2"/>
              </svg>
              Open Google Meet
            </a>
          )}

          {result.success && !result.meetingLink && (
            <p className="text-xs text-[#525252]">Meeting link not available — contact the organiser.</p>
          )}

          {!result.success && result.reason !== "EVENT_ENDED" && (
            <button
              onClick={() => {
                setResult(null)
                setFallbackQuery("")
              }}
              className="mt-3 text-xs text-[#525252] hover:text-[#A3A3A3]"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  )
}
