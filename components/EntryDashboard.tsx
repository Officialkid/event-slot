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

  if (loading) return <div className="p-4 text-sm text-[#525252]">Loading entry data...</div>
  if (!data) return null
  if (data.eventType === "PHYSICAL") return null

  const entryRate =
    data.totalConfirmed > 0
      ? Math.round((data.totalEntered / data.totalConfirmed) * 100)
      : 0

  return (
    <div className="mt-6 rounded-xl border border-[#2A2A2A] bg-[#141414] p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#C8F55A]">
          Live Entry Tracker
        </p>
        <span className="text-xs text-[#525252]">Auto-refreshes every 30s</span>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-[#0A0A0A] p-3 text-center">
          <p className="text-2xl font-bold text-[#C8F55A]">{data.totalEntered}</p>
          <p className="text-xs text-[#525252]">Joined</p>
        </div>
        <div className="rounded-xl bg-[#0A0A0A] p-3 text-center">
          <p className="text-2xl font-bold text-white">{data.totalConfirmed}</p>
          <p className="text-xs text-[#525252]">Registered</p>
        </div>
        <div className="rounded-xl bg-[#0A0A0A] p-3 text-center">
          <p className="text-2xl font-bold text-white">{entryRate}%</p>
          <p className="text-xs text-[#525252]">Attendance</p>
        </div>
      </div>

      {data.hostLink && (
        <div className="mb-5">
          <p className="mb-2 text-xs text-[#525252]">Your host link</p>
          <a
            href={data.hostLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-[#C8F55A] px-4 py-2.5 text-sm font-bold text-black transition-colors hover:bg-[#b8e040]"
          >
            Open Google Meet as Host
          </a>
        </div>
      )}

      <div>
        <p className="mb-3 text-sm font-medium text-white">Recent entries ({data.totalEntered})</p>
        {data.entryLogs.length === 0 ? (
          <p className="text-sm text-[#525252]">No entries yet.</p>
        ) : (
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {data.entryLogs.map((log, index) => (
              <div
                key={`${log.scannedAt}-${index}`}
                className="flex items-center justify-between rounded-lg bg-[#0A0A0A] px-3 py-2"
              >
                <span className="text-sm text-white">{log.attendeeName}</span>
                <span className="text-xs text-[#525252]">
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
