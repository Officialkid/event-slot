"use client"

import { useMemo, useRef, useState } from "react"
import { getCommunityLinkLabel, normalizeCommunityLink } from "@/lib/communityLink"
import { getPublicEventUrl } from "@/lib/eventUrls"

type WalkInCheckinFormProps = {
  event: {
    slug: string
    title: string
    location?: string | null
    eventDate?: string | null
    eventEndAt?: string | null
    communityLink?: string | null
    organizerName?: string | null
  }
  dayLabel: string
  dayTitle?: string | null
  showBranding?: boolean
}

type CheckinResponse = {
  success: true
  duplicate: boolean
  attendee: { name: string; phone: string }
  event: { title: string; slug: string; organizerName: string | null }
  day: { key: string; title: string | null; label: string; index: number; total: number }
  todayCount: number
  totalCount: number
}

function BrandingFooter() {
  return (
    <div style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.72rem", color: "rgba(240,237,230,0.2)", fontFamily: "var(--font-dm-sans)" }}>
      Powered by{" "}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "rgba(200,245,90,0.4)", textDecoration: "none" }}
      >
        EventSlot
      </a>
    </div>
  )
}

export default function WalkInCheckinForm({ event, dayLabel, dayTitle = null, showBranding = false }: WalkInCheckinFormProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<CheckinResponse | null>(null)
  const [downloadingCard, setDownloadingCard] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [sharing, setSharing] = useState<"whatsapp" | "story" | null>(null)
  const shareCardRef = useRef<HTMLDivElement>(null)

  const eventLink = useMemo(() => {
    if (typeof window === "undefined") return ""
    return getPublicEventUrl(window.location.origin, event.slug, "WALK_IN")
  }, [event.slug])

  const communityLink = normalizeCommunityLink(event.communityLink)
  const shareText = useMemo(() => {
    if (!result) return ""
    const attendedLine = result.day.title
      ? `${result.day.title} - ${result.day.label}`
      : result.day.label
    return `I attended ${result.event.title} on ${attendedLine}. ${result.todayCount.toLocaleString()} people are here today on EventSlot. ${eventLink}`
  }, [eventLink, result])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/events/${event.slug}/walk-in-checkins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Unable to check in right now.")
        return
      }
      setResult(data)
      setName("")
      setPhone("")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleCopyLink() {
    if (!eventLink) return
    try {
      await navigator.clipboard.writeText(eventLink)
      setCopiedLink(true)
      window.setTimeout(() => setCopiedLink(false), 1800)
    } catch {
      // Ignore clipboard failures to preserve current app behavior.
    }
  }

  async function handleDownloadShareCard() {
    if (!shareCardRef.current) return
    setDownloadingCard(true)
    try {
      const html2canvas = (await import("html2canvas")).default
      const canvas = await html2canvas(shareCardRef.current, {
        backgroundColor: "#0F141C",
        scale: 2,
      })
      const link = document.createElement("a")
      link.href = canvas.toDataURL("image/png")
      link.download = `${event.slug}-checkin-card.png`
      link.click()
    } finally {
      setDownloadingCard(false)
    }
  }

  async function handleShare(target: "whatsapp" | "story") {
    if (!result) return
    setSharing(target)
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: `${result.event.title} - ${result.day.label}`,
            text: shareText,
            url: eventLink,
          })
          return
        } catch {
          // Fall through to channel-specific fallback.
        }
      }

      if (target === "whatsapp") {
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer")
        return
      }

      await handleDownloadShareCard()
      await handleCopyLink()
    } finally {
      setSharing(null)
    }
  }

  if (result) {
    return (
      <div className="mx-auto w-full max-w-[520px]">
        <div className="space-y-4">
          <div
            ref={shareCardRef}
            className="rounded-[20px] border border-[rgba(240,237,230,0.12)] bg-[linear-gradient(145deg,#101722_0%,#121b29_55%,#0D1117_100%)] p-7 shadow-[0_18px_48px_rgba(0,0,0,0.35)]"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[rgba(240,237,230,0.45)]">
                EventSlot
              </span>
              <span className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold ${result.duplicate ? "border-[rgba(255,184,77,0.35)] bg-[rgba(255,184,77,0.08)] text-[#FFB84D]" : "border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)] text-[#C8F55A]"}`}>
                {result.duplicate ? "Already checked in" : "Checked in"}
              </span>
            </div>
            <h2 className="mt-5 text-[1.8rem] text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
              {result.attendee.name}
            </h2>
            <p className="mt-2 text-[0.95rem] text-[rgba(240,237,230,0.65)]">
              {result.duplicate ? "You were already checked in for today, so we kept your original entry." : "Your walk-in check-in is complete."}
            </p>
            <div className="mt-6 rounded-[14px] border border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
              <p className="text-[0.72rem] uppercase tracking-[0.08em] text-[rgba(240,237,230,0.4)]">Event</p>
              <p className="mt-1 text-[1rem] font-medium text-[#F0EDE6]">{result.event.title}</p>
              <p className="mt-3 text-[0.72rem] uppercase tracking-[0.08em] text-[rgba(240,237,230,0.4)]">Day session</p>
              {result.day.title && (
                <p className="mt-1 text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[#C8F55A]">{result.day.title}</p>
              )}
              <p className={`${result.day.title ? "mt-1" : "mt-1"} text-[0.9rem] text-[rgba(240,237,230,0.82)]`}>{result.day.label}</p>
              <p className="mt-3 text-[0.72rem] uppercase tracking-[0.08em] text-[rgba(240,237,230,0.4)]">Check-ins today</p>
              <p className="mt-1 text-[1.35rem] text-[#C8F55A]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
                {result.todayCount}
              </p>
            </div>
          </div>

          <div className="rounded-[16px] border border-[rgba(240,237,230,0.1)] bg-[rgba(255,255,255,0.02)] p-5">
            <p className="text-[0.8rem] text-[rgba(240,237,230,0.55)]">
              {result.duplicate ? "You can still share the event link with someone else attending today." : "Invite someone else by sharing the same event link or your check-in card."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleShare("whatsapp")}
                disabled={sharing !== null}
                className="rounded-full bg-[#C8F55A] px-5 py-2.5 text-[0.82rem] font-semibold text-[#0A0A0A] disabled:opacity-60"
              >
                {sharing === "whatsapp" ? "Opening..." : "Share on WhatsApp"}
              </button>
              <button
                type="button"
                onClick={() => void handleShare("story")}
                disabled={sharing !== null}
                className="rounded-full border border-[rgba(200,245,90,0.28)] bg-[rgba(200,245,90,0.08)] px-5 py-2.5 text-[0.82rem] font-medium text-[#C8F55A] disabled:opacity-60"
              >
                {sharing === "story" ? "Preparing..." : "Share story"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleDownloadShareCard()}
                disabled={downloadingCard}
                className="rounded-full border border-[rgba(240,237,230,0.15)] px-5 py-2.5 text-[0.82rem] font-medium text-[rgba(240,237,230,0.68)] disabled:opacity-60"
              >
                {downloadingCard ? "Preparing..." : "Download share card"}
              </button>
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="rounded-full border border-[rgba(240,237,230,0.15)] px-5 py-2.5 text-[0.82rem] font-medium text-[rgba(240,237,230,0.68)]"
              >
                {copiedLink ? "Link copied" : "Copy event link"}
              </button>
            </div>
            {communityLink && (
              <a
                href={communityLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.08)] px-5 py-2.5 text-[0.82rem] font-medium text-[#C8F55A]"
                style={{ textDecoration: "none" }}
              >
                {getCommunityLinkLabel(communityLink)}
              </a>
            )}
          </div>
        </div>
        {showBranding && <BrandingFooter />}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[520px]">
      <form onSubmit={handleSubmit} className="w-full rounded-[16px] border border-[rgba(240,237,230,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.01)_100%)] p-5 sm:p-7 space-y-6 shadow-[0_16px_36px_rgba(0,0,0,0.25)] backdrop-blur-sm">
        <div>
          <p className="text-[0.72rem] uppercase tracking-[0.1em] text-[rgba(240,237,230,0.6)]">Walk-in check-in</p>
          <h2 className="mt-2 text-[1.45rem] text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
            Check in for today
          </h2>
          <p className="mt-2 text-[0.86rem] text-[rgba(240,237,230,0.48)]">
            {dayTitle ? `${dayTitle} - ${dayLabel}` : dayLabel}. It only takes your name and phone number.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-[0.72rem] font-semibold tracking-[0.04em] text-[rgba(240,237,230,0.82)]">
              Full name <span className="text-[#C8F55A]">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-[10px] border border-[rgba(240,237,230,0.16)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5 text-[0.875rem] text-[#F0EDE6] placeholder:text-[rgba(240,237,230,0.45)] focus:border-[rgba(200,245,90,0.62)] focus:outline-none focus:ring-2 focus:ring-[rgba(200,245,90,0.15)]"
              placeholder="Enter your full name"
            />
          </div>
          <div>
            <label className="mb-1 block text-[0.72rem] font-semibold tracking-[0.04em] text-[rgba(240,237,230,0.82)]">
              Phone number <span className="text-[#C8F55A]">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="mt-1 w-full rounded-[10px] border border-[rgba(240,237,230,0.16)] bg-[rgba(255,255,255,0.04)] px-3 py-2.5 text-[0.875rem] text-[#F0EDE6] placeholder:text-[rgba(240,237,230,0.45)] focus:border-[rgba(200,245,90,0.62)] focus:outline-none focus:ring-2 focus:ring-[rgba(200,245,90,0.15)]"
              placeholder="Use the full country code, for example +254..."
            />
          </div>
        </div>

        <div className="rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-3">
          <p className="text-[0.76rem] text-[rgba(240,237,230,0.42)]">
            We use your phone number to prevent duplicate check-ins for the same event day.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[#C8F55A] px-5 py-3 text-[0.875rem] font-semibold text-[#0A0A0A] shadow-[0_8px_20px_rgba(200,245,90,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Checking in..." : "Check in now"}
        </button>

        {error && <div className="text-center text-[0.82rem] text-[#FF6B6B]">{error}</div>}
      </form>
      {showBranding && <BrandingFooter />}
    </div>
  )
}
