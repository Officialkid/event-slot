"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { useState, useRef, useEffect } from "react"

const navItems = [
  { title: "Home", href: "/" },
  { title: "Features", href: "/#how-it-works" },
  { title: "Get started", href: "/#get-started" },
]

export default function Nav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : session?.user?.email?.[0]?.toUpperCase() ?? "?"

  return (
    <nav className="sticky top-0 z-30 bg-[#0A0A0A] border-b border-[rgba(240,237,230,0.1)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="text-[1.4rem] font-semibold tracking-tight" style={{ fontFamily: "var(--font-instrument-serif)" }}>
          <span className="text-[#F0EDE6]">Event</span>
          <span className="text-[#C8F55A]">Slot</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {navItems.map(item => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 text-sm font-medium ${isActive ? "text-[#C8F55A]" : "text-[rgba(240,237,230,0.65)]"}`}
              >
                {item.title}
                {isActive && <span className="h-2 w-2 rounded-full bg-[#C8F55A]" />}
              </Link>
            )
          })}
        </div>

        {session ? (
          <div className="flex items-center gap-3">
            <Link
              href="/my-events"
              className="text-sm font-medium text-[rgba(240,237,230,0.65)] hover:text-[#F0EDE6] transition-colors"
            >
              My events
            </Link>

            {/* Avatar + dropdown */}
            <div ref={dropdownRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setDropdownOpen(o => !o)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(200,245,90,0.15)",
                  color: "#C8F55A",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                {initials}
              </button>

              {dropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "110%",
                    right: 0,
                    background: "#141414",
                    border: "0.5px solid rgba(240,237,230,0.1)",
                    borderRadius: 8,
                    padding: "0.25rem",
                    minWidth: 130,
                    zIndex: 50,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "0.5rem 1rem",
                      fontSize: "0.82rem",
                      color: "rgba(240,237,230,0.6)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      borderRadius: 6,
                      fontFamily: "var(--font-dm-sans)",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(240,237,230,0.05)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <Link
            href="/create"
            className={`inline-flex items-center justify-center rounded-full px-6 py-2 text-sm font-semibold text-[#0A0A0A] ${pathname === "/create" ? "bg-[#B7E86D]" : "bg-[#C8F55A]"}`}
          >
            Create an event
          </Link>
        )}
      </div>
    </nav>
  )
}
