"use client"

import React, { useState } from "react"
import Image from "next/image"

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
    organizerEmail: string
    eventDate?: Date | null
    location?: string | null
    communityLink?: string | null
    imageUrl?: string | null
    createdAt: Date
  }
}

type AttendeeResult = {
  status: 'confirmed' | 'waitlist'
  waitlistPosition?: number
  registrationId: string
  registrationNumber?: number
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
  const [consentTransactional, setConsentTransactional] = useState(false)
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [consentError, setConsentError] = useState("")

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
    setError("")
    setConsentError("")

    // Client-side required field validation
    for (let i = 0; i < attendees.length; i++) {
      for (const q of event.questions) {
        if (q.required && !attendees[i][q.id]?.trim()) {
          setError(`Please fill in "${q.label}"${attendees.length > 1 ? ` for attendee ${i + 1}` : ""}.`)
          return
        }
      }
    }

    if (!consentTransactional) {
      setConsentError("You must agree to receive event notifications to register.")
      return
    }

    setLoading(true)
    try {
      const attendeesPayload = attendees.map(form => ({
        answers: event.questions.map(q => ({ questionId: q.id, value: form[q.id] || "" })),
      }))
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventSlug: event.slug, attendees: attendeesPayload, consentTransactional, consentMarketing }),
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
    const isSingle = bulkResult.results.length === 1
    const communityLink = event.communityLink

    const getCommunityLinkLabel = (url: string): string => {
      if (url.includes("whatsapp") || url.includes("wa.me")) return "Join WhatsApp Group →"
      if (url.includes("t.me") || url.includes("telegram")) return "Join Telegram Group →"
      return url
    }

    return (
      <div className="mx-auto w-full max-w-[480px] space-y-4">
        {bulkResult.results.map((r, i) => (
          <div key={i} className="rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-8">
            {r.status === "confirmed" ? (
              <>
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)]">
                  <span className="block h-3 w-5 rotate-[-45deg] border-b-4 border-l-4 border-[#C8F55A]" />
                </div>
                <h2 className="text-center text-[1.6rem] text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)", fontWeight: 400 }}>
                  {isSingle ? "You're in!" : `Attendee ${i + 1} — You're in!`}
                </h2>
                <p className="mx-auto mt-3 max-w-[360px] text-center text-[0.95rem] text-[rgba(240,237,230,0.6)]" style={{ fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
                  Thank you for registering for {event.title}. Your slot is confirmed and we look forward to seeing you.
                </p>
                <div className="mt-4 flex justify-center">
                  <span className="rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)] px-3 py-1 text-[0.7rem] text-[#C8F55A]">
                    Confirmed
                  </span>
                </div>
                {r.registrationNumber && (
                  <p className="mt-3 text-center text-[0.72rem] text-[rgba(240,237,230,0.35)]" style={{ fontFamily: "var(--font-dm-sans)" }}>
                    Registration #{String(r.registrationNumber).padStart(4, "0")}
                  </p>
                )}
                {communityLink && (
                  <div className="mt-5 rounded-[8px] px-5 py-4" style={{ background: "rgba(200,245,90,0.06)", border: "0.5px solid rgba(200,245,90,0.15)" }}>
                    <p style={{ fontSize: "0.7rem", color: "#C8F55A", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>
                      Join the community
                    </p>
                    <a
                      href={communityLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full rounded-full border border-[rgba(200,245,90,0.4)] px-4 py-2 text-center text-[0.875rem] text-[#C8F55A]"
                      style={{ fontFamily: "var(--font-dm-sans)" }}
                    >
                      {getCommunityLinkLabel(communityLink)}
                    </a>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(240,237,230,0.15)] bg-[rgba(240,237,230,0.06)]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(240,237,230,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h2 className="text-center text-[1.6rem] text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)", fontWeight: 400 }}>
                  {isSingle ? "You're on the waitlist" : `Attendee ${i + 1} — Waitlist`}
                </h2>
                <p className="mx-auto mt-3 max-w-[360px] text-center text-[0.95rem] text-[rgba(240,237,230,0.6)]" style={{ fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
                  Thank you for your interest in {event.title}. You are currently position #{r.waitlistPosition} on the waitlist. We will notify you if a slot opens up.
                </p>
                <div className="mt-4 flex justify-center">
                  <span className="rounded-full border border-[rgba(240,237,230,0.15)] bg-[rgba(240,237,230,0.06)] px-3 py-1 text-[0.7rem] text-[rgba(240,237,230,0.55)]">
                    Waitlist #{r.waitlistPosition}
                  </span>
                </div>
                {r.registrationNumber && (
                  <p className="mt-3 text-center text-[0.72rem] text-[rgba(240,237,230,0.35)]" style={{ fontFamily: "var(--font-dm-sans)" }}>
                    Registration #{String(r.registrationNumber).padStart(4, "0")}
                  </p>
                )}
              </>
            )}
            <div style={{ textAlign: "center", marginTop: "1rem", display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              <a
                href={`/registration/${r.registrationId}`}
                style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.35)", textDecoration: "none" }}
              >
                View status
              </a>
              <a
                href={`/registration/${r.registrationId}/edit`}
                style={{ fontSize: "0.78rem", color: "rgba(200,245,90,0.5)", textDecoration: "none" }}
              >
                Edit your details →
              </a>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[480px]">
      {/* Event poster */}
      {event.imageUrl && (
        <div className="mb-5 relative w-full overflow-hidden rounded-[12px] border border-[rgba(240,237,230,0.08)]" style={{ height: 220 }}>
          <Image src={event.imageUrl} alt={`${event.title} poster`} fill style={{ objectFit: "cover" }} unoptimized />
        </div>
      )}
      {/* Event header */}
      <div style={{ marginBottom: "0.5rem" }}>
        <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", color: "#F0EDE6", lineHeight: 1.2, fontWeight: 400, marginBottom: "0.35rem" }}>
          {event.title}
        </h1>
        <p style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.4)", marginBottom: event.description ? "0.75rem" : "0.5rem" }}>
          Organised by {event.organizerEmail}
        </p>
        {event.description && (
          <p style={{ fontWeight: 300, fontSize: "0.95rem", color: "rgba(240,237,230,0.6)", lineHeight: 1.65, marginBottom: "0.75rem", maxWidth: 480 }}>
            {event.description}
          </p>
        )}
        {(event.eventDate || event.location) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "0.75rem" }}>
            {event.eventDate && (
              <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.5)" }}>
                {new Date(event.eventDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {new Date(event.eventDate).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase()}
              </p>
            )}
            {event.location && (
              <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.5)" }}>
                📍 {event.location}
              </p>
            )}
          </div>
        )}
        {typeof event.capacity === "number" && (
          <div style={{ marginTop: "0.75rem" }}>
            <div className="space-y-2">
              <div className="h-1.5 overflow-hidden rounded-[8px] bg-[rgba(240,237,230,0.06)]">
                <div className="h-full bg-[#C8F55A]" style={{ width: `${Math.min(100, Math.round((event.confirmedCount / event.capacity) * 100))}%` }} />
              </div>
              <div className="flex items-center justify-between text-[0.72rem] text-[rgba(240,237,230,0.45)]">
                <span>{event.confirmedCount} of {event.capacity} confirmed</span>
                <span className={`rounded-full px-3 py-1 text-[0.7rem] ${event.confirmedCount < event.capacity ? 'bg-[rgba(200,245,90,0.12)] text-[#C8F55A] border border-[rgba(200,245,90,0.3)]' : 'bg-[rgba(255,107,107,0.1)] text-[#FF6B6B] border border-[rgba(255,107,107,0.3)]'}`}>
                  {event.confirmedCount < event.capacity ? `${event.capacity - event.confirmedCount} spots remaining` : 'Full'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ margin: "1.5rem 0", borderTop: "0.5px solid rgba(240,237,230,0.08)" }} />

      <form onSubmit={handleSubmit} className="w-full rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-7 space-y-6">
        <p style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.35)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          Fill in your details
        </p>

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

      {/* Consent checkboxes */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingTop: "0.25rem" }}>
        {/* Checkbox 1 — Required */}
        <label style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start", cursor: "pointer" }}>
          <span style={{ position: "relative", flexShrink: 0, marginTop: "2px" }}>
            <input
              type="checkbox"
              checked={consentTransactional}
              onChange={e => { setConsentTransactional(e.target.checked); if (e.target.checked) setConsentError("") }}
              style={{ position: "absolute", opacity: 0, width: 16, height: 16, margin: 0, cursor: "pointer" }}
            />
            <span style={{
              display: "block",
              width: 16,
              height: 16,
              borderRadius: 3,
              border: consentTransactional ? "1.5px solid #C8F55A" : "1.5px solid rgba(240,237,230,0.2)",
              background: consentTransactional ? "#C8F55A" : "transparent",
              flexShrink: 0,
              transition: "background 0.15s, border 0.15s",
            }}>
              {consentTransactional && (
                <svg width="10" height="7" viewBox="0 0 10 7" fill="none" style={{ display: "block", margin: "3px auto 0" }}>
                  <path d="M1 3.5L3.8 6 9 1" stroke="#0A0A0A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          </span>
          <span style={{ fontSize: "0.8rem", color: "rgba(240,237,230,0.6)", lineHeight: 1.5, fontFamily: "var(--font-dm-sans)" }}>
            I agree to receive updates about this event, including registration confirmation and waitlist notifications. (Required)
          </span>
        </label>
        {consentError && (
          <div style={{ fontSize: "0.78rem", color: "#FF6B6B", marginTop: "-0.25rem", paddingLeft: "1.6rem" }}>{consentError}</div>
        )}

        {/* Checkbox 2 — Optional */}
        <label style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start", cursor: "pointer" }}>
          <span style={{ position: "relative", flexShrink: 0, marginTop: "2px" }}>
            <input
              type="checkbox"
              checked={consentMarketing}
              onChange={e => setConsentMarketing(e.target.checked)}
              style={{ position: "absolute", opacity: 0, width: 16, height: 16, margin: 0, cursor: "pointer" }}
            />
            <span style={{
              display: "block",
              width: 16,
              height: 16,
              borderRadius: 3,
              border: consentMarketing ? "1.5px solid #C8F55A" : "1.5px solid rgba(240,237,230,0.2)",
              background: consentMarketing ? "#C8F55A" : "transparent",
              flexShrink: 0,
              transition: "background 0.15s, border 0.15s",
            }}>
              {consentMarketing && (
                <svg width="10" height="7" viewBox="0 0 10 7" fill="none" style={{ display: "block", margin: "3px auto 0" }}>
                  <path d="M1 3.5L3.8 6 9 1" stroke="#0A0A0A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </span>
          </span>
          <span style={{ fontSize: "0.8rem", color: "rgba(240,237,230,0.45)", lineHeight: 1.5, fontFamily: "var(--font-dm-sans)" }}>
            I would like to hear about future events from this organiser. (Optional)
          </span>
        </label>

        {/* Privacy note */}
        <p style={{ fontSize: "0.7rem", color: "rgba(240,237,230,0.25)", lineHeight: 1.5, margin: "0.25rem 0 0", fontFamily: "var(--font-dm-sans)" }}>
          Your data is protected under Kenya&apos;s Data Protection Act 2019. We never sell your information.
        </p>
      </div>

      <button
        type="submit"
        className={`w-full rounded-full px-5 py-3 text-[0.875rem] font-semibold ${loading ? 'bg-[#C8F55A] text-[#0A0A0A] opacity-60 cursor-not-allowed' : 'bg-[#C8F55A] text-[#0A0A0A]'}`}
        disabled={loading}
      >
        {loading ? "Submitting..." : attendees.length > 1 ? `Register ${attendees.length} attendees` : "Register"}
      </button>
      {error && <div className="mt-2 text-[0.82rem] text-[#FF6B6B] text-center">{error}</div>}
      </form>
    </div>
  )
}
