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

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)
  const [filter, setFilter] = useState<"all" | "unread">("all")

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

  const unreadCount = notifications.filter(n => !n.read).length
  const displayed = filter === "unread" ? notifications.filter(n => !n.read) : notifications

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
      <div style={{ display: "flex", gap: "0.25rem", marginBottom: "1.25rem", background: "rgba(240,237,230,0.04)", borderRadius: 10, padding: "0.25rem" }}>
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
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "3rem 0",
          }}
        >
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
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {displayed.map(notif => (
            <button
              key={notif.id}
              onClick={() => !notif.read && markOneRead(notif.id)}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.875rem",
                padding: "0.875rem 1rem",
                borderRadius: 10,
                background: notif.read
                  ? "transparent"
                  : "rgba(200,245,90,0.04)",
                borderLeft: notif.read
                  ? "2px solid transparent"
                  : "2px solid #C8F55A",
                border: notif.read
                  ? "0.5px solid rgba(240,237,230,0.06)"
                  : "0.5px solid rgba(200,245,90,0.12)",
                borderLeftWidth: notif.read ? undefined : 2,
                cursor: notif.read ? "default" : "pointer",
                textAlign: "left",
                width: "100%",
                transition: "background 0.15s",
              }}
            >
              {/* Colored dot */}
              <span
                style={{
                  flexShrink: 0,
                  marginTop: 4,
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: notif.type === "full" ? "#FF6B6B" : "#C8F55A",
                  opacity: notif.read ? 0.35 : 1,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.875rem",
                    fontFamily: "var(--font-dm-sans)",
                    color: notif.read
                      ? "rgba(240,237,230,0.5)"
                      : "#F0EDE6",
                    lineHeight: 1.5,
                  }}
                >
                  {notif.message}
                </p>
                <span
                  style={{
                    display: "block",
                    marginTop: "0.3rem",
                    fontSize: "0.72rem",
                    color: "rgba(240,237,230,0.3)",
                    fontFamily: "var(--font-dm-sans)",
                  }}
                >
                  {formatDistanceToNow(new Date(notif.createdAt), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
