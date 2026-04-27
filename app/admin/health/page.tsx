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
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
      <span style={{ width: 9, height: 9, borderRadius: "50%", background: ok ? "#C8F55A" : "#FF6B6B", flexShrink: 0 }} />
      <span style={{ fontSize: "0.82rem", color: ok ? "#C8F55A" : "#FF6B6B", fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}>
        {ok ? "Healthy" : "Error"}
      </span>
    </span>
  )
}

export default function AdminHealthPage() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/health")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ color: "rgba(240,237,230,0.25)", fontFamily: "var(--font-dm-sans)", fontSize: "0.82rem" }}>Loading…</div>
  }
  if (!data) return null

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", fontWeight: 400, color: "#F0EDE6", marginBottom: "0.4rem" }}>
        Platform Health
      </h1>
      <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.35)", fontFamily: "var(--font-dm-sans)", marginBottom: "2rem" }}>
        System status and error monitoring.
      </p>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ marginBottom: "2.5rem" }}>
        <div style={{ background: "#111", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.5rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.75rem" }}>
            Database (Neon)
          </div>
          <StatusDot ok={data.dbOk} />
        </div>

        <div style={{ background: "#111", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.5rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>
            Emails accepted this month
          </div>
          <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", color: "#F0EDE6", lineHeight: 1 }}>
            {data.emailsAcceptedThisMonth ?? "—"}
          </div>
          <div style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", marginTop: "0.3rem", fontFamily: "var(--font-dm-sans)" }}>
            {data.emailProviderConfigured ? "from email provider" : "RESEND_API_KEY missing"}
          </div>
        </div>

        <div style={{ background: "#111", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 12, padding: "1.5rem" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.5rem" }}>
            Recent API errors
          </div>
          <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "2rem", color: data.recentErrors.length > 0 ? "#FF6B6B" : "#C8F55A", lineHeight: 1 }}>
            {data.recentErrors.length}
          </div>
          <div style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", marginTop: "0.3rem", fontFamily: "var(--font-dm-sans)" }}>last 10 logged</div>
        </div>
      </div>

      {/* Error log */}
      <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", fontWeight: 400, color: "#F0EDE6", marginBottom: "1rem" }}>
        Recent API Errors
      </h2>
      {data.recentErrors.length === 0 ? (
        <div style={{ background: "#111", border: "0.5px solid rgba(240,237,230,0.07)", borderRadius: 12, padding: "2rem", textAlign: "center", color: "rgba(240,237,230,0.2)", fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem" }}>
          No errors logged. All clear.
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 12, border: "0.5px solid rgba(240,237,230,0.08)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr style={{ borderBottom: "0.5px solid rgba(240,237,230,0.08)", background: "#111" }}>
                {["Route", "Error", "Time"].map(h => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "left", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recentErrors.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: "0.5px solid rgba(240,237,230,0.04)", background: i % 2 !== 0 ? "rgba(255,255,255,0.01)" : "transparent" }}>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap" }}>{e.route}</td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)" }}>{e.message}</td>
                  <td style={{ padding: "0.75rem 1rem", fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap" }}>
                    {new Date(e.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
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
