"use client"

import React, { useCallback, useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

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

const insightSurface = "var(--surface)"
const insightSurfaceAlt = "var(--surface-2)"
const insightBorderSoft = "1px solid color-mix(in srgb, var(--border-subtle) 70%, transparent)"
const insightTextPrimary = "var(--text-primary)"
const insightTextSecondary = "var(--text-secondary)"
const insightTextMuted = "var(--text-muted)"
const insightAccent = "var(--accent)"
const insightAccentSoft = "color-mix(in srgb, var(--accent) 12%, transparent)"
const insightAccentBorder = "1px solid color-mix(in srgb, var(--accent) 26%, transparent)"

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
      {positive ? "Up" : "Down"} {Math.abs(change)}% vs last month
    </span>
  )
}

export default function InsightsPage() {
  useSession()
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [range, setRange] = useState<DateRange>("90d")
  const [profile, setProfile] = useState<string | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/insights?range=${range}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || "Failed to load insights")
        return
      }
      setData(json)
    } catch {
      setError("Unable to load insights.")
    } finally {
      setLoading(false)
    }
  }, [range])

  const generateProfile = async () => {
    setProfileLoading(true)
    try {
      const res = await fetch("/api/insights/audience-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || "Unable to generate audience profile.")
        return
      }
      setProfile(typeof json.profile === "string" ? json.profile : null)
    } catch {
      setError("Unable to generate audience profile.")
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <style>{`@keyframes ins-pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
        <div style={{ height: 36, borderRadius: 8, background: insightSurfaceAlt, marginBottom: "0.5rem", animation: "ins-pulse 1.4s ease-in-out infinite", maxWidth: 320 }} />
        <div style={{ height: 18, borderRadius: 6, background: insightSurfaceAlt, marginBottom: "1.25rem", animation: "ins-pulse 1.4s ease-in-out infinite", maxWidth: 260 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1.25fr 0.95fr", gap: "1rem", marginBottom: "1rem" }} className="ins-hero-grid">
          {[1, 2].map((i) => (
            <div key={i} style={{ height: 210, borderRadius: 14, background: insightSurfaceAlt, animation: "ins-pulse 1.4s ease-in-out infinite" }} />
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginBottom: "1.5rem" }} className="ins-stat-grid">
          {[1, 2, 3].map((i) => <div key={i} style={{ height: 90, borderRadius: 10, background: insightSurfaceAlt, animation: "ins-pulse 1.4s ease-in-out infinite" }} />)}
        </div>
        <div style={{ height: 260, borderRadius: 12, background: insightSurfaceAlt, animation: "ins-pulse 1.4s ease-in-out infinite" }} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", paddingTop: "3rem", textAlign: "center" }}>
        <p style={{ fontSize: "0.875rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>{error}</p>
        <button
          onClick={load}
          style={{ marginTop: "1rem", background: "transparent", border: insightBorderSoft, borderRadius: 8, padding: "0.45rem 1rem", fontSize: "0.82rem", color: insightTextSecondary, cursor: "pointer", fontFamily: "var(--font-dm-sans)" }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) return null

  const tooltipStyle = {
    contentStyle: {
      background: "var(--bg-elevated)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 8,
      fontSize: "0.78rem",
      fontFamily: "var(--font-dm-sans)",
      color: "var(--text-primary)",
    },
  }

  const topEvent = data.eventLeaderboard?.[0] ?? null
  const bestConversionEvent = data.eventLeaderboard?.reduce<EventLeaderboardItem | null>((best, item) => {
    if (!best) return item
    return item.conversionRate > best.conversionRate ? item : best
  }, null) ?? null
  const busiestDay = data.registrationsByDayOfWeek.reduce<{ day: string; count: number } | null>((best, item) => {
    if (!best) return item
    return item.count > best.count ? item : best
  }, null)

  const decisionCards = [
    {
      label: "Best registration pull",
      title: topEvent ? topEvent.title : "Waiting for enough event data",
      detail: topEvent
        ? `${topEvent.registrations.toLocaleString()} registrations and ${topEvent.views.toLocaleString()} views.`
        : "This area will highlight the event attracting the strongest demand once you have enough data.",
    },
    {
      label: "Strongest conversion",
      title: bestConversionEvent ? `${bestConversionEvent.conversionRate}% conversion` : "Waiting for funnel data",
      detail: bestConversionEvent
        ? `${bestConversionEvent.title} is turning visits into registrations better than the rest.`
        : "EventSlot will surface the event page with the healthiest conversion once traffic is available.",
    },
    {
      label: "Best day to push",
      title: busiestDay ? busiestDay.day : "Not enough registration history yet",
      detail: busiestDay
        ? `${busiestDay.count.toLocaleString()} registrations landed on ${busiestDay.day}, making it your best promotion window so far.`
        : "Keep collecting registrations and this view will recommend the strongest day to share links.",
    },
  ]

  return (
    <>
      <style>{`@keyframes ins-pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ marginBottom: "1.75rem", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.9rem", flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.8rem", fontWeight: 400, color: insightTextPrimary, margin: "0 0 0.375rem" }}>
              Insight Tracker
            </h1>
            <p style={{ fontSize: "0.875rem", color: insightTextSecondary, fontFamily: "var(--font-dm-sans)", margin: 0 }}>
              A control room for audience behaviour, demand signals, and what to act on next.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <a
              href={`/api/insights/export/pdf?range=${range}`}
              download
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.45rem",
                background: "color-mix(in srgb, var(--accent) 12%, var(--surface))",
                border: "0.5px solid color-mix(in srgb, var(--accent) 35%, var(--border))",
                borderRadius: 10,
                padding: "0.48rem 0.85rem",
                textDecoration: "none",
                color: "var(--text-primary)",
                fontSize: "0.82rem",
                fontWeight: 500,
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <span>Export Insights PDF</span>
            </a>
            <a
              href={`/api/insights/export?range=${range}`}
              download
              title="Download raw CSV data"
              style={{
                display: "inline-flex",
                alignItems: "center",
                border: insightBorderSoft,
                borderRadius: 10,
                padding: "0.48rem 0.65rem",
                textDecoration: "none",
                color: insightTextMuted,
                fontSize: "0.8rem",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              <span>CSV</span>
            </a>
          </div>
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
                border: range === r ? insightAccentBorder : insightBorderSoft,
                background: range === r ? insightAccentSoft : "transparent",
                color: range === r ? insightTextPrimary : insightTextSecondary,
              }}
            >
              {r === "30d" ? "Last 30 days" : r === "90d" ? "Last 90 days" : r === "1y" ? "Last year" : "All time"}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.25fr) minmax(280px, 0.95fr)", gap: "1rem", marginBottom: "1rem" }} className="ins-hero-grid">
          <div style={{ background: insightSurface, border: insightBorderSoft, borderRadius: 14, padding: "1.15rem 1.2rem" }}>
            <p style={{ fontSize: "0.68rem", color: insightAccent, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 0.55rem 0", fontFamily: "var(--font-dm-sans)" }}>
              AI audience profile
            </p>
            {profile ? (
              <>
                <p style={{ margin: 0, fontSize: "0.84rem", color: insightTextSecondary, lineHeight: 1.7, fontFamily: "var(--font-dm-sans)", fontStyle: "italic" }}>
                  &ldquo;{profile}&rdquo;
                </p>
                <button
                  onClick={generateProfile}
                  disabled={profileLoading}
                  style={{ marginTop: "0.7rem", background: "transparent", border: insightBorderSoft, borderRadius: 999, padding: "0.42rem 0.85rem", fontSize: "0.74rem", color: insightTextSecondary, cursor: profileLoading ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)" }}
                >
                  {profileLoading ? "Analysing..." : "Refresh profile"}
                </button>
              </>
            ) : (
              <>
                <p style={{ margin: "0 0 0.75rem", fontSize: "0.82rem", color: insightTextSecondary, lineHeight: 1.65, fontFamily: "var(--font-dm-sans)" }}>
                  Build a plain-language summary of who attends your events, how they respond, and what that suggests for the next campaign.
                </p>
                <button
                  onClick={generateProfile}
                  disabled={profileLoading}
                  style={{ background: insightAccent, color: "#0A0A0A", border: "none", borderRadius: 10, padding: "0.55rem 0.95rem", fontSize: "0.82rem", fontWeight: 700, fontFamily: "var(--font-dm-sans)", cursor: profileLoading ? "not-allowed" : "pointer", opacity: profileLoading ? 0.7 : 1 }}
                >
                  {profileLoading ? "Analysing..." : "Generate audience profile"}
                </button>
              </>
            )}
          </div>

          <div style={{ background: insightSurface, border: insightBorderSoft, borderRadius: 14, padding: "1.15rem 1.2rem" }}>
            <p style={{ fontSize: "0.68rem", color: insightTextMuted, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 0.55rem 0", fontFamily: "var(--font-dm-sans)" }}>
              Decision support
            </p>
            <div style={{ display: "grid", gap: "0.7rem" }}>
              {decisionCards.map((card) => (
                <div key={card.label} style={{ background: insightSurfaceAlt, border: insightBorderSoft, borderRadius: 12, padding: "0.8rem 0.9rem" }}>
                  <div style={{ fontSize: "0.67rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: insightTextMuted, fontFamily: "var(--font-dm-sans)", marginBottom: "0.28rem" }}>
                    {card.label}
                  </div>
                  <div style={{ fontSize: "0.9rem", color: insightTextPrimary, fontWeight: 600, fontFamily: "var(--font-dm-sans)", marginBottom: "0.22rem", lineHeight: 1.45 }}>
                    {card.title}
                  </div>
                  <p style={{ margin: 0, fontSize: "0.77rem", color: insightTextSecondary, lineHeight: 1.6, fontFamily: "var(--font-dm-sans)" }}>
                    {card.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {data.aiSummary && (
          <div
            style={{
              background: data.aiSummarySource === "fallback" ? "rgba(255,168,0,0.06)" : insightAccentSoft,
              border: data.aiSummarySource === "fallback" ? "0.5px solid rgba(255,168,0,0.25)" : insightAccentBorder,
              borderRadius: 10,
              padding: "0.9rem 1.1rem",
              marginBottom: "1rem",
            }}
          >
            <div style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: data.aiSummarySource === "fallback" ? "rgba(255,168,0,0.85)" : insightTextPrimary, fontFamily: "var(--font-dm-sans)", marginBottom: "0.3rem" }}>
              {data.aiSummarySource === "fallback" ? "AI Summary (Fallback)" : "AI Summary"}
            </div>
            <p style={{ margin: 0, fontSize: "0.82rem", color: insightTextSecondary, lineHeight: 1.6, fontFamily: "var(--font-dm-sans)" }}>
              {data.aiSummary}
            </p>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.75rem", marginBottom: "1.75rem" }} className="ins-stat-grid">
          {[
            { label: "Events Analysed", value: data.totalEventsAnalysed, mom: null as number | null },
            { label: "Total Respondents", value: data.totalRespondents, mom: data.registrantsMoM },
            { label: "Repeat Attendees", value: data.repeatAttendees, mom: data.momChange },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                background: insightSurface,
                border: stat.label === "Repeat Attendees" && data.repeatAttendees > 0 ? insightAccentBorder : insightBorderSoft,
                borderRadius: 10,
                padding: "1.1rem 1.25rem",
              }}
            >
              <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: insightTextMuted, fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>
                {stat.label}
              </div>
              <div style={{ fontSize: "1.6rem", fontFamily: "var(--font-instrument-serif)", color: insightTextPrimary }}>{stat.value}</div>
              <MoMBadge change={stat.mom} />
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.75rem" }} className="ins-chart-grid">
          <div style={{ background: insightSurface, border: insightBorderSoft, borderRadius: 12, padding: "1.25rem 1.5rem" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: insightTextMuted, fontFamily: "var(--font-dm-sans)", marginBottom: "1rem" }}>
              By day of week
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.registrationsByDayOfWeek} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--border-subtle) 55%, transparent)" />
                <XAxis dataKey="day" tick={{ fontSize: 8, fill: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }} tickFormatter={(d) => d.slice(0, 3)} />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" fill="color-mix(in srgb, var(--accent) 58%, #6f89d8 42%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: insightSurface, border: insightBorderSoft, borderRadius: 12, padding: "1.25rem 1.5rem" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: insightTextMuted, fontFamily: "var(--font-dm-sans)", marginBottom: "1rem" }}>
              By month
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.registrationsByMonth} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="color-mix(in srgb, var(--border-subtle) 55%, transparent)" />
                <XAxis dataKey="month" tick={{ fontSize: 8, fill: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }} />
                <YAxis tick={{ fontSize: 9, fill: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }} allowDecimals={false} />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="count" fill="color-mix(in srgb, var(--accent) 42%, #7cc6ff 58%)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {data.eventLeaderboard?.length > 0 && (
          <div style={{ border: insightBorderSoft, borderRadius: 14, overflow: "hidden", background: insightSurface, marginBottom: "1.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", padding: "0.85rem 1rem", borderBottom: insightBorderSoft }}>
              <p style={{ margin: 0, fontSize: "0.68rem", color: insightAccent, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)" }}>
                Your events
              </p>
              <p style={{ margin: 0, color: insightTextMuted, fontSize: "0.7rem", fontFamily: "var(--font-dm-sans)" }}>Sorted by registrations</p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 760 }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: "0.75rem", padding: "0.75rem 1rem", background: insightSurfaceAlt, borderBottom: insightBorderSoft }}>
                  {["Event", "Registrations", "Conversion", "Check-in", "Views"].map((h) => (
                    <p key={h} style={{ margin: 0, color: insightTextMuted, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-dm-sans)" }}>
                      {h}
                    </p>
                  ))}
                </div>
                {data.eventLeaderboard.map((item, i) => (
                  <a
                    key={item.id}
                    href={`/dashboard/events/${item.slug}`}
                    style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: "0.75rem", padding: "0.9rem 1rem", borderBottom: "0.5px solid color-mix(in srgb, var(--border-subtle) 65%, transparent)", textDecoration: "none" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0 }}>
                      {i < 3 && (
                        <span style={{ fontSize: "0.95rem", flexShrink: 0 }}>
                          {i === 0 ? "1" : i === 1 ? "2" : "3"}
                        </span>
                      )}
                      <p style={{ margin: 0, color: insightTextPrimary, fontSize: "0.82rem", fontWeight: 500, fontFamily: "var(--font-dm-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.title}
                      </p>
                    </div>
                    <p style={{ margin: 0, color: insightTextPrimary, fontSize: "0.82rem", alignSelf: "center", fontFamily: "var(--font-dm-sans)" }}>{item.registrations}</p>
                    <p style={{ margin: 0, color: insightTextPrimary, fontSize: "0.82rem", alignSelf: "center", fontFamily: "var(--font-dm-sans)" }}>{item.conversionRate}%</p>
                    <p style={{ margin: 0, fontSize: "0.82rem", alignSelf: "center", fontWeight: 600, fontFamily: "var(--font-dm-sans)", color: item.checkInRate >= 70 ? "#22C55E" : item.checkInRate >= 50 ? "#F59E0B" : "#EF4444" }}>
                      {item.checkInRate > 0 ? `${item.checkInRate}%` : "-"}
                    </p>
                    <p style={{ margin: 0, color: insightTextSecondary, fontSize: "0.82rem", alignSelf: "center", fontFamily: "var(--font-dm-sans)" }}>{item.views.toLocaleString()}</p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {data.questionInsights.length > 0 && (
          <div style={{ marginBottom: "1.75rem" }}>
            <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", fontWeight: 400, color: insightTextPrimary, marginBottom: "1rem" }}>
              Audience insights
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {data.questionInsights.map((insight) => (
                <div key={insight.questionLabel} style={{ background: insightSurface, border: insightBorderSoft, borderRadius: 12, padding: "1.25rem 1.5rem" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.875rem", fontWeight: 500, color: insightTextPrimary, fontFamily: "var(--font-dm-sans)" }}>{insight.questionLabel}</span>
                    <span style={{ fontSize: "0.7rem", color: insightTextMuted, fontFamily: "var(--font-dm-sans)" }}>{insight.totalAnswers} responses</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                    {insight.topAnswers.slice(0, 6).map((ans) => (
                      <div key={ans.value} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem", gap: "0.6rem" }}>
                            <span style={{ fontSize: "0.78rem", color: insightTextSecondary, fontFamily: "var(--font-dm-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                              {ans.value}
                            </span>
                            <span style={{ fontSize: "0.72rem", color: insightTextSecondary, fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap" }}>
                              {ans.count} ({ans.percentage}%)
                            </span>
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: "color-mix(in srgb, var(--text-primary) 6%, transparent)", overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 2, background: "color-mix(in srgb, var(--accent) 50%, #6f89d8 50%)", width: `${ans.percentage}%`, transition: "width 0.4s ease" }} />
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
          <div style={{ background: insightSurface, border: insightBorderSoft, borderRadius: 12, padding: "2rem", textAlign: "center" }}>
            <p style={{ fontSize: "0.875rem", color: insightTextMuted, fontFamily: "var(--font-dm-sans)" }}>
              No registration data yet. Insights will appear after attendees register for your events.
            </p>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 860px) {
          .ins-hero-grid { grid-template-columns: 1fr !important; }
        }
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
