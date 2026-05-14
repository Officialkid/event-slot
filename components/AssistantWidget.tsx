"use client"

import { useState } from "react"
import { AssistantExperience } from "@/components/assistant/AssistantExperience"

export function AssistantWidget() {
  const [isOpen, setIsOpen] = useState(false)

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
        <div className="fixed bottom-24 right-4 sm:right-6 z-50">
          <AssistantExperience onClose={() => setIsOpen(false)} />
        </div>
      )}
    </>
  )
}
