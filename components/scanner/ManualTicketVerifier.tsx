"use client"

import { useMemo, useState } from "react"

type LookupResult = {
  registrationId: string
  registrationNumber: number | null
  attendeeName: string
  attendeeEmail: string | null
  status: string
  submittedAt: string
  waitlistPosition: number | null
  confirmationCode: string | null
  ticketCode: string
  alreadyVerified: boolean
  verifiedAt: string | null
}

interface Props {
  eventSlug: string
  accessToken: string
  onExit: () => void
  onVerified?: () => void
}

export function ManualTicketVerifier({ eventSlug, accessToken, onExit, onVerified }: Props) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<LookupResult[]>([])
  const [error, setError] = useState("")
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const summary = useMemo(() => {
    if (results.length === 0) return ""
    const verified = results.filter((item) => item.alreadyVerified).length
    return `${results.length} match${results.length === 1 ? "" : "es"} found · ${verified} already verified`
  }, [results])

  const runLookup = async () => {
    const normalized = query.trim()
    if (normalized.length < 2) return
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ q: normalized, token: accessToken })
      const res = await fetch(`/api/events/${eventSlug}/verify-ticket/lookup?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Unable to search right now.")
        return
      }
      setResults(data.results ?? [])
    } catch {
      setError("Unable to search right now.")
    } finally {
      setLoading(false)
    }
  }

  const verifyTicket = async (ticketCode: string) => {
    setBusyKey(`verify-${ticketCode}`)
    setError("")
    try {
      const res = await fetch(`/api/events/${eventSlug}/verify-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: accessToken, ticketCode }),
      })
      const data = await res.json()
      if (!res.ok && !data.alreadyVerified) {
        setError(data.error || "Unable to verify ticket.")
        return
      }
      setResults((current) =>
        current.map((item) =>
          item.ticketCode === ticketCode
            ? {
                ...item,
                alreadyVerified: true,
                verifiedAt: data.ticket?.scannedAt ?? data.ticket?.checkedInAt ?? new Date().toISOString(),
              }
            : item
        )
      )
      onVerified?.()
    } catch {
      setError("Unable to verify ticket.")
    } finally {
      setBusyKey(null)
    }
  }

  const unverifyTicket = async (ticketCode: string) => {
    setBusyKey(`unverify-${ticketCode}`)
    setError("")
    try {
      const res = await fetch(`/api/events/${eventSlug}/verify-ticket/unverify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: accessToken, ticketCode }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Unable to unverify ticket.")
        return
      }
      setResults((current) =>
        current.map((item) =>
          item.ticketCode === ticketCode
            ? { ...item, alreadyVerified: false, verifiedAt: null }
            : item
        )
      )
    } catch {
      setError("Unable to unverify ticket.")
    } finally {
      setBusyKey(null)
    }
  }

  const deleteRegistration = async (registrationId: string) => {
    setBusyKey(`delete-${registrationId}`)
    setError("")
    try {
      const res = await fetch(`/api/registrations/${registrationId}?token=${encodeURIComponent(accessToken)}`, {
        method: "DELETE",
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Unable to delete registration.")
        return
      }
      setResults((current) => current.filter((item) => item.registrationId !== registrationId))
      onVerified?.()
    } catch {
      setError("Unable to delete registration.")
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="w-full min-h-[70vh] rounded-2xl border border-[#232323] bg-[#0A0A0A] p-5 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <p className="text-white text-lg font-semibold">Verify Ticket</p>
          <p className="text-[#A3A3A3] text-sm">Search by attendee name, email, ticket number, or confirmation code.</p>
        </div>
        <button onClick={onExit} className="px-3 py-1.5 rounded-full bg-[#141414] text-white text-xs border border-[#2A2A2A]">
          Back
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void runLookup() }}
          placeholder="Enter name, email, ticket number, or confirmation code"
          className="flex-1 bg-[#141414] border border-[#2A2A2A] rounded-xl px-4 py-3 text-white placeholder:text-[#525252] focus:outline-none focus:border-[#C8F55A] text-sm"
        />
        <button
          onClick={() => void runLookup()}
          disabled={loading || query.trim().length < 2}
          className="bg-[#C8F55A] text-black font-bold px-5 py-3 rounded-xl hover:bg-[#b8e040] transition-colors text-sm disabled:opacity-50"
        >
          {loading ? "Searching..." : "Find ticket"}
        </button>
      </div>

      {summary && <p className="text-[#A3A3A3] text-xs mb-3">{summary}</p>}
      {error && <p className="text-[#F87171] text-sm mb-3">{error}</p>}

      <div className="space-y-3">
        {results.length === 0 && !loading && (
          <div className="rounded-2xl border border-[#232323] bg-[#141414] p-6 text-center text-[#525252] text-sm">
            Search results will appear here.
          </div>
        )}

        {results.map((item) => (
          <div key={item.registrationId} className="rounded-2xl border border-[#232323] bg-[#141414] p-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="text-white font-semibold">{item.attendeeName}</p>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${item.alreadyVerified ? "border-[#EF4444]/30 text-[#F87171] bg-[#EF4444]/10" : "border-[#22C55E]/30 text-[#86EFAC] bg-[#22C55E]/10"}`}>
                    {item.alreadyVerified ? "VERIFIED" : "READY"}
                  </span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full border border-[#2A2A2A] text-[#A3A3A3]">
                    {item.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-[#A3A3A3] text-sm">{item.attendeeEmail || "No email captured"}</p>
                <div className="mt-2 text-xs text-[#737373] space-y-1">
                  <p>Ticket: {item.ticketCode}</p>
                  {item.confirmationCode && <p>Confirmation: {item.confirmationCode}</p>}
                  {item.registrationNumber && <p>Registration #{item.registrationNumber}</p>}
                  {item.waitlistPosition ? <p>Waitlist position #{item.waitlistPosition}</p> : null}
                  {item.verifiedAt ? <p>Verified at {new Date(item.verifiedAt).toLocaleString()}</p> : <p>Not yet verified</p>}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void verifyTicket(item.ticketCode)}
                  disabled={item.status.toLowerCase() !== "confirmed" || busyKey !== null}
                  className="px-3 py-2 rounded-xl bg-[#C8F55A] text-black text-xs font-bold disabled:opacity-40"
                >
                  {busyKey === `verify-${item.ticketCode}` ? "Verifying..." : "Verify"}
                </button>
                <button
                  onClick={() => void unverifyTicket(item.ticketCode)}
                  disabled={!item.alreadyVerified || busyKey !== null}
                  className="px-3 py-2 rounded-xl border border-[#2A2A2A] text-[#F0EDE6] text-xs disabled:opacity-40"
                >
                  {busyKey === `unverify-${item.ticketCode}` ? "Saving..." : "Unverify"}
                </button>
                <button
                  onClick={() => void deleteRegistration(item.registrationId)}
                  disabled={busyKey !== null}
                  className="px-3 py-2 rounded-xl border border-[#EF4444]/35 text-[#F87171] text-xs disabled:opacity-40"
                >
                  {busyKey === `delete-${item.registrationId}` ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
