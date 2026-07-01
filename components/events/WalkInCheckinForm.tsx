"use client"

import { useEffect, useMemo, useState } from "react"
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
  onCheckinComplete?: (result: CheckinResponse) => void
}

type CheckinResponse = {
  success: true
  duplicate: boolean
  attendee: { name: string; phone: string }
  event: { title: string; slug: string; organizerName: string | null }
  day: { key: string; title: string | null; label: string; index: number; total: number }
  todayCount: number
  totalCount: number
  returnToken?: string
  returnLink?: string
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

export default function WalkInCheckinForm({ event, dayLabel, dayTitle = null, showBranding = false, onCheckinComplete }: WalkInCheckinFormProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<CheckinResponse | null>(null)
  const [downloadingCard, setDownloadingCard] = useState(false)
  const [copiedEventLink, setCopiedEventLink] = useState(false)
  const [copiedReturnLink, setCopiedReturnLink] = useState(false)
  const [sharing, setSharing] = useState<"poster" | null>(null)
  const [shareError, setShareError] = useState("")
  const [autoCheckinAttempted, setAutoCheckinAttempted] = useState(false)

  const eventLink = useMemo(() => {
    if (typeof window === "undefined") return ""
    return getPublicEventUrl(window.location.origin, event.slug, "WALK_IN")
  }, [event.slug])

  const shareText = useMemo(() => {
    if (!result) return ""
    const attendedLine = result.day.total > 1
      ? `${result.day.title} on ${result.day.label}`
      : result.day.label
    return `Hello guys, I attended ${result.event.title} ${attendedLine}. Check us out at www.eventsslot.com ${eventLink}`.trim()
  }, [eventLink, result])

  const shareCardUrl = useMemo(() => {
    if (!result || typeof window === "undefined") return ""
    const params = new URLSearchParams({
      day: String(result.day.index),
      name: result.attendee.name,
      spot: String(result.todayCount),
    })
    return `${window.location.origin}/api/walkin/${event.slug}/share-card?${params.toString()}`
  }, [event.slug, result])

  const shareCardDownloadUrl = useMemo(() => {
    if (!shareCardUrl) return ""
    return `${shareCardUrl}&download=1`
  }, [shareCardUrl])

  const oneClickReturnLink = useMemo(() => {
    if (!result?.returnToken || typeof window === "undefined") return ""
    const params = new URLSearchParams({ recheck: result.returnToken })
    return `${window.location.origin}/walkin/${event.slug}?${params.toString()}`
  }, [event.slug, result])

  useEffect(() => {
    if (result || autoCheckinAttempted || loading) return
    const token = new URLSearchParams(window.location.search).get("recheck")
    if (!token) return
    setAutoCheckinAttempted(true)
    setLoading(true)
    setError("")
    fetch(`/api/walkin/${event.slug}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnToken: token }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Unable to complete your quick return check-in.")
        }
        setResult(data)
        onCheckinComplete?.(data)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Unable to complete your quick return check-in.")
      })
      .finally(() => setLoading(false))
  }, [autoCheckinAttempted, event.slug, loading, onCheckinComplete, result])

  async function downloadFromUrl(url: string, fallbackBaseName: string) {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) throw new Error("Unable to prepare download.")

    const blob = await response.blob()
    const extension = blob.type === "image/png" ? "png" : "jpg"
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = `${fallbackBaseName}.${extension}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/walkin/${event.slug}/checkin`, {
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
      onCheckinComplete?.(data)
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
      setCopiedEventLink(true)
      setShareError("")
      window.setTimeout(() => setCopiedEventLink(false), 1800)
    } catch {
      setShareError("Could not copy the link on this browser. Please press and hold the address bar link instead.")
    }
  }

  async function getShareCardFile() {
    if (!result || !shareCardUrl) return null
    const response = await fetch(shareCardUrl, { cache: "no-store" })
    if (!response.ok) throw new Error("Unable to prepare share card.")
    const blob = await response.blob()
    const extension = blob.type === "image/jpeg" ? "jpg" : "png"
    return new File([blob], `${event.slug}-checkin-poster.${extension}`, { type: blob.type || "image/png" })
  }

  async function handleCopyReturnLink() {
    if (!oneClickReturnLink) return
    try {
      await navigator.clipboard.writeText(oneClickReturnLink)
      setCopiedReturnLink(true)
      setShareError("")
      window.setTimeout(() => setCopiedReturnLink(false), 1800)
    } catch {
      setShareError("Could not copy the return link on this browser. Please copy the address manually.")
    }
  }

  async function handleDownloadShareCard() {
    setDownloadingCard(true)
    try {
      setShareError("")
      if (!shareCardDownloadUrl) return
      await downloadFromUrl(shareCardDownloadUrl, `${event.slug}-checkin-poster`)
    } catch {
      setShareError("We could not generate your poster just now. Please try again.")
    } finally {
      setDownloadingCard(false)
    }
  }

  async function handleShare() {
    if (!result) return
    setSharing("poster")

    try {
      setShareError("")
      const file = await getShareCardFile()

      if (
        file &&
        typeof navigator !== "undefined" &&
        "canShare" in navigator &&
        navigator.canShare({ files: [file] }) &&
        navigator.share
      ) {
        try {
          await navigator.share({
            title: `${result.event.title} - ${result.day.label}`,
            text: shareText,
            files: [file],
          })
          return
        } catch {
          // Fall through to link-based native share or local download fallback.
        }
      }

      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: `${result.event.title} - ${result.day.label}`,
            text: shareText,
            url: eventLink,
          })
          return
        } catch {
          // Fall through to local download fallback.
        }
      }

      await handleDownloadShareCard()
    } catch {
      setShareError("Sharing is not available right now. Please try Download my poster instead.")
    } finally {
      setSharing(null)
    }
  }

  if (result) {
    return (
      <div className="mx-auto w-full max-w-[520px]">
        <div className="space-y-4">
          <div className="rounded-[20px] border border-[rgba(240,237,230,0.12)] bg-[linear-gradient(145deg,#101722_0%,#121b29_55%,#0D1117_100%)] p-7 shadow-[0_18px_48px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[rgba(240,237,230,0.45)]">
                EventSlot
              </span>
              <span className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold ${result.duplicate ? "border-[rgba(255,184,77,0.35)] bg-[rgba(255,184,77,0.08)] text-[#FFB84D]" : "border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)] text-[#C8F55A]"}`}>
                {result.duplicate ? "Already checked in" : "Checked in"}
              </span>
            </div>
            <p className="mt-5 text-[0.8rem] uppercase tracking-[0.14em] text-[#C8F55A]">Congratulations</p>
            <h2 className="mt-2 text-[1.8rem] text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
              {result.duplicate ? "You have checked in" : "You have checked in"}
            </h2>
            <p className="mt-3 text-[0.98rem] text-[rgba(240,237,230,0.72)]">
              {result.duplicate
                ? `We already had ${result.attendee.name} checked in for today.`
                : `We are glad to have ${result.attendee.name} here today.`}
            </p>
            <p className="mt-2 text-[0.92rem] text-[rgba(240,237,230,0.58)]">
              Celebrate a little, then tell someone you attended.
            </p>
            <div className="mt-6 rounded-[14px] border border-[rgba(240,237,230,0.08)] bg-[rgba(255,255,255,0.03)] p-4">
              <p className="text-[0.72rem] uppercase tracking-[0.08em] text-[rgba(240,237,230,0.4)]">Event</p>
              <p className="mt-1 text-[1rem] font-medium text-[#F0EDE6]">{result.event.title}</p>
              <p className="text-[0.72rem] uppercase tracking-[0.08em] text-[rgba(240,237,230,0.4)]">Attendee</p>
              <p className="mt-1 text-[1rem] font-medium text-[#F0EDE6]">{result.attendee.name}</p>
              <p className="mt-3 text-[0.72rem] uppercase tracking-[0.08em] text-[rgba(240,237,230,0.4)]">Day attended</p>
              {result.day.title && (
                <p className="mt-1 text-[0.82rem] font-semibold uppercase tracking-[0.08em] text-[#C8F55A]">{result.day.title}</p>
              )}
              <p className="mt-1 text-[0.9rem] text-[rgba(240,237,230,0.82)]">{result.day.label}</p>
              <p className="mt-3 text-[0.72rem] uppercase tracking-[0.08em] text-[rgba(240,237,230,0.4)]">Check-in number</p>
              <p className="mt-1 text-[1.35rem] text-[#C8F55A]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
                #{result.todayCount.toLocaleString()}
              </p>
            </div>
            <div className="mt-6 text-center text-[0.78rem] text-[rgba(240,237,230,0.52)]">
              Powered by EventSlot
              <div className="mt-1 text-[rgba(200,245,90,0.66)]">Check us out at www.eventsslot.com</div>
            </div>
          </div>

          <div className="rounded-[16px] border border-[rgba(240,237,230,0.1)] bg-[rgba(255,255,255,0.02)] p-5">
            <p className="text-[0.8rem] text-[rgba(240,237,230,0.55)]">
              {result.duplicate
                ? "Share your poster or keep your quick return link handy for tomorrow."
                : "Share this with your friends, download your poster, or keep your quick return link handy for tomorrow."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleShare()}
                disabled={sharing !== null}
                className="rounded-full bg-[#C8F55A] px-5 py-2.5 text-[0.82rem] font-semibold text-[#0A0A0A] disabled:opacity-60"
              >
                {sharing === "poster" ? "Preparing..." : "Share poster"}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleDownloadShareCard()}
                disabled={downloadingCard}
                className="rounded-full border border-[rgba(240,237,230,0.15)] px-5 py-2.5 text-[0.82rem] font-medium text-[rgba(240,237,230,0.68)] disabled:opacity-60"
              >
                {downloadingCard ? "Preparing..." : "Download my poster"}
              </button>
              <button
                type="button"
                onClick={() => void handleCopyLink()}
                className="rounded-full border border-[rgba(240,237,230,0.15)] px-5 py-2.5 text-[0.82rem] font-medium text-[rgba(240,237,230,0.68)]"
              >
                {copiedEventLink ? "Link copied" : "Copy event link"}
              </button>
              {oneClickReturnLink ? (
                <button
                  type="button"
                  onClick={() => void handleCopyReturnLink()}
                  className="rounded-full border border-[rgba(200,245,90,0.26)] px-5 py-2.5 text-[0.82rem] font-medium text-[#C8F55A]"
                >
                  {copiedReturnLink ? "Return link copied" : "Copy quick return link"}
                </button>
              ) : null}
            </div>
            {shareError && <p className="mt-3 text-[0.8rem] text-[#FFB84D]">{shareError}</p>}
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
            Welcome to {event.title}
          </h2>
          <p className="mt-2 text-[0.86rem] text-[rgba(240,237,230,0.48)]">
            We are glad to have you here. Please help us track everyone who attended by filling in your details for {dayTitle ? `${dayTitle} - ${dayLabel}` : dayLabel}.
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
            Your data is protected under Kenya&apos;s Data Protection Act 2019. We use your phone number only to prevent duplicate check-ins for the same event day.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[#C8F55A] px-5 py-3 text-[0.875rem] font-semibold text-[#0A0A0A] shadow-[0_8px_20px_rgba(200,245,90,0.2)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Checking in..." : "I am here"}
        </button>

        {error && <div className="text-center text-[0.82rem] text-[#FF6B6B]">{error}</div>}
      </form>
      {showBranding && <BrandingFooter />}
    </div>
  )
}
