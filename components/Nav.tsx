"use client"

import Image from "next/image"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useEffect, useRef, useState } from "react"

const navItems = [
  { title: "Home", href: "/", sectionId: null },
  { title: "Pricing", href: "/pricing", sectionId: null },
  { title: "Universities", href: "/for-universities", sectionId: null },
  { title: "Benefits", href: "/#benefits", sectionId: "benefits" },
]

const marketingRoutes = new Set([
  "/",
  "/pricing",
  "/for-universities",
  "/how-it-works",
  "/waitlist-system",
  "/privacy",
  "/terms",
  "/signin",
  "/signup",
])

export default function Nav() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)
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
    if (pathname !== "/") return
    const sectionIds = ["benefits", "get-started"]
    const visible = new Map<string, boolean>()
    const observers: IntersectionObserver[] = []

    sectionIds.forEach(id => {
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

    return () => observers.forEach(obs => obs.disconnect())
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

  if (!marketingRoutes.has(pathname)) return null

  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase()
    : session?.user?.email?.[0]?.toUpperCase() ?? "?"

  return (
    <nav className="sticky top-0 z-40 border-b border-[rgba(240,237,230,0.08)] bg-[rgba(10,10,10,0.82)] backdrop-blur-xl">
      <div className="marketing-shell px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 rounded-[18px] border border-[rgba(200,245,90,0.14)] bg-[rgba(8,12,8,0.92)] px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.22)] sm:px-5">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/assets/logo.png"
              alt="EventSlot logo"
              width={30}
              height={30}
              className="h-[30px] w-[30px]"
            />
            <span className="text-[1.08rem] font-semibold tracking-tight sm:text-[1.22rem]">
              <span className="text-[#F0EDE6]">Event</span>
              <span className="text-[#C8F55A]">Slot</span>
            </span>
          </Link>

          <div className="hidden items-center gap-6 lg:flex">
            {navItems.map(item => {
              const active = isActive(item)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.sectionId)}
                  className={`text-[0.88rem] font-medium transition-colors ${
                    active ? "text-[#C8F55A]" : "text-[rgba(240,237,230,0.66)] hover:text-white"
                  }`}
                >
                  {item.title}
                </Link>
              )
            })}
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            {session ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-[0.9rem] font-medium text-[rgba(240,237,230,0.72)] transition-colors hover:text-white"
                >
                  My dashboard
                </Link>
                <div ref={dropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(o => !o)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(200,245,90,0.18)] bg-[rgba(200,245,90,0.12)] text-[0.78rem] font-semibold text-[#C8F55A]"
                  >
                    {initials}
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 top-[115%] min-w-[160px] rounded-[14px] border border-[rgba(240,237,230,0.1)] bg-[#111311] p-2 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
                      {[
                        { label: "Profile", href: "/dashboard/profile" },
                        { label: "Billing", href: "/dashboard/billing" },
                      ].map(item => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setDropdownOpen(false)}
                          className="block rounded-[10px] px-3 py-2 text-[0.85rem] text-[rgba(240,237,230,0.72)] transition-colors hover:bg-[rgba(240,237,230,0.05)] hover:text-white"
                        >
                          {item.label}
                        </Link>
                      ))}
                      <div className="my-1 h-px bg-[rgba(240,237,230,0.08)]" />
                      <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="w-full rounded-[10px] px-3 py-2 text-left text-[0.85rem] text-[rgba(240,237,230,0.72)] transition-colors hover:bg-[rgba(240,237,230,0.05)] hover:text-white"
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
            onClick={() => setMenuOpen(open => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-[12px] border border-[rgba(240,237,230,0.1)] bg-[rgba(255,255,255,0.03)] text-[#F0EDE6] lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="mt-3 rounded-[18px] border border-[rgba(240,237,230,0.08)] bg-[#101110] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.32)] lg:hidden">
            <div className="flex flex-col gap-1">
              {navItems.map(item => {
                const active = isActive(item)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={(e) => handleNavClick(e, item.sectionId)}
                    className={`rounded-[12px] px-3 py-3 text-[0.94rem] font-medium transition-colors ${
                      active
                        ? "bg-[rgba(200,245,90,0.1)] text-[#C8F55A]"
                        : "text-[rgba(240,237,230,0.72)] hover:bg-[rgba(255,255,255,0.03)] hover:text-white"
                    }`}
                  >
                    {item.title}
                  </Link>
                )
              })}
            </div>

            <div className="mt-4 flex flex-col gap-3 border-t border-[rgba(240,237,230,0.08)] pt-4">
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
