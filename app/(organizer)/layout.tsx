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
  const accountIdentity = session?.user?.name || session?.user?.email || "Organizer"

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
          background: color-mix(in srgb, var(--text-primary) 6%, transparent) !important;
          color: var(--text-primary) !important;
        }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* SIDEBAR — desktop only */}
        <aside
          className="hidden md:flex flex-col"
          style={{
            width: 240,
            flexShrink: 0,
            background: "color-mix(in srgb, var(--surface) 94%, var(--surface-muted) 6%)",
            borderRight: "0.5px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
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
              borderBottom: "0.5px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
              flexShrink: 0,
            }}
          >
            <Link href="/" style={{ display: "inline-block", textDecoration: "none" }}>
              <span
                style={{
                  fontFamily: "var(--font-instrument-serif)",
                  fontSize: "1.3rem",
                  color: "var(--text-primary)",
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
                    background: active ? "var(--accent-dim)" : "transparent",
                    color: active ? "var(--accent)" : "var(--text-secondary)",
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
              borderTop: "0.5px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
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
                  background: "var(--accent-dim)",
                  border: "0.5px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.65rem",
                  fontWeight: 500,
                  color: "var(--accent)",
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-secondary)",
                  fontFamily: "var(--font-dm-sans)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "0.62rem",
                      color: "var(--text-muted)",
                      fontFamily: "var(--font-dm-sans)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: "0.12rem",
                    }}
                  >
                    Account profile
                  </div>
                  <div
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {accountIdentity}
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              style={{
                width: "100%",
                background: "transparent",
                border: "0.5px solid color-mix(in srgb, var(--text-primary) 12%, transparent)",
                borderRadius: 8,
                padding: "0.45rem 0.75rem",
                fontSize: "0.75rem",
                color: "var(--text-secondary)",
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
              background: "color-mix(in srgb, var(--surface) 92%, var(--bg-page) 8%)",
              borderBottom: "0.5px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
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
                  color: "var(--text-primary)",
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
                  color: "var(--text-secondary)",
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
                  background: "var(--accent-dim)",
                  border: "0.5px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.65rem",
                  fontWeight: 500,
                  color: "var(--accent)",
                }}
              >
                {initials}
              </div>
              <div className="hidden md:block" style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "0.62rem",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-dm-sans)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    lineHeight: 1.1,
                    marginBottom: "0.08rem",
                  }}
                >
                  Account profile
                </div>
                <div
                  style={{
                    fontSize: "0.82rem",
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-dm-sans)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {accountIdentity}
                </div>
              </div>
            </div>
          </header>

          {/* Page content — pb-20 clears mobile tab bar */}
          <main className="md:pb-0" style={{ flex: 1, background: "var(--bg-page)", paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>
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
          background: "color-mix(in srgb, var(--surface) 94%, var(--surface-muted) 6%)",
          borderTop: "0.5px solid color-mix(in srgb, var(--text-primary) 8%, transparent)",
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
                color: active ? "var(--accent)" : "var(--text-secondary)",
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

