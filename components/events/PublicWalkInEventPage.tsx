"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"

type WalkInEventView = {
  slug: string
  title: string
  [key: string]: unknown
}

type WalkInStatusResponse = {
  eventTitle: string
  status: "ACTIVE" | "NOT_STARTED" | "ENDED"
  dayNumber: number | null
  totalDays: number
  dayLabel: string
  countToday: number
}

type CheckinResponse = {
  success: true
  dayNumber: number
  totalDays: number
  dayLabel: string
  countToday: number
  eventTitle: string
}

function hasBasicPhoneShape(value: string) {
  return /^\+?[\d\s().-]{8,20}$/.test(value.trim())
}

function dayLine(dayNumber: number | null | undefined, totalDays: number | null | undefined, label: string | null | undefined) {
  if (!label) return ""
  if (dayNumber && totalDays && totalDays > 1) return `Day ${dayNumber} of ${totalDays} · ${label}`
  return label
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-6 text-[#F0EDE6] sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-[460px] items-center justify-center">
        <section className="w-full rounded-[8px] border border-[rgba(240,237,230,0.12)] bg-[#141414] px-5 py-7 shadow-[0_18px_60px_rgba(0,0,0,0.35)] sm:px-7 sm:py-8">
          {children}
        </section>
      </div>
    </main>
  )
}

function Brand() {
  return (
    <p className="text-center text-[0.9rem] font-semibold tracking-[0.08em] text-[rgba(240,237,230,0.62)]">
      EventSlot
    </p>
  )
}

export default function PublicWalkInEventPage({ event }: { event: WalkInEventView }) {
  const [status, setStatus] = useState<WalkInStatusResponse | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState("")
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState("")
  const [checkin, setCheckin] = useState<CheckinResponse | null>(null)
  const [sharing, setSharing] = useState<"whatsapp" | "story" | null>(null)

  const eventTitle = status?.eventTitle || event.title
  const activeDayLine = useMemo(
    () => dayLine(status?.dayNumber, status?.totalDays, status?.dayLabel),
    [status?.dayLabel, status?.dayNumber, status?.totalDays],
  )

  useEffect(() => {
    let cancelled = false

    async function loadStatus() {
      setStatusLoading(true)
      setStatusError("")
      try {
        const res = await fetch(`/api/walkin/${event.slug}/status`, { cache: "no-store" })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || "Unable to load check-in status.")
        }
        if (!cancelled) setStatus(data)
      } catch (error) {
        if (!cancelled) {
          setStatusError(error instanceof Error ? error.message : "Unable to load check-in status.")
        }
      } finally {
        if (!cancelled) setStatusLoading(false)
      }
    }

    void loadStatus()
    return () => {
      cancelled = true
    }
  }, [event.slug])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError("")

    if (!name.trim()) {
      setFormError("Please enter your name.")
      return
    }

    if (!hasBasicPhoneShape(phone)) {
      setFormError("Please enter a valid phone number.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/walkin/${event.slug}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setFormError(data.error || "Unable to check in right now.")
        return
      }
      setCheckin(data)
      setStatus((current) => current ? { ...current, countToday: data.countToday } : current)
      setName("")
      setPhone("")
    } catch {
      setFormError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function fetchShareCardFile() {
    const dayParam = checkin?.dayNumber ? `?day=${encodeURIComponent(String(checkin.dayNumber))}` : ""
    const response = await fetch(`/api/walkin/${event.slug}/share-card${dayParam}`, { cache: "no-store" })
    if (!response.ok) {
      throw new Error("Unable to generate share card.")
    }
    const blob = await response.blob()
    return new File([blob], `${event.slug}-walkin-share.png`, { type: blob.type || "image/png" })
  }

  async function downloadFile(file: File) {
    const link = document.createElement("a")
    link.href = URL.createObjectURL(file)
    link.download = file.name
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(link.href), 2000)
  }

  async function handleShare(target: "whatsapp" | "story") {
    if (!checkin) return
    setSharing(target)
    const text = `I attended ${checkin.eventTitle}. ${checkin.countToday.toLocaleString()} people are here today.`
    try {
      const imageFile = await fetchShareCardFile()

      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
        await navigator.share({
          title: checkin.eventTitle,
          text,
          files: [imageFile],
        })
        return
      }

      if (target === "whatsapp") {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer")
      }

      await downloadFile(imageFile)
    } finally {
      setSharing(null)
    }
  }

  if (statusLoading) {
    return (
      <Shell>
        <Brand />
        <div className="mt-12 text-center text-[1.05rem] text-[rgba(240,237,230,0.58)]">
          Loading check-in...
        </div>
      </Shell>
    )
  }

  if (statusError || !status) {
    return (
      <Shell>
        <Brand />
        <h1 className="mt-10 text-center text-[1.8rem] text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
          Check-in unavailable
        </h1>
        <p className="mt-5 text-center text-[1rem] leading-7 text-[rgba(240,237,230,0.58)]">
          {statusError || "Please try again shortly."}
        </p>
      </Shell>
    )
  }

  if (status.status === "NOT_STARTED") {
    return (
      <Shell>
        <Brand />
        <h1 className="mt-10 text-center text-[2rem] leading-tight text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
          {eventTitle}
        </h1>
        <p className="mt-10 text-[1.55rem] font-semibold leading-tight text-[#F0EDE6]">
          This event hasn't started yet.
        </p>
        <p className="mt-8 text-[1.15rem] leading-8 text-[rgba(240,237,230,0.68)]">
          Check-in opens on<br />
          <span className="text-[#C8F55A]">{status.dayLabel}.</span>
        </p>
      </Shell>
    )
  }

  if (status.status === "ENDED") {
    return (
      <Shell>
        <Brand />
        <h1 className="mt-10 text-center text-[2rem] leading-tight text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
          {eventTitle}
        </h1>
        <p className="mt-10 text-[1.55rem] font-semibold leading-tight text-[#F0EDE6]">
          This event has ended.
        </p>
        <p className="mt-4 text-[1.1rem] leading-8 text-[rgba(240,237,230,0.68)]">
          Thanks to everyone who attended.
        </p>
        <a
          href="/"
          className="mt-10 flex min-h-[52px] w-full items-center justify-center rounded-[8px] border border-[rgba(200,245,90,0.35)] bg-[rgba(200,245,90,0.08)] px-5 text-[1rem] font-semibold text-[#C8F55A]"
          style={{ textDecoration: "none" }}
        >
          Visit eventslot.com
        </a>
      </Shell>
    )
  }

  if (checkin) {
    return (
      <Shell>
        <div className="rounded-[8px] bg-[#141414] text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(200,245,90,0.28)] bg-[rgba(200,245,90,0.1)] text-[1.65rem] font-bold text-[#C8F55A]">
            ✓
          </div>
          <h1 className="mt-5 text-center text-[2.05rem] leading-tight text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
            You&apos;re in!
          </h1>
          <p className="mt-8 text-[1.05rem] leading-7 text-[rgba(240,237,230,0.62)]">
            You attended
          </p>
          <p className="mt-2 text-[1.45rem] font-semibold leading-tight text-[#F0EDE6]">
            {checkin.eventTitle}
          </p>
          <p className="mt-3 text-[0.98rem] text-[#C8F55A]">
            {dayLine(checkin.dayNumber, checkin.totalDays, checkin.dayLabel)}
          </p>
          <p className="mt-9 text-[1.12rem] font-semibold text-[#F0EDE6]">
            {checkin.countToday.toLocaleString()} people here today
          </p>
        </div>

        <button
          type="button"
          onClick={() => void handleShare("whatsapp")}
          disabled={sharing !== null}
          className="mt-10 min-h-[54px] w-full rounded-[8px] bg-[#C8F55A] px-5 text-[1rem] font-bold text-[#0A0A0A] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {sharing === "whatsapp" ? "Opening WhatsApp..." : "Share on WhatsApp"}
        </button>
        <button
          type="button"
          onClick={() => void handleShare("story")}
          disabled={sharing !== null}
          className="mt-3 min-h-[54px] w-full rounded-[8px] border border-[rgba(240,237,230,0.16)] px-5 text-[1rem] font-semibold text-[rgba(240,237,230,0.82)] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {sharing === "story" ? "Preparing story..." : "Share Story"}
        </button>
        <button
          type="button"
          onClick={() => setCheckin(null)}
          className="mt-5 w-full text-center text-[0.86rem] text-[rgba(240,237,230,0.45)]"
        >
          Check in another person
        </button>
        <footer className="mt-9 text-center text-[0.78rem] leading-6 text-[rgba(240,237,230,0.38)]">
          <div>Powered by EventSlot</div>
          <div>eventsslot.com</div>
        </footer>
      </Shell>
    )
  }

  return (
    <Shell>
      <Brand />
      <h1 className="mt-10 text-center text-[2rem] leading-tight text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
        {eventTitle}
      </h1>
      <p className="mt-3 text-center text-[1rem] font-semibold text-[#C8F55A]">
        {activeDayLine}
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-6">
        <div>
          <label className="block text-[1rem] font-semibold text-[rgba(240,237,230,0.82)]" htmlFor="walkin-name">
            Your Name
          </label>
          <input
            id="walkin-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 min-h-[56px] w-full rounded-[8px] border border-[rgba(240,237,230,0.18)] bg-[#0F0F0F] px-4 text-[1.15rem] text-[#F0EDE6] outline-none focus:border-[rgba(200,245,90,0.7)]"
          />
        </div>

        <div>
          <label className="block text-[1rem] font-semibold text-[rgba(240,237,230,0.82)]" htmlFor="walkin-phone">
            Phone Number
          </label>
          <input
            id="walkin-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-2 min-h-[56px] w-full rounded-[8px] border border-[rgba(240,237,230,0.18)] bg-[#0F0F0F] px-4 text-[1.15rem] text-[#F0EDE6] outline-none focus:border-[rgba(200,245,90,0.7)]"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="min-h-[58px] w-full rounded-[8px] bg-[#C8F55A] px-5 text-[1.08rem] font-bold text-[#0A0A0A] disabled:cursor-not-allowed disabled:opacity-65"
        >
          {submitting ? "Checking in..." : "I'm Here"}
        </button>

        {formError && (
          <p className="text-center text-[0.95rem] leading-6 text-[#FF6B6B]">
            {formError}
          </p>
        )}
      </form>
    </Shell>
  )
}
