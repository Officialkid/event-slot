"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"

type Question = {
  id: string
  label: string
  type: string
  options?: string[]
  required: boolean
}

type RegistrationItem = {
  id: string
  answers: Array<{ questionId: string; value: string }>
  submittedAt: string
  waitlistPosition?: number | null
}

type EventData = {
  title: string
  description?: string
  capacity: number | null
  deadline?: string | null
  confirmedCount: number
  waitlistCount: number
  slug: string
  questions: Question[]
}

export default function OrganizerDashboardPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params?.slug
  const token = searchParams?.get("token") || ""

  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [eventData, setEventData] = useState<EventData | null>(null)
  const [confirmed, setConfirmed] = useState<RegistrationItem[]>([])
  const [waitlist, setWaitlist] = useState<RegistrationItem[]>([])
  const [error, setError] = useState("")
  const [newCapacity, setNewCapacity] = useState("")
  const [capacityMessage, setCapacityMessage] = useState("")
  const [updating, setUpdating] = useState(false)
  const [origin, setOrigin] = useState("")

  const fetchDashboard = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    setAccessDenied(false)
    setError("")
    try {
      const url = `/api/events/${slug}?token=${encodeURIComponent(token)}`
      const res = await fetch(url)
      const data = await res.json()
      if (res.status === 401) {
        setAccessDenied(true)
        return
      }
      if (!res.ok || !data.success) {
        setError(data.error || "Unable to load dashboard")
        return
      }
      setEventData(data.event)
      setConfirmed(data.confirmed)
      setWaitlist(data.waitlist)
    } catch {
      setError("Unable to load dashboard. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [slug, token])

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const questionLabels = useMemo(() => eventData?.questions.map(q => q.label) || [], [eventData])

  const registrationLink = origin && eventData ? `${origin}/${eventData.slug}` : ""
  const capacityDisplay = eventData?.capacity === null ? "Unlimited" : eventData?.capacity ?? "Unlimited"
  const slotsRemaining = eventData?.capacity === null ? "Unlimited" : eventData ? Math.max(0, eventData.capacity - eventData.confirmedCount) : "Unlimited"

  const handleCapacityUpdate = async () => {
    if (!eventData) return
    setCapacityMessage("")
    setError("")
    const parsed = Number(newCapacity)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError("Please enter a valid positive number for capacity.")
      return
    }
    if (eventData.capacity !== null && parsed <= eventData.capacity) {
      setError("New capacity must be greater than current capacity.")
      return
    }

    setUpdating(true)
    try {
      const res = await fetch(`/api/events/${slug}/capacity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newCapacity: parsed, token }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || "Unable to update capacity.")
        return
      }
      setCapacityMessage(`${data.promoted} people moved from waitlist to confirmed`)
      setNewCapacity("")
      await fetchDashboard()
    } catch {
      setError("Unable to update capacity. Please try again.")
    } finally {
      setUpdating(false)
    }
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] px-4 py-12">
        <div className="mx-auto max-w-[720px] rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-10 text-center">
          <h1 className="text-[1.8rem] font-semibold text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
            Access denied
          </h1>
          <p className="mt-3 text-[0.9rem] font-[300] text-[rgba(240,237,230,0.45)]">
            Invalid or missing dashboard link.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] px-4 py-10">
        <div className="mx-auto max-w-[1000px] space-y-6">
          <div className="h-10 rounded-[8px] bg-[#141414] animate-pulse opacity-70" />
          <div className="h-8 rounded-[8px] bg-[#141414] animate-pulse opacity-70" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="h-24 rounded-[8px] bg-[#141414] animate-pulse opacity-70" />
            <div className="h-24 rounded-[8px] bg-[#141414] animate-pulse opacity-70" />
            <div className="h-24 rounded-[8px] bg-[#141414] animate-pulse opacity-70" />
            <div className="h-24 rounded-[8px] bg-[#141414] animate-pulse opacity-70" />
          </div>
          <div className="h-80 rounded-[8px] bg-[#141414] animate-pulse opacity-70" />
        </div>
      </div>
    )
  }

  if (error && !eventData) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] px-4 py-12">
        <div className="mx-auto max-w-[720px] rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-10 text-center">
          <p className="text-[0.95rem] text-[rgba(240,237,230,0.45)]">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] px-4 py-8">
      <div className="mx-auto max-w-[1000px] space-y-8 text-[#F0EDE6]">
        <header className="space-y-4">
          <a href="/" className="text-[0.8rem] text-[rgba(240,237,230,0.35)]">← Back to home</a>
          <div>
            <h1 className="text-[1.8rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)" }}>
              {eventData?.title}
            </h1>
            {eventData?.deadline && new Date(eventData.deadline) > new Date() && (
              <p className="mt-2 text-[0.75rem] text-[rgba(240,237,230,0.35)]">
                Closes {new Date(eventData.deadline).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
            {eventData?.deadline && new Date(eventData.deadline) < new Date() && (
              <span className="mt-3 inline-flex rounded-full border border-[rgba(255,107,107,0.3)] bg-[rgba(255,107,107,0.1)] px-3 py-1 text-[0.7rem] text-[#FF6B6B]">
                Closed
              </span>
            )}
          </div>
          <div className="flex flex-col gap-3 rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-4 sm:flex-row sm:items-center sm:justify-between">
            <input
              readOnly
              value={registrationLink}
              className="w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem]"
            />
            <button
              type="button"
              className="rounded-full border border-[rgba(240,237,230,0.15)] bg-transparent px-4 py-2 text-[0.8rem] text-[rgba(240,237,230,0.6)]"
              onClick={() => navigator.clipboard.writeText(registrationLink)}
            >
              Copy link
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-[8px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-4">
            <div className="text-[0.68rem] uppercase tracking-[0.08em] text-[rgba(240,237,230,0.35)] mb-2">Confirmed</div>
            <div className="text-[1.6rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)" }}>{eventData?.confirmedCount}</div>
          </div>
          <div className="rounded-[8px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-4">
            <div className="text-[0.68rem] uppercase tracking-[0.08em] text-[rgba(240,237,230,0.35)] mb-2">Waitlist</div>
            <div className="text-[1.6rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)" }}>{eventData?.waitlistCount}</div>
          </div>
          <div className="rounded-[8px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-4">
            <div className="text-[0.68rem] uppercase tracking-[0.08em] text-[rgba(240,237,230,0.35)] mb-2">Capacity</div>
            <div className="text-[1.6rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)" }}>{capacityDisplay}</div>
          </div>
          <div className="rounded-[8px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-4">
            <div className="text-[0.68rem] uppercase tracking-[0.08em] text-[rgba(240,237,230,0.35)] mb-2">Slots remaining</div>
            <div className="text-[1.6rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)" }}>{slotsRemaining}</div>
          </div>
        </section>

        <section className="rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-6">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-[1.1rem] font-semibold text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
                Increase Capacity
              </h2>
              <p className="mt-2 text-[0.82rem] text-[rgba(240,237,230,0.45)]">
                Increase the number of confirmed spots and move waitlisted attendees automatically.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="number"
                min="1"
                value={newCapacity}
                onChange={e => setNewCapacity(e.target.value)}
                className="max-w-[140px] rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
              />
              <button
                type="button"
                className="rounded-full bg-[#C8F55A] px-4 py-2 text-[0.875rem] font-semibold text-[#0A0A0A]"
                onClick={handleCapacityUpdate}
                disabled={updating}
              >
                {updating ? "Updating..." : "Update capacity"}
              </button>
            </div>
            {capacityMessage && <div className="text-[0.82rem] text-[#C8F55A]">{capacityMessage}</div>}
            {error && <div className="text-[0.82rem] text-[#FF6B6B]">{error}</div>}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-[1.2rem] font-semibold text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
              Confirmed ({confirmed.length})
            </h2>
            <span className="inline-flex rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)] px-3 py-1 text-[0.7rem] text-[#C8F55A]">
              Confirmed
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-[#141414] text-[0.68rem] uppercase tracking-[0.08em] text-[rgba(240,237,230,0.4)]">
                <tr>
                  {questionLabels.map(label => (
                    <th key={label} className="px-4 py-3 text-left">{label}</th>
                  ))}
                  <th className="px-4 py-3 text-left">Registered at</th>
                </tr>
              </thead>
              <tbody>
                {confirmed.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-[0.85rem] text-[rgba(240,237,230,0.3)] text-center" colSpan={questionLabels.length + 1}>
                      No confirmed registrations yet
                    </td>
                  </tr>
                ) : (
                  confirmed.map(reg => (
                    <tr key={reg.id} className="hover:bg-[rgba(240,237,230,0.02)] border-t border-[rgba(240,237,230,0.06)]">
                      {eventData?.questions.map(q => {
                        const answer = reg.answers.find(a => a.questionId === q.id)?.value || ""
                        return <td key={q.id} className="px-4 py-3 text-[0.82rem] text-[#F0EDE6]">{answer}</td>
                      })}
                      <td className="px-4 py-3 text-[0.82rem] text-[#F0EDE6]">{new Date(reg.submittedAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-[1.2rem] font-semibold text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
              Waitlist ({waitlist.length})
            </h2>
            <span className="inline-flex rounded-full border border-[rgba(240,237,230,0.15)] bg-[rgba(240,237,230,0.06)] px-3 py-1 text-[0.7rem] text-[rgba(240,237,230,0.55)]">
              Waitlist
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse">
              <thead className="bg-[#141414] text-[0.68rem] uppercase tracking-[0.08em] text-[rgba(240,237,230,0.4)]">
                <tr>
                  <th className="px-4 py-3 text-left">Position</th>
                  {questionLabels.map(label => (
                    <th key={label} className="px-4 py-3 text-left">{label}</th>
                  ))}
                  <th className="px-4 py-3 text-left">Registered at</th>
                </tr>
              </thead>
              <tbody>
                {waitlist.length === 0 ? (
                  <tr>
                    <td className="px-4 py-6 text-[0.85rem] text-[rgba(240,237,230,0.3)] text-center" colSpan={questionLabels.length + 2}>
                      Waitlist is empty
                    </td>
                  </tr>
                ) : (
                  waitlist.map(reg => (
                    <tr key={reg.id} className="hover:bg-[rgba(240,237,230,0.02)] border-t border-[rgba(240,237,230,0.06)]">
                      <td className="px-4 py-3 text-[0.82rem] text-[#F0EDE6]">{reg.waitlistPosition}</td>
                      {eventData?.questions.map(q => {
                        const answer = reg.answers.find(a => a.questionId === q.id)?.value || ""
                        return <td key={q.id} className="px-4 py-3 text-[0.82rem] text-[#F0EDE6]">{answer}</td>
                      })}
                      <td className="px-4 py-3 text-[0.82rem] text-[#F0EDE6]">{new Date(reg.submittedAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
