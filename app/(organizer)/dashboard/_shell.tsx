"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"

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

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: <IconGrid />, exact: true },
  { label: "My Events", href: "/dashboard/events", icon: <IconCalendar />, exact: false },
  { label: "Notifications", href: "/dashboard/notifications", icon: <IconBell />, exact: false },
  { label: "Profile", href: "/dashboard/profile", icon: <IconUser />, exact: false },
] as const

function getIsActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href
  return pathname === href || pathname.startsWith(href + "/")
}

// ─── Sidebar inner content ────────────────────────────────────────────────────

interface SidebarInnerProps {
  pathname: string
  name: string
  email: string
  image?: string | null
  initials: string
  unreadCount: number
  userPlan: string
  onNavClick?: () => void
}

function SidebarInner({ pathname, name, email, image, initials, unreadCount, userPlan, onNavClick }: SidebarInnerProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Logo + user info */}
      <div
        style={{
          padding: "1.5rem 1.25rem 1.25rem",
          borderBottom: "0.5px solid rgba(240,237,230,0.06)",
          flexShrink: 0,
        }}
      >
        <Link
          href="/"
          style={{ textDecoration: "none", display: "inline-block", marginBottom: "1.25rem" }}
        >
          <span style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", color: "#F0EDE6" }}>
            Event
          </span>
          <span style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.3rem", color: "#C8F55A" }}>
            Slot
          </span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={name}
              width={32}
              height={32}
              style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
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
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
          )}
          <div style={{ overflow: "hidden", minWidth: 0 }}>
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
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
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
              <span style={{ flex: 1 }}>{item.label}</span>
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
        {/* Insights — business plan only */}
        {userPlan === "business" && (() => {
          const active = getIsActive(pathname, "/dashboard/insights", false)
          return (
            <Link
              href="/dashboard/insights"
              onClick={onNavClick}
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
              <span style={{ flex: 1 }}>Insights</span>
            </Link>
          )
        })()}
      </nav>

      {/* Bottom: links + sign out */}
      <div
        style={{
          padding: "0.875rem 1.25rem",
          borderTop: "0.5px solid rgba(240,237,230,0.06)",
          flexShrink: 0,
        }}
      >
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
    </div>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [userPlan, setUserPlan] = useState("free")

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?unread=true")
      const data = await res.json()
      if (typeof data.count === "number") setUnreadCount(data.count)
    } catch {
      // ignore
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
        .then(d => { if (d.plan) setUserPlan(d.plan) })
        .catch(() => { /* ignore */ })
    }
  }, [status])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin")
    }
  }, [status, router])

  useEffect(() => {
    setDrawerOpen(false)
    if (pathname !== "/dashboard/notifications" && status === "authenticated") {
      fetchUnreadCount()
    }
  }, [pathname, status, fetchUnreadCount])

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
    userPlan,
  }

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
        <SidebarInner {...sidebarProps} onNavClick={() => setDrawerOpen(false)} />
      </aside>

      {/* Page shell */}
      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* Desktop sidebar — fixed, hidden below md */}
        <aside
          className="hidden md:flex flex-col"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: 210,
            height: "100vh",
            background: "#0D0D0D",
            borderRight: "0.5px solid rgba(240,237,230,0.06)",
            zIndex: 30,
            overflowY: "auto",
          }}
        >
          <SidebarInner {...sidebarProps} />
        </aside>

        {/* Content column — offset for sidebar on desktop */}
        <div
          className="md:ml-[210px]"
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

            {/* Notification bell */}
            <Link
              href="/dashboard/notifications"
              aria-label="Notifications"
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
          </header>

          {/* Page content */}
          <main
            className="dash-content pb-28 md:pb-0"
            style={{ flex: 1, background: "#0A0A0A" }}
          >
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="flex md:hidden"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#0D0D0D",
          borderTop: "0.5px solid rgba(240,237,230,0.08)",
          justifyContent: "space-around",
          padding: "0.5rem 0",
          paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom))",
          zIndex: 50,
        }}
      >
        {NAV_ITEMS.map(item => {
          const active = getIsActive(pathname, item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "0.3rem 1rem",
                color: active ? "#C8F55A" : "rgba(240,237,230,0.35)",
                textDecoration: "none",
                position: "relative",
              }}
            >
              {item.icon}
              <span style={{ fontSize: "0.65rem", fontFamily: "var(--font-dm-sans)" }}>
                {item.label}
              </span>
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
      </nav>
    </>
  )
}
