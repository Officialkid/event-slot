"use client"

import Link from "next/link"

export default function PublicEventTopBar() {
  return (
    <div
      className="mb-5 flex items-center justify-between gap-3 rounded-[18px] border px-4 py-3 sm:px-5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <Link
        href="/"
        className="text-[1.55rem] leading-none no-underline"
        style={{ color: "var(--text-primary)", fontFamily: "var(--font-instrument-serif)" }}
      >
        Event<span className="text-[#C8F55A]">Slot</span>
      </Link>

      <Link
        href="/signup"
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-[rgba(200,245,90,0.28)] bg-[#C8F55A] px-4 py-2 text-[0.82rem] font-semibold text-[#0A0A0A] no-underline transition-transform duration-200 hover:scale-[1.02]"
      >
        Try it out
      </Link>
    </div>
  )
}
