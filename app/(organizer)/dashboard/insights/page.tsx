"use client"

import React, { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

// ─── Types ────────────────────────────────────────────────────────────────────

type TopAnswer = { value: string; count: number; percentage: number }
type QuestionInsight = {
  questionLabel: string
  questionType: string
  totalAnswers: number
  topAnswers: TopAnswer[]
}
type EventLeaderboardItem = {
  id: string
  slug: string
  title: string
  date: string | null
  registrations: number
  confirmed: number
  checkedIn: number
  checkInRate: number
  conversionRate: number
  views: number
}
type DateRange = "30d" | "90d" | "1y" | "all"

type InsightsData = {
  range: DateRange
  totalEventsAnalysed: number
  totalRespondents: number
  questionInsights: QuestionInsight[]
  registrationsByDayOfWeek: { day: string; count: number }[]
  registrationsByMonth: { month: string; count: number }[]
  repeatAttendees: number
  momChange: number | null
  registrantsMoM: number | null
  eventLeaderboard: EventLeaderboardItem[]
  aiSummary?: string | null
  aiSummarySource?: "ai" | "fallback"
}

function MoMBadge({ change }: { change: number | null }) {
  if (change === null) return null
  const positive = change >= 0
  return (
    <span
      style={{
        fontSize: "0.72rem",
        fontWeight: 600,
        color: positive ? "#22C55E" : "#EF4444",
        fontFamily: "var(--font-dm-sans)",
      }}
    >
      {positive ? "▲" : "▼"} {Math.abs(change)}% vs last month
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  useSession()
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [range, setRange] = useState<DateRange>("90d")
  const [profile, setProfile] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/insights?range=${range}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error || "Failed to load insights"); return }
      setData(json)
    } catch { setError("Unable to load insights.") }
    finally { setLoading(false) }
  }

  const generateProfile = async () => {
    setProfileLoading(true)
    try {
      const res = await fetch('/api/insights/audience-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Unable to generate audience profile.')
        return
      }
      setProfile(typeof json.profile === 'string' ? json.profile : null)
    } catch {
      setError('Unable to generate audience profile.')
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [range])

  // ─── Loading skeleton ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <style>{`@keyframes ins-pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
        <div style={{ height: 36, borderRadius: 8, background: "#141414", marginBottom: "0.5rem", animation: "ins-pulse 1.4s ease-in-out infinite", maxWidth: 300 }} />
        <div style={{ height: 18, borderRadius: 6, background: "#141414", marginBottom: "2rem", animation: "ins-pulse 1.4s ease-in-out infinite", maxWidth: 220 }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          {[1,2,3].map(i => <div key={i} style={{ height: 90, borderRadius: 10, background: "#141414", animation: "ins-pulse 1.4s ease-in-out infinite" }} />)}
        </div>
        <div style={{ height: 260, borderRadius: 12, background: "#141414", animation: "ins-pulse 1.4s ease-in-out infinite" }} />
      </div>
    )
  }

  // ─── Error ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", paddingTop: "3rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.875rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{error}</p>
        <button
          onClick={load}
          style={{ marginTop: "1rem", background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.45rem 1rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const tooltipStyle = {
    contentStyle: {
      background: "#1A1A1A",
      border: "0.5px solid rgba(240,237,230,0.1)",
      borderRadius: 8,
      fontSize: "0.78rem",
      fontFamily: "var(--font-dm-sans)",
      color: "#F0EDE6",
    },
  }

  return (
    <>
      <style>{`@keyframes ins-pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "1.75rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.9rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.8rem", fontWeight: 400, color: "#F0EDE6", margin: "0 0 0.375rem" }}>
              Insight Tracker
            </h1>
            <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>
              Patterns across all your events.
            </p>
          </div>
          <a
            href={`/api/insights/export?range=${range}`}
            download
            style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem", border: "0.5px solid rgba(240,237,230,0.18)", borderRadius: 10, padding: "0.48rem 0.8rem", textDecoration: "none", color: "rgba(240,237,230,0.75)", fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)" }}
          >
            <span>⬇</span>
            Export CSV
          </a>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          {(["30d", "90d", "1y", "all"] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                borderRadius: 8,
                padding: "0.36rem 0.72rem",
                fontSize: "0.76rem",
                fontWeight: 600,
                fontFamily: "var(--font-dm-sans)",
                cursor: "pointer",
                border: range === r ? "0.5px solid #C8F55A" : "0.5px solid rgba(240,237,230,0.14)",
                background: range === r ? "rgba(200,245,90,0.12)" : "transparent",
                color: range === r ? "#C8F55A" : "rgba(240,237,230,0.52)",
              }}
            >
              {r === "30d" ? "Last 30 days" : r === "90d" ? "Last 90 days" : r === "1y" ? "Last year" : "All time"}
            </button>
          ))}
        </div>

        <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1rem 1.1rem", marginBottom: "1rem" }}>
          <p style={{ fontSize: "0.68rem", color: "#C8F55A", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 0.6rem 0", fontFamily: "var(--font-dm-sans)" }}>
            ✦ AI Audience Profile
          </p>
          {profile ? (
            <>
              <p style={{ margin: 0, fontSize: "0.84rem", color: "rgba(240,237,230,0.72)", lineHeight: 1.6, fontFamily: "var(--font-dm-sans)", fontStyle: "italic" }}>
                "{profile}"
              </p>
              <button
                onClick={generateProfile}
                disabled={profileLoading}
                style={{ marginTop: "0.6rem", background: "transparent", border: "none", padding: 0, fontSize: "0.74rem", color: "rgba(240,237,230,0.4)", cursor: profileLoading ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)" }}
              >
                {profileLoading ? "Analysing..." : "Regenerate"}
              </button>
            </>
          ) : (
            <button
              onClick={generateProfile}
              disabled={profileLoading}
              style={{ background: "#C8F55A", color: "#0A0A0A", border: "none", borderRadius: 10, padding: "0.52rem 0.9rem", fontSize: "0.82rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)", cursor: profileLoading ? "not-allowed" : "pointer", opacity: profileLoading ? 0.7 : 1 }}
            >
              {profileLoading ? "Analysing..." : "Generate Audience Profile"}
            </button>
          )}
        </div>

        {data.aiSummary && (
          <div
            style={{
              background: data.aiSummarySource === "fallback" ? "rgba(255,168,0,0.06)" : "rgba(200,245,90,0.05)",
              border: data.aiSummarySource === "fallback"
                ? "0.5px solid rgba(255,168,0,0.25)"
                : "0.5px solid rgba(200,245,90,0.2)",
              borderRadius: 10,
              padding: "0.9rem 1.1rem",
              marginBottom: "1rem",
            }}
          >
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: data.aiSummarySource === "fallback" ? "rgba(255,168,0,0.85)" : "rgba(200,245,90,0.85)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.3rem" }}>
              {data.aiSummarySource === "fallback" ? "AI Summary (Fallback)" : "AI Summary"}
            </div>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "rgba(240,237,230,0.72)", lineHeight: 1.6, fontFamily: "var(--font-dm-sans)" }}>
              {data.aiSummary}
            </p>
          </div>
        )}

        {/* Top stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginBottom: "1.75rem" }} className="ins-stat-grid">
          {[
            { label: "Events Analysed", value: data.totalEventsAnalysed, mom: null as number | null },
            { label: "Total Respondents", value: data.totalRespondents, mom: data.registrantsMoM },
            { label: "Repeat Attendees", value: data.repeatAttendees, mom: data.momChange },
          ].map(stat => (
            <div
              key={stat.label}
              style={{
                background: "#141414",
                border: stat.label === "Repeat Attendees" && data.repeatAttendees > 0
                  ? "0.5px solid rgba(200,245,90,0.2)"
                  : "0.5px solid rgba(240,237,230,0.08)",
                borderRadius: 10,
                padding: "1.1rem 1.25rem",
              }}
            >
              <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>{stat.label}</div>
              <div style={{ fontSize: "1.6rem", fontFamily: "var(--font-instrument-serif)", color: stat.label === "Repeat Attendees" && data.repeatAttendees > 0 ? "#C8F55A" : "#F0EDE6" }}>{stat.value}</div>
              <MoMBadge change={stat.mom} />
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.75rem" }} className="ins-chart-grid">
          {/* By day of week */}
          <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.25rem 1.5rem" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "1rem" }}>By day of week</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.registrationsByDayOfWeek} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,237,230,0.06)" />
                <XAxis dataKey="day" tick={{ fontSize: 8, fill: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }} tickFormatter={d => d.slice(0, 3)} />
                <YAxis tick={{ fontSize: 9, fill: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" fill="rgba(200,245,90,0.55)" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By month */}
          <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.25rem 1.5rem" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "1rem" }}>By month</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.registrationsByMonth} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,237,230,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 8, fill: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }} />
                <YAxis tick={{ fontSize: 9, fill: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" fill="rgba(200,245,90,0.4)" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {data.eventLeaderboard?.length > 0 && (
          <div style={{ border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 14, overflow: "hidden", background: "#141414", marginBottom: "1.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", padding: "0.85rem 1rem", borderBottom: "0.5px solid rgba(240,237,230,0.12)" }}>
              <p style={{ margin: 0, fontSize: "0.68rem", color: "#C8F55A", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)" }}>
                ✦ Your Events
              </p>
              <p style={{ margin: 0, color: "rgba(240,237,230,0.35)", fontSize: "0.7rem", fontFamily: "var(--font-dm-sans)" }}>Sorted by registrations</p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 760 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: "0.75rem", padding: "0.75rem 1rem", background: "#1E1E1E", borderBottom: "0.5px solid rgba(240,237,230,0.12)" }}>
                  {['Event', 'Registrations', 'Conversion', 'Check-in', 'Views'].map((h) => (
                    <p key={h} style={{ margin: 0, color: "rgba(240,237,230,0.35)", fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-dm-sans)" }}>
                      {h}
                    </p>
                  ))}
                </div>
                {data.eventLeaderboard.map((item, i) => (
                  <a
                    key={item.id}
                    href={`/dashboard/events/${item.slug}`}
                    style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: "0.75rem", padding: "0.9rem 1rem", borderBottom: "0.5px solid rgba(240,237,230,0.07)", textDecoration: "none" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0 }}>
                      {i < 3 && (
                        <span style={{ fontSize: "0.95rem", flexShrink: 0 }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                        </span>
                      )}
                      <p style={{ margin: 0, color: "#F0EDE6", fontSize: "0.82rem", fontWeight: 500, fontFamily: "var(--font-dm-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</p>
                    </div>
                    <p style={{ margin: 0, color: "#F0EDE6", fontSize: "0.82rem", alignSelf: "center", fontFamily: "var(--font-dm-sans)" }}>{item.registrations}</p>
                    <p style={{ margin: 0, color: "#F0EDE6", fontSize: "0.82rem", alignSelf: "center", fontFamily: "var(--font-dm-sans)" }}>{item.conversionRate}%</p>
                    <p style={{ margin: 0, fontSize: "0.82rem", alignSelf: "center", fontWeight: 600, fontFamily: "var(--font-dm-sans)", color: item.checkInRate >= 70 ? '#22C55E' : item.checkInRate >= 50 ? '#F59E0B' : '#EF4444' }}>
                      {item.checkInRate > 0 ? `${item.checkInRate}%` : '—'}
                    </p>
                    <p style={{ margin: 0, color: "rgba(240,237,230,0.55)", fontSize: "0.82rem", alignSelf: "center", fontFamily: "var(--font-dm-sans)" }}>{item.views.toLocaleString()}</p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Audience question insights */}
        {data.questionInsights.length > 0 && (
          <div style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: "#F0EDE6", marginBottom: "1rem" }}>
              Audience insights
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {data.questionInsights.map(insight => (
                <div key={insight.questionLabel} style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.25rem 1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>{insight.questionLabel}</span>
                    <span style={{ fontSize: "0.7rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>{insight.totalAnswers} responses</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                    {insight.topAnswers.slice(0, 6).map(ans => (
                      <div key={ans.value} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                            <span style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.7)", fontFamily: "var(--font-dm-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, marginRight: "0.5rem" }}>{ans.value}</span>
                            <span style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap" }}>{ans.count} ({ans.percentage}%)</span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: "rgba(240,237,230,0.06)", overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 2, background: "rgba(200,245,90,0.5)", width: `${ans.percentage}%`, transition: "width 0.4s ease" }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.questionInsights.length === 0 && (
          <div style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "2rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
              No registration data yet. Insights will appear after attendees register for your events.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .ins-stat-grid { grid-template-columns: 1fr 1fr !important; }
          .ins-chart-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 400px) {
          .ins-stat-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  )
}
