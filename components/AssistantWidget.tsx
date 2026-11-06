"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { AssistantExperience } from "@/components/assistant/AssistantExperience"

export function AssistantWidget() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [memoryEnabled, setMemoryEnabled] = useState(false)
  const [memorySessionCount, setMemorySessionCount] = useState(0)
  const [memoryLastUpdated, setMemoryLastUpdated] = useState<string | null>(null)
  const [showMemorySettings, setShowMemorySettings] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setShowMemorySettings(false)
      return
    }

    let cancelled = false

    fetch("/api/user/memory")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.memoryEnabled === "boolean") {
          setMemoryEnabled(data.memoryEnabled)
          setMemorySessionCount(
            typeof data.sessionCount === "number" ? data.sessionCount : 0
          )
          setMemoryLastUpdated(
            typeof data.lastUpdated === "string" ? data.lastUpdated : null
          )
        }
      })
      .catch(() => {
        // Non-blocking: memory panel remains available with last known state.
      })

    return () => {
      cancelled = true
    }
  }, [isOpen])

  async function toggleMemory() {
    const newState = !memoryEnabled
    setMemoryEnabled(newState)

    try {
      const response = await fetch("/api/user/memory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newState }),
      })

      if (!response.ok) {
        setMemoryEnabled(!newState)
      }
    } catch {
      setMemoryEnabled(!newState)
    }
  }

  async function clearMemory() {
    if (!confirm("Clear all memory? The assistant will forget your past conversations.")) {
      return
    }

    try {
      const response = await fetch("/api/user/memory", { method: "DELETE" })
      if (response.ok) {
        setMemorySessionCount(0)
        setMemoryLastUpdated(null)
        alert("Memory cleared.")
      }
    } catch {
      // Best effort only.
    }
  }

  function renderMemoryPanel() {
    return (
      <div className="border-x border-b border-[#E2E8F0] dark:border-[#2A2A2A] bg-[#F8FAFC] dark:bg-[#0A0A0A] px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[#0F172A] dark:text-white text-xs font-semibold">Conversation Memory</p>
          <button
            onClick={() => {
              void toggleMemory()
            }}
            className={`relative w-10 h-5 rounded-full transition-colors ${memoryEnabled ? "bg-[#15803D]" : "bg-neutral-300 dark:bg-neutral-600"}`}
            aria-label="Toggle conversation memory"
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${memoryEnabled ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </div>
        <p className="text-[#64748B] dark:text-[#525252] text-xs mb-2">
          {memoryEnabled
            ? "The assistant remembers your past conversations."
            : "Memory is off. Each session starts fresh."}
        </p>
        <p className="text-[#64748B] dark:text-[#6E6E6E] text-[11px] mb-1">
          Sessions remembered: {memorySessionCount}
        </p>
        <p className="text-[#64748B] dark:text-[#6E6E6E] text-[11px] mb-2">
          Last updated: {memoryLastUpdated ? new Date(memoryLastUpdated).toLocaleString("en-KE") : "Never"}
        </p>
        {memoryEnabled && (
          <button
            onClick={() => {
              void clearMemory()
            }}
            className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors font-medium"
          >
            Clear memory
          </button>
        )}
      </div>
    )
  }

  const isDashboardRoute = pathname?.startsWith("/dashboard")
  const isAssistantRoute = pathname === "/dashboard/assistant" || pathname?.startsWith("/dashboard/assistant/")

  if (!isDashboardRoute || isAssistantRoute) {
    return null
  }

  return (
    <>
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="fixed bottom-36 right-4 sm:right-6 md:bottom-8 z-50 h-12 w-12 sm:h-14 sm:w-14 rounded-full
                   bg-[#15803D] text-white shadow-xl hover:bg-[#166534]
                   hover:scale-105 transition-all duration-200
                   flex items-center justify-center border border-white/20"
        aria-label="Toggle EventSlot Assistant"
      >
        {isOpen ? (
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l10 10M14 4L4 14" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-52 right-3 sm:right-6 md:bottom-24 z-50 w-[min(400px,calc(100vw-1.5rem))]">
          <div className="flex items-center justify-between px-3.5 py-2 bg-[#F8FAFC] dark:bg-[#0A0A0A] border border-[#E2E8F0] dark:border-[#2A2A2A] border-b-0 rounded-t-2xl shadow-sm">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
              <span className="text-xs font-semibold text-[#0F172A] dark:text-white">
                Event<span className="text-[#15803D] dark:text-[#C8F55A]">Slot</span> Assistant
              </span>
            </div>
            <button
              onClick={() => setShowMemorySettings((previous) => !previous)}
              className="text-xs text-[#64748B] hover:text-[#0F172A] dark:text-[#525252] dark:hover:text-[#A3A3A3] transition-colors p-1"
              title="Memory settings"
              aria-label="Memory settings"
            >
              ⚙️
            </button>
          </div>
          {showMemorySettings && renderMemoryPanel()}
          <AssistantExperience onClose={() => setIsOpen(false)} />
        </div>
      )}
    </>
  )
}
