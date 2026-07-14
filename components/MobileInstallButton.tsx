"use client"

import { useState } from "react"
import { usePWAInstall } from "@/hooks/usePWAInstall"

export function MobileInstallButton() {
  const { method, isMobile, promptInstall } = usePWAInstall()
  const [showIOSTip, setShowIOSTip] = useState(false)

  if (!isMobile) return null
  if (method === "already-installed") return null

  if (method === "android-manual") {
    return (
      <button
        onClick={() => window.alert("On Android, open your browser menu and tap Install app or Add to Home Screen to install the EventSlot PWA.")}
        aria-label="Install EventSlot app"
        style={{ maxHeight: "48px" }}
        className="inline-flex items-center gap-2 border border-[#2A2A2A]
                   text-white font-semibold px-4 py-2.5 rounded-full text-sm
                   hover:border-[#C8F55A]/50 transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v11" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        Install App
      </button>
    )
  }

  if (method === "pwa-prompt" && promptInstall) {
    return (
      <button
        onClick={promptInstall}
        aria-label="Install EventSlot app"
        style={{ maxHeight: "48px" }}
        className="inline-flex items-center gap-2 bg-[#C8F55A] text-black
                   font-bold px-4 py-2.5 rounded-full text-sm
                   hover:bg-[#b8e040] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Install App
      </button>
    )
  }

  if (method === "ios-manual") {
    return (
      <div className="relative inline-block">
        <button
          onClick={() => setShowIOSTip((v) => !v)}
          aria-label="Add EventSlot to home screen"
          style={{ maxHeight: "48px" }}
          className="inline-flex items-center gap-2 border border-[#2A2A2A]
                     text-white font-semibold px-4 py-2.5 rounded-full text-sm
                     hover:border-[#C8F55A]/50 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          Add to Home Screen
        </button>

        {showIOSTip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                          w-64 bg-[#141414] border border-[#2A2A2A] rounded-xl
                          p-3 shadow-xl z-50">
            <p className="text-white text-xs font-semibold mb-2">
              Install EventSlot on iPhone:
            </p>
            <ol className="space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-[#C8F55A] text-xs font-bold shrink-0 mt-0.5">1.</span>
                <span className="text-[#A3A3A3] text-xs leading-relaxed">
                  Tap the <strong className="text-white">Share</strong> button at the bottom of Safari
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#C8F55A] text-xs font-bold shrink-0 mt-0.5">2.</span>
                <span className="text-[#A3A3A3] text-xs leading-relaxed">
                  Scroll down and tap <strong className="text-white">&quot;Add to Home Screen&quot;</strong>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#C8F55A] text-xs font-bold shrink-0 mt-0.5">3.</span>
                <span className="text-[#A3A3A3] text-xs leading-relaxed">
                  Tap <strong className="text-white">&quot;Add&quot;</strong> in the top right
                </span>
              </li>
            </ol>
            <button
              onClick={() => setShowIOSTip(false)}
              className="absolute top-2 right-2 text-[#525252] hover:text-white text-xs"
              aria-label="Close"
            >
              x
            </button>
          </div>
        )}
      </div>
    )
  }

  return null
}
