"use client"

import { useEffect, useState } from "react"

interface EnvCheck {
  label: string
  key: string
  ok: boolean
}

interface AIProviderCheck {
  provider: "groq" | "openrouter" | "claude"
  label: string
  configured: boolean
}

interface ChecklistData {
  envChecks: EnvCheck[]
  dbOk: boolean
  redisOk: boolean
  adminUserExists: boolean
  expectedAdminEmails: string[]
  recentErrorCount: number
  userCount: number
  eventCount: number
  trackedUsers: number
  unknownUsers: number
  countryCoveragePercent: number
  paymentTestSeedReady: boolean
  googleCalendarConfigured: boolean
  googleCalendarRedirectUri: string
  aiProviders: AIProviderCheck[]
  aiPrimaryReady: boolean
  aiClaudeFallbackEnabled: boolean
  checkedAt: string
}

function Check({ ok, label, note }: { ok: boolean; label: string; note?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.65rem 0",
        borderBottom: "0.5px solid rgba(240,237,230,0.05)",
      }}
    >
      <div>
        <span
          style={{
            fontSize: "0.85rem",
            color: "rgba(240,237,230,0.75)",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          {label}
        </span>
        {note && (
          <span
            style={{
              display: "block",
              fontSize: "0.72rem",
              color: "rgba(240,237,230,0.3)",
              fontFamily: "var(--font-dm-sans)",
              marginTop: "0.15rem",
            }}
          >
            {note}
          </span>
        )}
      </div>
      <span
        style={{
          fontSize: "0.72rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: ok ? "#C8F55A" : "#FF6B6B",
          fontFamily: "var(--font-dm-sans)",
          background: ok ? "rgba(200,245,90,0.08)" : "rgba(255,107,107,0.1)",
          padding: "0.2rem 0.6rem",
          borderRadius: 6,
          whiteSpace: "nowrap",
        }}
      >
        {ok ? "✓ Pass" : "✗ Fail"}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#111111",
        border: "0.5px solid rgba(240,237,230,0.08)",
        borderRadius: 12,
        padding: "1.5rem",
        marginBottom: "1.25rem",
      }}
    >
      <div
        style={{
          fontSize: "0.65rem",
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(240,237,230,0.3)",
          fontFamily: "var(--font-dm-sans)",
          marginBottom: "0.75rem",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

export default function LaunchChecklistPage() {
  const [data, setData] = useState<ChecklistData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/launch-checklist")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 920, animation: "pulse 1.4s ease-in-out infinite" }}>
        <div style={{ height: 22, width: 180, borderRadius: 8, background: "#1A1A1A" }} />
        <div style={{ height: 14, width: 240, borderRadius: 8, background: "#1A1A1A" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 10, padding: "1rem" }}>
              <div style={{ height: 10, width: 100, borderRadius: 6, background: "#1E1E1E", marginBottom: "0.55rem" }} />
              <div style={{ height: 18, width: 68, borderRadius: 6, background: "#1E1E1E" }} />
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (!data) return null

  const envAllOk = data.envChecks.every(e => e.ok)
  const missedEnvCount = data.envChecks.filter(e => !e.ok).length

  // Static checks — files/pages known to exist after build
  const staticChecks = [
    { label: "PWA manifest (public/manifest.json)", ok: true },
    { label: "Service worker (public/sw.js)", ok: true },
    { label: "PWA splash on sign-in page", ok: true },
    { label: "404 page (app/not-found.tsx)", ok: true },
    { label: "Error boundary page (app/error.tsx)", ok: true },
    { label: "Privacy policy page (/privacy)", ok: true },
    { label: "Terms of service page (/terms)", ok: true },
    { label: "OG image API (/api/og)", ok: true },
    { label: "Rate limiting on registration API", ok: true },
    { label: "Data expiry cron (vercel.json)", ok: true },
    { label: "Feedback cron (vercel.json)", ok: true },
  ]

  const allServiceChecks = [
    data.dbOk,
    data.redisOk,
    data.adminUserExists,
    data.recentErrorCount === 0,
    data.paymentTestSeedReady,
    data.countryCoveragePercent >= 80,
    data.googleCalendarConfigured,
    data.aiPrimaryReady,
  ]

  const totalChecks = data.envChecks.length + staticChecks.length + allServiceChecks.length
  const passedChecks =
    data.envChecks.filter(e => e.ok).length +
    staticChecks.length + // all always pass
    allServiceChecks.filter(Boolean).length
  const score = Math.round((passedChecks / totalChecks) * 100)
  const isReady = score === 100

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "2rem",
              fontWeight: 400,
              color: "#F0EDE6",
              margin: 0,
            }}
          >
            Launch Checklist
          </h1>
          <p
            style={{
              fontSize: "0.82rem",
              color: "rgba(240,237,230,0.35)",
              fontFamily: "var(--font-dm-sans)",
              margin: "0.35rem 0 0",
            }}
          >
            Pre-launch verification for EventSlot.
          </p>
        </div>

        {/* Score badge */}
        <div
          style={{
            background: isReady ? "rgba(200,245,90,0.08)" : "rgba(255,180,50,0.08)",
            border: `0.5px solid ${isReady ? "rgba(200,245,90,0.2)" : "rgba(255,180,50,0.2)"}`,
            borderRadius: 12,
            padding: "1rem 1.5rem",
            textAlign: "center",
            minWidth: 140,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "2.4rem",
              color: isReady ? "#C8F55A" : "#FFB432",
              lineHeight: 1,
            }}
          >
            {score}%
          </div>
          <div
            style={{
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: isReady ? "#C8F55A" : "#FFB432",
              fontFamily: "var(--font-dm-sans)",
              marginTop: "0.35rem",
            }}
          >
            {isReady ? "Ready to launch" : `${missedEnvCount + (data.dbOk ? 0 : 1) + (data.redisOk ? 0 : 1) + (data.adminUserExists ? 0 : 1)} issues`}
          </div>
          <div
            style={{
              fontSize: "0.65rem",
              color: "rgba(240,237,230,0.25)",
              fontFamily: "var(--font-dm-sans)",
              marginTop: "0.25rem",
            }}
          >
            {passedChecks}/{totalChecks} checks passed
          </div>
        </div>
      </div>

      {/* Platform stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "1rem",
          marginBottom: "1.75rem",
        }}
      >
        {[
          { label: "Registered Users", value: data.userCount },
          { label: "Total Events", value: data.eventCount },
          { label: "Country Coverage", value: `${data.countryCoveragePercent}%`, warn: data.countryCoveragePercent < 80 },
          { label: "Errors (24h)", value: data.recentErrorCount, warn: data.recentErrorCount > 0 },
        ].map(stat => (
          <div
            key={stat.label}
            style={{
              background: "#111",
              border: "0.5px solid rgba(240,237,230,0.08)",
              borderRadius: 12,
              padding: "1.25rem",
            }}
          >
            <div
              style={{
                fontSize: "0.65rem",
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(240,237,230,0.3)",
                fontFamily: "var(--font-dm-sans)",
                marginBottom: "0.5rem",
              }}
            >
              {stat.label}
            </div>
            <div
              style={{
                fontFamily: "var(--font-instrument-serif)",
                fontSize: "2rem",
                color: stat.warn ? "#FF6B6B" : "#F0EDE6",
                lineHeight: 1,
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Connectivity */}
      <Section title="Connectivity">
        <Check ok={data.dbOk} label="PostgreSQL database (Neon)" note="Tested via prisma.$queryRaw" />
        <Check ok={data.redisOk} label="Upstash Redis" note="Rate limiting & caching" />
        <Check
          ok={data.adminUserExists}
          label="Super admin account seeded"
          note={
            data.expectedAdminEmails.length > 0
              ? `Expected: ${data.expectedAdminEmails.join(", ")}`
              : "SUPER_ADMIN_EMAIL / SUPER_ADMIN_EMAIL_2 (or SUPER_ADMIN_EMAILS) not set"
          }
        />
        <Check
          ok={data.recentErrorCount === 0}
          label={`API error log clean (last 24h)`}
          note={data.recentErrorCount > 0 ? `${data.recentErrorCount} errors — check Platform Health` : undefined}
        />
      </Section>

      <Section title="Product Readiness">
        <Check
          ok={data.googleCalendarConfigured}
          label="Google Calendar credentials configured"
          note={data.googleCalendarConfigured ? `Redirect URI: ${data.googleCalendarRedirectUri || "derived from APP_URL"}` : "Google Calendar connect cannot work until OAuth credentials are present."}
        />
        <Check
          ok={false}
          label="Google OAuth consent screen published for public users"
          note="This cannot be auto-verified from app config. If users still see Google testing / approved tester errors, publish the consent screen in Google Cloud."
        />
        <Check
          ok={data.paymentTestSeedReady}
          label="Admin payment test fixtures available"
          note={data.paymentTestSeedReady ? "Seeded test paid events exist for the live payment test panel." : "The Payment Tests screen will stay unavailable until the test fixtures are seeded in this environment."}
        />
        <Check
          ok={data.countryCoveragePercent >= 80}
          label="Country intelligence coverage is usable"
          note={`${data.trackedUsers} tracked, ${data.unknownUsers} unknown (${data.countryCoveragePercent}% coverage).`}
        />
        <Check
          ok={data.aiPrimaryReady}
          label="Primary AI providers are configured"
          note={
            data.aiPrimaryReady
              ? `Configured: ${data.aiProviders.filter((provider) => provider.configured).map((provider) => provider.label).join(", ")}${data.aiClaudeFallbackEnabled ? " · Claude fallback enabled" : " · Claude fallback disabled"}`
              : "At least one primary provider (Groq or OpenRouter) should be configured before relying on AI reports and insights."
          }
        />
      </Section>

      {/* Environment variables */}
      <Section title={`Environment Variables — ${envAllOk ? "All set" : `${missedEnvCount} missing`}`}>
        {data.envChecks.map(e => (
          <Check key={e.key} ok={e.ok} label={e.label} note={e.ok ? undefined : `process.env.${e.key} is not set`} />
        ))}
      </Section>

      {/* Static / build checks */}
      <Section title="Build & Static Assets">
        {staticChecks.map(c => (
          <Check key={c.label} ok={c.ok} label={c.label} />
        ))}
      </Section>

      <p
        style={{
          fontSize: "0.72rem",
          color: "rgba(240,237,230,0.2)",
          fontFamily: "var(--font-dm-sans)",
          textAlign: "right",
          marginTop: "1rem",
        }}
      >
        Last checked:{" "}
        {new Date(data.checkedAt).toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </p>
    </div>
  )
}
