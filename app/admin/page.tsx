"use client"

import { useEffect, useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

interface Stats {
  totalUsers: number
  totalEvents: number
  totalRegistrations: number
  activeEvents: number
  newUsersThisWeek: number
  newUsersThisMonth: number
  newEventsThisMonth: number
  plans: { free: number; pro: number; business: number }
  recentSignups: Array<{ id: string; name: string | null; email: string | null; plan: string; createdAt: string }>
}

function HeroSignupCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: number | string
  sub: string
  accent: "primary" | "secondary"
}) {
  const isPrimary = accent === "primary"
  return (
    <div
      style={{
        background: "#111",
        border: `0.5px solid ${isPrimary ? "rgba(200,245,90,0.35)" : "rgba(240,237,230,0.12)"}`,
        borderRadius: 14,
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          fontSize: "0.72rem",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: isPrimary ? "rgba(200,245,90,0.9)" : "rgba(240,237,230,0.4)",
          fontFamily: "var(--font-dm-sans)",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "3rem",
          color: isPrimary ? "#C8F55A" : "#F0EDE6",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "0.8rem", color: "rgba(240,237,230,0.42)", marginTop: "0.4rem", fontFamily: "var(--font-dm-sans)" }}>
        {sub}
      </div>
    </div>
  )
}

interface Revenue {
  totalCreditsPurchased: number
  totalCreditsSpent: number
  creditRevenueTotal: number
  proSubscribers: number
  businessSubscribers: number
  estimatedMRR: number
  newPaidThisMonth: number
  churnedThisMonth: number
  creditsByMonth: Array<{ month: string; revenue: number }>
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
  const [revenue, setRevenue] = useState<Revenue | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then(r => r.json()),
      fetch("/api/admin/revenue").then(r => r.json()),
    ]).then(([s, r]) => {
      setStats(s)
      setRevenue(r)
    }).finally(() => setLoading(false))
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

      {/* Row 1 — Signup priorities */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        style={{ marginBottom: "1.25rem" }}
      >
        <HeroSignupCard
          label="Total Signups"
          value={stats.totalUsers}
          sub="all time"
          accent="primary"
        />
        <HeroSignupCard
          label="New Signups This Week"
          value={stats.newUsersThisWeek}
          sub="since Monday"
          accent="secondary"
        />
      </div>

      {/* Row 2 — Core stats */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        style={{ marginBottom: "1.25rem" }}
      >
        <StatCard label="Total Events" value={stats.totalEvents} sub="all time" />
        <StatCard label="Total Registrations" value={stats.totalRegistrations} sub="all time" />
        <StatCard label="Active Events" value={stats.activeEvents} sub="right now" />
        <StatCard label="New Users" value={stats.newUsersThisMonth} sub="this month" />
      </div>

      {/* Row 3 — Growth */}
      <div
        className="grid grid-cols-2 md:grid-cols-3 gap-4"
        style={{ marginBottom: "2.5rem" }}
      >
        <StatCard label="New Events" value={stats.newEventsThisMonth} sub="this month" />
        <StatCard label="Free Plan Users" value={stats.plans.free} sub="current" />
        <StatCard label="Weekly Signup Pace" value={stats.newUsersThisWeek} sub="new this week" />
      </div>

      {/* Revenue section */}
      <h2
        style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "1.3rem",
          fontWeight: 400,
          color: "#F0EDE6",
          marginBottom: "1rem",
        }}
      >
        Revenue
      </h2>

      {revenue && (
        <>
          {/* Revenue cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4" style={{ marginBottom: "1.25rem" }}>
            {/* Estimated MRR */}
            <div
              style={{
                background: "#111",
                border: "0.5px solid rgba(200,245,90,0.18)",
                borderRadius: 12,
                padding: "1.5rem",
              }}
            >
              <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>
                Estimated MRR
              </div>
              <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", color: "#C8F55A", lineHeight: 1 }}>
                ${revenue.estimatedMRR.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", marginTop: "0.35rem", fontFamily: "var(--font-dm-sans)" }}>
                {revenue.newPaidThisMonth > 0 && `+${revenue.newPaidThisMonth} new`}
                {revenue.newPaidThisMonth > 0 && revenue.churnedThisMonth > 0 && " · "}
                {revenue.churnedThisMonth > 0 && `${revenue.churnedThisMonth} churned`}
                {revenue.newPaidThisMonth === 0 && revenue.churnedThisMonth === 0 && "this month"}
              </div>
            </div>

            {/* Pro subscribers */}
            <div style={{ background: "#111", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.5rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>
                Pro Subscribers
              </div>
              <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", color: "#F0EDE6", lineHeight: 1 }}>
                {revenue.proSubscribers}
              </div>
              <div style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", marginTop: "0.35rem", fontFamily: "var(--font-dm-sans)" }}>
                $20/mo each
              </div>
            </div>

            {/* Business subscribers */}
            <div style={{ background: "#111", border: "0.5px solid rgba(147,112,219,0.15)", borderRadius: 12, padding: "1.5rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>
                Business Subscribers
              </div>
              <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", color: "#9370DB", lineHeight: 1 }}>
                {revenue.businessSubscribers}
              </div>
              <div style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", marginTop: "0.35rem", fontFamily: "var(--font-dm-sans)" }}>
                $100/mo each
              </div>
            </div>

            {/* Credit revenue */}
            <div style={{ background: "#111", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.5rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>
                Credit Revenue
              </div>
              <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", color: "#F0EDE6", lineHeight: 1 }}>
                ${revenue.creditRevenueTotal.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", marginTop: "0.35rem", fontFamily: "var(--font-dm-sans)" }}>
                total · {revenue.totalCreditsSpent} credits spent
              </div>
            </div>
          </div>

          {/* Bar chart — credits revenue by month */}
          <div
            style={{
              background: "#111",
              border: "0.5px solid rgba(240,237,230,0.08)",
              borderRadius: 12,
              padding: "1.5rem",
              marginBottom: "2.5rem",
            }}
          >
            <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.25rem" }}>
              Credit Revenue · Last 12 Months
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={revenue.creditsByMonth} barCategoryGap="30%">
                <XAxis
                  dataKey="month"
                  tick={{ fill: "rgba(240,237,230,0.3)", fontSize: 10, fontFamily: "var(--font-dm-sans)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "rgba(240,237,230,0.25)", fontSize: 10, fontFamily: "var(--font-dm-sans)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                  width={36}
                />
                <Tooltip
                  cursor={{ fill: "rgba(240,237,230,0.04)" }}
                  contentStyle={{
                    background: "#1A1A1A",
                    border: "0.5px solid rgba(240,237,230,0.1)",
                    borderRadius: 8,
                    fontSize: "0.78rem",
                    fontFamily: "var(--font-dm-sans)",
                    color: "#F0EDE6",
                  }}
                  formatter={(value) => [`$${value}`, "Revenue"]}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {revenue.creditsByMonth.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.revenue > 0 ? "#C8F55A" : "rgba(200,245,90,0.15)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {(stats.plans.pro > 0 || stats.plans.business > 0) && (
        <div style={{ marginBottom: "2.5rem" }}>
          <PlanBar plans={stats.plans} />
        </div>
      )}

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
