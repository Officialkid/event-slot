"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"

const NAV_ITEMS = [
  {
    label: "Events",
    href: "/my-events",
    matches: ["/my-events", "/dashboard", "/edit"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
        <rect x="1.5" y="3.5" width="13" height="11" rx="2" strokeWidth="1.25" />
        <path d="M1.5 7h13" strokeWidth="1.25" />
        <path d="M5 1.5v4M11 1.5v4" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Create",
    href: "/create",
    matches: ["/create"],
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
        <circle cx="8" cy="8" r="6.5" strokeWidth="1.25" />
        <path d="M8 5.5v5M5.5 8h5" strokeWidth="1.25" strokeLinecap="round" />
      </svg>
    ),
  },
]

function getPageTitle(pathname: string): string {
  if (pathname === "/my-events") return "Your events"
  if (pathname === "/create") return "Create event"
  if (pathname.startsWith("/edit/")) return "Edit event"
  if (pathname.startsWith("/dashboard/")) return "Dashboard"
  return ""
}

function isActive(pathname: string, matches: string[]): boolean {
  return matches.some(m => pathname === m || pathname.startsWith(m + "/"))
}

export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: session } = useSession()

  // Dashboard routes have their own dedicated shell layout
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    return <>{children}</>
  }

  const initials = session?.user?.name
    ? session.user.name
        .split(" ")
        .map((n: string) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : session?.user?.email?.[0]?.toUpperCase() ?? "?"

  const pageTitle = getPageTitle(pathname)

  return (
    <>
      <style>{`
        .dash-nav-link:not(.dash-active):hover {
          background: rgba(240,237,230,0.04) !important;
          color: #F0EDE6 !important;
        }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* SIDEBAR — desktop only */}
        <aside
          className="hidden md:flex flex-col"
          style={{
            width: 240,
            flexShrink: 0,
            background: "#0D0D0D",
            borderRight: "0.5px solid rgba(240,237,230,0.06)",
            position: "sticky",
            top: 0,
            height: "100vh",
            overflowY: "auto",
          }}
        >
          {/* Logo */}
          <div
            style={{
              padding: "1.25rem 1.25rem 1rem",
              borderBottom: "0.5px solid rgba(240,237,230,0.06)",
              flexShrink: 0,
            }}
          >
            <Link href="/" style={{ display: "inline-block", textDecoration: "none" }}>
              <span
                style={{
                  fontFamily: "var(--font-instrument-serif)",
                  fontSize: "1.3rem",
                  color: "#F0EDE6",
                }}
              >
                Event
              </span>
              <span
                style={{
                  fontFamily: "var(--font-instrument-serif)",
                  fontSize: "1.3rem",
                  color: "#C8F55A",
                }}
              >
                Slot
              </span>
            </Link>
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
              const active = isActive(pathname, item.matches)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`dash-nav-link${active ? " dash-active" : ""}`}
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
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* User + sign out */}
          <div
            style={{
              padding: "0.875rem 1.25rem",
              borderTop: "0.5px solid rgba(240,237,230,0.06)",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                marginBottom: "0.625rem",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "rgba(200,245,90,0.12)",
                  border: "0.5px solid rgba(200,245,90,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.65rem",
                  fontWeight: 500,
                  color: "#C8F55A",
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "rgba(240,237,230,0.55)",
                  fontFamily: "var(--font-dm-sans)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {session?.user?.name || session?.user?.email || "Organizer"}
              </span>
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
        </aside>

        {/* MAIN AREA */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
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
              padding: "0 1.5rem",
              position: "sticky",
              top: 0,
              zIndex: 20,
            }}
          >
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

            {/* Page title — desktop only */}
            {pageTitle && (
              <span
                className="hidden md:block"
                style={{
                  fontSize: "0.82rem",
                  fontFamily: "var(--font-dm-sans)",
                  color: "rgba(240,237,230,0.4)",
                }}
              >
                {pageTitle}
              </span>
            )}

            {/* User chip */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "rgba(200,245,90,0.12)",
                  border: "0.5px solid rgba(200,245,90,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.65rem",
                  fontWeight: 500,
                  color: "#C8F55A",
                }}
              >
                {initials}
              </div>
              <span
                className="hidden md:block"
                style={{
                  fontSize: "0.82rem",
                  color: "rgba(240,237,230,0.4)",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                {session?.user?.name || session?.user?.email}
              </span>
            </div>
          </header>

          {/* Page content — pb-20 clears mobile tab bar */}
          <main className="md:pb-0" style={{ flex: 1, background: "#0A0A0A", paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
            {children}
          </main>
        </div>
      </div>

      {/* MOBILE BOTTOM TAB BAR */}
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
          const active = isActive(pathname, item.matches)
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                padding: "0.3rem 1.5rem",
                color: active ? "#C8F55A" : "rgba(240,237,230,0.4)",
                textDecoration: "none",
                fontSize: "0.7rem",
                fontFamily: "var(--font-dm-sans)",
              }}
            >
              {item.icon}
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}

