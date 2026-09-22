"use client"

import Link from "next/link"

export default function PublicEventTopBar() {
  return (
    <header
      className="mb-6 flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 sm:px-5 sm:py-3 transition-all"
      style={{
        borderColor: "var(--border)",
        background: "color-mix(in srgb, var(--surface) 85%, transparent)",
        backdropFilter: "blur(12px)",
      }}
    >
      <Link
        href="/"
        className="text-[1.35rem] sm:text-[1.55rem] leading-none no-underline transition hover:opacity-85"
        style={{ color: "var(--text-primary)", fontFamily: "var(--font-instrument-serif)" }}
      >
        Event<span className="text-[#C8F55A]">Slot</span>
      </Link>

      <nav className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/events"
          className="inline-flex items-center justify-center rounded-full border px-3 py-1.5 sm:px-3.5 sm:py-2 text-[0.78rem] sm:text-[0.82rem] font-medium transition hover:bg-[color-mix(in_srgb,var(--text-primary)_6%,transparent)] no-underline"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          Discover Events
        </Link>
        <Link
          href="/signup"
          className="inline-flex items-center justify-center rounded-full bg-[#C8F55A] px-3.5 py-1.5 sm:px-4 sm:py-2 text-[0.78rem] sm:text-[0.82rem] font-bold text-[#0A0A0A] no-underline transition hover:bg-[#bbf045] active:scale-[0.98]"
        >
          Try it out
        </Link>
      </nav>
    </header>
  )
}
