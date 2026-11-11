"use client"

import React, { useState } from "react"
import { Bell, CheckCircle2, Clock, Loader2 } from "lucide-react"

interface RecurringNotifyCardProps {
  slug: string
  eventTitle: string
  label: string
  opensAt?: Date | null
  initialEmail?: string
}

export function RecurringNotifyCard({
  slug,
  eventTitle,
  label,
  opensAt,
  initialEmail = "",
}: RecurringNotifyCardProps) {
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/events/${encodeURIComponent(slug)}/notify-open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to save alert. Please try again.")
        return
      }

      setSuccess(true)
      setMessage(data.message || "You're on the priority list! We'll email you when registration opens.")
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const openNotice = opensAt
    ? `${opensAt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })} at ${opensAt.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" })}`
    : null

  if (success) {
    return (
      <div
        className="w-full my-4 p-5 rounded-2xl border text-center transition-all animate-in fade-in"
        style={{
          background: "color-mix(in srgb, var(--accent) 12%, var(--surface))",
          borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)",
        }}
      >
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-[#15803D] dark:text-[#C8F55A]">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h4 className="text-base font-bold text-[var(--text-primary)] mb-1">
          You&apos;re on the Priority List!
        </h4>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">
          {message}
        </p>
      </div>
    )
  }

  return (
    <div
      role="region"
      aria-label="Recurring registration notification"
      className="w-full my-4 p-5 rounded-2xl border transition-all"
      style={{
        background: "color-mix(in srgb, var(--surface) 95%, transparent)",
        borderColor: "color-mix(in srgb, var(--text-primary) 14%, transparent)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{
            background: "color-mix(in srgb, var(--accent) 15%, transparent)",
            color: "var(--accent)",
          }}
        >
          <Clock className="h-5 w-5" />
        </div>
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 mb-1 border border-amber-500/20">
            <span>⏳</span>
            <span>Registration Opens Soon</span>
          </div>
          <h4 className="text-[0.95rem] font-bold text-[var(--text-primary)] m-0 leading-snug">
            {openNotice ? `Opens ${openNotice}` : label}
          </h4>
          <p className="text-xs text-[var(--text-secondary)] mt-1 mb-0 leading-relaxed">
            This is a weekly recurring event. Registrations open on schedule to ensure fair seating. Enter your email below to be notified the exact minute slots become available!
          </p>
        </div>
      </div>

      <form onSubmit={handleSubscribe} className="mt-4 flex flex-col sm:flex-row items-stretch gap-2">
        <div className="relative flex-1">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email for priority alert..."
            required
            disabled={loading}
            className="w-full rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm font-medium transition focus:outline-none"
            style={{
              background: "var(--surface-2, #18181B)",
              borderColor: error ? "#EF4444" : "var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs sm:text-sm font-bold text-black transition active:scale-[0.98] disabled:opacity-50 shrink-0"
          style={{
            background: "var(--accent)",
            boxShadow: "0 4px 14px rgba(200,245,90,0.25)",
          }}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-black" />
          ) : (
            <Bell className="h-4 w-4 text-black" />
          )}
          <span>Notify Me When Open</span>
        </button>
      </form>

      {error && (
        <p className="mt-2 text-xs text-red-500 m-0">
          {error}
        </p>
      )}
    </div>
  )
}
