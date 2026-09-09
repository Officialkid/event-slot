"use client"

import React, { useCallback, useEffect, useState, useRef } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import ExecutiveReportModal, { PresentationDeck } from "@/components/insights/ExecutiveReportModal"

type LiveEventItem = {
  id: string
  slug: string
  title: string
  eventDate: string | null
  maxCapacity: number | null
}

type LiveData = {
  events: LiveEventItem[]
  activeEvent: LiveEventItem | null
  selectedEventIds?: string[]
  selectedCohortTitles?: string[]
  isAllSelected?: boolean
  organizerName?: string
  liveAttendees: number
  totalConfirmed: number
  checkInRate: number
  activeSessions: number
  activeGates: number
  hourlyAttendance: { time: string; count: number; isPeak: boolean }[]
  sessionEngagement: { name: string; percentage: number; checkedIn: number; total: number }[]
  recentActivity: { id: string; text: string; timeAgo: string; type: "scan" | "reg" | "alert" }[]
  demographics: { label: string; percentage: number; count: number }[]
  lastUpdated: string
}

export default function LiveEventAnalytics() {
  const [data, setData] = useState<LiveData | null>(null)
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>(["all"])
  const [isCohortDropdownOpen, setIsCohortDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval] = useState(6000) // 6s poll
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date())

  // Presentation Deck State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false)
  const [deck, setDeck] = useState<PresentationDeck | null>(null)
  const [deckLoading, setDeckLoading] = useState(false)

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCohortDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const fetchLiveData = useCallback(async (eventIds?: string[]) => {
    try {
      const ids = eventIds !== undefined ? eventIds : selectedEventIds
      const queryParam = ids.length === 0 || ids.includes("all")
        ? "all"
        : ids.join(",")
      const res = await fetch(`/api/insights/live?eventIds=${queryParam}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
        setLastRefreshedAt(new Date())
      }
    } catch (err) {
      console.error("Failed to load live event telemetry", err)
    } finally {
      setLoading(false)
    }
  }, [selectedEventIds])

  useEffect(() => {
    fetchLiveData(selectedEventIds)
  }, [fetchLiveData, selectedEventIds])

  // Polling loop for real-time live telemetry
  useEffect(() => {
    if (!autoRefresh) return
    const timer = setInterval(() => {
      fetchLiveData(selectedEventIds)
    }, refreshInterval)
    return () => clearInterval(timer)
  }, [autoRefresh, refreshInterval, selectedEventIds, fetchLiveData])

  // Fetch or re-generate Gemini presentation deck
  const generateDeck = async () => {
    if (!data) return
    setDeckLoading(true)
    try {
      const res = await fetch("/api/insights/presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cohortTitles: data.selectedCohortTitles || (data.activeEvent ? [data.activeEvent.title] : ["All Active Events"]),
          liveAttendees: data.liveAttendees,
          totalConfirmed: data.totalConfirmed,
          checkInRate: data.checkInRate,
          activeGates: data.activeGates,
          hourlyAttendance: data.hourlyAttendance,
          sessionEngagement: data.sessionEngagement,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json.deck) setDeck(json.deck)
      }
    } catch (err) {
      console.error("Failed to generate presentation deck:", err)
    } finally {
      setDeckLoading(false)
    }
  }

  const handleOpenReportModal = async () => {
    setIsReportModalOpen(true)
    await generateDeck()
  }

  // Toggle single event in cohort selection
  const handleToggleEvent = (id: string) => {
    let next: string[]
    if (selectedEventIds.includes("all")) {
      next = [id]
    } else if (selectedEventIds.includes(id)) {
      next = selectedEventIds.filter(item => item !== id)
      if (next.length === 0) next = ["all"]
    } else {
      next = [...selectedEventIds, id]
    }
    setSelectedEventIds(next)
    fetchLiveData(next)
    setDeck(null) // reset deck cache for new cohort
  }

  const handleSelectAll = () => {
    setSelectedEventIds(["all"])
    fetchLiveData(["all"])
    setDeck(null)
  }

  const handleClear = () => {
    if (data?.events && data.events.length > 0) {
      const first = [data.events[0].id]
      setSelectedEventIds(first)
      fetchLiveData(first)
      setDeck(null)
    }
  }

  if (loading && !data) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 1040, margin: "0 auto" }}>
        <style>{`@keyframes live-pulse { 0%,100%{opacity:0.35} 50%{opacity:0.8} }`}</style>
        <div style={{ height: 60, borderRadius: 12, background: "var(--surface-2)", animation: "live-pulse 1.4s infinite" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 110, borderRadius: 14, background: "var(--surface-2)", animation: "live-pulse 1.4s infinite" }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
          <div style={{ height: 260, borderRadius: 14, background: "var(--surface-2)", animation: "live-pulse 1.4s infinite" }} />
          <div style={{ height: 260, borderRadius: 14, background: "var(--surface-2)", animation: "live-pulse 1.4s infinite" }} />
        </div>
      </div>
    )
  }

  const liveAttendees = data?.liveAttendees ?? 0
  const totalConfirmed = data?.totalConfirmed ?? 0
  const checkInRate = data?.checkInRate ?? 0
  const activeSessions = data?.activeSessions ?? 1
  const activeGates = data?.activeGates ?? 1
  const hourlyData = data?.hourlyAttendance ?? []
  const sessionData = data?.sessionEngagement ?? []
  const activityList = data?.recentActivity ?? []

  // Dynamic Theme Colors
  const surfaceColor = "var(--surface)"
  const surfaceAlt = "var(--surface-2)"
  const borderSoft = "1px solid color-mix(in srgb, var(--border-subtle) 85%, transparent)"
  const textPrimary = "var(--text-primary)"
  const textSecondary = "var(--text-secondary)"
  const accentColor = "var(--accent)"

  // Cohort Selection Display Text
  const isAll = selectedEventIds.includes("all") || selectedEventIds.length === 0
  const allEventsCount = data?.events?.length || 0
  let cohortButtonLabel = `Global Event Overview (${allEventsCount} Active)`
  if (!isAll && data?.events) {
    if (selectedEventIds.length === 1) {
      const ev = data.events.find(e => e.id === selectedEventIds[0])
      cohortButtonLabel = ev ? ev.title : "1 Event Selected"
    } else {
      const first = data.events.find(e => e.id === selectedEventIds[0])
      cohortButtonLabel = `${selectedEventIds.length} Events: ${first?.title || "Event"}, +${selectedEventIds.length - 1} more`
    }
  }

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0.9; }
          50% { transform: scale(1.25); opacity: 0.3; }
          100% { transform: scale(0.95); opacity: 0.9; }
        }
        .live-dot-glow {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .live-dot-glow::before {
          content: '';
          position: absolute;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #A3E635;
          animation: pulse-ring 2s infinite ease-in-out;
        }
        @media (max-width: 860px) {
          .live-kpi-grid { grid-template-columns: 1fr !important; }
          .live-chart-grid { grid-template-columns: 1fr !important; }
          .live-bottom-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* TOP COMMAND HEADER */}
      <div
        style={{
          background: surfaceColor,
          border: borderSoft,
          borderRadius: 14,
          padding: "0.95rem 1.35rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
            <span className="live-dot-glow">
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E", zIndex: 1 }} />
            </span>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: 800,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#22C55E",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              LIVE
            </span>
          </div>

          <div style={{ height: 18, width: 1, background: "var(--border-subtle)" }} />

          {/* COHORT MULTI-SELECT DROPDOWN */}
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setIsCohortDropdownOpen(!isCohortDropdownOpen)}
              type="button"
              style={{
                background: surfaceAlt,
                border: borderSoft,
                borderRadius: 8,
                padding: "0.42rem 0.85rem",
                color: textPrimary,
                fontSize: "0.84rem",
                fontWeight: 600,
                fontFamily: "var(--font-dm-sans)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.6rem",
                maxWidth: 380,
                textAlign: "left",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {cohortButtonLabel}
              </span>
              <span style={{ fontSize: "0.65rem", opacity: 0.6 }}>▼</span>
            </button>

            {isCohortDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  marginTop: "0.35rem",
                  width: 380,
                  maxHeight: 340,
                  background: surfaceColor,
                  border: borderSoft,
                  borderRadius: 12,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                  zIndex: 100,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "0.65rem 0.85rem",
                    borderBottom: borderSoft,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: surfaceAlt,
                  }}
                >
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: textSecondary }}>
                    Select Specific Events (Cohort)
                  </span>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: accentColor,
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: "0.15rem 0.4rem",
                      }}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={handleClear}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: textSecondary,
                        fontSize: "0.72rem",
                        cursor: "pointer",
                        padding: "0.15rem 0.4rem",
                      }}
                    >
                      Single
                    </button>
                  </div>
                </div>

                <div style={{ overflowY: "auto", padding: "0.4rem 0" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.65rem",
                      padding: "0.45rem 0.85rem",
                      cursor: "pointer",
                      fontSize: "0.82rem",
                      color: textPrimary,
                      background: isAll ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
                      borderBottom: "1px solid color-mix(in srgb, var(--border-subtle) 40%, transparent)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isAll}
                      onChange={handleSelectAll}
                      className="accent-[var(--accent)]"
                    />
                    <span style={{ fontWeight: isAll ? 700 : 500 }}>
                      🌐 Global Event Overview (All Active Events)
                    </span>
                  </label>

                  {data?.events.map((evt) => {
                    const isChecked = !isAll && selectedEventIds.includes(evt.id)
                    return (
                      <label
                        key={evt.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.65rem",
                          padding: "0.45rem 0.85rem",
                          cursor: "pointer",
                          fontSize: "0.8rem",
                          color: textPrimary,
                          background: isChecked ? "color-mix(in srgb, var(--accent) 8%, transparent)" : "transparent",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleEvent(evt.id)}
                          className="accent-[var(--accent)]"
                        />
                        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: isChecked ? 600 : 400 }}>
                            {evt.title}
                          </span>
                          {evt.eventDate && (
                            <span style={{ fontSize: "0.7rem", color: textSecondary }}>
                              {new Date(evt.eventDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live Controls & Executive Presentation Report Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
          <button
            onClick={handleOpenReportModal}
            type="button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              background: "color-mix(in srgb, var(--accent) 18%, var(--surface))",
              border: "1px solid color-mix(in srgb, var(--accent) 45%, transparent)",
              borderRadius: 8,
              padding: "0.4rem 0.9rem",
              fontSize: "0.76rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              cursor: "pointer",
              fontFamily: "var(--font-dm-sans)",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
            }}
          >
            <span>📊 Print / Present Report</span>
            <span
              style={{
                fontSize: "0.65rem",
                padding: "0.1rem 0.35rem",
                borderRadius: 4,
                background: "var(--accent)",
                color: "#0A0A0A",
                fontWeight: 800,
              }}
            >
              Deck
            </span>
          </button>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: autoRefresh ? "color-mix(in srgb, var(--accent) 14%, var(--surface-2))" : surfaceAlt,
              border: autoRefresh ? "1px solid color-mix(in srgb, var(--accent) 40%, transparent)" : borderSoft,
              borderRadius: 8,
              padding: "0.36rem 0.75rem",
              fontSize: "0.74rem",
              fontWeight: 600,
              color: textPrimary,
              cursor: "pointer",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: autoRefresh ? "#22C55E" : "var(--text-muted)" }} />
            {autoRefresh ? "Live Sync (6s)" : "Paused"}
          </button>

          <button
            onClick={() => fetchLiveData(selectedEventIds)}
            style={{
              background: surfaceAlt,
              border: borderSoft,
              borderRadius: 8,
              padding: "0.36rem 0.65rem",
              color: textSecondary,
              cursor: "pointer",
              fontSize: "0.75rem",
            }}
            title="Refresh now"
          >
            ↻
          </button>

          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>
            {lastRefreshedAt.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* KPI METRICS ROW */}
      <div className="live-kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem" }}>
        {/* KPI 1: Live Checked In */}
        <div
          style={{
            background: surfaceColor,
            border: borderSoft,
            borderRadius: 14,
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
          }}
        >
          <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: textSecondary, fontFamily: "var(--font-dm-sans)" }}>
            Live Attendees
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "2.4rem", fontWeight: 700, color: textPrimary, fontFamily: "var(--font-dm-sans)", lineHeight: 1 }}>
              {liveAttendees}
            </span>
            <span style={{ fontSize: "0.85rem", color: textSecondary, fontFamily: "var(--font-dm-sans)" }}>
              / {totalConfirmed} confirmed
            </span>
          </div>
          <span style={{ fontSize: "0.75rem", color: "#22C55E", fontWeight: 600, fontFamily: "var(--font-dm-sans)" }}>
            ↑ +1 vs Last Hour
          </span>
        </div>

        {/* KPI 2: Active Access Points / Gates */}
        <div
          style={{
            background: surfaceColor,
            border: borderSoft,
            borderRadius: 14,
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
          }}
        >
          <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: textSecondary, fontFamily: "var(--font-dm-sans)" }}>
            Active Gates & Scanners
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
            <span style={{ fontSize: "2.4rem", fontWeight: 700, color: textPrimary, fontFamily: "var(--font-dm-sans)", lineHeight: 1 }}>
              {activeGates}
            </span>
            <span style={{ fontSize: "0.85rem", color: textSecondary, fontFamily: "var(--font-dm-sans)" }}>
              entry portals
            </span>
          </div>
          <span style={{ fontSize: "0.75rem", color: textSecondary, fontFamily: "var(--font-dm-sans)" }}>
            Flow rate: {Math.max(1, Math.round(liveAttendees / Math.max(1, activeGates)))} scans / portal
          </span>
        </div>

        {/* KPI 3: Turnout Rate */}
        <div
          style={{
            background: surfaceColor,
            border: borderSoft,
            borderRadius: 14,
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
          }}
        >
          <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: textSecondary, fontFamily: "var(--font-dm-sans)" }}>
            Turnout Rate
          </span>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "2.4rem", fontWeight: 700, color: textPrimary, fontFamily: "var(--font-dm-sans)", lineHeight: 1 }}>
              {checkInRate}%
            </span>
            <div style={{ width: 42, height: 42, borderRadius: "50%", border: "3px solid color-mix(in srgb, var(--accent) 25%, transparent)", borderTopColor: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: textPrimary }}>
              {checkInRate}%
            </div>
          </div>
          <span style={{ fontSize: "0.75rem", color: "#22C55E", fontWeight: 600, fontFamily: "var(--font-dm-sans)" }}>
            +6.1% attendance pull
          </span>
        </div>
      </div>

      {/* CHARTS GRID */}
      <div className="live-chart-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
        {/* CHART 1: Hourly Flow */}
        <div
          style={{
            background: surfaceColor,
            border: borderSoft,
            borderRadius: 14,
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: textPrimary, fontFamily: "var(--font-dm-sans)" }}>
              Attendance Flow
            </span>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: textSecondary, fontFamily: "var(--font-dm-sans)" }}>
              Hourly check-ins & peak velocity
            </p>
          </div>

          <div style={{ height: 210, width: "100%", marginTop: "0.5rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="color-mix(in srgb, var(--border-subtle) 40%, transparent)" />
                <XAxis dataKey="time" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "color-mix(in srgb, var(--accent) 6%, transparent)" }}
                  contentStyle={{ background: "var(--surface)", border: borderSoft, borderRadius: 8, fontSize: "0.75rem" }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {hourlyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isPeak ? "var(--accent)" : "color-mix(in srgb, var(--accent) 45%, #2F5233)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CHART 2: Session & Admission Tier Breakdown */}
        <div
          style={{
            background: surfaceColor,
            border: borderSoft,
            borderRadius: 14,
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: textPrimary, fontFamily: "var(--font-dm-sans)" }}>
              Ticket Engagement
            </span>
            <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: textSecondary, fontFamily: "var(--font-dm-sans)" }}>
              Turnout % per admission tier
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginTop: "0.4rem" }}>
            {sessionData.length === 0 ? (
              <p style={{ fontSize: "0.8rem", color: textSecondary, margin: "auto" }}>
                No tiered tickets configured for this cohort.
              </p>
            ) : (
              sessionData.map((s, idx) => (
                <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", fontFamily: "var(--font-dm-sans)" }}>
                    <span style={{ fontWeight: 600, color: textPrimary }}>{s.name}</span>
                    <span style={{ color: textSecondary }}>{s.checkedIn} / {s.total} ({s.percentage}%)</span>
                  </div>
                  <div style={{ width: "100%", height: 6, borderRadius: 3, background: surfaceAlt, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${s.percentage}%`,
                        height: "100%",
                        background: idx === 0 ? "var(--accent)" : "color-mix(in srgb, var(--accent) 60%, #16A34A)",
                        borderRadius: 3,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM FEED & DEMOGRAPHICS */}
      <div className="live-bottom-grid" style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1rem" }}>
        {/* RECENT ACTIVITY STREAM */}
        <div
          style={{
            background: surfaceColor,
            border: borderSoft,
            borderRadius: 14,
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <span style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: textPrimary, fontFamily: "var(--font-dm-sans)" }}>
            Live Stream Feed
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {activityList.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.5rem 0.75rem",
                  borderRadius: 8,
                  background: surfaceAlt,
                  fontSize: "0.78rem",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.type === "scan" ? "#22C55E" : "var(--accent)" }} />
                  <span style={{ color: textPrimary }}>{item.text}</span>
                </div>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{item.timeAgo}</span>
              </div>
            ))}
          </div>
        </div>

        {/* DEMOGRAPHIC / VERIFICATION SPLIT */}
        <div
          style={{
            background: surfaceColor,
            border: borderSoft,
            borderRadius: 14,
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <span style={{ fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: textPrimary, fontFamily: "var(--font-dm-sans)" }}>
            Verification Composition
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.2rem" }}>
            {(data?.demographics || []).map((demo, idx) => (
              <div key={idx} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontFamily: "var(--font-dm-sans)" }}>
                  <span style={{ color: textPrimary }}>{demo.label}</span>
                  <span style={{ fontWeight: 600, color: textSecondary }}>{demo.count} ({demo.percentage}%)</span>
                </div>
                <div style={{ width: "100%", height: 5, borderRadius: 2.5, background: surfaceAlt, overflow: "hidden" }}>
                  <div style={{ width: `${demo.percentage}%`, height: "100%", background: "var(--accent)", borderRadius: 2.5 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* EXECUTIVE PRESENTATION MODAL */}
      <ExecutiveReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        deck={deck}
        loading={deckLoading}
        onRegenerate={generateDeck}
      />
    </div>
  )
}
