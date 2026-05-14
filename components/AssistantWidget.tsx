"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"

export function AssistantWidget() {
  const { status } = useSession()

  // Only show for signed-in users
  if (status !== "authenticated") return null

  return (
    <Link
      href="/dashboard/assistant"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full
                 bg-[#C8F55A] text-black shadow-xl hover:bg-[#b8e040]
                 hover:scale-110 transition-all duration-200 flex
                 items-center justify-center"
      aria-label="Open EventSlot Assistant"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    </Link>
  )
}
