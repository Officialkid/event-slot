"use client"

import React, { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  type EventDraft,
  getEventDrafts,
  deleteEventDraft,
  clearAllEventDrafts,
  formatDraftTimeAgo,
  getDraftStepLabel,
} from "@/lib/eventDrafts"

interface HistoryEvent {
  id: string
  title: string
  slug: string
  capacity: number | null
  deadline: string | null
  confirmedCount: number
  waitlistCount: number
  dashboardToken: string
  createdAt: string
  archived: boolean
  status: string
  eventDate: string | null
  eventEndAt?: string | null
  isRecurring?: boolean
  location: string | null
  eventType?: "PHYSICAL" | "VIRTUAL"
  dataExpired: boolean
  eventPassTier?: string | null
  eventPassStatus?: string | null
  eventPassExpiresAt?: string | null
}

type TabType = "all" | "drafts" | "past" | "archived"

function isPastEvent(event: HistoryEvent): boolean {
  if (event.archived || event.status === "archived") return false
  if (event.status === "closed" || event.status === "expired" || event.dataExpired) return true
  const now = new Date()
  if (!event.isRecurring) {
    if (event.eventEndAt && new Date(event.eventEndAt) < now) return true
    if (event.eventDate && new Date(event.eventDate) < now) return true
    if (event.deadline && new Date(event.deadline) < now) return true
  }
  return false
}

function isArchivedEvent(event: HistoryEvent): boolean {
  return event.archived || event.status === "archived"
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return iso
  }
}

export default function HistoryPage() {
  const router = useRouter()
  const [drafts, setDrafts] = useState<EventDraft[]>([])
  const [events, setEvents] = useState<HistoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>("all")
  const [search, setSearch] = useState("")

  const loadData = () => {
    setDrafts(getEventDrafts())
    fetch("/api/my-events")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.events)) {
          setEvents(data.events)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [])

  const pastEvents = useMemo(() => events.filter(isPastEvent), [events])
  const archivedEvents = useMemo(() => events.filter(isArchivedEvent), [events])

  const handleDeleteDraft = (id: string) => {
    deleteEventDraft(id)
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  const handleClearAllDrafts = () => {
    if (window.confirm("Are you sure you want to discard all in-progress drafts?")) {
      clearAllEventDrafts()
      setDrafts([])
    }
  }

  // Filtered views based on search & tab
  const searchLower = search.trim().toLowerCase()

  const filteredDrafts = useMemo(() => {
    if (!searchLower) return drafts
    return drafts.filter((d) =>
      (d.title || "").toLowerCase().includes(searchLower) ||
      (d.location || "").toLowerCase().includes(searchLower) ||
      (d.description || "").toLowerCase().includes(searchLower)
    )
  }, [drafts, searchLower])

  const filteredPast = useMemo(() => {
    if (!searchLower) return pastEvents
    return pastEvents.filter((e) =>
      (e.title || "").toLowerCase().includes(searchLower) ||
      (e.location || "").toLowerCase().includes(searchLower)
    )
  }, [pastEvents, searchLower])

  const filteredArchived = useMemo(() => {
    if (!searchLower) return archivedEvents
    return archivedEvents.filter((e) =>
      (e.title || "").toLowerCase().includes(searchLower) ||
      (e.location || "").toLowerCase().includes(searchLower)
    )
  }, [archivedEvents, searchLower])

  const totalCount = drafts.length + pastEvents.length + archivedEvents.length

  return (
    <div style={{ maxWidth: 840, margin: "0 auto", paddingBottom: "3rem" }}>
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          marginBottom: "1.75rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent)" }}>
              Organizer History
            </span>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "1.65rem",
              fontWeight: 400,
              color: "var(--text-primary)",
              margin: 0,
              lineHeight: 1.15,
            }}
          >
            History &amp; Saved Drafts
          </h1>
          <p
            style={{
              margin: "0.35rem 0 0",
              fontSize: "0.85rem",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            Access your uncompleted event drafts, completed past sessions, and archived events.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          {drafts.length > 1 && (
            <button
              onClick={handleClearAllDrafts}
              style={{
                background: "transparent",
                border: "0.5px solid var(--border)",
                color: "var(--text-muted)",
                borderRadius: 8,
                padding: "0.55rem 0.9rem",
                fontSize: "0.8rem",
                fontFamily: "var(--font-dm-sans)",
                cursor: "pointer",
              }}
            >
              Clear All Drafts
            </button>
          )}
          <Link
            href="/create"
            style={{
              background: "var(--accent)",
              color: "var(--accent-contrast)",
              borderRadius: 8,
              padding: "0.55rem 1.15rem",
              fontSize: "0.82rem",
              fontWeight: 600,
              fontFamily: "var(--font-dm-sans)",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              whiteSpace: "nowrap",
            }}
          >
            + Create New Event
          </Link>
        </div>
      </div>

      {/* Search & Tabs Toolbar */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drafts or past events by title or venue..."
            style={{
              width: "100%",
              background: "var(--bg-input)",
              border: "0.5px solid var(--border-subtle)",
              borderRadius: 10,
              padding: "0.65rem 1rem",
              fontSize: "0.85rem",
              color: "var(--text-primary)",
              fontFamily: "var(--font-dm-sans)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "0.8rem",
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Tab filters */}
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            borderBottom: "0.5px solid var(--border-subtle)",
            overflowX: "auto",
          }}
        >
          <button
            onClick={() => setActiveTab("all")}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "all" ? "2px solid var(--accent)" : "2px solid transparent",
              padding: "0.6rem 1rem",
              fontSize: "0.85rem",
              fontFamily: "var(--font-dm-sans)",
              color: activeTab === "all" ? "var(--text-primary)" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              marginBottom: "-0.5px",
            }}
          >
            All History
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 600,
                background: activeTab === "all" ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "color-mix(in srgb, var(--text-primary) 6%, transparent)",
                color: activeTab === "all" ? "var(--accent)" : "var(--text-muted)",
                borderRadius: 100,
                padding: "1px 6px",
              }}
            >
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("drafts")}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "drafts" ? "2px solid var(--accent)" : "2px solid transparent",
              padding: "0.6rem 1rem",
              fontSize: "0.85rem",
              fontFamily: "var(--font-dm-sans)",
              color: activeTab === "drafts" ? "var(--text-primary)" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              marginBottom: "-0.5px",
            }}
          >
            Drafts
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 600,
                background: activeTab === "drafts" ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "color-mix(in srgb, var(--text-primary) 6%, transparent)",
                color: activeTab === "drafts" ? "var(--accent)" : "var(--text-muted)",
                borderRadius: 100,
                padding: "1px 6px",
              }}
            >
              {drafts.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("past")}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "past" ? "2px solid var(--accent)" : "2px solid transparent",
              padding: "0.6rem 1rem",
              fontSize: "0.85rem",
              fontFamily: "var(--font-dm-sans)",
              color: activeTab === "past" ? "var(--text-primary)" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              marginBottom: "-0.5px",
            }}
          >
            Past Events
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 600,
                background: activeTab === "past" ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "color-mix(in srgb, var(--text-primary) 6%, transparent)",
                color: activeTab === "past" ? "var(--accent)" : "var(--text-muted)",
                borderRadius: 100,
                padding: "1px 6px",
              }}
            >
              {pastEvents.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("archived")}
            style={{
              background: "transparent",
              border: "none",
              borderBottom: activeTab === "archived" ? "2px solid var(--accent)" : "2px solid transparent",
              padding: "0.6rem 1rem",
              fontSize: "0.85rem",
              fontFamily: "var(--font-dm-sans)",
              color: activeTab === "archived" ? "var(--text-primary)" : "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              marginBottom: "-0.5px",
            }}
          >
            Archived
            <span
              style={{
                fontSize: "0.65rem",
                fontWeight: 600,
                background: activeTab === "archived" ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "color-mix(in srgb, var(--text-primary) 6%, transparent)",
                color: activeTab === "archived" ? "var(--accent)" : "var(--text-muted)",
                borderRadius: 100,
                padding: "1px 6px",
              }}
            >
              {archivedEvents.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 110,
                borderRadius: 12,
                background: "var(--surface)",
                border: "0.5px solid var(--border-subtle)",
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
          {/* Drafts Section */}
          {(activeTab === "all" || activeTab === "drafts") && (
            <div>
              {activeTab === "all" && drafts.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                  <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    In-Progress Drafts ({filteredDrafts.length})
                  </h2>
                </div>
              )}

              {filteredDrafts.length === 0 && activeTab === "drafts" ? (
                <div
                  style={{
                    background: "var(--surface)",
                    border: "0.5px solid var(--border-subtle)",
                    borderRadius: 12,
                    padding: "3rem 1.5rem",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📝</div>
                  <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.25rem", margin: "0 0 0.4rem", color: "var(--text-primary)" }}>
                    No drafts saved
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 auto 1.25rem", maxWidth: 380 }}>
                    When you start creating an event and leave before publishing, it will automatically show here so you can continue seamlessly.
                  </p>
                  <Link
                    href="/create"
                    style={{
                      background: "var(--accent)",
                      color: "var(--accent-contrast)",
                      borderRadius: 8,
                      padding: "0.55rem 1.15rem",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Start an Event
                  </Link>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {filteredDrafts.map((draft) => (
                    <div
                      key={draft.id}
                      style={{
                        background: "var(--surface)",
                        border: "0.5px solid var(--border-subtle)",
                        borderRadius: 12,
                        padding: "1.25rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "1rem",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem", flexWrap: "wrap" }}>
                          <h3
                            style={{
                              fontFamily: "var(--font-instrument-serif)",
                              fontSize: "1.2rem",
                              fontWeight: 400,
                              color: "var(--text-primary)",
                              margin: 0,
                            }}
                          >
                            {draft.title || "Untitled Event Draft"}
                          </h3>
                          <span
                            style={{
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              background: "color-mix(in srgb, var(--accent) 15%, transparent)",
                              color: "var(--accent)",
                              borderRadius: 100,
                              padding: "2px 8px",
                              fontFamily: "var(--font-dm-sans)",
                            }}
                          >
                            {getDraftStepLabel(draft.currentStep)}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)" }}>
                          Last touched {formatDraftTimeAgo(draft.updatedAt)}
                          {draft.eventDate && ` · Scheduled for ${formatDate(draft.eventDate)}`}
                          {draft.location && ` · 📍 ${draft.location}`}
                          {draft.eventType === "VIRTUAL" && " · 💻 Virtual"}
                        </p>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <button
                          onClick={() => handleDeleteDraft(draft.id)}
                          style={{
                            background: "transparent",
                            border: "0.5px solid var(--border)",
                            borderRadius: 8,
                            padding: "0.45rem 0.85rem",
                            fontSize: "0.78rem",
                            color: "var(--error)",
                            cursor: "pointer",
                            fontFamily: "var(--font-dm-sans)",
                          }}
                        >
                          Discard
                        </button>
                        <Link
                          href={`/create?draftId=${draft.id}`}
                          style={{
                            background: "var(--accent)",
                            color: "var(--accent-contrast)",
                            borderRadius: 8,
                            padding: "0.45rem 1.1rem",
                            fontSize: "0.78rem",
                            fontWeight: 600,
                            fontFamily: "var(--font-dm-sans)",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                          }}
                        >
                          Resume Event →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Past Events Section */}
          {(activeTab === "all" || activeTab === "past") && (
            <div>
              {activeTab === "all" && pastEvents.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", marginTop: drafts.length > 0 ? "1rem" : 0 }}>
                  <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Past Events ({filteredPast.length})
                  </h2>
                </div>
              )}

              {filteredPast.length === 0 && activeTab === "past" ? (
                <div
                  style={{
                    background: "var(--surface)",
                    border: "0.5px solid var(--border-subtle)",
                    borderRadius: 12,
                    padding: "3rem 1.5rem",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📅</div>
                  <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.25rem", margin: "0 0 0.4rem", color: "var(--text-primary)" }}>
                    No past events yet
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 auto", maxWidth: 380 }}>
                    When events conclude or are manually closed, they are archived here along with historical attendance data.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {filteredPast.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => router.push(`/dashboard/events/${event.slug}?token=${event.dashboardToken}`)}
                      style={{
                        background: "var(--surface)",
                        border: "0.5px solid var(--border-subtle)",
                        borderRadius: 12,
                        padding: "1.25rem",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "1rem",
                        transition: "border-color 0.15s ease",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem", flexWrap: "wrap" }}>
                          <h3
                            style={{
                              fontFamily: "var(--font-instrument-serif)",
                              fontSize: "1.2rem",
                              fontWeight: 400,
                              color: "var(--text-primary)",
                              margin: 0,
                            }}
                          >
                            {event.title}
                          </h3>
                          <span
                            style={{
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              background: "color-mix(in srgb, var(--error) 12%, transparent)",
                              color: "var(--error)",
                              borderRadius: 100,
                              padding: "2px 8px",
                              fontFamily: "var(--font-dm-sans)",
                            }}
                          >
                            {event.status === "closed" ? "CLOSED" : "CONCLUDED"}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)" }}>
                          {event.confirmedCount} attended / confirmed · {event.waitlistCount} waitlisted
                          {event.eventDate && ` · Date: ${formatDate(event.eventDate)}`}
                          {event.location && ` · 📍 ${event.location}`}
                          {event.eventType === "VIRTUAL" && " · 💻 Virtual"}
                        </p>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }} onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/dashboard/events/${event.slug}?token=${event.dashboardToken}`}
                          style={{
                            background: "transparent",
                            border: "0.5px solid var(--border)",
                            borderRadius: 8,
                            padding: "0.45rem 0.85rem",
                            fontSize: "0.78rem",
                            color: "var(--text-primary)",
                            fontFamily: "var(--font-dm-sans)",
                            textDecoration: "none",
                          }}
                        >
                          View Report →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Archived Events Section */}
          {(activeTab === "all" || activeTab === "archived") && (
            <div>
              {activeTab === "all" && archivedEvents.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", marginTop: "1rem" }}>
                  <h2 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Archived Events ({filteredArchived.length})
                  </h2>
                </div>
              )}

              {filteredArchived.length === 0 && activeTab === "archived" ? (
                <div
                  style={{
                    background: "var(--surface)",
                    border: "0.5px solid var(--border-subtle)",
                    borderRadius: 12,
                    padding: "3rem 1.5rem",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🗄️</div>
                  <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.25rem", margin: "0 0 0.4rem", color: "var(--text-primary)" }}>
                    No archived events
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 auto", maxWidth: 380 }}>
                    Events that you explicitly archive will be preserved here out of your active feeds.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {filteredArchived.map((event) => (
                    <div
                      key={event.id}
                      onClick={() => router.push(`/dashboard/events/${event.slug}?token=${event.dashboardToken}`)}
                      style={{
                        background: "var(--surface)",
                        border: "0.5px solid var(--border-subtle)",
                        borderRadius: 12,
                        padding: "1.25rem",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "1rem",
                        opacity: 0.85,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.35rem", flexWrap: "wrap" }}>
                          <h3
                            style={{
                              fontFamily: "var(--font-instrument-serif)",
                              fontSize: "1.2rem",
                              fontWeight: 400,
                              color: "var(--text-primary)",
                              margin: 0,
                            }}
                          >
                            {event.title}
                          </h3>
                          <span
                            style={{
                              fontSize: "0.65rem",
                              fontWeight: 700,
                              background: "color-mix(in srgb, var(--text-primary) 8%, transparent)",
                              color: "var(--text-muted)",
                              borderRadius: 100,
                              padding: "2px 8px",
                              fontFamily: "var(--font-dm-sans)",
                            }}
                          >
                            ARCHIVED
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)" }}>
                          {event.confirmedCount} attendees · Created {formatDate(event.createdAt)}
                          {event.location && ` · 📍 ${event.location}`}
                        </p>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }} onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/dashboard/events/${event.slug}?token=${event.dashboardToken}`}
                          style={{
                            background: "transparent",
                            border: "0.5px solid var(--border)",
                            borderRadius: 8,
                            padding: "0.45rem 0.85rem",
                            fontSize: "0.78rem",
                            color: "var(--text-primary)",
                            fontFamily: "var(--font-dm-sans)",
                            textDecoration: "none",
                          }}
                        >
                          View Details →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state for All tab when completely empty */}
          {activeTab === "all" && totalCount === 0 && (
            <div
              style={{
                background: "var(--surface)",
                border: "0.5px solid var(--border-subtle)",
                borderRadius: 12,
                padding: "3.5rem 1.5rem",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>📜</div>
              <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.35rem", margin: "0 0 0.5rem", color: "var(--text-primary)" }}>
                No history recorded yet
              </h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 auto 1.5rem", maxWidth: 400 }}>
                As you create drafts and host events, all your past milestones and in-progress work will be preserved here.
              </p>
              <Link
                href="/create"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-contrast)",
                  borderRadius: 8,
                  padding: "0.6rem 1.25rem",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Create Your First Event
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
