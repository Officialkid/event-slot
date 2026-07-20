"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck } from "lucide-react"

type AccessResponse = {
  success?: boolean
  error?: string
  event?: {
    title: string
    slug: string
    location: string | null
    eventDate: string | null
    status: string
    ticketsEnabled: boolean
  }
  accessToken?: string
}

export function VerifyAccessForm() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [humanConfirmed, setHumanConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError("")

    if (!humanConfirmed) {
      setError("Confirm you are human before opening the verifier workspace.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/verify-tickets/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })
      const data = (await res.json()) as AccessResponse

      if (!res.ok || !data.success || !data.event?.slug || !data.accessToken) {
        setError(data.error ?? "Could not open verifier workspace.")
        return
      }

      router.push(`/verify-tickets/${data.event.slug}?token=${encodeURIComponent(data.accessToken)}`)
    } catch {
      setError("Connection error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl shadow-black/10 md:p-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#C8F55A]/30 bg-[#C8F55A]/10">
          <ShieldCheck className="h-6 w-6 text-[#C8F55A]" />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#C8F55A]">
            Enter verifier code
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Ask the event organiser for the event verifier code. This opens only
            the scan, upload, and search tools for that event.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <label className="mb-2 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">
          Event verifier code
        </label>
        <input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="EV-12AB34CD"
          autoCapitalize="characters"
          className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-input)] px-4 py-4 text-lg font-bold uppercase tracking-[0.08em] text-[var(--text-primary)] outline-none"
        />
      </div>

      <label className="mt-4 flex items-start gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
        <input
          type="checkbox"
          checked={humanConfirmed}
          onChange={(event) => setHumanConfirmed(event.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span>
          I confirm I am a human verifier for this event. If reCAPTCHA or
          Turnstile keys are configured, EventSlot will enforce the provider
          challenge before access is granted.
        </span>
      </label>

      {error && (
        <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-5 w-full rounded-full bg-[#C8F55A] px-5 py-4 text-sm font-black text-black transition disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Opening verifier..." : "Open verifier workspace"}
      </button>
    </form>
  )
}
