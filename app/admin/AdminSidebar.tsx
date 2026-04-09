"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const navItems = [
  { label: "Overview", href: "/admin" },
  { label: "Users", href: "/admin/users" },
  { label: "Events", href: "/admin/events" },
  { label: "Messages", href: "/admin/messages" },
  { label: "Broadcast", href: "/admin/broadcast" },
  { label: "Platform Health", href: "/admin/health" },
  { label: "Launch Checklist", href: "/admin/launch" },
]

export default function AdminSidebar() {
  const pathname = usePathname()

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
                display: "block",
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
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div style={{ padding: "1rem 1.5rem", borderTop: "0.5px solid rgba(240,237,230,0.07)" }}>
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
