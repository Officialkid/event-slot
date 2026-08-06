"use client"

import Image from "next/image"
import Link from "next/link"
import { Menu, Moon, Sun, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useEffect, useRef, useState } from "react"
import { applyTheme, resolveCurrentTheme, type ThemeMode } from "@/lib/themeClient"

const navItems = [
  { title: "Home", href: "/", sectionId: null },
  { title: "Events", href: "/events", sectionId: null },
  { title: "Pricing", href: "/pricing", sectionId: null },
  { title: "Universities", href: "/for-universities", sectionId: null },
  { title: "Benefits", href: "/#benefits", sectionId: "benefits" },
  { title: "Verify tickets", href: "/verify-tickets", sectionId: null },
]

const marketingRoutes = new Set([
  "/",
  "/events",
  "/pricing",
  "/for-universities",
  "/how-it-works",
  "/waitlist-system",
  "/privacy",
  "/terms",
  "/signin",
  "/signup",
])

function getAccountInitials(name?: string | null, email?: string | null) {
  const normalizedEmail = email?.trim().toLowerCase() ?? ""
  if (normalizedEmail === "eventslot.co@gmail.com" || normalizedEmail.startsWith("eventslot")) {
    return "ES"
  }

  const displayName = name?.trim()
  if (displayName) {
    return displayName
      .split(/\s+/)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase()
  }

  return normalizedEmail[0]?.toUpperCase() ?? "?"
}

export default function Nav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemeMode>("dark")
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    setTheme(resolveCurrentTheme())
  }, [])

  useEffect(() => {
    if (pathname !== "/") return
    const sectionIds = ["benefits", "get-started"]
    const visible = new Map<string, boolean>()
    const observers: IntersectionObserver[] = []

    sectionIds.forEach((id) => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          visible.set(id, entry.isIntersecting)
          if (visible.get("get-started")) setActiveSection("get-started")
          else if (visible.get("benefits")) setActiveSection("benefits")
          else setActiveSection(null)
        },
        { threshold: 0.35 }
      )
      obs.observe(el)
      observers.push(obs)
    })

    return () => observers.forEach((obs) => obs.disconnect())
  }, [pathname])

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, sectionId: string | null) {
    if (pathname !== "/" || !sectionId) return
    e.preventDefault()
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" })
    setMenuOpen(false)
  }

  function isActive(item: typeof navItems[number]) {
    if (item.sectionId === null && item.href !== "/") return pathname === item.href
    if (pathname !== "/") return false
    if (item.sectionId === null) return activeSection === null
    return activeSection === item.sectionId
  }

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark"
    applyTheme(nextTheme)
    setTheme(nextTheme)
  }

  if (!marketingRoutes.has(pathname)) return null

  const initials = getAccountInitials(session?.user?.name, session?.user?.email)

  const isLight = theme === "light"
  const navShellStyle: React.CSSProperties = {
    borderBottom: `1px solid ${isLight ? "rgba(23,23,23,0.08)" : "rgba(240,237,230,0.08)"}`,
    background: isLight ? "rgba(247,247,242,0.82)" : "rgba(10,10,10,0.82)",
  }
  const panelStyle: React.CSSProperties = {
    border: `1px solid ${isLight ? "rgba(162,205,46,0.18)" : "rgba(200,245,90,0.14)"}`,
    background: isLight ? "rgba(255,255,255,0.92)" : "rgba(8,12,8,0.92)",
    boxShadow: "0 10px 40px rgba(0,0,0,0.22)",
  }
  const iconButtonStyle: React.CSSProperties = {
    border: `1px solid ${isLight ? "rgba(23,23,23,0.08)" : "rgba(240,237,230,0.1)"}`,
    background: isLight ? "rgba(23,23,23,0.03)" : "rgba(255,255,255,0.03)",
    color: isLight ? "#171717" : "#F0EDE6",
  }
  const dropdownStyle: React.CSSProperties = {
    border: `1px solid ${isLight ? "rgba(23,23,23,0.08)" : "rgba(240,237,230,0.1)"}`,
    background: isLight ? "#FFFFFF" : "#111311",
    boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
  }
  const mobilePanelStyle: React.CSSProperties = {
    border: `1px solid ${isLight ? "rgba(23,23,23,0.08)" : "rgba(240,237,230,0.08)"}`,
    background: isLight ? "#FFFFFF" : "#101110",
    boxShadow: "0 18px 50px rgba(0,0,0,0.32)",
  }
  const neutralText = isLight ? "rgba(23,23,23,0.72)" : "rgba(240,237,230,0.72)"
  const softerText = isLight ? "rgba(23,23,23,0.66)" : "rgba(240,237,230,0.66)"
  const logoEventColor = isLight ? "#171717" : "#F0EDE6"

  return (
    <nav className="sticky top-0 z-40 backdrop-blur-xl" style={navShellStyle}>
      <div className="marketing-shell px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 rounded-[18px] px-4 py-3 sm:px-5" style={panelStyle}>
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/assets/logo.png"
              alt="EventSlot logo"
              width={30}
              height={30}
              className="h-[30px] w-[30px]"
            />
            <span className="text-[1.08rem] font-semibold tracking-tight sm:text-[1.22rem]">
              <span style={{ color: logoEventColor }}>Event</span>
              <span className="text-[#C8F55A]">Slot</span>
            </span>
          </Link>

          <div className="hidden items-center gap-6 lg:flex">
            {navItems.map((item) => {
              const active = isActive(item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.sectionId)}
                  className="text-[0.88rem] font-medium transition-colors"
                  style={{ color: active ? "#C8F55A" : softerText }}
                >
                  {item.title}
                </Link>
              )
            })}
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full"
              style={iconButtonStyle}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {session ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-[0.9rem] font-medium transition-colors"
                  style={{ color: neutralText }}
                >
                  My dashboard
                </Link>
                <div ref={dropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((o) => !o)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(200,245,90,0.18)] bg-[rgba(200,245,90,0.12)] text-[0.78rem] font-semibold text-[#C8F55A]"
                  >
                    {initials}
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 top-[115%] min-w-[160px] rounded-[14px] p-2" style={dropdownStyle}>
                      {[
                        { label: "Profile", href: "/dashboard/profile" },
                        { label: "Billing", href: "/dashboard/billing" },
                      ].map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setDropdownOpen(false)}
                          className="block rounded-[10px] px-3 py-2 text-[0.85rem] transition-colors"
                          style={{ color: neutralText }}
                        >
                          {item.label}
                        </Link>
                      ))}
                      <div className="my-1 h-px" style={{ background: isLight ? "rgba(23,23,23,0.08)" : "rgba(240,237,230,0.08)" }} />
                      <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="w-full rounded-[10px] px-3 py-2 text-left text-[0.85rem] transition-colors"
                        style={{ color: neutralText }}
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Link href="/signup" className="marketing-button-primary h-11 px-5 py-0">
                Try It Now
              </Link>
            )}
          </div>

          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] lg:hidden"
            style={iconButtonStyle}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="mt-3 rounded-[18px] p-4 lg:hidden" style={mobilePanelStyle}>
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const active = isActive(item)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.sectionId)}
                    className="rounded-[12px] px-3 py-3 text-[0.94rem] font-medium transition-colors"
                    style={{
                      background: active ? "rgba(200,245,90,0.1)" : "transparent",
                      color: active ? "#C8F55A" : neutralText,
                    }}
                  >
                    {item.title}
                  </Link>
                )
              })}
            </div>

            <div className="mt-4 flex flex-col gap-3 pt-4" style={{ borderTop: `1px solid ${isLight ? "rgba(23,23,23,0.08)" : "rgba(240,237,230,0.08)"}` }}>
              <button
                type="button"
                onClick={toggleTheme}
                className="marketing-button-secondary w-full justify-center"
              >
                {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              </button>
              {session ? (
                <>
                  <Link href="/dashboard" className="marketing-button-primary w-full justify-center">
                    My dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="marketing-button-secondary w-full justify-center"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <Link href="/signup" className="marketing-button-primary w-full justify-center">
                  Try It Now
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
