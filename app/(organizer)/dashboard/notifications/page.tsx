"use client"

import React, { useEffect, useState, useCallback } from "react"
import { formatDistanceToNow } from "date-fns"

interface Notification {
  id: string
  type: string
  message: string
  read: boolean
  createdAt: string
  eventId?: string | null
}

interface FeedbackState {
  rating: number
  message: string
  submitting: boolean
  submitted: boolean
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
            color: star <= (hovered || value) ? "#C8F55A" : "rgba(240,237,230,0.2)",
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
          eventId: notif.eventId,
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
            color: "#F0EDE6",
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
              border: "0.5px solid rgba(240,237,230,0.15)",
              borderRadius: 8,
              padding: "0.45rem 1rem",
              fontSize: "0.8rem",
              color: "rgba(240,237,230,0.55)",
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
          background: "rgba(240,237,230,0.04)",
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
              background: filter === tab ? "rgba(240,237,230,0.08)" : "transparent",
              border: "none",
              borderRadius: 8,
              padding: "0.45rem 0",
              fontSize: "0.82rem",
              fontFamily: "var(--font-dm-sans)",
              color: filter === tab ? "#F0EDE6" : "rgba(240,237,230,0.4)",
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
              border: "2px solid rgba(200,245,90,0.2)",
              borderTopColor: "#C8F55A",
              animation: "notif-spin 0.8s linear infinite",
            }}
          />
        </div>
      ) : displayed.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "4rem 1rem",
            color: "rgba(240,237,230,0.35)",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "0.875rem",
          }}
        >
          {filter === "unread" ? "No unread notifications." : "You are all caught up. No notifications yet."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {displayed.map(notif => {
            const isFeedbackRequest = notif.type === "feedback_request"
            const fb = getFeedbackState(notif.id)
            const isUnread = !notif.read
            const borderColor = isUnread ? "rgba(200,245,90,0.12)" : "rgba(240,237,230,0.06)"
            const bgColor = isUnread ? "rgba(200,245,90,0.04)" : "transparent"
            const dotColor = notif.type === "full" ? "#FF6B6B" : "#C8F55A"

            if (isFeedbackRequest) {
              return (
                <div
                  key={notif.id}
                  style={{
                    ...cardBase,
                    flexDirection: "column",
                    background: bgColor,
                    border: `0.5px solid ${borderColor}`,
                    borderLeft: isUnread ? "2px solid #C8F55A" : undefined,
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
                        background: "#C8F55A",
                        opacity: isUnread ? 1 : 0.35,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)", color: isUnread ? "#F0EDE6" : "rgba(240,237,230,0.5)", lineHeight: 1.5 }}>
                        {notif.message}
                      </p>
                      <span style={{ display: "block", marginTop: "0.3rem", fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>

                  <div style={{ paddingLeft: "1.5rem", width: "100%", boxSizing: "border-box" }}>
                    {fb.submitted ? (
                      <p style={{ margin: "0.5rem 0 0", fontSize: "0.82rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)" }}>
                        Thank you for your feedback.
                      </p>
                    ) : (
                      <div style={{ marginTop: "0.75rem" }}>
                        <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: "rgba(240,237,230,0.4)", fontFamily: "var(--font-dm-sans)" }}>
                          Rate your experience
                        </p>
                        <StarRating value={fb.rating} onChange={v => setFeedbackField(notif.id, { rating: v })} />
                        <textarea
                          rows={3}
                          placeholder="Tell us about your experience"
                          value={fb.message}
                          onChange={e => setFeedbackField(notif.id, { message: e.target.value })}
                          style={{ width: "100%", background: "#0A0A0A", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.625rem 0.875rem", fontSize: "0.85rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6, marginBottom: "0.625rem" }}
                        />
                        <button
                          onClick={() => submitFeedback(notif)}
                          disabled={fb.submitting || fb.rating === 0}
                          style={{ background: fb.rating === 0 ? "rgba(200,245,90,0.25)" : "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1.25rem", fontSize: "0.82rem", fontWeight: 600, fontFamily: "var(--font-dm-sans)", color: fb.rating === 0 ? "rgba(8,8,8,0.4)" : "#080808", cursor: fb.submitting || fb.rating === 0 ? "default" : "pointer", opacity: fb.submitting ? 0.6 : 1, transition: "background 0.15s, opacity 0.15s" }}
                        >
                          {fb.submitting ? "Sending…" : "Send feedback"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            }

            if (notif.type === "data_expiry_warning") {
              return (
                <div
                  key={notif.id}
                  onClick={() => !notif.read && markOneRead(notif.id)}
                  style={{
                    ...cardBase,
                    background: isUnread ? "rgba(255,107,107,0.04)" : "transparent",
                    border: `0.5px solid ${isUnread ? "rgba(255,107,107,0.15)" : "rgba(240,237,230,0.06)"}`,
                    borderLeft: "2px solid #FF6B6B",
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
                      background: "#FF6B6B",
                      opacity: isUnread ? 1 : 0.35,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.875rem",
                        fontFamily: "var(--font-dm-sans)",
                        color: isUnread ? "#F0EDE6" : "rgba(240,237,230,0.5)",
                        lineHeight: 1.5,
                      }}
                    >
                      {notif.message}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.375rem", flexWrap: "wrap" }}>
                      <a
                        href="/pricing"
                        onClick={e => e.stopPropagation()}
                        style={{
                          fontSize: "0.8rem",
                          fontFamily: "var(--font-dm-sans)",
                          fontWeight: 600,
                          color: "#C8F55A",
                          textDecoration: "none",
                        }}
                      >
                        Upgrade to Pro →
                      </a>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "rgba(240,237,230,0.3)",
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
              <button
                key={notif.id}
                onClick={() => !notif.read && markOneRead(notif.id)}
                style={{
                  ...cardBase,
                  background: bgColor,
                  border: `0.5px solid ${borderColor}`,
                  borderLeft: isUnread ? "2px solid #C8F55A" : undefined,
                  cursor: isUnread ? "pointer" : "default",
                  transition: "background 0.15s",
                }}
              >
                <span style={{ flexShrink: 0, marginTop: 4, width: 8, height: 8, borderRadius: "50%", background: dotColor, opacity: isUnread ? 1 : 0.35 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "0.875rem", fontFamily: "var(--font-dm-sans)", color: isUnread ? "#F0EDE6" : "rgba(240,237,230,0.5)", lineHeight: 1.5 }}>
                    {notif.message}
                  </p>
                  <span style={{ display: "block", marginTop: "0.3rem", fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", fontFamily: "var(--font-dm-sans)" }}>
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
