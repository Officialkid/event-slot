"use client"

import { useEffect, useState } from "react"
import { AssistantExperience } from "@/components/assistant/AssistantExperience"

export function AssistantWidget() {
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
      <div className="border-b border-[#2A2A2A] bg-[#0A0A0A] px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-white text-xs font-medium">Conversation Memory</p>
          <button
            onClick={() => {
              void toggleMemory()
            }}
            className={`relative w-10 h-5 rounded-full transition-colors ${memoryEnabled ? "bg-[#C8F55A]" : "bg-[#2A2A2A]"}`}
            aria-label="Toggle conversation memory"
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-black transition-transform ${memoryEnabled ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </div>
        <p className="text-[#525252] text-xs mb-2">
          {memoryEnabled
            ? "The assistant remembers your past conversations."
            : "Memory is off. Each session starts fresh."}
        </p>
        <p className="text-[#6E6E6E] text-[11px] mb-2">
          Sessions remembered: {memorySessionCount}
        </p>
        <p className="text-[#6E6E6E] text-[11px] mb-2">
          Last updated: {memoryLastUpdated ? new Date(memoryLastUpdated).toLocaleString("en-KE") : "Never"}
        </p>
        {memoryEnabled && (
          <button
            onClick={() => {
              void clearMemory()
            }}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Clear memory
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setIsOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full
                   bg-[#C8F55A] text-black shadow-xl hover:bg-[#b8e040]
                   hover:scale-110 transition-all duration-200
                   flex items-center justify-center"
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
        <div className="fixed bottom-24 right-4 sm:right-6 z-50 w-[min(384px,calc(100vw-2rem))]">
          <div className="flex items-center justify-end px-2 py-1 bg-[#0A0A0A] border border-[#2A2A2A] border-b-0 rounded-t-2xl">
            <button
              onClick={() => setShowMemorySettings((previous) => !previous)}
              className="text-xs text-[#525252] hover:text-[#A3A3A3] transition-colors"
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
