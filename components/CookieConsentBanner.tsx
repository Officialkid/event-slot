"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

const COOKIE_CONSENT_KEY = "eventslot_cookie_consent"

export function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false)
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    setMounted(true)
    const existingConsent = localStorage.getItem(COOKIE_CONSENT_KEY)
    if (!existingConsent) {
      // Small timeout so it slides in smoothly after initial render
      const timer = setTimeout(() => setShowBanner(true), 800)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleConsent = (level: "all" | "essential") => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, level)
    } catch {
      // ignore in private browsing quotas
    }
    setShowBanner(false)
  }

  if (!mounted || !showBanner) return null

  return (
    <div
      role="region"
      aria-label="Cookie Preferences"
      className="fixed bottom-0 left-0 right-0 z-[9999] p-3 sm:p-4 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
    >
      <div className="max-w-4xl mx-auto bg-[#141414]/95 backdrop-blur-md border border-[#2A2A2A] rounded-2xl p-4 sm:p-5 shadow-2xl shadow-black/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5 select-none" role="img" aria-label="cookie">
            🍪
          </span>
          <div className="text-sm text-[#D4D4D4] leading-relaxed">
            <p className="font-medium text-white mb-1">We value your privacy</p>
            <p className="text-xs sm:text-sm text-[#A3A3A3]">
              We use essential cookies to maintain your login session and secure EventSlot. With your permission, we also use cookies to improve your experience. Learn more in our{" "}
              <Link
                href="/cookies"
                className="text-[#C8F55A] underline hover:text-[#b0de43] font-medium"
              >
                Cookie Policy
              </Link>
              .
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center shrink-0 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleConsent("essential")}
            className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border border-[#333] text-[#A3A3A3] hover:text-white hover:border-[#555] bg-transparent transition-all cursor-pointer"
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={() => handleConsent("all")}
            className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-[#C8F55A] text-[#0A0A0A] hover:bg-[#b5e648] transition-all shadow-md shadow-[#C8F55A]/20 cursor-pointer"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  )
}
