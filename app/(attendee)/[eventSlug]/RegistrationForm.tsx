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

type AttendeeResult = {
  status: 'confirmed' | 'waitlist'
  waitlistPosition?: number
}

type BulkResult = {
  success: true
  results: AttendeeResult[]
  eventTitle: string
}

type AttendeeAnswers = Record<string, string>

function emptyAnswers(questions: EventQuestion[]): AttendeeAnswers {
  return Object.fromEntries(questions.map(q => [q.id, ""]))
}

export default function RegistrationForm({ event }: EventProps) {
  const [attendees, setAttendees] = useState<AttendeeAnswers[]>([emptyAnswers(event.questions)])
  const [loading, setLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null)
  const [error, setError] = useState("")

  const MAX_ATTENDEES = 20

  function addAttendee() {
    if (attendees.length >= MAX_ATTENDEES) return
    setAttendees(a => [...a, emptyAnswers(event.questions)])
  }

  function removeAttendee(index: number) {
    setAttendees(a => a.filter((_, i) => i !== index))
  }

  function handleChange(attendeeIndex: number, qId: string, value: string) {
    setAttendees(a => {
      const next = [...a]
      next[attendeeIndex] = { ...next[attendeeIndex], [qId]: value }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const attendeesPayload = attendees.map(form => ({
        answers: event.questions.map(q => ({ questionId: q.id, value: form[q.id] || "" })),
      }))
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug: event.slug, attendees: attendeesPayload }),
      })
      const data = await res.json()
      if (data.success) {
        setBulkResult(data)
      } else {
        setError(data.error || "Registration failed.")
      }
    } catch {
      setError("Unexpected error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Success screen
  if (bulkResult) {
    const allConfirmed = bulkResult.results.every(r => r.status === "confirmed")
    const allWaitlist = bulkResult.results.every(r => r.status === "waitlist")
    return (
      <div className="mx-auto max-w-[480px] rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)] text-[#C8F55A]">
          <span className="block h-3 w-5 rotate-[-45deg] border-b-4 border-l-4 border-[#C8F55A]" />
        </div>
        <h2 className="text-center text-[1.5rem] font-semibold text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
          {allConfirmed ? "You're in" : allWaitlist ? "You're on the waitlist" : "Registration received"}
        </h2>
        <p className="mt-2 mb-5 text-center text-[0.875rem] text-[rgba(240,237,230,0.5)]">
          {event.title}
        </p>
        <div className="space-y-2">
          {bulkResult.results.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-[8px] border border-[rgba(240,237,230,0.08)] bg-[rgba(240,237,230,0.03)] px-4 py-3"
            >
              <span className="text-[0.875rem] text-[rgba(240,237,230,0.7)]" style={{ fontFamily: "var(--font-dm-sans)" }}>
                Attendee {i + 1}
              </span>
              {r.status === "confirmed" ? (
                <span className="rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)] px-3 py-1 text-[0.7rem] text-[#C8F55A]">
                  Confirmed
                </span>
              ) : (
                <span className="rounded-full border border-[rgba(240,237,230,0.15)] bg-[rgba(240,237,230,0.06)] px-3 py-1 text-[0.7rem] text-[rgba(240,237,230,0.55)]">
                  Waitlist #{r.waitlistPosition}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    )
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

      {/* Bulk prompt row */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: "0.8rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)" }}>
          Registering more than one person?
        </span>
        {attendees.length < MAX_ATTENDEES && (
          <button
            type="button"
            onClick={addAttendee}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(200,245,90,0.12)",
              border: "0.5px solid rgba(200,245,90,0.3)",
              color: "#C8F55A",
              fontSize: "1.1rem",
              lineHeight: 1,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            aria-label="Add attendee"
          >
            +
          </button>
        )}
      </div>

      {/* Attendee blocks */}
      {attendees.map((form, attendeeIndex) => (
        <div key={attendeeIndex}>
          {/* Divider between attendees */}
          {attendeeIndex > 0 && (
            <div style={{ borderTop: "0.5px solid rgba(240,237,230,0.08)", margin: "1.25rem 0" }} />
          )}

          {/* Attendee header */}
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.35)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-dm-sans)" }}>
              Attendee {attendeeIndex + 1}
            </span>
            {attendeeIndex > 0 && (
              <button
                type="button"
                onClick={() => removeAttendee(attendeeIndex)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(240,237,230,0.35)",
                  cursor: "pointer",
                  fontSize: "1rem",
                  lineHeight: 1,
                  padding: "0 2px",
                }}
                aria-label="Remove attendee"
              >
                ×
              </button>
            )}
          </div>

          {/* Questions for this attendee */}
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
                    onChange={e => handleChange(attendeeIndex, q.id, e.target.value)}
                  />
                )}
                {q.type === "email" && (
                  <input
                    type="email"
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    required={q.required}
                    value={form[q.id]}
                    onChange={e => handleChange(attendeeIndex, q.id, e.target.value)}
                  />
                )}
                {q.type === "phone" && (
                  <input
                    type="tel"
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    required={q.required}
                    value={form[q.id]}
                    onChange={e => handleChange(attendeeIndex, q.id, e.target.value)}
                  />
                )}
                {q.type === "select" && (
                  <select
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    required={q.required}
                    value={form[q.id]}
                    onChange={e => handleChange(attendeeIndex, q.id, e.target.value)}
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
        </div>
      ))}

      <button
        type="submit"
        className={`w-full rounded-full px-5 py-3 text-[0.875rem] font-semibold ${loading ? 'bg-[#C8F55A] text-[#0A0A0A] opacity-60 cursor-not-allowed' : 'bg-[#C8F55A] text-[#0A0A0A]'}`}
        disabled={loading}
      >
        {loading ? "Submitting..." : attendees.length > 1 ? `Register ${attendees.length} attendees` : "Register"}
      </button>
      {error && <div className="mt-2 text-[0.82rem] text-[#FF6B6B] text-center">{error}</div>}
    </form>
  )
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
