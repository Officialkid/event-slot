"use client"

import { useCallback, useEffect, useState } from "react"

interface EntryData {
  eventTitle: string
  eventType: string
  totalConfirmed: number
  totalEntered: number
  hostLink: string | null
  entryLogs: { attendeeName: string; scannedAt: string }[]
}

export function EntryDashboard({ eventId }: { eventId: string }) {
  const [data, setData] = useState<EntryData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/organizer/events/${eventId}/entry-log`)
      if (res.ok) {
        setData((await res.json()) as EntryData)
      }
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    void load()
    const interval = window.setInterval(() => {
      void load()
    }, 30000)
    return () => clearInterval(interval)
  }, [load])

  if (loading) return <div className="p-4 text-sm text-[var(--text-muted)]">Loading entry data...</div>
  if (!data) return null

  const isPhysical = data.eventType === "PHYSICAL"
  const entryRate =
    data.totalConfirmed > 0
      ? Math.round((data.totalEntered / data.totalConfirmed) * 100)
      : 0
  const remaining = Math.max(0, data.totalConfirmed - data.totalEntered)

  return (
    <div className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text-primary)] shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
          {isPhysical ? "Gate Verification & Entry Tracker" : "Live Entry Tracker"}
        </p>
        <span className="text-xs text-[var(--text-muted)]">Auto-refreshes every 30s</span>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-center">
          <p className="text-2xl font-bold text-[var(--accent)]">{data.totalEntered}</p>
          <p className="text-xs text-[var(--text-muted)]">{isPhysical ? "Actual Admitted" : "Joined"}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-center">
          <p className="text-2xl font-bold text-[var(--text-primary)]">{data.totalConfirmed}</p>
          <p className="text-xs text-[var(--text-muted)]">Expected Total</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-center">
          <p className="text-2xl font-bold text-[var(--text-primary)]">{remaining}</p>
          <p className="text-xs text-[var(--text-muted)]">Awaiting Entry</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-center">
          <p className="text-2xl font-bold text-[var(--text-primary)]">{entryRate}%</p>
          <p className="text-xs text-[var(--text-muted)]">Turnout</p>
        </div>
      </div>

      {data.hostLink && (
        <div className="mb-5">
          <p className="mb-2 text-xs text-[var(--text-muted)]">Your host link</p>
          <a
            href={data.hostLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--accent-contrast)] transition-colors hover:opacity-90"
          >
            Open Google Meet as Host
          </a>
        </div>
      )}

      <div>
        <p className="mb-3 text-sm font-medium text-[var(--text-primary)]">Recent entries ({data.totalEntered})</p>
        {data.entryLogs.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No entries yet.</p>
        ) : (
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {data.entryLogs.map((log, index) => (
              <div
                key={`${log.scannedAt}-${index}`}
                className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[var(--text-primary)]"
              >
                <span className="text-sm text-[var(--text-primary)]">{log.attendeeName}</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {new Date(log.scannedAt).toLocaleTimeString("en-KE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
