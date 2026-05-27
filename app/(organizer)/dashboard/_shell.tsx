"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { TutorialOverlay } from "@/components/tutorial/TutorialOverlay"
import { HintDot } from "@/components/tutorial/HintDot"
import OnboardingTourSelector from "@/components/OnboardingTourSelector"
import { TokenChip } from "@/components/TokenChip"
import { useTutorial } from "@/hooks/useTutorial"

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="3" width="13" height="11" rx="2" />
      <path d="M1.5 7h13" />
      <path d="M5 1.5v3M11 1.5v3" />
    </svg>
  )
}

function IconBell({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5A4.5 4.5 0 003.5 6v3.5L2 11.5h12L12.5 9.5V6A4.5 4.5 0 008 1.5z" />
      <path d="M6.5 11.5a1.5 1.5 0 003 0" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="5.5" r="3" />
      <path d="M1.5 14.5c0-3.314 2.91-6 6.5-6s6.5 2.686 6.5 6" />
    </svg>
  )
}

function IconInsights() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1.5 12.5l4-5 3 2.5 4-6" />
      <path d="M13.5 4v3.5H10" />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="5" r="2.5" />
      <path d="M1 14c0-2.761 2.239-5 5-5s5 2.239 5 5" />
      <path d="M12 7c1.105 0 2 .895 2 2v1" />
      <path d="M10 4a2 2 0 110 3.999" />
    </svg>
  )
}

function IconTrophy() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2.5h6v2a3 3 0 01-6 0v-2z" />
      <path d="M5 4.5H3.5A1.5 1.5 0 002 6v.2A2.8 2.8 0 004.8 9H5" />
      <path d="M11 4.5h1.5A1.5 1.5 0 0114 6v.2A2.8 2.8 0 0111.2 9H11" />
      <path d="M8 7.5v2.2" />
      <path d="M6 13.5h4" />
      <path d="M6.5 10.8h3" />
    </svg>
  )
}

function IconBilling() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M1.5 6.5h13" />
      <path d="M4.5 9.5h3M11 9.5h.5" />
    </svg>
  )
}

function IconFeedback() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.5 2.5h-11a1 1 0 00-1 1v7a1 1 0 001 1H5l3 2.5 3-2.5h2.5a1 1 0 001-1v-7a1 1 0 00-1-1z" />
      <path d="M5 6.5h6M5 9h4" />
    </svg>
  )
}

function IconMenu() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M3 5h14M3 10h14M3 15h14" />
    </svg>
  )
}

function IconX() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 4l10 10M14 4L4 14" />
    </svg>
  )
}

function IconChat() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function IconLogOut() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.5 5.5l3 2.5-3 2.5" />
      <path d="M13.5 8h-7" />
      <path d="M6.5 3H3a1 1 0 00-1 1v8a1 1 0 001 1h3.5" />
    </svg>
  )
}

function IconAdmin() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L2 4v4c0 3.3 2.5 5.5 6 6 3.5-.5 6-2.7 6-6V4L8 1.5z" />
    </svg>
  )
}

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: <IconGrid />, exact: true },
  { label: "My Events", href: "/dashboard/events", icon: <IconCalendar />, exact: false },
  { label: "Community", href: "/dashboard/community", icon: <IconTrophy />, exact: false },
  { label: "Notifications", href: "/dashboard/notifications", icon: <IconBell />, exact: false },
  { label: "Assistant", href: "/dashboard/assistant", icon: <IconChat />, exact: false },
  { label: "Billing", href: "/dashboard/billing", icon: <IconBilling />, exact: false },
  { label: "Calendar", href: "/dashboard/profile#calendar", icon: <IconCalendar />, exact: false },
  { label: "Profile", href: "/dashboard/profile", icon: <IconUser />, exact: false },
  { label: "Comms", href: "/dashboard/feedback", icon: <IconFeedback />, exact: false },
] as const

function getIsActive(pathname: string, href: string, exact: boolean): boolean {
  const normalizedHref = href.split("#")[0].split("?")[0]
  if (exact) return pathname === normalizedHref
  return pathname === normalizedHref || pathname.startsWith(normalizedHref + "/")
}

// ─── Sidebar inner content ────────────────────────────────────────────────────

interface SidebarInnerProps {
  pathname: string
  name: string
  email: string
  image?: string | null
  initials: string
  unreadCount: number
  hasPioneer: boolean
  usedFeatures: string[]
  onNavClick?: () => void
  onOpenTourSelector?: () => void
  collapsed?: boolean
  isAdmin?: boolean
}

function SidebarInner({ pathname, name, email, image, initials, unreadCount, hasPioneer, usedFeatures, onNavClick, onOpenTourSelector, collapsed = false, isAdmin = false }: SidebarInnerProps) {
  const [tooltip, setTooltip] = useState<{ label: string; y: number } | null>(null)
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Logo + user info */}
      <div
        className="dash-hdr-top"
        style={{
          padding: "1.5rem 1.25rem 1.25rem",
          borderBottom: "0.5px solid rgba(240,237,230,0.06)",
          flexShrink: 0,
        }}
      >
        <Link
          href="/"
          className="dash-hdr-logo"
          style={{ textDecoration: "none", display: "inline-block", marginBottom: "1.25rem" }}
        >
          <span style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", color: "#F0EDE6" }}>
            Event
          </span>
          <span style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", color: "#C8F55A" }}>
            Slot
          </span>
        </Link>
        <Link
          href="/"
          className="dash-logo-e"
          style={{ textDecoration: "none", display: "none", marginBottom: "1.25rem" }}
        >
          <span style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", color: "#C8F55A" }}>E</span>
        </Link>

        <div className="dash-avatar-wrap" style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          {/* Avatar with Pioneer badge overlay */}
          <div style={{ position: "relative", flexShrink: 0, width: 32, height: 32 }}>
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={image}
                alt={name}
                width={32}
                height={32}
                style={{ borderRadius: "50%", objectFit: "cover", display: "block", width: 32, height: 32 }}
              />
            ) : (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(200,245,90,0.15)",
                  border: "0.5px solid rgba(200,245,90,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "#C8F55A",
                }}
              >
                {initials}
              </div>
            )}
            {hasPioneer && (
              <span
                title="EventSlot Pioneer"
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -4,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#C8F55A",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.52rem",
                  border: "1.5px solid #141414",
                  lineHeight: 1,
                  boxShadow: "0 0 4px rgba(200,245,90,0.6)",
                }}
              >
                🏆
              </span>
            )}
          </div>
          <div className="dash-user-det" style={{ overflow: "hidden", minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 500,
                color: "rgba(240,237,230,0.75)",
                fontFamily: "var(--font-dm-sans)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {name}
            </div>
            {hasPioneer && (
              <div style={{ marginTop: "0.2rem" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.62rem",
                    padding: "2px 8px",
                    borderRadius: 999,
                    color: "#C8F55A",
                    background: "rgba(200,245,90,0.1)",
                    border: "0.5px solid rgba(200,245,90,0.35)",
                    fontFamily: "var(--font-dm-sans)",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    width: "fit-content",
                  }}
                >
                  Pioneer
                </span>
              </div>
            )}
            {email && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "rgba(240,237,230,0.35)",
                  fontFamily: "var(--font-dm-sans)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {email}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav
        className="dash-sl-nav"
        style={{
          flex: 1,
          padding: "0.875rem 0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {NAV_ITEMS.map(item => {
          const active = getIsActive(pathname, item.href, item.exact)
          const tutorialTarget =
            item.href === "/dashboard/events"
              ? "my-events-nav"
              : item.href === "/dashboard/notifications"
                ? "notifications-nav"
                : item.href === "/dashboard/profile"
                  ? "profile-nav"
                  : undefined
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tutorial={tutorialTarget}
              onClick={onNavClick}
              onMouseEnter={e => {
                if (collapsed) {
                  const rect = (e.currentTarget as HTMLAnchorElement).getBoundingClientRect()
                  setTooltip({ label: item.label, y: rect.top + rect.height / 2 })
                }
              }}
              onMouseLeave={() => setTooltip(null)}
              className={`dash-sl-link${active ? " dash-sl-active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0.6rem 1rem",
                borderRadius: 8,
                fontSize: "0.875rem",
                fontFamily: "var(--font-dm-sans)",
                textDecoration: "none",
                background: active ? "rgba(200,245,90,0.08)" : "transparent",
                color: active ? "#C8F55A" : "rgba(240,237,230,0.45)",
              }}
            >
              {item.icon}
              <span className="dash-nav-lbl" style={{ flex: 1, display: "inline-flex", alignItems: "center" }}>
                {item.label}
                {item.href === "/dashboard/events" && (
                  <HintDot
                    show={!usedFeatures.includes("view_events")}
                    message="See all your events, manage registrations, and share your event link here."
                  />
                )}
                {item.href === "/dashboard/notifications" && (
                  <HintDot
                    show={!usedFeatures.includes("notifications")}
                    message="Stay updated when registrations, waitlist changes, and key activity happen."
                  />
                )}
                {item.href === "/dashboard/billing" && (
                  <HintDot
                    show={!usedFeatures.includes("billing")}
                    message="Manage plans, credits, and usage in one place."
                  />
                )}
                {item.href === "/dashboard/profile" && (
                  <HintDot
                    show={!usedFeatures.includes("profile")}
                    message="Complete your profile so attendees recognize your events."
                  />
                )}
                {item.href === "/dashboard/feedback" && (
                  <HintDot
                    show={!usedFeatures.includes("feedback")}
                    message="Send product feedback and track your previous submissions here."
                  />
                )}
              </span>
              {item.href === "/dashboard/notifications" && unreadCount > 0 && (
                <span
                  style={{
                    background: "#C8F55A",
                    color: "#0A0A0A",
                    borderRadius: 100,
                    fontSize: "0.6rem",
                    padding: "1px 6px",
                    fontWeight: 500,
                    marginLeft: "auto",
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </Link>
          )
        })}
        {(() => {
          const active = getIsActive(pathname, "/dashboard/insights", false)
          return (
            <Link
              href="/dashboard/insights"
              data-tutorial="insights-nav"
              onClick={onNavClick}
              onMouseEnter={e => {
                if (collapsed) {
                  const rect = (e.currentTarget as HTMLAnchorElement).getBoundingClientRect()
                  setTooltip({ label: "Insights", y: rect.top + rect.height / 2 })
                }
              }}
              onMouseLeave={() => setTooltip(null)}
              className={`dash-sl-link${active ? " dash-sl-active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0.6rem 1rem",
                borderRadius: 8,
                fontSize: "0.875rem",
                fontFamily: "var(--font-dm-sans)",
                textDecoration: "none",
                background: active ? "rgba(200,245,90,0.08)" : "transparent",
                color: active ? "#C8F55A" : "rgba(240,237,230,0.45)",
              }}
            >
              <IconInsights />
              <span className="dash-nav-lbl" style={{ flex: 1 }}>Insights</span>
            </Link>
          )
        })()}
        {(() => {
          const active = getIsActive(pathname, "/dashboard/team", false)
          return (
            <Link
              href="/dashboard/team"
              data-tutorial="team-nav"
              onClick={onNavClick}
              onMouseEnter={e => {
                if (collapsed) {
                  const rect = (e.currentTarget as HTMLAnchorElement).getBoundingClientRect()
                  setTooltip({ label: "Team", y: rect.top + rect.height / 2 })
                }
              }}
              onMouseLeave={() => setTooltip(null)}
              className={`dash-sl-link${active ? " dash-sl-active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "0.6rem 1rem",
                borderRadius: 8,
                fontSize: "0.875rem",
                fontFamily: "var(--font-dm-sans)",
                textDecoration: "none",
                background: active ? "rgba(200,245,90,0.08)" : "transparent",
                color: active ? "#C8F55A" : "rgba(240,237,230,0.45)",
              }}
            >
              <IconUsers />
              <span className="dash-nav-lbl" style={{ flex: 1, display: "inline-flex", alignItems: "center" }}>
                Team
                <HintDot
                  show={!usedFeatures.includes("team")}
                  message="Invite teammates and manage shared event access from here."
                />
              </span>
            </Link>
          )
        })()}
      </nav>

      {/* Admin Panel — only visible to superadmin */}
      {isAdmin && (
        <div style={{ padding: "0 0.75rem 0.625rem" }}>
          <div style={{ height: "0.5px", background: "rgba(200,245,90,0.15)", margin: "0 0.25rem 0.625rem" }} />
          {(() => {
            const active = getIsActive(pathname, "/admin", false)
            return (
              <Link
                href="/admin"
                onClick={onNavClick}
                onMouseEnter={e => {
                  if (collapsed) {
                    const rect = (e.currentTarget as HTMLAnchorElement).getBoundingClientRect()
                    setTooltip({ label: "Admin Panel", y: rect.top + rect.height / 2 })
                  }
                }}
                onMouseLeave={() => setTooltip(null)}
                className={`dash-sl-link${active ? " dash-sl-active" : ""}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0.6rem 1rem",
                  borderRadius: 8,
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-dm-sans)",
                  textDecoration: "none",
                  background: active ? "rgba(200,245,90,0.12)" : "rgba(200,245,90,0.05)",
                  color: active ? "#C8F55A" : "rgba(200,245,90,0.65)",
                  border: "0.5px solid rgba(200,245,90,0.18)",
                }}
              >
                <IconAdmin />
                <span className="dash-nav-lbl">Admin Panel</span>
              </Link>
            )
          })()}
        </div>
      )}

      {/* Bottom: links + sign out */}
      <div
        className="dash-bottom"
        style={{
          padding: "0.875rem 1.25rem",
          borderTop: "0.5px solid rgba(240,237,230,0.06)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={onOpenTourSelector}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "0.6rem 1rem",
            borderRadius: "8px",
            background: "transparent",
            border: "none",
            color: "rgba(240,237,230,0.35)",
            fontSize: "0.875rem",
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
            fontFamily: "var(--font-dm-sans)",
            marginBottom: "0.5rem",
          }}
        >
          ◎ Take a tour
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: "0.625rem" }}>
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="dash-sl-link"
            style={{
              fontSize: "0.75rem",
              color: "rgba(240,237,230,0.3)",
              fontFamily: "var(--font-dm-sans)",
              textDecoration: "none",
              padding: "0.25rem 0.5rem",
              borderRadius: 6,
            }}
          >
            Terms of Service
          </a>
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="dash-sl-link"
            style={{
              fontSize: "0.75rem",
              color: "rgba(240,237,230,0.3)",
              fontFamily: "var(--font-dm-sans)",
              textDecoration: "none",
              padding: "0.25rem 0.5rem",
              borderRadius: 6,
            }}
          >
            Privacy Policy
          </a>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          style={{
            width: "100%",
            background: "transparent",
            border: "0.5px solid rgba(240,237,230,0.1)",
            borderRadius: 8,
            padding: "0.45rem 0.75rem",
            fontSize: "0.75rem",
            color: "rgba(240,237,230,0.4)",
            cursor: "pointer",
            fontFamily: "var(--font-dm-sans)",
            textAlign: "left",
          }}
        >
          Sign out
        </button>
      </div>
      {/* Tooltip for icon-only collapsed nav items */}
      {collapsed && tooltip && (
        <div
          style={{
            position: "fixed",
            left: 64,
            top: tooltip.y,
            transform: "translateY(-50%)",
            background: "#1A1A1A",
            border: "0.5px solid rgba(240,237,230,0.1)",
            borderRadius: 6,
            padding: "0.35rem 0.6rem",
            fontSize: "0.78rem",
            color: "rgba(240,237,230,0.75)",
            fontFamily: "var(--font-dm-sans)",
            whiteSpace: "nowrap" as const,
            zIndex: 50,
            pointerEvents: "none" as const,
          }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const tutorial = useTutorial()
  const { data: session, status } = useSession()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [hasPioneer, setHasPioneer] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [usedFeatures, setUsedFeatures] = useState<string[]>([])
  const [showTourSelector, setShowTourSelector] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [signOutConfirm, setSignOutConfirm] = useState(false)
  const moreSheetRef = useRef<HTMLDivElement>(null)
  const unreadRequestInFlightRef = useRef(false)

  const fetchUnreadCount = useCallback(async () => {
    if (unreadRequestInFlightRef.current) return
    if (typeof navigator !== "undefined" && !navigator.onLine) return
    if (typeof document !== "undefined" && document.hidden) return
    unreadRequestInFlightRef.current = true
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch("/api/notifications?unread=true", {
        cache: "no-store",
        signal: controller.signal,
      })
      if (!res.ok) return
      const data = await res.json()
      if (typeof data.count === "number") setUnreadCount(data.count)
    } catch {
      // ignore
    } finally {
      clearTimeout(timeoutId)
      unreadRequestInFlightRef.current = false
    }
  }, [])

  useEffect(() => {
    if (status === "authenticated") {
      fetchUnreadCount()
      const id = setInterval(fetchUnreadCount, 60_000)
      return () => clearInterval(id)
    }
  }, [status, fetchUnreadCount])

  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/me")
        .then(r => r.json())
        .then(d => {
          if (typeof d.isAdmin === "boolean") setIsAdmin(d.isAdmin)
        })
        .catch(() => { /* ignore */ })
    }
  }, [status])

  useEffect(() => {
    if (status !== "authenticated") return

    fetch("/api/user/badges")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setHasPioneer(Boolean(d?.hasPioneer))
      })
      .catch(() => {
        setHasPioneer(false)
      })

    fetch("/api/onboarding")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (Array.isArray(d?.usedFeatures)) {
          setUsedFeatures(d.usedFeatures)
        }
      })
      .catch(() => {})
  }, [pathname, status])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin")
    }
  }, [status, router])

  // Claim any pending referral from the eventslot_ref cookie (handles OAuth signups)
  useEffect(() => {
    if (status === "authenticated") {
      fetch("/api/user/claim-referral", { method: "POST" }).catch(() => {})
    }
  }, [status])

  useEffect(() => {
    setDrawerOpen(false)
    setMoreOpen(false)
    setSignOutConfirm(false)
    if (pathname !== "/dashboard/notifications" && status === "authenticated") {
      fetchUnreadCount()
    }
  }, [pathname, status, fetchUnreadCount])

  // Focus trap for More sheet
  useEffect(() => {
    if (!moreOpen) return
    const el = moreSheetRef.current
    if (!el) return
    const focusable = el.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    )
    focusable[0]?.focus()
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMoreOpen(false)
        setSignOutConfirm(false)
        return
      }
      if (e.key !== 'Tab') return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last?.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [moreOpen])

  // Persist sidebar collapse state across sessions
  useEffect(() => {
    const stored = localStorage.getItem("sidebarCollapsed")
    if (stored !== null) setSidebarCollapsed(stored === "true")
  }, [])

  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed))
  }, [sidebarCollapsed])

  const name = session?.user?.name || session?.user?.email || "Organizer"
  const email = session?.user?.email ?? ""
  const image = session?.user?.image ?? null
  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n: string) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : email[0]?.toUpperCase() ?? "?"

  const sidebarProps: SidebarInnerProps = {
    pathname,
    name,
    email,
    image,
    initials,
    unreadCount,
    hasPioneer,
    usedFeatures,
    onOpenTourSelector: () => setShowTourSelector(true),
  }
  sidebarProps.isAdmin = isAdmin

  const startTour = useCallback((sections: string[]) => {
    setShowTourSelector(false)
    tutorial.startTour(sections)
  }, [tutorial])

  if (status === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#0A0A0A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <style>{`@keyframes dash-spin { to { transform: rotate(360deg); } }`}</style>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: "50%",
            border: "2px solid rgba(200,245,90,0.2)",
            borderTopColor: "#C8F55A",
            animation: "dash-spin 0.8s linear infinite",
          }}
        />
      </div>
    )
  }

  if (status === "unauthenticated") return null

  return (
    <>
      <style>{`
        .dash-sl-link:not(.dash-sl-active):hover {
          background: rgba(240,237,230,0.04) !important;
          color: #F0EDE6 !important;
        }
        .dash-icon-btn:hover {
          background: rgba(240,237,230,0.06) !important;
        }
        .dash-content {
          padding: 2rem 2.5rem;
        }
        @media (max-width: 767px) {
          .dash-content {
            padding: 1.25rem;
          }
        }
        @media (min-width: 768px) {
          .dash-main-col { margin-left: ${sidebarCollapsed ? 56 : 240}px; transition: margin-left 0.25s ease; }
        }
        .dash-sidebar-col { transition: width 0.25s ease; }
        .dash-sidebar-collapsed .dash-sl-nav a { padding-left: 0 !important; padding-right: 0 !important; justify-content: center !important; }
        .dash-sidebar-collapsed .dash-sl-nav .dash-nav-lbl { display: none !important; }
        .dash-sidebar-collapsed .dash-bottom { opacity: 0; visibility: hidden; height: 0; overflow: hidden; padding: 0 !important; border: none !important; }
        .dash-sidebar-collapsed .dash-hdr-top { padding: 0.85rem 0 0.75rem !important; align-items: center !important; }
        .dash-sidebar-collapsed .dash-hdr-logo { display: none !important; }
        .dash-sidebar-collapsed .dash-logo-e { display: inline-block !important; }
        .dash-sidebar-collapsed .dash-user-det { display: none !important; }
        .dash-sidebar-collapsed .dash-avatar-wrap { justify-content: center !important; }
        .dash-collapse-btn:hover { color: rgba(240,237,230,0.55) !important; }
        @keyframes moreSheetSlideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        .more-sheet-item:hover {
          background: rgba(240,237,230,0.04) !important;
        }
      `}</style>

      {/* Drawer backdrop */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 40,
          }}
        />
      )}

      {/* Mobile drawer — slides in from left */}
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          width: 280,
          background: "#0D0D0D",
          borderRight: "0.5px solid rgba(240,237,230,0.06)",
          zIndex: 50,
          overflowY: "auto",
          transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "0.75rem 1rem",
            borderBottom: "0.5px solid rgba(240,237,230,0.04)",
          }}
        >
          <button
            onClick={() => setDrawerOpen(false)}
            className="dash-icon-btn"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "rgba(240,237,230,0.4)",
              padding: "0.35rem",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <IconX />
          </button>
        </div>
        <SidebarInner
          {...sidebarProps}
          onNavClick={() => setDrawerOpen(false)}
          onOpenTourSelector={() => {
            setDrawerOpen(false)
            setShowTourSelector(true)
          }}
        />
      </aside>

      {/* Page shell */}
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Desktop sidebar — fixed, hidden below md */}
        <aside
          className={`hidden md:flex flex-col dash-sidebar-col${sidebarCollapsed ? " dash-sidebar-collapsed" : ""}`}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: sidebarCollapsed ? 56 : 240,
            height: "100vh",
            background: "#0D0D0D",
            borderRight: "0.5px solid rgba(240,237,230,0.06)",
            zIndex: 30,
            overflowY: "auto",
            overflowX: "hidden",
            transition: "width 0.25s ease",
          }}
        >
          <SidebarInner {...sidebarProps} collapsed={sidebarCollapsed} />
          {/* Collapse button — only shown when expanded */}
          {!sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
              className="dash-collapse-btn"
              style={{
                position: "absolute",
                top: 16,
                right: 10,
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "rgba(240,237,230,0.25)",
                padding: "0.25rem",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2L4 6l4 4" />
              </svg>
            </button>
          )}
        </aside>
        {/* Protruding reopen tab — desktop only, visible when collapsed */}
        {sidebarCollapsed && (
          <div
            className="hidden md:flex"
            onClick={() => setSidebarCollapsed(false)}
            style={{
              position: "fixed",
              top: "50%",
              left: 56,
              transform: "translateY(-50%)",
              width: 16,
              height: 48,
              background: "#141414",
              border: "0.5px solid rgba(240,237,230,0.08)",
              borderLeft: "none",
              borderRadius: "0 8px 8px 0",
              cursor: "pointer",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 31,
            }}
          >
            <svg width="7" height="11" viewBox="0 0 8 12" fill="none" stroke="rgba(240,237,230,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 2l4 4-4 4" />
            </svg>
          </div>
        )}

        {/* Content column — offset for sidebar on desktop */}
        <div
          className="dash-main-col"
          style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}
        >
          {/* Top bar */}
          <header
            style={{
              height: 56,
              flexShrink: 0,
              background: "#0A0A0A",
              borderBottom: "0.5px solid rgba(240,237,230,0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 1.25rem",
              position: "sticky",
              top: 0,
              zIndex: 20,
            }}
          >
            {/* Hamburger — mobile only */}
            <button
              className="md:hidden dash-icon-btn"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "rgba(240,237,230,0.6)",
                padding: "0.3rem",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IconMenu />
            </button>

            {/* Logo — mobile only */}
            <Link href="/" className="md:hidden" style={{ textDecoration: "none" }}>
              <span
                style={{
                  fontFamily: "var(--font-instrument-serif)",
                  fontSize: "1.2rem",
                  color: "#F0EDE6",
                }}
              >
                Event
              </span>
              <span
                style={{
                  fontFamily: "var(--font-instrument-serif)",
                  fontSize: "1.2rem",
                  color: "#C8F55A",
                }}
              >
                Slot
              </span>
            </Link>

            {/* Empty spacer — desktop (keeps bell right-aligned) */}
            <div className="hidden md:block" />

            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <TokenChip />
              <button
                onClick={tutorial.restartTutorial}
                aria-label="Restart dashboard tour"
                className="dash-icon-btn"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  color: "rgba(240,237,230,0.55)",
                  background: "transparent",
                  border: "0.5px solid rgba(240,237,230,0.12)",
                  cursor: "pointer",
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "0.95rem",
                  lineHeight: 1,
                }}
              >
                ?
              </button>

              <Link
                href="/dashboard/notifications"
                aria-label="Notifications"
                data-tutorial="notifications-nav"
                className="dash-icon-btn"
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  color: "rgba(240,237,230,0.55)",
                  textDecoration: "none",
                }}
              >
                <IconBell size={18} />
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#C8F55A",
                    }}
                  />
                )}
              </Link>
            </div>
          </header>

          {/* Page content */}
          <main
            className="dash-content pb-40 md:pb-0"
            style={{ flex: 1, background: "#0A0A0A" }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom tab bar — 4 items max: Dashboard, Events, Notifications, More */}
      <nav
        aria-label="Mobile navigation"
        className="flex md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#0D0D0D",
          borderTop: "0.5px solid rgba(240,237,230,0.08)",
          justifyContent: "space-evenly",
          padding: "0.5rem 0",
          paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))",
          zIndex: 50,
          boxShadow: "0 -6px 20px rgba(0,0,0,0.32)",
        }}
      >
        {([
          { label: "Dashboard", href: "/dashboard", icon: <IconGrid />, exact: true },
          { label: "Events", href: "/dashboard/events", icon: <IconCalendar />, exact: false },
          { label: "Alerts", href: "/dashboard/notifications", icon: <IconBell />, exact: false },
        ] as const).map(item => {
          const active = getIsActive(pathname, item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tutorial={
                item.href === "/dashboard/events"
                  ? "my-events-nav"
                  : item.href === "/dashboard/notifications"
                    ? "notifications-nav"
                    : undefined
              }
              aria-label={item.label}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                padding: "0.3rem 0",
                color: active ? "#C8F55A" : "rgba(240,237,230,0.35)",
                textDecoration: "none",
                position: "relative",
              }}
            >
              {item.icon}
              <span style={{ fontSize: "0.65rem", fontFamily: "var(--font-dm-sans)" }}>{item.label}</span>
              {item.href === "/dashboard/notifications" && unreadCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 8,
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#C8F55A",
                  }}
                />
              )}
            </Link>
          )
        })}
        {/* Profile quick access */}
        <Link
          href="/dashboard/profile"
          aria-label="Profile"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            padding: "0.3rem 0",
            color: getIsActive(pathname, "/dashboard/profile", false) ? "#C8F55A" : "rgba(240,237,230,0.35)",
            textDecoration: "none",
          }}
        >
          <IconUser />
          <span style={{ fontSize: "0.65rem", fontFamily: "var(--font-dm-sans)" }}>Profile</span>
        </Link>
      </nav>

      {/* More bottom sheet */}
      {moreOpen && (
        <>
          {/* Overlay */}
          <div
            className="md:hidden"
            onClick={() => { setMoreOpen(false); setSignOutConfirm(false) }}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
              zIndex: 60,
            }}
          />
          {/* Sheet */}
          <div
            ref={moreSheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="More options"
            className="md:hidden"
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              background: "#0D0D0D",
              borderTop: "0.5px solid rgba(240,237,230,0.1)",
              borderRadius: "16px 16px 0 0",
              zIndex: 61,
              paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
              animation: "moreSheetSlideUp 0.25s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "0.75rem 0 0.25rem" }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(240,237,230,0.15)" }} />
            </div>

            {!signOutConfirm ? (
              <div style={{ padding: "0.25rem 0.75rem 0.25rem" }}>
                {([
                  { label: "Profile", href: "/dashboard/profile", icon: <IconUser />, show: true },
                  { label: "Team", href: "/dashboard/team", icon: <IconUsers />, show: true },
                  { label: "Billing", href: "/dashboard/billing", icon: <IconBilling />, show: true },
                  { label: "Feedback", href: "/dashboard/feedback", icon: <IconFeedback />, show: true },
                  { label: "Insights", href: "/dashboard/insights", icon: <IconInsights />, show: true },
                ] as const).filter(i => i.show).map(item => {
                  const active = getIsActive(pathname, item.href, false)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      data-tutorial={
                        item.href === "/dashboard/profile"
                          ? "profile-nav"
                          : item.href === "/dashboard/insights"
                            ? "insights-nav"
                            : item.href === "/dashboard/team"
                              ? "team-nav"
                              : undefined
                      }
                      aria-label={item.label}
                      onClick={() => setMoreOpen(false)}
                      className="more-sheet-item"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "0.75rem 1rem",
                        borderRadius: 10,
                        color: active ? "#C8F55A" : "rgba(240,237,230,0.75)",
                        background: active ? "rgba(200,245,90,0.06)" : "transparent",
                        textDecoration: "none",
                        fontSize: "0.9rem",
                        fontFamily: "var(--font-dm-sans)",
                      }}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  )
                })}

                {isAdmin && (
                  <>
                    <div style={{ height: 1, background: "rgba(240,237,230,0.08)", margin: "0.5rem 0.25rem" }} />
                    <Link
                      href="/admin"
                      aria-label="Switch to Admin View"
                      onClick={() => setMoreOpen(false)}
                      className="more-sheet-item"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "0.75rem 1rem",
                        borderRadius: 10,
                        color: "rgba(200,245,90,0.8)",
                        textDecoration: "none",
                        fontSize: "0.9rem",
                        fontFamily: "var(--font-dm-sans)",
                      }}
                    >
                      <IconAdmin />
                      Switch to Admin View
                    </Link>
                  </>
                )}

                <div style={{ height: 1, background: "rgba(240,237,230,0.08)", margin: "0.5rem 0.25rem" }} />
                <button
                  aria-label="Sign out"
                  onClick={() => setSignOutConfirm(true)}
                  className="more-sheet-item"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "0.75rem 1rem",
                    borderRadius: 10,
                    color: "#FF6B6B",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    fontFamily: "var(--font-dm-sans)",
                    width: "100%",
                    textAlign: "left",
                  }}
                >
                  <IconLogOut />
                  Sign Out
                </button>
              </div>
            ) : (
              <div style={{ padding: "1.25rem 1.5rem 1rem" }}>
                <p
                  style={{
                    fontSize: "0.9rem",
                    color: "rgba(240,237,230,0.75)",
                    fontFamily: "var(--font-dm-sans)",
                    marginBottom: "1rem",
                    lineHeight: 1.5,
                  }}
                >
                  Are you sure you want to sign out?
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    aria-label="Cancel sign out"
                    onClick={() => setSignOutConfirm(false)}
                    style={{
                      flex: 1,
                      padding: "0.625rem 1rem",
                      borderRadius: 8,
                      background: "rgba(240,237,230,0.06)",
                      border: "0.5px solid rgba(240,237,230,0.1)",
                      color: "rgba(240,237,230,0.75)",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontFamily: "var(--font-dm-sans)",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    aria-label="Confirm sign out"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    style={{
                      flex: 1,
                      padding: "0.625rem 1rem",
                      borderRadius: 8,
                      background: "rgba(255,107,107,0.12)",
                      border: "0.5px solid rgba(255,107,107,0.3)",
                      color: "#FF6B6B",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontFamily: "var(--font-dm-sans)",
                      fontWeight: 500,
                    }}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showTourSelector && (
        <OnboardingTourSelector
          onClose={() => setShowTourSelector(false)}
          onStart={startTour}
        />
      )}

      {tutorial.isActive && tutorial.currentStep && (
        <TutorialOverlay
          step={tutorial.currentStep}
          currentStepIndex={tutorial.currentStepIndex}
          totalSteps={tutorial.totalSteps}
          targetRect={tutorial.targetRect}
          onNext={tutorial.handleNext}
          onBack={tutorial.handleBack}
          onSkip={tutorial.handleSkip}
        />
      )}
    </>
  )
}
