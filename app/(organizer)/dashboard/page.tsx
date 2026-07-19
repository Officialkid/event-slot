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
  eventDate: string | null
  deadline: string | null
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

const surfaceStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "0.5px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
}

const softSurfaceStyle: React.CSSProperties = {
  background: "color-mix(in srgb, var(--surface) 94%, transparent)",
  border: "0.5px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
}

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: "var(--font-instrument-serif)",
  fontSize: "1.1rem",
  fontWeight: 400,
  color: "var(--text-primary)",
  marginBottom: "1rem",
}

const itemDivider = "0.5px solid color-mix(in srgb, var(--text-primary) 8%, transparent)"
const subtleDivider = "0.5px solid color-mix(in srgb, var(--text-primary) 6%, transparent)"
const mutedButtonBorder = "0.5px solid color-mix(in srgb, var(--text-primary) 15%, transparent)"
const mutedCardBg = "color-mix(in srgb, var(--surface) 94%, transparent)"
const softFillBg = "color-mix(in srgb, var(--text-primary) 4%, transparent)"

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
        ...surfaceStyle,
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
          color: "var(--text-muted)",
          fontFamily: "var(--font-dm-sans)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "1.8rem",
          fontWeight: 600,
          color: "var(--text-primary)",
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
          background: "color-mix(in srgb, black 56%, transparent)",
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
          background: "color-mix(in srgb, var(--surface) 94%, black 6%)",
          border: "0.5px solid color-mix(in srgb, var(--text-primary) 10%, transparent)",
          borderRadius: 16,
          padding: "1.75rem",
          width: "min(92vw, 420px)",
        }}
      >
        <h3
        style={{
          fontFamily: "var(--font-instrument-serif)",
          fontSize: "1.2rem",
          color: "var(--text-primary)",
          marginBottom: "0.5rem",
        }}
        >
          Increase capacity
        </h3>
        <p
        style={{
          fontSize: "0.82rem",
          color: "var(--text-secondary)",
          fontFamily: "var(--font-dm-sans)",
          marginBottom: "1.25rem",
        }}
      >
          <strong style={{ color: "var(--text-primary)" }}>{event.title}</strong> currently has{" "}
          {event.confirmedCount} of {event.capacity} slots filled.
        </p>

        <label
          style={{
            display: "block",
            fontSize: "0.72rem",
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "var(--text-muted)",
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
            background: "var(--bg-input)",
            border: "0.5px solid color-mix(in srgb, var(--text-primary) 15%, transparent)",
            borderRadius: 8,
            padding: "0.625rem 0.875rem",
            fontSize: "0.875rem",
            color: "var(--text-primary)",
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
              border: "0.5px solid color-mix(in srgb, var(--text-primary) 15%, transparent)",
              borderRadius: 8,
              padding: "0.5rem 1rem",
              fontSize: "0.82rem",
              color: "var(--text-secondary)",
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
  const [isAdmin, setIsAdmin] = useState(false)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [adminStats, setAdminStats] = useState<{
    totalUsers: number
    newUsersThisMonth: number
    recentSignups: Array<{ id: string; name: string | null; email: string | null; plan: string; createdAt: string }>
  } | null>(null)
  const [adminFeedback, setAdminFeedback] = useState<{
    unreadCount: number
    items: Array<{ id: string; subject: string; type: string; createdAt: string; organizer: { name: string | null; email: string | null } }>
  } | null>(null)
  const [adminLoading, setAdminLoading] = useState(false)

  const identityName = profileName || session?.user?.name || null
  const firstName = identityName
    ? identityName.split(" ")[0]
    : session?.user?.email?.split("@")[0] ?? "there"

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then(r => r.json())
      .then(data => setStats(data))
      .finally(() => setLoading(false))
    fetch("/api/me")
      .then(r => r.json())
      .then(d => {
        if (typeof d.isAdmin === "boolean") setIsAdmin(d.isAdmin)
      })
      .catch(() => {})
    fetch("/api/profile")
      .then(r => r.ok ? r.json() : null)
      .then(profile => {
        if (profile && typeof profile.name === "string" && profile.name.trim()) {
          setProfileName(profile.name.trim())
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    setAdminLoading(true)
    Promise.all([
      fetch("/api/admin/stats").then(r => r.json()),
      fetch("/api/admin/feedback?status=unread&limit=3").then(r => r.json()),
    ])
      .then(([s, f]) => {
        setAdminStats({ totalUsers: s.totalUsers, newUsersThisMonth: s.newUsersThisMonth, recentSignups: (s.recentSignups ?? []).slice(0, 5) })
        setAdminFeedback({ unreadCount: f.unreadCount ?? 0, items: (f.items ?? []).slice(0, 3) })
      })
      .catch(() => {})
      .finally(() => setAdminLoading(false))
  }, [isAdmin])

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

  return (
    <>
      {capacityEvent && (
        <CapacityModal
          event={capacityEvent}
          onClose={() => setCapacityEvent(null)}
          onSuccess={handleCapacitySuccess}
        />
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
                fontSize: "1.45rem",
                color: "var(--text-primary)",
                fontWeight: 400,
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              {getGreeting()}, {firstName}
            </h1>
            <p
              style={{
                marginTop: "0.4rem",
                fontSize: "0.9rem",
                fontWeight: 300,
                color: "var(--text-secondary)",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              Here is what is happening with your events.
            </p>
          </div>
          <Link
            href="/create"
            data-tutorial="create-event-btn"
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
          data-tutorial="dashboard-stats"
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
              <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", color: stats.eventsThisMonth > 0 ? "#C8F55A" : "var(--text-muted)" }}>
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
              return <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", color: "var(--text-muted)" }}>Same as last month</span>
            })()}
          />
          <StatCard
            label="Active now"
            value={loading ? "—" : (stats?.activeEvents ?? 0)}
            trend={!loading && stats && (
              stats.eventsClosingThisWeek > 0
                ? <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", color: "#FAC775" }}>⚠ {stats.eventsClosingThisWeek} closing this week</span>
                : <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", color: "var(--text-muted)" }}>No closures this week</span>
            )}
          />
          <StatCard
            label="On waitlist"
            value={loading ? "—" : (stats?.totalWaitlisted ?? 0)}
            trend={!loading && stats && (
              stats.totalWaitlisted === 0
                ? <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", color: "#C8F55A" }}>All caught up</span>
                : <span style={{ fontSize: "0.72rem", fontFamily: "var(--font-dm-sans)", color: "var(--text-muted)" }}>across {stats.waitlistEventCount} event{stats.waitlistEventCount !== 1 ? "s" : ""}</span>
            )}
          />
        </div>

        {/* Sections — single column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

          {/* Needs attention — only rendered when loading or there are near-capacity events */}
          {(loading || (stats?.eventsNearCapacity?.length ?? 0) > 0) && (
          <section>
            <h2 style={sectionHeadingStyle}>
              Needs attention
            </h2>

            {loading ? (
              <div
                style={{
                  ...surfaceStyle,
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
                      background: "color-mix(in srgb, var(--text-primary) 4%, transparent)",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  />
                ))}
              </div>
            ) : !stats?.eventsNearCapacity?.length ? (
              <div
                style={{
                  ...surfaceStyle,
                  borderRadius: 12,
                  padding: "1.5rem",
                }}
              >
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-muted)",
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
                  ...surfaceStyle,
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
                            ? subtleDivider
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
                            color: "var(--text-primary)",
                            fontFamily: "var(--font-dm-sans)",
                          }}
                        >
                          {event.title}
                        </span>
                        <button
                          onClick={() => setCapacityEvent(event)}
                          style={{
                            background: "transparent",
                            border: mutedButtonBorder,
                            borderRadius: 6,
                            padding: "0.3rem 0.75rem",
                            fontSize: "0.72rem",
                            fontWeight: 500,
                            color: "var(--text-secondary)",
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
                          background: softFillBg,
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
                          color: "var(--text-muted)",
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
              style={sectionHeadingStyle}
            >
              Upcoming events
            </h2>

            {loading ? (
              <div
                style={{
                  ...surfaceStyle,
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
                      background: softFillBg,
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  />
                ))}
              </div>
            ) : !stats?.upcomingEvents?.length ? (
              <div
                style={{
                  ...surfaceStyle,
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
                    background: softFillBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "0.25rem",
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.875rem",
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-dm-sans)",
                  }}
                >
                  No upcoming events
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
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
                  ...surfaceStyle,
                  borderRadius: 12,
                  overflow: "hidden",
                }}
              >
                {stats.upcomingEvents.map((ev, i) => {
                  const pct = ev.capacity && ev.capacity > 0
                    ? Math.min(100, Math.round((ev.confirmedCount / ev.capacity) * 100))
                    : 0
                  const primaryDate = new Date(ev.eventDate ?? ev.deadline ?? "")
                  const formatted = Number.isNaN(primaryDate.getTime())
                    ? "Date TBD"
                    : primaryDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
                  return (
                    <div
                      key={ev.slug}
                      style={{
                        padding: "0.875rem 1.25rem",
                        borderBottom:
                          i < stats.upcomingEvents.length - 1
                            ? subtleDivider
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
                              color: "var(--text-primary)",
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
                              color: "var(--text-muted)",
                              fontFamily: "var(--font-dm-sans)",
                              marginTop: "0.15rem",
                            }}
                          >
                            {ev.eventDate ? `Happens ${formatted}` : `Closes ${formatted}`}
                          </div>
                        </div>
                        <Link
                          href={`/dashboard/events/${ev.slug}`}
                          style={{
                            flexShrink: 0,
                            background: "transparent",
                            border: mutedButtonBorder,
                            borderRadius: 6,
                            padding: "0.28rem 0.65rem",
                            fontSize: "0.72rem",
                            color: "var(--text-secondary)",
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
                            background: softFillBg,
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
            <h2 style={sectionHeadingStyle}>
              Recent activity
            </h2>

            {loading ? (
              <div
                style={{
                  ...surfaceStyle,
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
                      background: "color-mix(in srgb, var(--text-primary) 4%, transparent)",
                      animation: "pulse 1.5s ease-in-out infinite",
                    }}
                  />
                ))}
              </div>
            ) : !stats?.recentActivity?.length ? (
              <div
                style={{
                  ...surfaceStyle,
                  borderRadius: 12,
                  padding: "1.5rem",
                }}
              >
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--text-muted)",
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
                    ...surfaceStyle,
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
                            ? subtleDivider
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
                        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{item.name}</span>
                        <span style={{ color: "var(--text-secondary)" }}> registered for </span>
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
                          color: "var(--text-muted)",
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
                  style={{ display: "block", padding: "0.75rem 1.25rem", textAlign: "center", fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", textDecoration: "none", borderTop: subtleDivider }}
                >
                  View all activity
                </Link>
              </>
            )}
          </section>

          {/* ── Admin Snapshot ─────────────────────────────────────────────── */}
          {isAdmin && (
            <section>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", gap: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 22, height: 22, borderRadius: 6,
                    background: "rgba(200,245,90,0.12)", border: "0.5px solid rgba(200,245,90,0.25)",
                    flexShrink: 0,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="#C8F55A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 1.5L2 4v4c0 3.3 2.5 5.5 6 6 3.5-.5 6-2.7 6-6V4L8 1.5z" />
                    </svg>
                  </span>
                  <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.1rem", fontWeight: 400, color: "var(--text-primary)", margin: 0 }}>
                    Admin Overview
                  </h2>
                </div>
                <Link
                  href="/admin"
                  style={{ fontSize: "0.75rem", color: "#C8F55A", textDecoration: "none", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap" }}
                >
                  Open Admin Panel →
                </Link>
              </div>

              {/* Mini stat cards */}
              <div className="admin-stat-grid" style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(3, 1fr)", marginBottom: "1rem" }}>
                <style>{`.admin-stat-grid { grid-template-columns: repeat(3, 1fr) !important; }`}</style>
                <div style={{ background: mutedCardBg, border: "0.5px solid rgba(200,245,90,0.12)", borderRadius: 10, padding: "1rem 1.25rem" }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.4rem" }}>Total Users</div>
                  <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.65rem", color: "var(--text-primary)", lineHeight: 1 }}>
                    {adminLoading ? "—" : (adminStats?.totalUsers ?? 0)}
                  </div>
                </div>
                <div style={{ background: mutedCardBg, border: "0.5px solid rgba(200,245,90,0.12)", borderRadius: 10, padding: "1rem 1.25rem" }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.4rem" }}>New Signups</div>
                  <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.65rem", color: "#C8F55A", lineHeight: 1 }}>
                    {adminLoading ? "—" : (adminStats?.newUsersThisMonth ?? 0)}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", marginTop: "0.2rem" }}>this month</div>
                </div>
                <div style={{ background: mutedCardBg, border: "0.5px solid rgba(200,245,90,0.12)", borderRadius: 10, padding: "1rem 1.25rem" }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.4rem" }}>Unread Feedback</div>
                  <div style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.65rem", color: adminFeedback && adminFeedback.unreadCount > 0 ? "#FAC775" : "var(--text-primary)", lineHeight: 1 }}>
                    {adminLoading ? "—" : (adminFeedback?.unreadCount ?? 0)}
                  </div>
                </div>
              </div>

              {/* Two columns: Recent Signups + Unread Feedback */}
              <div className="admin-two-col" style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr" }}>
                <style>{`@media (min-width: 640px) { .admin-two-col { grid-template-columns: 1fr 1fr !important; } }`}</style>

                {/* Recent signups */}
                <div style={{ ...surfaceStyle, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "0.75rem 1rem 0.5rem", borderBottom: subtleDivider, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>Recent Signups</span>
                    <Link href="/admin/users" style={{ fontSize: "0.7rem", color: "var(--text-muted)", textDecoration: "none", fontFamily: "var(--font-dm-sans)" }}>View all →</Link>
                  </div>
                  {adminLoading ? (
                    <div style={{ padding: "0.75rem 1rem" }}>
                      {[1,2,3].map(i => <div key={i} style={{ height: 28, borderRadius: 6, background: softFillBg, marginBottom: "0.5rem", animation: "pulse 1.5s ease-in-out infinite" }} />)}
                    </div>
                  ) : !adminStats?.recentSignups?.length ? (
                    <div style={{ padding: "1rem", fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>No signups yet.</div>
                  ) : (
                    adminStats.recentSignups.map((u, i, arr) => (
                      <div key={u.id} style={{ padding: "0.625rem 1rem", borderBottom: i < arr.length - 1 ? "0.5px solid var(--border-subtle)" : "none", display: "flex", alignItems: "center", gap: "0.625rem", justifyContent: "space-between" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name ?? u.email ?? "—"}</div>
                          {u.name && <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>}
                        </div>
                        <span style={{
                          fontSize: "0.62rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                          padding: "0.15rem 0.4rem", borderRadius: 99,
                          background: "color-mix(in srgb, var(--text-primary) 7%, transparent)",
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-dm-sans)", flexShrink: 0,
                        }}>{u.plan}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Unread Feedback */}
                <div style={{ ...surfaceStyle, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "0.75rem 1rem 0.5rem", borderBottom: subtleDivider, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>Unread Feedback</span>
                    <Link href="/admin/feedback" style={{ fontSize: "0.7rem", color: "var(--text-muted)", textDecoration: "none", fontFamily: "var(--font-dm-sans)" }}>View all →</Link>
                  </div>
                  {adminLoading ? (
                    <div style={{ padding: "0.75rem 1rem" }}>
                      {[1,2,3].map(i => <div key={i} style={{ height: 42, borderRadius: 6, background: softFillBg, marginBottom: "0.5rem", animation: "pulse 1.5s ease-in-out infinite" }} />)}
                    </div>
                  ) : !adminFeedback?.items?.length ? (
                    <div style={{ padding: "1rem", fontSize: "0.8rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>No unread feedback.</div>
                  ) : (
                    adminFeedback.items.map((fb, i, arr) => (
                      <div key={fb.id} style={{ padding: "0.625rem 1rem", borderBottom: i < arr.length - 1 ? "0.5px solid var(--border-subtle)" : "none" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                          <span style={{
                            fontSize: "0.6rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em",
                            padding: "0.12rem 0.4rem", borderRadius: 99, fontFamily: "var(--font-dm-sans)",
                            background: fb.type === "complaint" ? "rgba(255,107,107,0.12)" : fb.type === "compliment" ? "rgba(74,222,128,0.12)" : fb.type === "suggestion" ? "rgba(96,165,250,0.12)" : "color-mix(in srgb, var(--text-primary) 7%, transparent)",
                            color: fb.type === "complaint" ? "#FF6B6B" : fb.type === "compliment" ? "#4ADE80" : fb.type === "suggestion" ? "#60A5FA" : "var(--text-secondary)",
                          }}>{fb.type}</span>
                          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>{fb.organizer.name ?? fb.organizer.email ?? "—"}</span>
                        </div>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fb.subject}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Quick-access admin links */}
              <div className="admin-links-grid" style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem", gridTemplateColumns: "repeat(4, 1fr)" }}>
                <style>{`@media (max-width: 479px) { .admin-links-grid { grid-template-columns: repeat(2, 1fr) !important; } }`}</style>
                {([
                  { label: "Users", href: "/admin/users", icon: "👥" },
                  { label: "Events", href: "/admin/events", icon: "📅" },
                  { label: "Feedback", href: "/admin/feedback", icon: "💬" },
                  { label: "Broadcast", href: "/admin/broadcast", icon: "📢" },
                ] as const).map(item => (
                  <Link key={item.href} href={item.href} style={{ textDecoration: "none" }}>
                    <div style={{
                      background: "rgba(200,245,90,0.04)", border: "0.5px solid rgba(200,245,90,0.1)",
                      borderRadius: 8, padding: "0.6rem 0.75rem", display: "flex", alignItems: "center",
                      gap: "0.5rem",
                    }}>
                      <span style={{ fontSize: "0.9rem" }}>{item.icon}</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(200,245,90,0.75)", fontFamily: "var(--font-dm-sans)" }}>{item.label}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}
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
