"use client"

import { useEffect, useState } from "react"

interface ErrorLog {
  id: string
  route: string
  message: string
  createdAt: string
}

interface HealthData {
  dbOk: boolean
  recentErrors: ErrorLog[]
  emailsAcceptedThisMonth: number | null
  emailProviderConfigured: boolean
  emailProviderHealthy: boolean
  emailProviderName: "smtp" | "resend"
  emailProviderMessage: string
}

type IssueStatus = "open" | "config" | "resolved" | "info"

type ClassifiedIssue = {
  id: string
  route: string
  message: string
  createdAt: string
  status: IssueStatus
  label: string
  summary: string
  hint: string
  stale: boolean
}

const STALE_AFTER_HOURS = 72

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: ok ? "var(--accent)" : "var(--error)", flexShrink: 0 }} />
      <span style={{ fontSize: "0.82rem", color: ok ? "var(--accent)" : "var(--error)", fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}>
        {ok ? "Healthy" : "Error"}
      </span>
    </span>
  )
}

function issueIsStale(createdAt: string) {
  const created = new Date(createdAt).getTime()
  if (Number.isNaN(created)) return false
  return Date.now() - created > STALE_AFTER_HOURS * 60 * 60 * 1000
}

function classifyIssue(error: ErrorLog, data: HealthData): ClassifiedIssue {
  const stale = issueIsStale(error.createdAt)
  const emailHealthy = data.emailProviderConfigured && data.emailProviderHealthy

  if (error.route.startsWith("paid-ticket-email:") && error.message.includes("verify a domain at resend.com/domains")) {
    return {
      ...error,
      status: emailHealthy ? "resolved" : "config",
      label: "Email domain setup",
      summary: emailHealthy
        ? "Paid ticket email failures came from the old provider setup and should now be cleared."
        : "Paid ticket confirmations are blocked by email provider configuration.",
      hint: emailHealthy
        ? "This is now historical. Send a fresh paid-ticket confirmation to confirm live delivery."
        : "Verify SMTP credentials, sender domain DNS, SPF, DKIM, DMARC, and the configured from-address.",
      stale,
    }
  }

  if (error.route === "AI-report" || error.route === "AI-capacity") {
    if (error.message.includes("credit balance is too low")) {
      return {
        ...error,
        status: stale ? "info" : "config",
        label: stale ? "Claude fallback history" : "Claude credits",
        summary: stale
          ? "Claude fallback failed previously because the Anthropic account had no usable credits."
          : "Claude requests are failing because the Anthropic account has no usable credits.",
        hint: stale
          ? "Historical only unless you still want Claude enabled as a live fallback."
          : "Top up Anthropic credits or keep Claude fallback disabled for now.",
        stale,
      }
    }

    if (error.message.includes("mistralai/mistral-7b-instruct") || error.message.includes("mixtral-8x7b-32768")) {
      return {
        ...error,
        status: "resolved",
        label: "Old AI model log",
        summary: "This came from outdated provider model IDs.",
        hint: "Current code has already moved Groq and OpenRouter off those old model slugs.",
        stale,
      }
    }
  }

  if (error.route === "/api/admin/health" && error.message.includes("Cannot read properties of undefined (reading 'resend')")) {
    return {
      ...error,
      status: "resolved",
      label: "Old health-check bug",
      summary: "This was created by the previous Resend health-check implementation.",
      hint: "The current health route no longer uses that broken code path.",
      stale,
    }
  }

  if (error.route.startsWith("waitlist-promotion-email:")) {
    return {
      ...error,
      status: "info",
      label: "No-op promotion",
      summary: "The waitlist promotion job ran but nobody was eligible for promotion.",
      hint: "This is informational unless you expected waiting attendees with email addresses.",
      stale,
    }
  }

  return {
    ...error,
    status: "open",
    label: "Needs review",
    summary: "This log still needs manual review.",
    hint: "Trace the route or background job and confirm whether the failure is still reproducible.",
    stale,
  }
}

function getStatusColor(status: IssueStatus) {
  if (status === "resolved") return "var(--info)"
  if (status === "info") return "var(--text-secondary)"
  if (status === "config") return "var(--warning)"
  return "var(--error)"
}

function getStatusText(status: IssueStatus) {
  if (status === "resolved") return "Likely fixed in code"
  if (status === "info") return "Informational"
  if (status === "config") return "Needs configuration"
  return "Needs investigation"
}

export default function AdminHealthPage() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/health")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 960, animation: "pulse 1.4s ease-in-out infinite" }}>
        <div style={{ height: 24, width: 220, borderRadius: 8, background: "var(--surface-hover)" }} />
        <div style={{ height: 14, width: 260, borderRadius: 8, background: "var(--surface-hover)" }} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ background: "var(--surface)", border: "0.5px solid var(--border-subtle)", borderRadius: 12, padding: "1.5rem" }}>
              <div style={{ height: 10, width: 120, borderRadius: 6, background: "var(--surface-hover)", marginBottom: "0.8rem" }} />
              <div style={{ height: 16, width: 90, borderRadius: 6, background: "var(--surface-hover)" }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  const issues = data.recentErrors.map((error) => classifyIssue(error, data))
  const actionableIssues = issues.filter(
    (issue) => (issue.status === "open" || issue.status === "config") && !issue.stale
  )
  const resolvedIssues = issues.filter((issue) => issue.status === "resolved")
  const informationalIssues = issues.filter((issue) => issue.status === "info")
  const activeIssues = Array.from(
    new Map(
      actionableIssues.map((issue) => [`${issue.status}:${issue.label}:${issue.summary}`, issue])
    ).values()
  )
  const emailMetricLabel = data.emailProviderName === "smtp" ? "Email provider" : "Emails accepted this month"
  const emailMetricValue = data.emailProviderName === "smtp" ? data.emailProviderName.toUpperCase() : String(data.emailsAcceptedThisMonth ?? "--")

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", fontWeight: 400, color: "var(--text-primary)", marginBottom: "0.4rem" }}>
        Platform Health
      </h1>
      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", marginBottom: "2rem" }}>
        System status and error monitoring.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ marginBottom: "2rem" }}>
        <div style={{ background: "var(--surface)", border: "0.5px solid var(--border-subtle)", borderRadius: 12, padding: "1.5rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.75rem" }}>
            Database (Neon)
          </div>
          <StatusDot ok={data.dbOk} />
        </div>

        <div style={{ background: "var(--surface)", border: "0.5px solid var(--border-subtle)", borderRadius: 12, padding: "1.5rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>
            {emailMetricLabel}
          </div>
          <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", color: "var(--text-primary)", lineHeight: 1 }}>
            {emailMetricValue}
          </div>
          <div style={{ fontSize: "0.72rem", color: data.emailProviderHealthy ? "var(--text-muted)" : "var(--error)", marginTop: "0.3rem", fontFamily: "var(--font-dm-sans)" }}>
            {data.emailProviderConfigured ? data.emailProviderMessage : "Email provider settings missing"}
          </div>
        </div>

        <div style={{ background: "var(--surface)", border: "0.5px solid var(--border-subtle)", borderRadius: 12, padding: "1.5rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>
            Actionable issues
          </div>
          <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", color: activeIssues.length > 0 ? "var(--error)" : "var(--accent)", lineHeight: 1 }}>
            {activeIssues.length}
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.3rem", fontFamily: "var(--font-dm-sans)" }}>
            {resolvedIssues.length} likely fixed, {informationalIssues.length} informational
          </div>
        </div>
      </div>

      {activeIssues.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginBottom: "2rem" }}>
          {activeIssues.slice(0, 4).map((issue) => (
            <div key={issue.id} style={{ background: "var(--surface)", border: "0.5px solid var(--border-subtle)", borderRadius: 12, padding: "1rem" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.65rem" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: getStatusColor(issue.status), flexShrink: 0 }} />
                <span style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.08em", color: getStatusColor(issue.status), fontFamily: "var(--font-dm-sans)", fontWeight: 600 }}>
                  {issue.label}
                </span>
              </div>
              <div style={{ color: "var(--text-primary)", fontSize: "0.92rem", fontFamily: "var(--font-dm-sans)", fontWeight: 600, marginBottom: "0.5rem" }}>
                {issue.summary}
              </div>
              <div style={{ color: "var(--text-secondary)", fontSize: "0.78rem", lineHeight: 1.5, fontFamily: "var(--font-dm-sans)" }}>
                {issue.hint}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", fontWeight: 400, color: "var(--text-primary)", marginBottom: "1rem" }}>
        Recent API Errors
      </h2>
      {issues.length === 0 ? (
        <div style={{ background: "var(--surface)", border: "0.5px solid var(--border-subtle)", borderRadius: 12, padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem" }}>
          No errors logged. All clear.
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 12, border: "0.5px solid var(--border-subtle)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid var(--border-subtle)", background: "var(--surface)" }}>
                {["Route", "Error", "Time"].map((h) => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, i) => (
                <tr key={issue.id} style={{ borderBottom: "0.5px solid var(--border-subtle)", background: i % 2 !== 0 ? "var(--surface-2)" : "transparent" }}>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "var(--error)", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap", verticalAlign: "top" }}>
                    <div>{issue.route}</div>
                    <div style={{ marginTop: "0.35rem", display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.64rem", letterSpacing: "0.04em", textTransform: "uppercase", color: getStatusColor(issue.status) }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: getStatusColor(issue.status), flexShrink: 0 }} />
                      {getStatusText(issue.status)}
                      {issue.stale ? " | Historical" : ""}
                    </div>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", verticalAlign: "top" }}>
                    <div style={{ color: "var(--text-primary)", marginBottom: "0.35rem" }}>{issue.summary}</div>
                    <div style={{ marginBottom: "0.45rem", wordBreak: "break-word" }}>{issue.message}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: "0.72rem", lineHeight: 1.45 }}>{issue.hint}</div>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap", verticalAlign: "top" }}>
                    {new Date(issue.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
