"use client"

import { useEffect, useState } from "react"

interface Stats {
  totalUsers: number
  totalEvents: number
  totalRegistrations: number
  activeEvents: number
  newUsersThisMonth: number
  newEventsThisMonth: number
  plans: { free: number; pro: number; business: number }
  recentSignups: Array<{ id: string; name: string | null; email: string | null; plan: string; createdAt: string }>
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div
      style={{
        background: "#111",
        border: "0.5px solid rgba(240,237,230,0.08)",
        borderRadius: 12,
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(240,237,230,0.35)",
          fontFamily: "var(--font-dm-sans)",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "2rem",
          color: "#F0EDE6",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.35)", marginTop: "0.35rem", fontFamily: "var(--font-dm-sans)" }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function PlanBar({ plans }: { plans: { free: number; pro: number; business: number } }) {
  const total = (plans.free || 0) + (plans.pro || 0) + (plans.business || 0) || 1
  const bars = [
    { label: "Free", count: plans.free || 0, color: "rgba(240,237,230,0.3)" },
    { label: "Pro", count: plans.pro || 0, color: "#C8F55A" },
    { label: "Business", count: plans.business || 0, color: "rgba(200,245,90,0.55)" },
  ]
  return (
    <div
      style={{
        background: "#111",
        border: "0.5px solid rgba(240,237,230,0.08)",
        borderRadius: 12,
        padding: "1.5rem",
        gridColumn: "span 2",
      }}
    >
      <div
        style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(240,237,230,0.35)",
          fontFamily: "var(--font-dm-sans)",
          marginBottom: "1rem",
        }}
      >
        Plan Breakdown
      </div>
      <div style={{ display: "flex", gap: 4, height: 12, borderRadius: 100, overflow: "hidden", marginBottom: "0.75rem" }}>
        {bars.map(b => (
          <div
            key={b.label}
            style={{ flex: b.count, background: b.color, minWidth: b.count > 0 ? 4 : 0 }}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: "1.5rem" }}>
        {bars.map(b => (
          <div key={b.label} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
            <span style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)" }}>
              {b.label}: <strong style={{ color: "#F0EDE6" }}>{b.count}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    free: { bg: "rgba(240,237,230,0.07)", color: "rgba(240,237,230,0.45)" },
    pro: { bg: "rgba(200,245,90,0.12)", color: "#C8F55A" },
    business: { bg: "rgba(200,245,90,0.2)", color: "#C8F55A" },
  }
  const style = colors[plan] ?? colors.free
  return (
    <span
      style={{
        fontSize: "0.65rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        padding: "0.15rem 0.5rem",
        borderRadius: 100,
        background: style.bg,
        color: style.color,
        fontFamily: "var(--font-dm-sans)",
      }}
    >
      {plan}
    </span>
  )
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/stats")
      .then(r => r.json())
      .then(setStats)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem" }}>Loading…</div>
  }
  if (!stats) return null

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "2rem",
          fontWeight: 400,
          color: "#F0EDE6",
          marginBottom: "0.4rem",
        }}
      >
        Overview
      </h1>
      <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "2rem" }}>
        Platform-wide stats at a glance.
      </p>

      {/* Row 1 — Core stats */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        style={{ marginBottom: "1.25rem" }}
      >
        <StatCard label="Total Users" value={stats.totalUsers} />
        <StatCard label="Total Events" value={stats.totalEvents} sub="all time" />
        <StatCard label="Total Registrations" value={stats.totalRegistrations} sub="all time" />
        <StatCard label="Active Events" value={stats.activeEvents} sub="right now" />
      </div>

      {/* Row 2 — Growth */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        style={{ marginBottom: "2.5rem" }}
      >
        <StatCard label="New Users" value={stats.newUsersThisMonth} sub="this month" />
        <StatCard label="New Events" value={stats.newEventsThisMonth} sub="this month" />
        <PlanBar plans={stats.plans} />
      </div>

      {/* Recent signups */}
      <h2
        style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "1.3rem",
          fontWeight: 400,
          color: "#F0EDE6",
          marginBottom: "1rem",
        }}
      >
        Recent Signups
      </h2>
      <div style={{ overflowX: "auto", borderRadius: 12, border: "0.5px solid rgba(240,237,230,0.08)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid rgba(240,237,230,0.08)", background: "#111" }}>
              {["Name", "Email", "Plan", "Joined"].map(h => (
                <th
                  key={h}
                  style={{
                    padding: "0.75rem 1rem",
                    textAlign: "left",
                    fontSize: "0.65rem",
                    fontWeight: 600,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "rgba(240,237,230,0.3)",
                    fontFamily: "var(--font-dm-sans)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.recentSignups.map((u, i) => (
              <tr
                key={u.id}
                style={{
                  borderBottom: "0.5px solid rgba(240,237,230,0.04)",
                  background: i % 2 !== 0 ? "rgba(255,255,255,0.01)" : "transparent",
                }}
              >
                <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)" }}>
                  {u.name ?? "—"}
                </td>
                <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)" }}>
                  {u.email ?? "—"}
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <PlanBadge plan={u.plan} />
                </td>
                <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)" }}>
                  {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
