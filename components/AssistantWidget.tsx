"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function AssistantWidget() {
  const pathname = usePathname()
  const isDashboardRoute = pathname?.startsWith("/dashboard")
  const isAssistantRoute = pathname === "/dashboard/assistant" || pathname?.startsWith("/dashboard/assistant/")

  if (!isDashboardRoute || isAssistantRoute) {
    return null
  }

  return (
    <Link
      href="/dashboard/assistant"
      className="fixed bottom-28 right-6 z-50 h-14 w-14 rounded-full md:bottom-6
                 bg-[var(--accent)] text-[var(--accent-contrast,#FFFFFF)] shadow-xl hover:opacity-90
                 hover:scale-110 transition-all duration-200
                 flex items-center justify-center"
      style={{ textDecoration: "none" }}
      aria-label="Create Event with ASA"
      title="Create Event with ASA"
    >
      <span style={{ fontSize: "1.35rem" }}>✨</span>
    </Link>
  )
}
