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
  { label: "Conversations", href: "/admin/conversations" },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const [flaggedCount, setFlaggedCount] = useState(0)

  useEffect(() => {
    fetch("/api/admin/assistant-sessions?filter=flagged")
      .then(r => r.json())
      .then(d => setFlaggedCount(d.flaggedCount ?? 0))
      .catch(() => {})
  }, [])

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: "#080808",
        borderRight: "0.5px solid rgba(240,237,230,0.07)",
        padding: "2rem 0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: "0 1.5rem 2rem", borderBottom: "0.5px solid rgba(240,237,230,0.07)" }}>
        <Link
          href="/admin"
          style={{
            fontFamily: "var(--font-instrument-serif)",
            fontSize: "1.2rem",
            textDecoration: "none",
            lineHeight: 1.2,
          }}
        >
          <span style={{ color: "#F0EDE6" }}>Event</span>
          <span style={{ color: "#C8F55A" }}>Slot</span>
        </Link>
        <div
          style={{
            marginTop: "0.4rem",
            fontSize: "0.65rem",
            fontWeight: 700,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "rgba(240,237,230,0.3)",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          Admin Console
        </div>
      </div>

      <nav style={{ padding: "1.25rem 0.75rem", flex: 1 }}>
        {navItems.map(item => {
          const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0.55rem 0.75rem",
                borderRadius: 8,
                fontSize: "0.875rem",
                fontFamily: "var(--font-dm-sans)",
                fontWeight: isActive ? 500 : 400,
                color: isActive ? "#C8F55A" : "rgba(240,237,230,0.5)",
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

      <div style={{ padding: "1rem 1.5rem", borderTop: "0.5px solid rgba(240,237,230,0.07)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <a
          href="https://docs.eventsslot.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.75rem",
            color: "rgba(240,237,230,0.5)",
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
          Documentation ↗
        </a>
        <Link
          href="/"
          style={{
            fontSize: "0.75rem",
            color: "rgba(240,237,230,0.3)",
            textDecoration: "none",
            fontFamily: "var(--font-dm-sans)",
          }}
        >
          ← Back to site
        </Link>
      </div>
    </aside>
  )
}
