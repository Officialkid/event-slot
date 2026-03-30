"use client"

import React, { useState } from "react"

type EventQuestion = {
  id: string
  label: string
  type: string
  options?: string[]
  required: boolean
}

type EventProps = {
  event: {
    slug: string
    title: string
    description?: string | null
    capacity?: number | null
    confirmedCount: number
    questions: EventQuestion[]
  }
}

type RegistrationResult = {
  status: 'confirmed' | 'waitlist'
  waitlistPosition?: number
}

export default function RegistrationForm({ event }: EventProps) {
  const [form, setForm] = useState(() =>
    Object.fromEntries(event.questions.map(q => [q.id, ""]))
  )
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RegistrationResult | null>(null)
  const [error, setError] = useState("")

  const handleChange = (id: string, value: string) => {
    setForm(f => ({ ...f, [id]: value }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const answers = event.questions.map(q => ({
        questionId: q.id,
        value: form[q.id] || ""
      }))
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug: event.slug, answers }),
      })
      const data = await res.json()
      if (data.success) {
        setResult(data)
      } else {
        setError(data.error || "Registration failed.")
      }
    } catch {
      setError("Unexpected error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    if (result.status === "confirmed") {
      return (
        <div className="mx-auto max-w-[480px] rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)] text-[#C8F55A]">
            <span className="block h-3 w-5 rotate-[-45deg] border-b-4 border-l-4 border-[#C8F55A]" />
          </div>
          <h2 className="text-[1.6rem] font-semibold text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
            You&apos;re in
          </h2>
          <p className="mt-3 text-[0.95rem] text-[rgba(240,237,230,0.6)]">
            You are confirmed for {event.title}
          </p>
          <span className="mt-4 inline-flex rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)] px-3 py-1 text-[0.7rem] text-[#C8F55A]">
            Confirmed
          </span>
        </div>
      )
    } else {
      return (
        <div className="mx-auto max-w-[480px] rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(240,237,230,0.15)] bg-[rgba(240,237,230,0.06)] text-[rgba(240,237,230,0.55)]">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(240,237,230,0.15)]">
              <span className="absolute h-3 w-3 rounded-full bg-[rgba(240,237,230,0.55)]" />
              <span className="absolute top-0 left-1 h-5 w-0.5 bg-[rgba(240,237,230,0.55)]" />
            </div>
          </div>
          <h2 className="text-[1.6rem] font-semibold text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
            You&apos;re on the waitlist
          </h2>
          <p className="mt-3 text-[0.95rem] text-[rgba(240,237,230,0.6)]">
            Position #{result.waitlistPosition}. If a slot opens, you will be notified.
          </p>
          <span className="mt-4 inline-flex rounded-full border border-[rgba(240,237,230,0.15)] bg-[rgba(240,237,230,0.06)] px-3 py-1 text-[0.7rem] text-[rgba(240,237,230,0.55)]">
            Waitlist
          </span>
        </div>
      )
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto w-full max-w-[480px] rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-7 space-y-6">
      <div>
        <h1 className="text-[1.5rem] font-semibold text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
          {event.title}
        </h1>
        {event.description && <p className="mt-2 text-[0.875rem] font-[300] text-[rgba(240,237,230,0.45)]">{event.description}</p>}
      </div>

      {typeof event.capacity === "number" && (
        <div className="space-y-3">
          <div className="h-1.5 overflow-hidden rounded-[8px] bg-[rgba(240,237,230,0.06)]">
            <div className="h-full bg-[#C8F55A]" style={{ width: `${Math.min(100, Math.round((event.confirmedCount / event.capacity) * 100))}%` }} />
          </div>
          <div className="flex items-center justify-between text-[0.72rem] text-[rgba(240,237,230,0.45)]">
            <span>{event.confirmedCount} of {event.capacity} confirmed</span>
            <span className={`rounded-full px-3 py-1 text-[0.7rem] ${event.confirmedCount < event.capacity ? 'bg-[rgba(200,245,90,0.12)] text-[#C8F55A] border border-[rgba(200,245,90,0.3)]' : 'bg-[rgba(255,107,107,0.1)] text-[#FF6B6B] border border-[rgba(255,107,107,0.3)]'}`}>
              {event.confirmedCount < event.capacity ? `${event.capacity - event.confirmedCount} spots remaining` : 'Full'}
            </span>
          </div>
          <div className="border-t border-[rgba(240,237,230,0.08)] mt-4" />
        </div>
      )}

      <div className="space-y-4">
        {event.questions.map(q => (
          <div key={q.id}>
            <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
              {q.label}{q.required && <span className="text-[#C8F55A]"> *</span>}
            </label>
            {q.type === "text" && (
              <input
                type="text"
                className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                required={q.required}
                value={form[q.id]}
                onChange={e => handleChange(q.id, e.target.value)}
              />
            )}
            {q.type === "email" && (
              <input
                type="email"
                className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                required={q.required}
                value={form[q.id]}
                onChange={e => handleChange(q.id, e.target.value)}
              />
            )}
            {q.type === "phone" && (
              <input
                type="tel"
                className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                required={q.required}
                value={form[q.id]}
                onChange={e => handleChange(q.id, e.target.value)}
              />
            )}
            {q.type === "select" && (
              <select
                className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                required={q.required}
                value={form[q.id]}
                onChange={e => handleChange(q.id, e.target.value)}
              >
                <option value="" className="bg-[#141414] text-[#F0EDE6]">Select...</option>
                {q.options?.map(opt => (
                  <option key={opt} value={opt} className="bg-[#141414] text-[#F0EDE6]">
                    {opt}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>

      <button
        type="submit"
        className={`w-full rounded-full px-5 py-3 text-[0.875rem] font-semibold ${loading ? 'bg-[#C8F55A] text-[#0A0A0A] opacity-60 cursor-not-allowed' : 'bg-[#C8F55A] text-[#0A0A0A]'}`}
        disabled={loading}
      >
        {loading ? "Submitting..." : "Register"}
      </button>
      {error && <div className="mt-2 text-[0.82rem] text-[#FF6B6B] text-center">{error}</div>}
    </form>
  )
}
