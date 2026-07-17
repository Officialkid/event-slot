"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

const navItems = [
  { label: "Overview", href: "/admin" },
  { label: "Users", href: "/admin/users" },
  { label: "Events", href: "/admin/events" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Org Feedback", href: "/admin/feedback" },
  { label: "Comms", href: "/admin/comms" },
  { label: "Broadcast", href: "/admin/broadcast" },
  { label: "Platform Health", href: "/admin/health" },
  { label: "Launch Checklist", href: "/admin/launch" },
  { label: "Billing Interest", href: "/admin/billing-launch-interest" },
  { label: "Conversations", href: "/admin/conversations" },
  { label: "System Updates", href: "/admin/updates" },
  { label: "Countries", href: "/admin/countries" },
  { label: "Payment Tests", href: "/admin/test/payments" },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const [flaggedCount, setFlaggedCount] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    const loadFlaggedCount = async () => {
      try {
        const response = await fetch("/api/admin/assistant-sessions?filter=flagged", { cache: "no-store" })
        const bodyText = await response.text()

        if (!bodyText) {
          if (!cancelled) setFlaggedCount(0)
          return
        }

        let payload: { flaggedCount?: number } = {}
        try {
          payload = JSON.parse(bodyText) as { flaggedCount?: number }
        } catch {
          payload = {}
        }

        if (!cancelled) {
          setFlaggedCount(typeof payload.flaggedCount === "number" ? payload.flaggedCount : 0)
        }
      } catch {
        if (!cancelled) {
          setFlaggedCount(0)
        }
      }
    }

    loadFlaggedCount()
    const intervalId = window.setInterval(loadFlaggedCount, 30000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [pathname])

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => { document.body.style.overflow = "" }
  }, [drawerOpen])

  const sidebarContent = (
    <>
      <div style={{ padding: "0 1.5rem 2rem", borderBottom: "0.5px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <Link
            href="/admin"
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "1.2rem",
              textDecoration: "none",
              lineHeight: 1.2,
            }}
            onClick={() => setDrawerOpen(false)}
          >
            <span style={{ color: "var(--text-primary)" }}>Event</span>
            <span style={{ color: "#C8F55A" }}>Slot</span>
          </Link>
          <div
            style={{
              marginTop: "0.4rem",
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            Admin Console
          </div>
        </div>
        {/* Close button: mobile only */}
        <button
          className="admin-sidebar-close-btn"
          onClick={() => setDrawerOpen(false)}
          aria-label="Close menu"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            padding: "0.2rem",
            lineHeight: 1,
            fontSize: "1.4rem",
          }}
        >
          X
        </button>
      </div>

      <nav style={{ padding: "1.25rem 0.75rem", flex: 1, overflowY: "auto" }}>
        {navItems.map(item => {
          const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setDrawerOpen(false)}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0.55rem 0.75rem",
                borderRadius: 8,
                fontSize: "0.875rem",
                fontFamily: "var(--font-dm-sans)",
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                background: isActive ? "rgba(200,245,90,0.08)" : "transparent",
                textDecoration: "none",
                marginBottom: "0.15rem",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <span>{item.label}</span>
              {item.href === "/admin/conversations" && flaggedCount > 0 && (
                <span
                  style={{
                    marginLeft: "auto",
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    padding: "2px 5px",
                    borderRadius: 99,
                    lineHeight: 1,
                  }}
                >
                  {flaggedCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: "1rem 1.5rem", borderTop: "0.5px solid var(--border-subtle)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <a
          href="https://docs.eventsslot.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            textDecoration: "none",
            fontFamily: "var(--font-dm-sans)",
            padding: "0.35rem 0",
          }}
          title="Open EventSlot Documentation"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          Documentation
        </a>
        <Link
          href="/"
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            textDecoration: "none",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          Back to site
        </Link>
      </div>
    </>
  )

  return (
    <>
      <style>{`
        /* Desktop sidebar */
        .admin-sidebar-desktop {
          width: 220px;
          flex-shrink: 0;
          background: color-mix(in srgb, var(--surface) 96%, black 4%);
          border-right: 0.5px solid var(--border-subtle);
          padding: 2rem 0;
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          overflow-y: auto;
        }

        /* Hide close button on desktop */
        .admin-sidebar-close-btn {
          display: none !important;
        }

        /* Mobile top bar */
        .admin-mobile-topbar {
          display: none;
        }

        /* Mobile drawer overlay */
        .admin-drawer-overlay {
          display: none;
        }

        @media (max-width: 767px) {
          /* Hide desktop sidebar on mobile */
          .admin-sidebar-desktop {
            display: none !important;
          }

          /* Show mobile top bar */
          .admin-mobile-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 56px;
            background: color-mix(in srgb, var(--surface) 96%, black 4%);
            border-bottom: 0.5px solid var(--border-subtle);
            padding: 0 1.25rem;
            z-index: 200;
          }

          /* Show close button inside drawer on mobile */
          .admin-sidebar-close-btn {
            display: block !important;
          }

          /* Drawer overlay backdrop */
          .admin-drawer-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.65);
            z-index: 300;
          }

          /* Drawer panel */
          .admin-drawer-panel {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            width: 280px;
            max-width: 85vw;
            background: color-mix(in srgb, var(--surface) 96%, black 4%);
            border-right: 0.5px solid var(--border-subtle);
            z-index: 301;
            display: flex;
            flex-direction: column;
            padding: 2rem 0;
            overflow-y: auto;
            transform: translateX(-100%);
            transition: transform 0.25s ease;
          }

          .admin-drawer-panel.open {
            transform: translateX(0);
          }
        }
      `}</style>

      {/* Mobile top bar */}
      <div className="admin-mobile-topbar">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          style={{
            background: "transparent",
            border: "0.5px solid var(--border)",
            borderRadius: 8,
            color: "var(--text-secondary)",
            cursor: "pointer",
            padding: "0.4rem 0.6rem",
            fontSize: "1rem",
            lineHeight: 1,
          }}
        >
          Menu
        </button>
        <Link
          href="/admin"
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.1rem",
            textDecoration: "none",
          }}
        >
          <span style={{ color: "var(--text-primary)" }}>Event</span>
          <span style={{ color: "#C8F55A" }}>Slot</span>
        </Link>
        <div style={{ width: 36 }} /> {/* spacer to centre logo */}
      </div>

      {/* Drawer (mobile) */}
      {drawerOpen && (
        <div
          className="admin-drawer-overlay"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className={`admin-drawer-panel open`}
            onClick={e => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="admin-sidebar-desktop">
        {sidebarContent}
      </aside>
    </>
  )
}
