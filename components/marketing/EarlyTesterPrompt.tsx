"use client"

import { type FormEvent, useEffect, useState } from "react"
import { ArrowRight, CheckCircle2, X } from "lucide-react"

const DISMISS_KEY = "eventslot-early-tester-dismissed"
const TESTER_PROMPT_ENABLED = process.env.NEXT_PUBLIC_APP_TESTER_PROMPT_ENABLED !== "false"

export function EarlyTesterPrompt({ enabled = true }: { enabled?: boolean }) {
  const [visible, setVisible] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !TESTER_PROMPT_ENABLED) return
    if (window.localStorage.getItem(DISMISS_KEY) !== "true") {
      const timer = window.setTimeout(() => setVisible(true), 900)
      return () => window.clearTimeout(timer)
    }
  }, [enabled])

  if (!visible) return null

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "true")
    setVisible(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/app-testers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Could not save your email.")
      }
      setMessage(
        payload?.emailSent === false
          ? "You are on the early tester list. We saved your email, but the confirmation email could not be sent yet."
          : payload?.optInUrlAvailable
            ? "You are on the early tester list. Please check your email for the Play Store testing invite."
            : "You are on the early tester list. Please check your email for confirmation."
      )
      setEmail("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your email.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <aside className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-[28px] border border-[var(--border-emphasis)] bg-[var(--surface)] p-4 text-[var(--text-primary)] shadow-[0_24px_90px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:left-auto sm:right-5 sm:w-[420px]">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-4 top-4 rounded-full border border-[var(--border-subtle)] p-2 text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
        aria-label="Dismiss early tester invite"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="pr-10">
        <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(200,245,90,0.28)] bg-[rgba(200,245,90,0.09)] px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.16em] text-[#C8F55A]">
          <span className="h-2 w-2 rounded-full bg-[#C8F55A]" />
          App testing
        </div>
        <h2 className="mt-3 text-[1.25rem] font-semibold leading-tight text-[var(--text-primary)]">
          EventSlot is preparing for Play Store testing.
        </h2>
        <p className="mt-2 text-[0.9rem] leading-6 text-[var(--text-secondary)]">
          Join the early tester list and we will email you when the app testing track opens.
        </p>
      </div>

      <form onSubmit={submit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="your@email.com"
          className="min-h-[48px] flex-1 rounded-full border border-[var(--border)] bg-[var(--bg-input)] px-4 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#C8F55A] px-5 text-sm font-black text-[#0A0A0A] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Saving..." : "Join testers"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </form>

      {message ? <p className="mt-3 text-sm font-semibold text-[#C8F55A]">{message}</p> : null}
      {error ? <p className="mt-3 text-sm font-semibold text-[#FF9A8A]">{error}</p> : null}

      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="mt-3 text-sm font-bold text-[#C8F55A] underline-offset-4 hover:underline"
      >
        {expanded ? "Hide details" : "More about testing"}
      </button>

      {expanded ? (
        <div className="mt-3 grid gap-2 rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3 text-[0.82rem] leading-5 text-[var(--text-secondary)]">
          {[
            "Use the app regularly so we can catch real mobile issues.",
            "Create test events, register, verify tickets, and check exports.",
            "Share feedback quickly so EventSlot is stronger before public launch.",
          ].map((item) => (
            <div key={item} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#C8F55A]" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
