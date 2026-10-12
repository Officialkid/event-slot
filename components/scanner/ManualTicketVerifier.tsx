"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { scannerAudio } from "@/lib/scannerAudio"

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

const verifierSurface = "var(--surface)"
const verifierSurfaceAlt = "var(--surface-2)"
const verifierBorder = "var(--border)"
const verifierBorderSoft = "var(--border-subtle)"
const verifierTextPrimary = "var(--text-primary)"
const verifierTextSecondary = "var(--text-secondary)"
const verifierTextMuted = "var(--text-muted)"

export function ManualTicketVerifier({ eventSlug, accessToken, onExit, onVerified }: Props) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<LookupResult[]>([])
  const [error, setError] = useState("")
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const lookupAbortRef = useRef<AbortController | null>(null)

  const summary = useMemo(() => {
    if (results.length === 0) return ""
    const verified = results.filter((item) => item.admissionsUsed > 0).length
    return `${results.length} match${results.length === 1 ? "" : "es"} found · ${verified} with at least one verification`
  }, [results])

  const runLookup = useCallback(async (targetQuery?: string) => {
    const raw = targetQuery !== undefined ? targetQuery : query
    const normalized = raw.trim()
    if (!normalized) {
      setResults([])
      setLoading(false)
      setError("")
      return
    }

    if (lookupAbortRef.current) {
      lookupAbortRef.current.abort()
    }
    const controller = new AbortController()
    lookupAbortRef.current = controller

    setLoading(true)
    setError("")

    try {
      const params = new URLSearchParams({ q: normalized, token: accessToken })
      const res = await fetch(`/api/events/${eventSlug}/verify-ticket/lookup?${params.toString()}`, {
        signal: controller.signal,
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Unable to search right now.")
        return
      }
      setResults(data.results ?? [])
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return
      }
      setError("Unable to search right now.")
    } finally {
      setLoading(false)
    }
  }, [accessToken, eventSlug, query])

  // Debounced live type-ahead lookup: triggers automatically on 1+ characters
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setLoading(false)
      setError("")
      return
    }

    const timer = setTimeout(() => {
      void runLookup(trimmed)
    }, 180)

    return () => clearTimeout(timer)
  }, [query, runLookup])

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
        scannerAudio.playWarning()
        setError(data.error || "Unable to verify ticket.")
        return
      }

      if (data.alreadyVerified) {
        scannerAudio.playWarning()
      } else {
        scannerAudio.playSuccess()
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
    <div
      className="w-full min-h-[70vh] rounded-2xl border p-5 md:p-6"
      style={{ borderColor: verifierBorder, backgroundColor: verifierSurfaceAlt }}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold" style={{ color: verifierTextPrimary }}>Verify Ticket</p>
          <p className="text-sm" style={{ color: verifierTextSecondary }}>
            Search by attendee name, email, ticket number, or confirmation code.
          </p>
        </div>
        <button
          onClick={onExit}
          className="rounded-full border px-3 py-1.5 text-xs"
          style={{ borderColor: verifierBorderSoft, backgroundColor: verifierSurface, color: verifierTextPrimary }}
        >
          Back
        </button>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void runLookup()
            }}
            placeholder="Type attendee name (e.g. James), email, or ticket code..."
            className="w-full rounded-xl border pl-10 pr-10 py-3 text-sm placeholder:text-[#6b7280] focus:border-[#C8F55A] focus:outline-none transition-colors"
            style={{ borderColor: verifierBorderSoft, backgroundColor: verifierSurface, color: verifierTextPrimary }}
            autoFocus
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setQuery("")
                setResults([])
                setError("")
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <button
          onClick={() => void runLookup()}
          disabled={loading || query.trim().length === 0}
          className="rounded-xl bg-[#C8F55A] px-6 py-3 text-sm font-bold text-black transition-all hover:bg-[#b8e040] active:scale-95 disabled:opacity-40 shrink-0"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {summary && <p className="mb-3 text-xs" style={{ color: verifierTextSecondary }}>{summary}</p>}
      {error && <p className="mb-3 text-sm text-[#F87171]">{error}</p>}

      <div className="space-y-3">
        {results.length === 0 && !loading && (
          <div
            className="rounded-2xl border p-6 text-center text-sm"
            style={{ borderColor: verifierBorder, backgroundColor: verifierSurface, color: verifierTextMuted }}
          >
            Search results will appear here.
          </div>
        )}

        {results.map((item) => (
          <div
            key={item.registrationId}
            className="rounded-2xl border p-4"
            style={{ borderColor: verifierBorder, backgroundColor: verifierSurface }}
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <p className="font-semibold" style={{ color: verifierTextPrimary }}>{item.attendeeName}</p>
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
                  <span
                    className="rounded-full border px-2 py-0.5 text-[11px]"
                    style={{ borderColor: verifierBorderSoft, color: verifierTextSecondary }}
                  >
                    {item.status.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm" style={{ color: verifierTextSecondary }}>{item.attendeeEmail || "No email captured"}</p>
                <div className="mt-2 space-y-1 text-xs" style={{ color: verifierTextMuted }}>
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
                  className="rounded-xl bg-[#C8F55A] px-4 py-2 text-xs font-bold text-black transition-all hover:bg-[#b8e040] active:scale-95 disabled:opacity-40 shadow-sm"
                >
                  {busyKey === `verify-${item.ticketCode}` ? "Verifying..." : item.admissionsRemaining > 0 ? "✓ Verify Ticket" : "Fully Admitted"}
                </button>
                <button
                  onClick={() => void unverifyTicket(item.ticketCode)}
                  disabled={item.admissionsUsed <= 0 || busyKey !== null}
                  className="rounded-xl border px-3 py-2 text-xs disabled:opacity-40"
                  style={{ borderColor: verifierBorderSoft, color: verifierTextPrimary }}
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
