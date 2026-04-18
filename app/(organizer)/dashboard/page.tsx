"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { formatDistanceToNow } from "date-fns"

// ─── Types ────────────────────────────────────────────────────────────────────

interface EventNearCapacity {
  title: string
  slug: string
  confirmedCount: number
  capacity: number
  dashboardToken: string
}

interface UpcomingEvent {
  title: string
  slug: string
  confirmedCount: number
  capacity: number | null
  deadline: string
}

interface ActivityItem {
  id: string
  name: string
  eventTitle: string
  eventSlug: string
  submittedAt: string
}

interface Stats {
  totalEvents: number
  totalRegistrations: number
  activeEvents: number
  totalWaitlisted: number
  eventsNearCapacity: EventNearCapacity[]
  upcomingEvents: UpcomingEvent[]
  recentActivity: ActivityItem[]
  eventsThisMonth: number
  registrationsThisMonth: number
  registrationsLastMonth: number
  conversionRate: number
  eventsClosingThisWeek: number
  waitlistEventCount: number
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, trend }: { label: string; value: number | string; trend?: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#141414",
        border: "0.5px solid rgba(240,237,230,0.08)",
        borderRadius: 12,
        padding: "1.25rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <span
        style={{
          fontSize: "0.7rem",
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "rgba(240,237,230,0.4)",
          fontFamily: "var(--font-dm-sans)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "2rem",
          fontWeight: 600,
          color: "#F0EDE6",
          fontFamily: "var(--font-dm-sans)",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      {trend && (
        <div style={{ marginTop: "0.1rem" }}>{trend}</div>
      )}
    </div>
  )
}

// ─── Capacity modal ───────────────────────────────────────────────────────────

function CapacityModal({
  event,
  onClose,
  onSuccess,
}: {
  event: EventNearCapacity
  onClose: () => void
  onSuccess: (slug: string, newCapacity: number) => void
}) {
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSave = async () => {
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      setError("Enter a valid positive number.")
      return
    }
    if (parsed <= event.confirmedCount) {
      setError("New capacity must be greater than current confirmed count.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/events/${event.slug}/capacity`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newCapacity: parsed, token: event.dashboardToken }),
      })
      const data = await res.json()
      if (res.ok) {
        onSuccess(event.slug, parsed)
        onClose()
      } else {
        setError(data.error || "Failed to update capacity.")
      }
    } catch {
      setError("Unexpected error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 100,
        }}
      />
      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 101,
          background: "#1A1A1A",
          border: "0.5px solid rgba(240,237,230,0.1)",
          borderRadius: 16,
          padding: "1.75rem",
          width: "min(92vw, 420px)",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.2rem",
            color: "#F0EDE6",
            marginBottom: "0.5rem",
          }}
        >
          Increase capacity
        </h3>
        <p
          style={{
            fontSize: "0.82rem",
            color: "rgba(240,237,230,0.45)",
            fontFamily: "var(--font-dm-sans)",
            marginBottom: "1.25rem",
          }}
        >
          <strong style={{ color: "rgba(240,237,230,0.7)" }}>{event.title}</strong> currently has{" "}
          {event.confirmedCount} of {event.capacity} slots filled.
        </p>

        <label
          style={{
            display: "block",
            fontSize: "0.72rem",
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "rgba(240,237,230,0.4)",
            fontFamily: "var(--font-dm-sans)",
            marginBottom: "0.4rem",
            textTransform: "uppercase",
          }}
        >
          New capacity
        </label>
        <input
          type="number"
          min={event.confirmedCount + 1}
          value={value}
          onChange={e => { setValue(e.target.value); setError("") }}
          placeholder={String(event.capacity + 1)}
          style={{
            width: "100%",
            background: "#141414",
            border: "0.5px solid rgba(240,237,230,0.15)",
            borderRadius: 8,
            padding: "0.625rem 0.875rem",
            fontSize: "0.875rem",
            color: "#F0EDE6",
            fontFamily: "var(--font-dm-sans)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {error && (
          <p
            style={{
              fontSize: "0.78rem",
              color: "#FF6B6B",
              fontFamily: "var(--font-dm-sans)",
              marginTop: "0.4rem",
            }}
          >
            {error}
          </p>
        )}

        <div
          style={{
            display: "flex",
            gap: "0.625rem",
            marginTop: "1.25rem",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "0.5px solid rgba(240,237,230,0.15)",
              borderRadius: 8,
              padding: "0.5rem 1rem",
              fontSize: "0.82rem",
              color: "rgba(240,237,230,0.5)",
              cursor: "pointer",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: "#C8F55A",
              border: "none",
              borderRadius: 8,
              padding: "0.5rem 1.25rem",
              fontSize: "0.82rem",
              fontWeight: 600,
              color: "#0A0A0A",
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "var(--font-dm-sans)",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardOverviewPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [capacityEvent, setCapacityEvent] = useState<EventNearCapacity | null>(null)
  const [userPlan, setUserPlan] = useState("free")
  const [creditBalance, setCreditBalance] = useState(0)
  const [featureModal, setFeatureModal] = useState<{ name: string; icon: string; tier: string; description: string; credits?: number } | null>(null)

  const firstName = session?.user?.name
    ? session.user.name.split(" ")[0]
    : session?.user?.email?.split("@")[0] ?? "there"

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then(r => r.json())
      .then(data => setStats(data))
      .finally(() => setLoading(false))
    fetch("/api/me")
      .then(r => r.json())
      .then(d => {
        if (d.plan) setUserPlan(d.plan)
        if (typeof d.creditBalance === "number") setCreditBalance(d.creditBalance)
      })
      .catch(() => {})
  }, [])

  const handleCapacitySuccess = (slug: string, newCapacity: number) => {
    setStats(prev => {
      if (!prev) return prev
      const updated = prev.eventsNearCapacity.map(e =>
        e.slug === slug ? { ...e, capacity: newCapacity } : e
      )
      // Remove events that no longer meet the 80% threshold
      const filtered = updated.filter(
        e => e.confirmedCount / e.capacity >= 0.8
      )
      return { ...prev, eventsNearCapacity: filtered }
    })
  }

  const FEATURES = [
    { name: "Event creation",      tier: "free",     desc: "Create unlimited registration links",            icon: "+",  cost: undefined },
    { name: "Waitlist automation",  tier: "free",     desc: "Auto-manage overflow registrations",             icon: "⟳",  cost: undefined },
    { name: "Bulk registration",    tier: "free",     desc: "Register multiple people at once",               icon: "⊞",  cost: undefined },
    { name: "Community link",       tier: "free",     desc: "Add WhatsApp or Telegram link",                  icon: "🔗", cost: undefined },
    { name: "Export CSV",           tier: "credits",  desc: "Download attendee data as spreadsheet",          icon: "↓",  cost: 15 },
    { name: "Standard report",      tier: "free",     desc: "Basic Word document with attendee list",         icon: "📄", cost: undefined },
    { name: "AI event report",      tier: "credits",  desc: "Narrative analysis written by AI",               icon: "✦",  cost: 50 },
    { name: "Event analytics",      tier: "pro",      desc: "Views, conversion rate, timelines",              icon: "📊", cost: undefined },
    { name: "AI insight cards",     tier: "credits",  desc: "3 AI-generated insights per event",              icon: "💡", cost: 20 },
    { name: "Ask your data",        tier: "business", desc: "Chat with your event analytics",                 icon: "💬", cost: undefined },
    { name: "Duplicate event",      tier: "pro",      desc: "Clone any event setup instantly",                icon: "⧉",  cost: undefined },
    { name: "Custom thank you",     tier: "pro",      desc: "Personalised confirmation message",              icon: "✉",  cost: undefined },
    { name: "Team members",         tier: "pro",      desc: "Invite collaborators to your account",           icon: "👥", cost: undefined },
    { name: "Insight Tracker",      tier: "business", desc: "Cross-event audience demographics",              icon: "📈", cost: undefined },
    { name: "Feedback forms",       tier: "business", desc: "Post-event star ratings and comments",           icon: "⭐", cost: undefined },
    { name: "Predictive capacity",  tier: "pro",      desc: "AI suggests capacity before you set it",         icon: "🤖", cost: undefined },
  ] as const

  const tierStyle = (tier: string): { bg: string; color: string; label: string } => {
    if (tier === "pro")      return { bg: "rgba(250,199,117,0.12)", color: "#FAC775", label: "Pro" }
    if (tier === "business") return { bg: "rgba(127,119,221,0.12)", color: "#7F77DD", label: "Business" }
    if (tier === "credits")  return { bg: "rgba(55,138,221,0.12)",  color: "#378ADD", label: "Credits" }
    return { bg: "rgba(200,245,90,0.1)", color: "#C8F55A", label: "Free" }
  }

  const planOrder: Record<string, number> = { free: 0, pro: 1, business: 2 }
  const canAccess = (tier: string) => {
    if (tier === "free") return true
    if (tier === "credits") return true
    return (planOrder[userPlan] ?? 0) >= (planOrder[tier] ?? 99)
  }

  return (
    <>
      {capacityEvent && (
        <CapacityModal
          event={capacityEvent}
          onClose={() => setCapacityEvent(null)}
          onSuccess={handleCapacitySuccess}
        />
      )}

      {/* Feature / upgrade / credits modal */}
      {featureModal && (
        <div
          onClick={() => setFeatureModal(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200, padding: "1rem",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#141414", border: "0.5px solid rgba(240,237,230,0.1)",
              borderRadius: 14, padding: "2rem", maxWidth: 400, width: "100%",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>{featureModal.icon}</div>
            <h3 style={{
              fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem",
              color: "#F0EDE6", marginBottom: "0.5rem",
            }}>{featureModal.name}</h3>
            <p style={{
              fontSize: "0.82rem", fontFamily: "var(--font-dm-sans)",
              color: "rgba(240,237,230,0.55)", lineHeight: 1.6, marginBottom: "1.5rem",
            }}>{featureModal.description}</p>
            {featureModal.tier === "credits" ? (
              <>
                <p style={{
                  fontSize: "0.78rem", fontFamily: "var(--font-dm-sans)",
                  color: "#378ADD", marginBottom: "1.25rem",
                }}>This costs <strong>{featureModal.credits} credits</strong> per use.{" "}You currently have <strong>{creditBalance}</strong> credits.</p>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <Link
                    href="/dashboard/billing"
                    onClick={() => setFeatureModal(null)}
                    style={{
                      flex: 1, textAlign: "center", padding: "0.6rem",
                      background: "#378ADD", color: "#fff", borderRadius: 8,
                      fontFamily: "var(--font-dm-sans)", fontSize: "0.8rem",
                      fontWeight: 600, textDecoration: "none",
                    }}
                  >Buy Credits</Link>
                  <button
                    onClick={() => setFeatureModal(null)}
                    style={{
                      flex: 1, padding: "0.6rem", background: "transparent",
                      border: "0.5px solid rgba(240,237,230,0.15)", color: "rgba(240,237,230,0.5)",
                      borderRadius: 8, fontFamily: "var(--font-dm-sans)", fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >Maybe later</button>
                </div>
              </>
            ) : (
              <>
                <p style={{
                  fontSize: "0.78rem", fontFamily: "var(--font-dm-sans)",
                  color: featureModal.tier === "business" ? "#7F77DD" : "#FAC775",
                  marginBottom: "1.25rem",
                }}>Available on the <strong style={{ textTransform: "capitalize" }}>{featureModal.tier}</strong> plan.</p>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <Link
                    href="/pricing"
                    onClick={() => setFeatureModal(null)}
                    style={{
                      flex: 1, textAlign: "center", padding: "0.6rem",
                      background: "#C8F55A", color: "#0A0A0A", borderRadius: 8,
                      fontFamily: "var(--font-dm-sans)", fontSize: "0.8rem",
                      fontWeight: 600, textDecoration: "none",
                    }}
                  >See Plans</Link>
                  <button
                    onClick={() => setFeatureModal(null)}
                    style={{
                      flex: 1, padding: "0.6rem", background: "transparent",
                      border: "0.5px solid rgba(240,237,230,0.15)", color: "rgba(240,237,230,0.5)",
                      borderRadius: 8, fontFamily: "var(--font-dm-sans)", fontSize: "0.8rem",
                      cursor: "pointer",
                    }}
                  >Not now</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Page header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "2rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontFamily: "var(--font-instrument-serif)",
                fontSize: "1.6rem",
                color: "#F0EDE6",
                fontWeight: 400,
                margin: 0,
              }}
            >
              {getGreeting()}, {firstName}
            </h1>
            <p
              style={{
                marginTop: "0.4rem",
                fontSize: "0.875rem",
                fontWeight: 300,
                color: "rgba(240,237,230,0.45)",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              Here is what is happening with your events.
            </p>
          </div>
          <Link
            href="/create"
            style={{
              background: "#C8F55A",
              color: "#0A0A0A",
              borderRadius: 8,
              padding: "0.6rem 1.25rem",
              fontSize: "0.82rem",
              fontWeight: 600,
              fontFamily: "var(--font-dm-sans)",
              textDecoration: "none",
              whiteSpace: "nowrap",
              alignSelf: "flex-start",
            }}
          >
            Create new event
          </Link>
        </div>

        {/* Stat cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "0.75rem",
            marginBottom: "2rem",
          }}
          className="sm:grid-cols-4"
        >
          <StatCard
            label="Total events"
            value={loading ? "—" : (stats?.totalEvents ?? 0)}
            trend={!loading && stats && (
              <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", color: stats.eventsThisMonth > 0 ? "#C8F55A" : "rgba(240,237,230,0.3)" }}>
                {stats.eventsThisMonth > 0 ? `+${stats.eventsThisMonth} this month` : "None this month"}
              </span>
            )}
          />
          <StatCard
            label="Registrations"
            value={loading ? "—" : (stats?.totalRegistrations ?? 0)}
            trend={!loading && stats && (() => {
              const diff = stats.registrationsThisMonth - stats.registrationsLastMonth
              if (diff > 0) return <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", color: "#C8F55A" }}>↑ {diff} more than last month</span>
              if (diff < 0) return <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", color: "rgba(255,107,107,0.8)" }}>↓ {Math.abs(diff)} fewer than last month</span>
              return <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", color: "rgba(240,237,230,0.3)" }}>Same as last month</span>
            })()}
          />
          <StatCard
            label="Active now"
            value={loading ? "—" : (stats?.activeEvents ?? 0)}
            trend={!loading && stats && (
              stats.eventsClosingThisWeek > 0
                ? <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", color: "#FAC775" }}>⚠ {stats.eventsClosingThisWeek} closing this week</span>
                : <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", color: "rgba(240,237,230,0.3)" }}>No closures this week</span>
            )}
          />
          <StatCard
            label="On waitlist"
            value={loading ? "—" : (stats?.totalWaitlisted ?? 0)}
            trend={!loading && stats && (
              stats.totalWaitlisted === 0
                ? <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", color: "#C8F55A" }}>All caught up</span>
                : <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", color: "rgba(240,237,230,0.3)" }}>across {stats.waitlistEventCount} event{stats.waitlistEventCount !== 1 ? "s" : ""}</span>
            )}
          />
        </div>

        {/* ── Plan Badge ──────────────────────────────────────────────────────── */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(200,245,90,0.04), rgba(200,245,90,0.01))",
            border: "0.5px solid rgba(200,245,90,0.12)",
            borderRadius: 10,
            padding: "0.875rem 1.25rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "0.25rem",
          }}
        >
          {/* Left: plan pill + credits */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <span style={{
              fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em",
              textTransform: "uppercase", fontFamily: "var(--font-dm-sans)",
              padding: "0.25rem 0.6rem", borderRadius: 99,
              background: userPlan === "business" ? "rgba(127,119,221,0.18)" : userPlan === "pro" ? "rgba(250,199,117,0.15)" : "rgba(200,245,90,0.12)",
              color: userPlan === "business" ? "#7F77DD" : userPlan === "pro" ? "#FAC775" : "#C8F55A",
              border: `0.5px solid ${userPlan === "business" ? "rgba(127,119,221,0.3)" : userPlan === "pro" ? "rgba(250,199,117,0.25)" : "rgba(200,245,90,0.25)"}`,
            }}>{userPlan}</span>
            {creditBalance > 0 && (
              <span style={{
                fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.03em",
                fontFamily: "var(--font-dm-sans)", padding: "0.25rem 0.6rem",
                borderRadius: 99, background: "rgba(55,138,221,0.12)",
                color: "#378ADD", border: "0.5px solid rgba(55,138,221,0.25)",
              }}>{creditBalance} credits</span>
            )}
          </div>
          {/* Right: contextual CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {userPlan === "free" && (
              <>
                <Link href="/pricing" style={{
                  fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)",
                  color: "#0A0A0A", background: "#C8F55A", padding: "0.35rem 0.9rem",
                  borderRadius: 99, textDecoration: "none", whiteSpace: "nowrap",
                }}>Upgrade to Pro</Link>
                <Link href="/dashboard/billing" style={{
                  fontSize: "0.75rem", fontWeight: 500, fontFamily: "var(--font-dm-sans)",
                  color: "rgba(240,237,230,0.55)", textDecoration: "none", whiteSpace: "nowrap",
                }}>Buy credits →</Link>
              </>
            )}
            {userPlan === "pro" && (
              <Link href="/pricing" style={{
                fontSize: "0.75rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)",
                color: "#7F77DD", textDecoration: "none", whiteSpace: "nowrap",
              }}>Upgrade to Business →</Link>
            )}
            {userPlan === "business" && (
              <span style={{
                fontSize: "0.75rem", fontFamily: "var(--font-dm-sans)",
                color: "rgba(240,237,230,0.4)",
              }}>You&apos;re on the best plan</span>
            )}
          </div>
        </div>

        {/* ── Quick Actions ────────────────────────────────────────────────────── */}
        <div className="dash-qa-grid" style={{ display: "grid", gap: "0.75rem", marginBottom: "0.25rem" }}>
          <style>{`.dash-qa-grid { grid-template-columns: repeat(2, 1fr) } @media (min-width: 640px) { .dash-qa-grid { grid-template-columns: repeat(4, 1fr) } }`}</style>
          {/* Create Event */}
          <Link href="/create" style={{ textDecoration: "none" }}>
            <div style={{
              background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)",
              borderRadius: 10, padding: "1rem 1.1rem", display: "flex", flexDirection: "column",
              gap: "0.5rem", cursor: "pointer", transition: "border-color 0.15s",
            }}>
              <span style={{ fontSize: "1.1rem" }}>+</span>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", color: "#F0EDE6" }}>Create Event</span>
            </div>
          </Link>
          {/* My Events */}
          <Link href="/dashboard/events" style={{ textDecoration: "none" }}>
            <div style={{
              background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)",
              borderRadius: 10, padding: "1rem 1.1rem", display: "flex", flexDirection: "column",
              gap: "0.5rem", cursor: "pointer",
            }}>
              <span style={{ fontSize: "1.1rem" }}>☰</span>
              <span style={{ fontSize: "0.78rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", color: "#F0EDE6" }}>My Events</span>
              {!loading && stats && (
                <span style={{ fontSize: "0.68rem", fontFamily: "var(--font-dm-sans)", color: "rgba(240,237,230,0.35)" }}>{stats.totalEvents} total</span>
              )}
            </div>
          </Link>
          {/* Analytics — Pro gated */}
          {userPlan !== "free"
            ? (
              <Link href="/dashboard/insights" style={{ textDecoration: "none" }}>
                <div style={{
                  background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)",
                  borderRadius: 10, padding: "1rem 1.1rem", display: "flex", flexDirection: "column", gap: "0.5rem", cursor: "pointer",
                }}>
                  <span style={{ fontSize: "1.1rem" }}>📊</span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", color: "#F0EDE6" }}>Analytics</span>
                </div>
              </Link>
            )
            : (
              <div
                onClick={() => setFeatureModal({ name: "Event Analytics", icon: "📊", tier: "pro", description: "Views, conversion rate, registration timelines and more.", credits: undefined })}
                style={{
                  background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)",
                  borderRadius: 10, padding: "1rem 1.1rem", display: "flex", flexDirection: "column",
                  gap: "0.5rem", cursor: "pointer", position: "relative",
                }}
              >
                <span style={{ fontSize: "1.1rem", filter: "grayscale(1) opacity(0.4)" }}>📊</span>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", color: "rgba(240,237,230,0.35)" }}>Analytics</span>
                <span style={{
                  position: "absolute", top: "0.6rem", right: "0.7rem",
                  fontSize: "0.7rem", color: "#FAC775",
                }}>🔒</span>
              </div>
            )
          }
          {/* Get Report — Credits gated */}
          {creditBalance >= 50
            ? (
              <Link href="/dashboard/events" style={{ textDecoration: "none" }}>
                <div style={{
                  background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)",
                  borderRadius: 10, padding: "1rem 1.1rem", display: "flex", flexDirection: "column", gap: "0.5rem", cursor: "pointer",
                }}>
                  <span style={{ fontSize: "1.1rem" }}>✦</span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", color: "#F0EDE6" }}>AI Report</span>
                </div>
              </Link>
            )
            : (
              <div
                onClick={() => setFeatureModal({ name: "AI Event Report", icon: "✦", tier: "credits", description: "A narrative analysis of your event written by AI — attendance patterns, highlights, and recommendations.", credits: 50 })}
                style={{
                  background: "#141414", border: "0.5px solid rgba(240,237,230,0.08)",
                  borderRadius: 10, padding: "1rem 1.1rem", display: "flex", flexDirection: "column",
                  gap: "0.5rem", cursor: "pointer", position: "relative",
                }}
              >
                <span style={{ fontSize: "1.1rem", filter: "grayscale(1) opacity(0.4)" }}>✦</span>
                <span style={{ fontSize: "0.78rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", color: "rgba(240,237,230,0.35)" }}>AI Report</span>
                <span style={{
                  position: "absolute", top: "0.6rem", right: "0.7rem",
                  fontSize: "0.62rem", color: "#378ADD",
                }}>50 cr</span>
              </div>
            )
          }
        </div>

        {/* Sections — single column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Needs attention — only rendered when loading or there are near-capacity events */}
          {(loading || (stats?.eventsNearCapacity?.length ?? 0) > 0) && (
            <section>
            <h2
              style={{
                fontFamily: "var(--font-instrument-serif)",
                fontSize: "1.1rem",
                fontWeight: 400,
                color: "#F0EDE6",
                marginBottom: "1rem",
              }}
            >
              Needs attention
            </h2>

            {loading ? (
              <div
                style={{
                  background: "#141414",
                  border: "0.5px solid rgba(240,237,230,0.08)",
                  borderRadius: 12,
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {[1, 2].map(i => (
                  <div
                    key={i}
                    style={{
                      height: 56,
                      borderRadius: 8,
                      background: "rgba(240,237,230,0.04)",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  />
                ))}
              </div>
            ) : !stats?.eventsNearCapacity?.length ? (
              <div
                style={{
                  background: "#141414",
                  border: "0.5px solid rgba(240,237,230,0.08)",
                  borderRadius: 12,
                  padding: "1.5rem",
                }}
              >
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "rgba(240,237,230,0.35)",
                    fontFamily: "var(--font-dm-sans)",
                    margin: 0,
                  }}
                >
                  All events have plenty of room.
                </p>
              </div>
            ) : (
              <div
                style={{
                  background: "#141414",
                  border: "0.5px solid rgba(240,237,230,0.08)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {stats.eventsNearCapacity.map((event, i) => {
                  const pct = Math.min(100, Math.round((event.confirmedCount / event.capacity) * 100))
                  return (
                    <div
                      key={event.slug}
                      style={{
                        padding: "1rem 1.25rem",
                        borderBottom:
                          i < stats.eventsNearCapacity.length - 1
                            ? "0.5px solid rgba(240,237,230,0.06)"
                            : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.75rem",
                          marginBottom: "0.625rem",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            color: "#F0EDE6",
                            fontFamily: "var(--font-dm-sans)",
                          }}
                        >
                          {event.title}
                        </span>
                        <button
                          onClick={() => setCapacityEvent(event)}
                          style={{
                            background: "transparent",
                            border: "0.5px solid rgba(240,237,230,0.15)",
                            borderRadius: 6,
                            padding: "0.3rem 0.75rem",
                            fontSize: "0.72rem",
                            fontWeight: 500,
                            color: "rgba(240,237,230,0.55)",
                            cursor: "pointer",
                            fontFamily: "var(--font-dm-sans)",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          Increase capacity
                        </button>
                      </div>

                      {/* Progress bar */}
                      <div
                        style={{
                          height: 4,
                          background: "rgba(240,237,230,0.06)",
                          borderRadius: 100,
                          overflow: "hidden",
                          marginBottom: "0.4rem",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct}%`,
                            background: pct >= 95 ? "#FF6B6B" : "#C8F55A",
                            borderRadius: 100,
                            transition: "width 0.4s ease",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "rgba(240,237,230,0.35)",
                          fontFamily: "var(--font-dm-sans)",
                        }}
                      >
                        {event.confirmedCount} of {event.capacity} slots filled
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
          )}

          {/* Upcoming events */}
          <section>
            <h2
              style={{
                fontFamily: "var(--font-instrument-serif)",
                fontSize: "1.1rem",
                fontWeight: 400,
                color: "#F0EDE6",
                marginBottom: "1rem",
              }}
            >
              Upcoming events
            </h2>

            {loading ? (
              <div
                style={{
                  background: "#141414",
                  border: "0.5px solid rgba(240,237,230,0.08)",
                  borderRadius: 12,
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {[1, 2, 3].map(i => (
                  <div
                    key={i}
                    style={{
                      height: 52,
                      borderRadius: 8,
                      background: "rgba(240,237,230,0.04)",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  />
                ))}
              </div>
            ) : !stats?.upcomingEvents?.length ? (
              <div
                style={{
                  background: "#141414",
                  border: "0.5px solid rgba(240,237,230,0.08)",
                  borderRadius: 12,
                  padding: "2rem 1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "0.625rem",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "rgba(240,237,230,0.04)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "0.25rem",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(240,237,230,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.875rem",
                    color: "rgba(240,237,230,0.35)",
                    fontFamily: "var(--font-dm-sans)",
                  }}
                >
                  No upcoming events
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.78rem",
                    color: "rgba(240,237,230,0.2)",
                    fontFamily: "var(--font-dm-sans)",
                  }}
                >
                  Create an event to get started.
                </p>
                <Link
                  href="/create"
                  style={{
                    marginTop: "0.5rem",
                    background: "#C8F55A",
                    color: "#0A0A0A",
                    borderRadius: 8,
                    padding: "0.5rem 1.1rem",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    fontFamily: "var(--font-dm-sans)",
                    textDecoration: "none",
                  }}
                >
                  Create event
                </Link>
              </div>
            ) : (
              <div
                style={{
                  background: "#141414",
                  border: "0.5px solid rgba(240,237,230,0.08)",
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {stats.upcomingEvents.map((ev, i) => {
                  const pct = ev.capacity && ev.capacity > 0
                    ? Math.min(100, Math.round((ev.confirmedCount / ev.capacity) * 100))
                    : 0
                  const deadlineDate = new Date(ev.deadline)
                  const formatted = deadlineDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                  return (
                    <div
                      key={ev.slug}
                      style={{
                        padding: "0.875rem 1.25rem",
                        borderBottom:
                          i < stats.upcomingEvents.length - 1
                            ? "0.5px solid rgba(240,237,230,0.06)"
                            : "none",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.75rem",
                          marginBottom: ev.capacity ? "0.5rem" : 0,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "0.875rem",
                              fontWeight: 500,
                              color: "#F0EDE6",
                              fontFamily: "var(--font-dm-sans)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {ev.title}
                          </div>
                          <div
                            style={{
                              fontSize: "0.72rem",
                              color: "rgba(240,237,230,0.35)",
                              fontFamily: "var(--font-dm-sans)",
                              marginTop: "0.15rem",
                            }}
                          >
                            Closes {formatted}
                          </div>
                        </div>
                        <Link
                          href={`/dashboard/events/${ev.slug}`}
                          style={{
                            flexShrink: 0,
                            background: "transparent",
                            border: "0.5px solid rgba(240,237,230,0.15)",
                            borderRadius: 6,
                            padding: "0.28rem 0.65rem",
                            fontSize: "0.72rem",
                            color: "rgba(240,237,230,0.5)",
                            textDecoration: "none",
                            fontFamily: "var(--font-dm-sans)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          View
                        </Link>
                      </div>
                      {ev.capacity != null && ev.capacity > 0 && (
                        <div
                          style={{
                            height: 4,
                            background: "rgba(240,237,230,0.06)",
                            borderRadius: 100,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${pct}%`,
                              background: "#C8F55A",
                              borderRadius: 100,
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Recent activity feed */}
          <section>
            <h2
              style={{
                fontFamily: "var(--font-instrument-serif)",
                fontSize: "1.1rem",
                fontWeight: 400,
                color: "#F0EDE6",
                marginBottom: "1rem",
              }}
            >
              Recent activity
            </h2>

            {loading ? (
              <div
                style={{
                  background: "#141414",
                  border: "0.5px solid rgba(240,237,230,0.08)",
                  borderRadius: 12,
                  padding: "1.25rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {[1, 2, 3, 4].map(i => (
                  <div
                    key={i}
                    style={{
                      height: 38,
                      borderRadius: 8,
                      background: "rgba(240,237,230,0.04)",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  />
                ))}
              </div>
            ) : !stats?.recentActivity?.length ? (
              <div
                style={{
                  background: "#141414",
                  border: "0.5px solid rgba(240,237,230,0.08)",
                  borderRadius: 12,
                  padding: "1.5rem",
                }}
              >
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "rgba(240,237,230,0.35)",
                    fontFamily: "var(--font-dm-sans)",
                    margin: 0,
                  }}
                >
                  No recent activity. Create a new event to get started.
                </p>
              </div>
            ) : (
              <>
                <div
                  style={{
                    background: "#141414",
                    border: "0.5px solid rgba(240,237,230,0.08)",
                    borderRadius: 12,
                    overflow: "hidden",
                  }}
                >
                  {(stats?.recentActivity ?? []).map((item, i, arr) => (
                    <div
                      key={item.id}
                      style={{
                        padding: "0.875rem 1.25rem",
                        borderBottom:
                          i < arr.length - 1
                            ? "0.5px solid rgba(240,237,230,0.06)"
                            : "none",
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.82rem",
                          fontFamily: "var(--font-dm-sans)",
                          lineHeight: 1.5,
                        }}
                      >
                        <span style={{ color: "#F0EDE6", fontWeight: 500 }}>{item.name}</span>
                        <span style={{ color: "rgba(240,237,230,0.4)" }}> registered for </span>
                        <Link
                          href={`/dashboard/${item.eventSlug}`}
                          style={{
                            color: "#C8F55A",
                            textDecoration: "none",
                            fontWeight: 500,
                          }}
                        >
                          {item.eventTitle}
                        </Link>
                      </p>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "rgba(240,237,230,0.3)",
                          fontFamily: "var(--font-dm-sans)",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {formatDistanceToNow(new Date(item.submittedAt), { addSuffix: true })}
                      </span>
                    </div>
                  ))}
                </div>
                <Link
                  href="/dashboard/events"
                  style={{ display: "block", padding: "0.75rem 1.25rem", textAlign: "center", fontSize: "0.78rem", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)", textDecoration: "none", borderTop: "0.5px solid rgba(240,237,230,0.06)" }}
                >
                  View all activity
                </Link>
              </>
            )}
          </section>

          {/* ── Feature Discovery ──────────────────────────────────────────── */}
          <section>
            <h2
              style={{
                fontFamily: "var(--font-instrument-serif)",
                fontSize: "1.1rem",
                color: "#F0EDE6",
                marginBottom: "1rem",
              }}
            >Everything EventSlot can do</h2>
            <div className="feat-grid" style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(2, 1fr)" }}>
              <style>{`@media (min-width: 640px) { .feat-grid { grid-template-columns: repeat(3, 1fr) !important; } }`}</style>
              {FEATURES.map(feat => {
                const ts = tierStyle(feat.tier)
                const accessible = canAccess(feat.tier)
                const isCreditFeature = feat.tier === "credits"
                const needUpgrade = !accessible
                const needCredits = isCreditFeature && creditBalance < (feat.cost ?? 0)
                const locked = needUpgrade || needCredits
                const handleClick = () => {
                  if (needUpgrade) {
                    setFeatureModal({ name: feat.name, icon: feat.icon, tier: feat.tier, description: feat.desc })
                  } else if (needCredits) {
                    setFeatureModal({ name: feat.name, icon: feat.icon, tier: feat.tier, description: feat.desc, credits: feat.cost })
                  }
                }
                return (
                  <div
                    key={feat.name}
                    onClick={locked ? handleClick : undefined}
                    style={{
                      background: "#141414",
                      border: "0.5px solid rgba(240,237,230,0.08)",
                      borderRadius: 10,
                      padding: "1rem 1.1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.4rem",
                      cursor: locked ? "pointer" : "default",
                      opacity: locked ? 0.7 : 1,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1rem", filter: locked ? "grayscale(1) opacity(0.5)" : "none" }}>{feat.icon}</span>
                      <span style={{
                        fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.05em",
                        textTransform: "uppercase", fontFamily: "var(--font-dm-sans)",
                        padding: "0.18rem 0.5rem", borderRadius: 99,
                        background: ts.bg, color: ts.color,
                      }}>{ts.label}{isCreditFeature && feat.cost ? ` · ${feat.cost}` : ""}</span>
                    </div>
                    <span style={{
                      fontSize: "0.78rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)",
                      color: locked ? "rgba(240,237,230,0.4)" : "#F0EDE6",
                    }}>{feat.name}</span>
                    <span style={{
                      fontSize: "0.7rem", fontFamily: "var(--font-dm-sans)",
                      color: "rgba(240,237,230,0.35)", lineHeight: 1.5,
                    }}>{feat.desc}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @media (min-width: 640px) {
          .sm\\:grid-cols-4 { grid-template-columns: repeat(4, 1fr) !important; }
        }
      `}</style>
    </>
  )
}
