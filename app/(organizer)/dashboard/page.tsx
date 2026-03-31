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
  recentActivity: ActivityItem[]
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number | string }) {
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
        method: "POST",
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

  const firstName = session?.user?.name
    ? session.user.name.split(" ")[0]
    : session?.user?.email?.split("@")[0] ?? "there"

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then(r => r.json())
      .then(data => setStats(data))
      .finally(() => setLoading(false))
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
          <StatCard label="Total events" value={loading ? "—" : (stats?.totalEvents ?? 0)} />
          <StatCard label="Registrations" value={loading ? "—" : (stats?.totalRegistrations ?? 0)} />
          <StatCard label="Active now" value={loading ? "—" : (stats?.activeEvents ?? 0)} />
          <StatCard label="On waitlist" value={loading ? "—" : (stats?.totalWaitlisted ?? 0)} />
        </div>

        {/* Two-col grid on desktop */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "1.5rem",
          }}
          className="lg:grid-cols-[1fr_1fr]"
        >
          {/* Capacity alert section */}
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
            ) : !stats?.eventsNearCapacity.length ? (
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
            ) : !stats?.recentActivity.length ? (
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
                  No registrations yet. Share your event link to get started.
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
                {stats.recentActivity.map((item, i) => (
                  <div
                    key={item.id}
                    style={{
                      padding: "0.875rem 1.25rem",
                      borderBottom:
                        i < stats.recentActivity.length - 1
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
            )}
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
        @media (min-width: 1024px) {
          .lg\\:grid-cols-\\[1fr_1fr\\] { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </>
  )
}
