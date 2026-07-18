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
  plans: { free: number }
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
        background: "var(--surface)",
        border: `0.5px solid ${isPrimary ? "var(--border-emphasis)" : "var(--border-subtle)"}`,
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
          color: isPrimary ? "var(--accent)" : "var(--text-muted)",
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
          color: isPrimary ? "var(--accent)" : "var(--text-primary)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.4rem", fontFamily: "var(--font-dm-sans)" }}>
        {sub}
      </div>
    </div>
  )
}

interface AuditLogEntry {
  id: string
  actorId: string
  action: string
  metadata: Record<string, string | null> | null
  createdAt: string
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

type ReportPaymentSummary = {
  currency: string
  grossRevenue: number
  commissionTotal: number
  netRevenue: number
  successfulPayments: number
  pendingPayments: number
  failedPayments: number
  ticketsSold: number
  paymentMethodBreakdown: Array<{
    method: string
    count: number
    grossRevenue: number
  }>
}

type LinkReportPreview = {
  success: boolean
  event: {
    title: string
    slug: string
    confirmedCount: number
    waitlistCount: number
    capacity: number | null
    eventDate: string | null
    location: string | null
  }
  reportReady?: boolean
  message?: string
  aiContent?: {
    eventOverview: string
    executiveSummary: string
    strengths: string
    weaknessesAndRisks: string
    audienceProfile: string
    registrationBehaviour: string
    competitivePositioning: string
    waitlistAnalysis: string
    recommendations: string
    overallScore: string
  }
  paymentSummary?: ReportPaymentSummary
  downloadUrl: string
}

function formatReportMoney(currency: string, amount: number) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "KES",
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency || "KES"} ${amount.toLocaleString("en-US")}`
  }
}

function formatPaymentMethodLabel(method: string) {
  return method
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "0.5px solid var(--border-subtle)",
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
          color: "var(--text-muted)",
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
          color: "var(--text-primary)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.35rem", fontFamily: "var(--font-dm-sans)" }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  void plan
  return (
    <span
      style={{
        fontSize: "0.65rem",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        padding: "0.15rem 0.5rem",
        borderRadius: 100,
        background: "var(--border-subtle)",
        color: "var(--text-muted)",
        fontFamily: "var(--font-dm-sans)",
      }}
    >
      free
    </span>
  )
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [revenue, setRevenue] = useState<Revenue | null>(null)
  const [loading, setLoading] = useState(true)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [reportLinkInput, setReportLinkInput] = useState("")
  const [generatingByLink, setGeneratingByLink] = useState(false)
  const [linkReportError, setLinkReportError] = useState("")
  const [linkReportPreview, setLinkReportPreview] = useState<LinkReportPreview | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then(r => r.json()),
      fetch("/api/admin/revenue").then(r => r.json()),
    ]).then(([s, r]) => {
      setStats(s)
      setRevenue(r)
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    fetch("/api/admin/audit-log?action=ADMIN_MODE_ACTIVATED&limit=20")
      .then(r => r.json())
      .then(d => setAuditLogs(d.logs ?? []))
      .catch(() => {})
  }, [])

  const downloadReport = (period: "weekly" | "monthly" | "yearly") => {
    const url = `/api/admin/stakeholder-report?period=${period}`
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.click()
  }

  const generateByLink = async () => {
    if (!reportLinkInput.trim() || generatingByLink) return
    setGeneratingByLink(true)
    setLinkReportError("")
    try {
      const res = await fetch('/api/admin/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventUrl: reportLinkInput.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data?.success) {
        setLinkReportPreview(null)
        setLinkReportError(data?.error || 'Failed to generate report from that link.')
        return
      }
      setLinkReportPreview(data)
    } catch {
      setLinkReportPreview(null)
      setLinkReportError('Network error while generating report by link.')
    } finally {
      setGeneratingByLink(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 980, animation: "pulse 1.4s ease-in-out infinite" }}>
        <div style={{ height: 24, width: 180, borderRadius: 8, background: "var(--surface-hover)" }} />
        <div style={{ height: 14, width: 260, borderRadius: 8, background: "var(--surface-hover)" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ background: "var(--surface)", border: "0.5px solid var(--border-subtle)", borderRadius: 10, padding: "1rem" }}>
              <div style={{ height: 10, width: 90, borderRadius: 6, background: "var(--surface-hover)", marginBottom: "0.55rem" }} />
              <div style={{ height: 18, width: 56, borderRadius: 6, background: "var(--surface-hover)" }} />
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (!stats) return null

  return (
    <div>
      <h1
        style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "2rem",
          fontWeight: 400,
          color: "var(--text-primary)",
          marginBottom: "0.4rem",
        }}
      >
        Overview
      </h1>
      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", marginBottom: "2rem" }}>
        Platform-wide stats at a glance.
      </p>

      <div
        style={{
          background: "var(--surface)",
          border: "0.5px solid var(--border-subtle)",
          borderRadius: "12px",
          padding: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--accent)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "0.5rem",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          Stakeholder Reports
        </p>
        <h3
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.3rem",
            color: "var(--text-primary)",
            marginBottom: "0.75rem",
            fontWeight: 400,
          }}
        >
          Generate Platform Report
        </h3>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.25rem", fontFamily: "var(--font-dm-sans)" }}>
          Download a complete Word document report for stakeholder meetings. Includes user growth, events, registrations,
          system health, and AI recommendations.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {[
            { key: "weekly", label: "This Week" },
            { key: "monthly", label: "This Month" },
            { key: "yearly", label: "This Year" },
          ].map(period => (
            <button
              key={period.key}
              onClick={() => downloadReport(period.key as "weekly" | "monthly" | "yearly")}
              style={{
                background: period.key === "monthly" ? "var(--accent)" : "transparent",
                color: period.key === "monthly" ? "#0A0A0A" : "var(--text-secondary)",
                border: period.key === "monthly" ? "none" : "0.5px solid var(--border-subtle)",
                borderRadius: "100px",
                padding: "0.6rem 1.4rem",
                fontSize: "0.875rem",
                fontWeight: period.key === "monthly" ? 600 : 400,
                cursor: "pointer",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              ↓ {period.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: "0.5px solid var(--border-subtle)",
          borderRadius: "12px",
          padding: "1.5rem",
          marginBottom: "2rem",
        }}
      >
        <p
          style={{
            fontSize: "0.7rem",
            color: "var(--accent)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "0.5rem",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          Event Report by Link
        </p>
        <h3
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.3rem",
            color: "var(--text-primary)",
            marginBottom: "0.75rem",
            fontWeight: 400,
          }}
        >
          Paste event registration URL or slug
        </h3>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1rem", fontFamily: "var(--font-dm-sans)" }}>
          Use this for sales demos and admin review: paste a public active EventSlot link and prepare the AI preview, then export the full Word report.
        </p>

        <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={reportLinkInput}
            onChange={e => setReportLinkInput(e.target.value)}
            placeholder="https://www.eventsslot.com/eventslot-virtual-demo-session-e4hp or event slug"
            style={{
              flex: "1 1 420px",
              minWidth: 280,
              background: "var(--bg-input)",
              border: "0.5px solid var(--border-subtle)",
              borderRadius: 8,
              padding: "0.6rem 0.875rem",
              color: "var(--text-primary)",
              fontSize: "0.85rem",
              fontFamily: "var(--font-dm-sans)",
              outline: "none",
            }}
          />
          <button
            onClick={generateByLink}
            disabled={generatingByLink || !reportLinkInput.trim()}
            style={{
              background: "var(--accent)",
              color: "#0A0A0A",
              border: "none",
              borderRadius: "100px",
              padding: "0.62rem 1.25rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: generatingByLink ? "not-allowed" : "pointer",
              fontFamily: "var(--font-dm-sans)",
              opacity: generatingByLink ? 0.7 : 1,
            }}
          >
            {generatingByLink ? 'Preparing...' : 'Prepare preview'}
          </button>
        </div>

        {linkReportError && (
          <p style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "var(--error)", fontFamily: "var(--font-dm-sans)" }}>
            {linkReportError}
          </p>
        )}

        {linkReportPreview && (
          <div style={{ marginTop: "1rem", borderTop: "0.5px solid var(--border-subtle)", paddingTop: "1rem" }}>
            <p style={{ fontSize: "0.84rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.35rem" }}>
              <strong style={{ color: "var(--text-primary)" }}>{linkReportPreview.event.title}</strong>
            </p>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>
              Slug: {linkReportPreview.event.slug} · Confirmed: {linkReportPreview.event.confirmedCount} · Waitlist: {linkReportPreview.event.waitlistCount}
            </p>

            {linkReportPreview.message && (
              <p style={{ marginTop: "0.55rem", marginBottom: 0, fontSize: "0.8rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
                {linkReportPreview.message}
              </p>
            )}

            {linkReportPreview.aiContent && (
              <div style={{ marginTop: "0.8rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ background: "var(--bg-input)", border: "0.5px solid var(--border-emphasis)", borderRadius: 10, padding: "0.65rem 0.75rem" }}>
                  <div style={{ fontSize: "0.68rem", color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)", marginBottom: "0.2rem" }}>
                    10. Overall Score
                  </div>
                  <div style={{ fontSize: "0.92rem", color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)", lineHeight: 1.5 }}>
                    {linkReportPreview.aiContent.overallScore}
                  </div>
                </div>

                {[
                  { title: "1. Event Overview", text: linkReportPreview.aiContent.eventOverview },
                  { title: "2. Executive Summary", text: linkReportPreview.aiContent.executiveSummary },
                  { title: "3. Strengths", text: linkReportPreview.aiContent.strengths },
                  { title: "4. Weaknesses & Risks", text: linkReportPreview.aiContent.weaknessesAndRisks },
                  { title: "5. Audience Profile", text: linkReportPreview.aiContent.audienceProfile },
                  { title: "6. Registration Behaviour", text: linkReportPreview.aiContent.registrationBehaviour },
                  { title: "7. Competitive Positioning", text: linkReportPreview.aiContent.competitivePositioning },
                  { title: "8. Waitlist Analysis", text: linkReportPreview.aiContent.waitlistAnalysis },
                  { title: "9. Recommendations", text: linkReportPreview.aiContent.recommendations },
                ].map((item) => (
                  <details key={item.title} style={{ border: "0.5px solid var(--border-subtle)", borderRadius: 8, background: "var(--surface-2)", padding: "0.45rem 0.65rem" }}>
                    <summary style={{ cursor: "pointer", fontSize: "0.76rem", color: "var(--accent)", letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)" }}>
                      {item.title}
                    </summary>
                    <p style={{ margin: "0.5rem 0 0", fontSize: "0.78rem", color: "var(--text-secondary)", lineHeight: 1.65, fontFamily: "var(--font-dm-sans)", whiteSpace: "pre-wrap" }}>
                      {item.text}
                    </p>
                  </details>
                ))}
              </div>
            )}

            {linkReportPreview.paymentSummary && (() => {
              const paymentSummary = linkReportPreview.paymentSummary
              return (
              <div style={{ marginTop: "0.8rem", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                <div style={{ background: "var(--bg-input)", border: "0.5px solid var(--accent-dim)", borderRadius: 10, padding: "0.75rem" }}>
                  <div style={{ fontSize: "0.68rem", color: "var(--accent)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)", marginBottom: "0.25rem" }}>
                    Commercial Performance
                  </div>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.6, fontFamily: "var(--font-dm-sans)" }}>
                    Gross revenue {formatReportMoney(paymentSummary.currency, paymentSummary.grossRevenue)}, net revenue {formatReportMoney(paymentSummary.currency, paymentSummary.netRevenue)}, and platform commission {formatReportMoney(paymentSummary.currency, paymentSummary.commissionTotal)}.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.5rem" }}>
                  {[
                    { label: "Gross Revenue", value: formatReportMoney(paymentSummary.currency, paymentSummary.grossRevenue) },
                    { label: "Net Revenue", value: formatReportMoney(paymentSummary.currency, paymentSummary.netRevenue) },
                    { label: "Commission", value: formatReportMoney(paymentSummary.currency, paymentSummary.commissionTotal) },
                    { label: "Tickets Sold", value: paymentSummary.ticketsSold.toLocaleString("en-US") },
                    { label: "Successful Payments", value: paymentSummary.successfulPayments.toLocaleString("en-US") },
                    { label: "Pending Payments", value: paymentSummary.pendingPayments.toLocaleString("en-US") },
                  ].map((item) => (
                    <div key={item.label} style={{ background: "var(--surface-2)", border: "0.5px solid var(--border-subtle)", borderRadius: 8, padding: "0.7rem" }}>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-dm-sans)", marginBottom: "0.25rem" }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: "0.88rem", color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)" }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                {paymentSummary.paymentMethodBreakdown.length > 0 && (
                  <div style={{ background: "var(--surface-2)", border: "0.5px solid var(--border-subtle)", borderRadius: 8, padding: "0.75rem" }}>
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--font-dm-sans)", marginBottom: "0.45rem" }}>
                      Payment Methods
                    </div>
                    <div style={{ display: "grid", gap: "0.4rem" }}>
                      {paymentSummary.paymentMethodBreakdown.map((method) => (
                        <div key={method.method} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", fontFamily: "var(--font-dm-sans)" }}>
                          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                            {formatPaymentMethodLabel(method.method)} · {method.count} sale{method.count === 1 ? "" : "s"}
                          </span>
                          <span style={{ fontSize: "0.78rem", color: "var(--text-primary)" }}>
                            {formatReportMoney(paymentSummary.currency, method.grossRevenue)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              )
            })()}

            <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              <a
                href={linkReportPreview.downloadUrl}
                style={{
                  textDecoration: 'none',
                  background: 'var(--accent)',
                  color: '#0A0A0A',
                  borderRadius: '100px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-dm-sans)',
                }}
              >
                ↓ Download Word
              </a>
            </div>
          </div>
        )}
      </div>

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
          color: "var(--text-primary)",
          marginBottom: "1rem",
        }}
      >
        Revenue
      </h2>

      {revenue && (
        <>
          {/* Revenue cards */}
          <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-4" style={{ marginBottom: "2.5rem" }}>
            <div style={{ display: "grid", gap: "1rem" }}>
            {/* Estimated MRR */}
            <div
              style={{
                background: "var(--surface)",
                border: "0.5px solid var(--accent-dim)",
                borderRadius: 12,
                padding: "1.5rem",
              }}
            >
              <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>
                Estimated MRR
              </div>
              <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", color: "var(--accent)", lineHeight: 1 }}>
                ${revenue.estimatedMRR.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.35rem", fontFamily: "var(--font-dm-sans)" }}>
                {revenue.newPaidThisMonth > 0 && `+${revenue.newPaidThisMonth} new`}
                {revenue.newPaidThisMonth > 0 && revenue.churnedThisMonth > 0 && " · "}
                {revenue.churnedThisMonth > 0 && `${revenue.churnedThisMonth} churned`}
                {revenue.newPaidThisMonth === 0 && revenue.churnedThisMonth === 0 && "this month"}
              </div>
            </div>

            {/* Credit revenue */}
            <div style={{ background: "var(--surface)", border: "0.5px solid var(--border-subtle)", borderRadius: 12, padding: "1.5rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>
                Credit Revenue
              </div>
              <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", color: "var(--text-primary)", lineHeight: 1 }}>
                ${revenue.creditRevenueTotal.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.35rem", fontFamily: "var(--font-dm-sans)" }}>
                total · {revenue.totalCreditsSpent} credits spent
              </div>
            </div>
          </div>

          {/* Bar chart — credits revenue by month */}
          <div
            style={{
              background: "var(--surface)",
              border: "0.5px solid var(--border-subtle)",
              borderRadius: 12,
              padding: "1.5rem",
            }}
          >
            <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.25rem" }}>
              Credit Revenue · Last 12 Months
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={revenue.creditsByMonth} barCategoryGap="30%">
                <XAxis
                  dataKey="month"
                  tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-dm-sans)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-dm-sans)" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `$${v}`}
                  width={36}
                />
                <Tooltip
                  cursor={{ fill: "var(--border-subtle)" }}
                  contentStyle={{
                    background: "var(--surface-hover)",
                    border: "0.5px solid var(--border-subtle)",
                    borderRadius: 8,
                    fontSize: "0.78rem",
                    fontFamily: "var(--font-dm-sans)",
                    color: "var(--text-primary)",
                  }}
                  formatter={(value) => [`$${value}`, "Revenue"]}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {revenue.creditsByMonth.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.revenue > 0 ? "var(--accent)" : "var(--accent-dim)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          </div>
        </>
      )}

      {/* Recent signups */}
      <h2
        style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "1.3rem",
          fontWeight: 400,
          color: "var(--text-primary)",
          marginBottom: "1rem",
        }}
      >
        Recent Signups
      </h2>
      <div style={{ overflowX: "auto", borderRadius: 12, border: "0.5px solid var(--border-subtle)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
          <thead>
            <tr style={{ borderBottom: "0.5px solid var(--border-subtle)", background: "var(--surface)" }}>
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
                    color: "var(--text-muted)",
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
                  borderBottom: "0.5px solid var(--border-subtle)",
                  background: i % 2 !== 0 ? "var(--surface-2)" : "transparent",
                }}
              >
                <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)" }}>
                  {u.name ?? "—"}
                </td>
                <td style={{ padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)" }}>
                  {u.email ?? "—"}
                </td>
                <td style={{ padding: "0.75rem 1rem" }}>
                  <PlanBadge plan={u.plan} />
                </td>
                <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>
                  {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {auditLogs.length > 0 && (
        <div style={{ marginTop: "2.5rem" }}>
          <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", fontWeight: 400, color: "var(--text-primary)", marginBottom: "1rem" }}>
            Admin Mode Activity
          </h2>
          <div style={{ borderRadius: 12, border: "0.5px solid var(--border-subtle)", overflow: "hidden" }}>
            <div style={{ padding: "0.75rem 1rem", background: "var(--surface)", borderBottom: "0.5px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "var(--error)", flexShrink: 0 }} />
              <span style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--error)", fontFamily: "var(--font-dm-sans)" }}>
                Admin Mode Activity Log
              </span>
            </div>
            {auditLogs.map((log, i) => {
              const meta = log.metadata ?? {}
              return (
                <div
                  key={log.id}
                  style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", padding: "0.75rem 1rem", borderBottom: i < auditLogs.length - 1 ? "0.5px solid var(--border-subtle)" : "none", background: i % 2 !== 0 ? "var(--surface-2)" : "transparent" }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "color-mix(in srgb, var(--error) 12%, transparent)", border: "0.5px solid color-mix(in srgb, var(--error) 30%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: "0.75rem" }}>
                    🛡
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)", margin: 0 }}>
                      {meta.eventTitle ? `Entered Admin Mode for "${meta.eventTitle}"` : log.action}
                    </p>
                    {meta.organiserEmail && (
                      <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", margin: "0.15rem 0 0" }}>
                        Organiser: {meta.organiserName} ({meta.organiserEmail})
                      </p>
                    )}
                    <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", margin: "0.15rem 0 0" }}>
                      {new Date(log.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
