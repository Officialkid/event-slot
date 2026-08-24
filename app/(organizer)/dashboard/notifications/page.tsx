"use client"

import React, { useEffect, useState, useCallback } from "react"
import { formatDistanceToNow } from "date-fns"
import { markFeatureUsed } from "@/lib/markFeatureUsed"
import Link from "next/link"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  read: boolean
  createdAt: string
  link?: string | null
}

interface FeedbackState {
  rating: number
  message: string
  submitting: boolean
  submitted: boolean
}

const panelSurfaceStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "0.5px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
}

function StarRating({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const [hovered, setHovered] = useState(0)
  return (
    <div style={{ display: "flex", gap: "0.25rem", marginBottom: "0.75rem" }}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "0 2px",
            fontSize: "1.4rem",
            lineHeight: 1,
            color: star <= (hovered || value) ? "var(--accent)" : "color-mix(in srgb, var(--text-primary) 20%, transparent)",
            transition: "color 0.1s",
          }}
          aria-label={`${star} star`}
        >
          ★
        </button>
      ))}
    </div>
  )
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [feedbackStates, setFeedbackStates] = useState<Record<string, FeedbackState>>({})

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      const data = await res.json()
      if (data.notifications) setNotifications(data.notifications)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    markFeatureUsed("notifications")
    fetchNotifications()
  }, [fetchNotifications])

  const markAllRead = async () => {
    setMarkingAll(true)
    try {
      await fetch("/api/notifications/read", { method: "PATCH" })
      setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    } catch {
      // ignore
    } finally {
      setMarkingAll(false)
    }
  }

  const markOneRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" })
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      )
    } catch {
      // ignore
    }
  }

  const getFeedbackState = (id: string): FeedbackState =>
    feedbackStates[id] ?? { rating: 0, message: "", submitting: false, submitted: false }

  const setFeedbackField = (id: string, patch: Partial<FeedbackState>) =>
    setFeedbackStates(prev => ({ ...prev, [id]: { ...getFeedbackState(id), ...patch } }))

  const submitFeedback = async (notif: Notification) => {
    const state = getFeedbackState(notif.id)
    if (state.rating === 0) return
    setFeedbackField(notif.id, { submitting: true })
    try {
      const res = await fetch("/api/feedback/organizer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationId: notif.id,
          rating: state.rating,
          message: state.message,
        }),
      })
      if (res.ok) {
        setFeedbackField(notif.id, { submitted: true, submitting: false })
        setNotifications(prev =>
          prev.map(n => (n.id === notif.id ? { ...n, read: true } : n))
        )
      } else {
        setFeedbackField(notif.id, { submitting: false })
      }
    } catch {
      setFeedbackField(notif.id, { submitting: false })
    }
  }

  const unreadCount = notifications.filter(n => !n.read).length
  const displayed =
    filter === "unread" ? notifications.filter(n => !n.read) : notifications

  const cardBase: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.875rem",
    padding: "0.875rem 1rem",
    borderRadius: 10,
    textAlign: "left",
    width: "100%",
  }

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.25rem",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.6rem",
            color: "var(--text-primary)",
            fontWeight: 400,
            margin: 0,
          }}
        >
          Notifications
        </h1>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            style={{
              background: "transparent",
              border: "0.5px solid color-mix(in srgb, var(--text-primary) 15%, transparent)",
              borderRadius: 8,
              padding: "0.45rem 1rem",
              fontSize: "0.8rem",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-dm-sans)",
              cursor: markingAll ? "default" : "pointer",
              opacity: markingAll ? 0.5 : 1,
            }}
          >
            {markingAll ? "Marking…" : "Mark all as read"}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          marginBottom: "1.25rem",
          background: "color-mix(in srgb, var(--text-primary) 4%, transparent)",
          borderRadius: 10,
          padding: "0.25rem",
        }}
      >
        {(["all", "unread"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            style={{
              flex: 1,
              background: filter === tab ? "color-mix(in srgb, var(--text-primary) 8%, transparent)" : "transparent",
              border: "none",
              borderRadius: 8,
              padding: "0.45rem 0",
              fontSize: "0.82rem",
              fontFamily: "var(--font-dm-sans)",
              color: filter === tab ? "var(--text-primary)" : "var(--text-secondary)",
              cursor: "pointer",
              fontWeight: filter === tab ? 500 : 400,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {tab === "all" ? `All (${notifications.length})` : `Unread (${unreadCount})`}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "3rem 0" }}>
          <style>{`@keyframes notif-spin { to { transform: rotate(360deg); } }`}</style>
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              border: "2px solid color-mix(in srgb, var(--accent) 20%, transparent)",
              borderTopColor: "var(--accent)",
              animation: "notif-spin 0.8s linear infinite",
            }}
          />
        </div>
      ) : displayed.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "4rem 1rem",
            color: "var(--text-muted)",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "0.875rem",
          }}
        >
          {filter === "unread" ? (
            "No unread notifications."
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ fontSize: "2.2rem" }}>N</div>
              <p style={{ margin: 0, fontSize: "1rem", color: "var(--text-primary)" }}>No notifications yet</p>
              <p style={{ margin: 0, maxWidth: 360, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                As your events receive registrations and waitlist updates, you will see actionable alerts here.
              </p>
              <Link
                href="/dashboard/events/new"
                style={{
                  display: "inline-block",
                  marginTop: "0.35rem",
                  background: "var(--accent)",
                  color: "var(--accent-contrast, #080808)",
                  borderRadius: 10,
                  padding: "0.55rem 1rem",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Create Your First Event
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {displayed.map(notif => {
            const isFeedbackRequest = notif.title === "Feedback Request"
            const fb = getFeedbackState(notif.id)
            const isUnread = !notif.read
            const borderColor = isUnread ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "color-mix(in srgb, var(--text-primary) 6%, transparent)"
            const bgColor = isUnread ? "color-mix(in srgb, var(--accent) 4%, transparent)" : "var(--surface)"
            const dotColor = notif.type === "PLATFORM" ? "var(--accent)" : notif.title === "Event Full" ? "var(--error)" : "var(--accent)"

            if (isFeedbackRequest) {
              return (
                <div
                  key={notif.id}
                  style={{
                    ...cardBase,
                    flexDirection: "column",
                    background: bgColor,
                    border: `0.5px solid ${borderColor}`,
                    borderLeft: isUnread ? "2px solid var(--accent)" : undefined,
                  }}
                >
                  <div style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start", width: "100%" }}>
                    <span
                      style={{
                        flexShrink: 0,
                        marginTop: 4,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--accent)",
                        opacity: isUnread ? 1 : 0.35,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)", color: isUnread ? "var(--text-primary)" : "var(--text-secondary)", lineHeight: 1.5 }}>
                        {notif.message}
                      </p>
                      {notif.link && (
                        <a
                          href={notif.link}
                          style={{
                            display: "inline-block",
                            marginTop: "0.4rem",
                            fontSize: "0.78rem",
                            fontFamily: "var(--font-dm-sans)",
                            fontWeight: 500,
                            color: "var(--accent)",
                            textDecoration: "none",
                          }}
                        >
                          Open event →
                        </a>
                      )}
                      <span style={{ display: "block", marginTop: "0.3rem", fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <div style={{ paddingLeft: "1.5rem", width: "100%", boxSizing: "border-box" }}>
                    {fb.submitted ? (
                      <p style={{ margin: "0.5rem 0 0", fontSize: "0.82rem", color: "var(--accent)", fontFamily: "var(--font-dm-sans)" }}>
                        Thank you for your feedback.
                      </p>
                    ) : (
                      <div style={{ marginTop: "0.75rem" }}>
                        <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)" }}>
                          Rate your experience
                        </p>
                        <StarRating value={fb.rating} onChange={v => setFeedbackField(notif.id, { rating: v })} />
                        <textarea
                          rows={3}
                          placeholder="Tell us about your experience"
                          value={fb.message}
                          onChange={e => setFeedbackField(notif.id, { message: e.target.value })}
                          style={{ width: "100%", background: "var(--bg-input)", border: "0.5px solid color-mix(in srgb, var(--text-primary) 12%, transparent)", borderRadius: 8, padding: "0.625rem 0.875rem", fontSize: "0.85rem", color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6, marginBottom: "0.625rem" }}
                        />
                        <button
                          onClick={() => submitFeedback(notif)}
                          disabled={fb.submitting || fb.rating === 0}
                          style={{ background: fb.rating === 0 ? "color-mix(in srgb, var(--accent) 25%, transparent)" : "var(--accent)", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", color: fb.rating === 0 ? "color-mix(in srgb, var(--accent-contrast, #080808) 40%, transparent)" : "var(--accent-contrast, #080808)", cursor: fb.submitting || fb.rating === 0 ? "default" : "pointer", opacity: fb.submitting ? 0.6 : 1, transition: "background 0.15s, opacity 0.15s" }}
                        >
                          {fb.submitting ? "Sending…" : "Send feedback"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            if (notif.title === "Waitlist Growing") {
              return (
                <div
                  key={notif.id}
                  onClick={() => !notif.read && markOneRead(notif.id)}
                  style={{
                    ...cardBase,
                    background: isUnread ? "color-mix(in srgb, var(--warning) 4%, transparent)" : "transparent",
                    border: `0.5px solid ${isUnread ? "color-mix(in srgb, var(--warning) 15%, transparent)" : "var(--border-subtle)"}`,
                    borderLeft: "2px solid var(--warning)",
                    cursor: isUnread ? "pointer" : "default",
                    transition: "background 0.15s",
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      marginTop: 4,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--warning)",
                      opacity: isUnread ? 1 : 0.35,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.875rem",
                        fontFamily: "var(--font-dm-sans)",
                        color: isUnread ? "var(--text-primary)" : "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {notif.message}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.375rem", flexWrap: "wrap" }}>
                      {notif.link && (
                        <a
                          href={notif.link}
                          onClick={e => e.stopPropagation()}
                          style={{
                            fontSize: "0.78rem",
                            fontFamily: "var(--font-dm-sans)",
                            fontWeight: 500,
                            color: "var(--warning)",
                            textDecoration: "none",
                            background: "color-mix(in srgb, var(--warning) 10%, transparent)",
                            border: "0.5px solid color-mix(in srgb, var(--warning) 25%, transparent)",
                            borderRadius: 6,
                            padding: "0.25rem 0.625rem",
                          }}
                        >
                          Increase capacity →
                        </a>
                      )}
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-dm-sans)",
                        }}
                      >
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            }

            if (notif.title === "Data Expiry Warning") {
              return (
                <div
                  key={notif.id}
                  onClick={() => !notif.read && markOneRead(notif.id)}
                  style={{
                    ...cardBase,
                    background: isUnread ? "color-mix(in srgb, var(--error) 4%, transparent)" : "transparent",
                    border: `0.5px solid ${isUnread ? "color-mix(in srgb, var(--error) 15%, transparent)" : "var(--border-subtle)"}`,
                    borderLeft: "2px solid var(--error)",
                    cursor: isUnread ? "pointer" : "default",
                    transition: "background 0.15s",
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      marginTop: 4,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "var(--error)",
                      opacity: isUnread ? 1 : 0.35,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.875rem",
                        fontFamily: "var(--font-dm-sans)",
                        color: isUnread ? "var(--text-primary)" : "var(--text-secondary)",
                        lineHeight: 1.5,
                      }}
                    >
                      {notif.message}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.375rem", flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                          fontFamily: "var(--font-dm-sans)",
                        }}
                      >
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={notif.id}
                onClick={() => !notif.read && markOneRead(notif.id)}
                style={{
                  ...cardBase,
                  background: bgColor,
                  border: `0.5px solid ${borderColor}`,
                  borderLeft: isUnread ? "2px solid var(--accent)" : undefined,
                  cursor: isUnread ? "pointer" : "default",
                  transition: "background 0.15s",
                }}
              >
                <span style={{ flexShrink: 0, marginTop: 4, width: 8, height: 8, borderRadius: "50%", background: dotColor, opacity: isUnread ? 1 : 0.35 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {notif.type === "PLATFORM" && (
                    <span
                      style={{
                        display: "inline-block",
                        marginBottom: "0.35rem",
                        fontSize: "0.68rem",
                        fontFamily: "var(--font-dm-sans)",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        background: "color-mix(in srgb, var(--accent) 20%, transparent)",
                        color: "var(--accent)",
                        borderRadius: 999,
                        padding: "0.15rem 0.5rem",
                      }}
                    >
                      Platform Update
                    </span>
                  )}
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.8rem", fontFamily: "var(--font-dm-sans)", color: "var(--text-primary)", fontWeight: 600, lineHeight: 1.4 }}>
                    {notif.title}
                  </p>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)", color: isUnread ? "var(--text-primary)" : "var(--text-secondary)", lineHeight: 1.5 }}>
                    {notif.message}
                  </p>
                  {notif.link && (
                    <a
                      href={notif.link}
                      onClick={e => e.stopPropagation()}
                      style={{
                        display: "inline-block",
                        marginTop: "0.4rem",
                        fontSize: "0.78rem",
                        fontFamily: "var(--font-dm-sans)",
                        fontWeight: 500,
                        color: "var(--accent)",
                        textDecoration: "none",
                      }}
                    >
                      Open →
                    </a>
                  )}
                  <span style={{ display: "block", marginTop: "0.3rem", fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-dm-sans)" }}>
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
