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
  admissionsTotal: number
  admissionsUsed: number
  admissionsRemaining: number
  verifiedEntries: Array<{ name?: string; verifiedAt?: string }>
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
    const verified = results.filter((item) => item.admissionsUsed > 0).length
    return `${results.length} match${results.length === 1 ? "" : "es"} found · ${verified} with at least one verification`
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
                admissionsUsed: typeof data.ticket?.admissionsUsed === "number"
                  ? data.ticket.admissionsUsed
                  : Math.min(item.admissionsTotal, item.admissionsUsed + 1),
                admissionsRemaining: typeof data.ticket?.admissionsRemaining === "number"
                  ? data.ticket.admissionsRemaining
                  : Math.max(0, item.admissionsTotal - (item.admissionsUsed + 1)),
                verifiedAt: data.ticket?.scannedAt ?? data.ticket?.checkedInAt ?? new Date().toISOString(),
                verifiedEntries: Array.isArray(data.ticket?.verifiedEntries)
                  ? data.ticket.verifiedEntries
                  : item.verifiedEntries,
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
            ? {
                ...item,
                alreadyVerified: Boolean(data.ticket?.admissionsUsed ?? Math.max(0, item.admissionsUsed - 1)),
                verifiedAt: data.ticket?.scannedAt ?? null,
                admissionsUsed: typeof data.ticket?.admissionsUsed === "number"
                  ? data.ticket.admissionsUsed
                  : Math.max(0, item.admissionsUsed - 1),
                admissionsRemaining: typeof data.ticket?.admissionsRemaining === "number"
                  ? data.ticket.admissionsRemaining
                  : Math.min(item.admissionsTotal, item.admissionsRemaining + 1),
                verifiedEntries: Array.isArray(data.ticket?.verifiedEntries)
                  ? data.ticket.verifiedEntries
                  : item.verifiedEntries.slice(0, -1),
              }
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
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">Verify Ticket</p>
          <p className="text-sm text-[#A3A3A3]">Search by attendee name, email, ticket number, or confirmation code.</p>
        </div>
        <button onClick={onExit} className="rounded-full border border-[#2A2A2A] bg-[#141414] px-3 py-1.5 text-xs text-white">
          Back
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 md:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void runLookup() }}
          placeholder="Enter name, email, ticket number, or confirmation code"
          className="flex-1 rounded-xl border border-[#2A2A2A] bg-[#141414] px-4 py-3 text-sm text-white placeholder:text-[#525252] focus:border-[#C8F55A] focus:outline-none"
        />
        <button
          onClick={() => void runLookup()}
          disabled={loading || query.trim().length < 2}
          className="rounded-xl bg-[#C8F55A] px-5 py-3 text-sm font-bold text-black transition-colors hover:bg-[#b8e040] disabled:opacity-50"
        >
          {loading ? "Searching..." : "Find ticket"}
        </button>
      </div>

      {summary && <p className="mb-3 text-xs text-[#A3A3A3]">{summary}</p>}
      {error && <p className="mb-3 text-sm text-[#F87171]">{error}</p>}

      <div className="space-y-3">
        {results.length === 0 && !loading && (
          <div className="rounded-2xl border border-[#232323] bg-[#141414] p-6 text-center text-sm text-[#525252]">
            Search results will appear here.
          </div>
        )}

        {results.map((item) => (
          <div key={item.registrationId} className="rounded-2xl border border-[#232323] bg-[#141414] p-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-white">{item.attendeeName}</p>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    item.admissionsUsed > 0
                      ? item.admissionsRemaining > 0
                        ? "border-[#F59E0B]/30 bg-[#F59E0B]/10 text-[#FCD34D]"
                        : "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#F87171]"
                      : "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#86EFAC]"
                  }`}>
                    {item.admissionsUsed > 0
                      ? item.admissionsRemaining > 0
                        ? "PARTIALLY VERIFIED"
                        : "VERIFIED"
                      : "READY"}
                  </span>
                  <span className="rounded-full border border-[#2A2A2A] px-2 py-0.5 text-[11px] text-[#A3A3A3]">
                    {item.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-[#A3A3A3]">{item.attendeeEmail || "No email captured"}</p>
                <div className="mt-2 space-y-1 text-xs text-[#737373]">
                  <p>Ticket: {item.ticketCode}</p>
                  {item.confirmationCode && <p>Confirmation: {item.confirmationCode}</p>}
                  {item.registrationNumber && <p>Registration #{item.registrationNumber}</p>}
                  {item.waitlistPosition ? <p>Waitlist position #{item.waitlistPosition}</p> : null}
                  <p>
                    Entries used: {item.admissionsUsed} / {item.admissionsTotal}
                    {item.admissionsTotal > 1 ? ` · ${item.admissionsRemaining} remaining` : ""}
                  </p>
                  {item.verifiedAt ? <p>Last verified at {new Date(item.verifiedAt).toLocaleString()}</p> : <p>Not yet verified</p>}
                  {item.verifiedEntries.length > 0 && (
                    <p>
                      Verification history: {item.verifiedEntries.map((entry) => entry.name?.trim() || "Attendee").join(", ")}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => void verifyTicket(item.ticketCode)}
                  disabled={item.status.toLowerCase() !== "confirmed" || item.admissionsRemaining <= 0 || busyKey !== null}
                  className="rounded-xl bg-[#C8F55A] px-3 py-2 text-xs font-bold text-black disabled:opacity-40"
                >
                  {busyKey === `verify-${item.ticketCode}` ? "Verifying..." : item.admissionsRemaining > 0 ? "Verify" : "Fully used"}
                </button>
                <button
                  onClick={() => void unverifyTicket(item.ticketCode)}
                  disabled={item.admissionsUsed <= 0 || busyKey !== null}
                  className="rounded-xl border border-[#2A2A2A] px-3 py-2 text-xs text-[#F0EDE6] disabled:opacity-40"
                >
                  {busyKey === `unverify-${item.ticketCode}` ? "Saving..." : "Unverify"}
                </button>
                <button
                  onClick={() => void deleteRegistration(item.registrationId)}
                  disabled={busyKey !== null}
                  className="rounded-xl border border-[#EF4444]/35 px-3 py-2 text-xs text-[#F87171] disabled:opacity-40"
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
