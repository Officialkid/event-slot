"use client"

import Link from "next/link"

export default function PublicEventTopBar() {
  return (
    <header
      className="mb-5 sm:mb-6 flex items-center justify-between gap-2 sm:gap-4 rounded-2xl border px-3 py-2 sm:px-5 sm:py-3 transition-all"
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in srgb, var(--surface) 85%, transparent)",
        backdropFilter: "blur(12px)",
      }}
    >
      <Link
        href="/"
        className="text-[1.3rem] sm:text-[1.55rem] leading-none no-underline transition hover:opacity-85 shrink-0"
        style={{ color: "var(--text-primary)", fontFamily: "var(--font-instrument-serif)" }}
      >
        Event<span className="text-[#C8F55A]">Slot</span>
      </Link>

      <nav className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <Link
          href="/events"
          className="inline-flex items-center justify-center rounded-full border px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-[0.74rem] sm:text-[0.82rem] font-medium transition hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] no-underline whitespace-nowrap"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          <span className="hidden sm:inline">Discover Events</span>
          <span className="sm:hidden">Discover</span>
        </Link>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-full bg-[#C8F55A] px-3 py-1.5 sm:px-4 sm:py-2 text-[0.74rem] sm:text-[0.82rem] font-bold text-[#0A0A0A] no-underline transition hover:bg-[#bbf045] active:scale-[0.98] whitespace-nowrap"
        >
          <span className="hidden sm:inline">Try it out</span>
          <span className="sm:hidden">Host Event</span>
        </Link>
      </nav>
    </header>
  )
}
