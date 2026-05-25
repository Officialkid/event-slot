"use client"

import { useState } from "react"
import { Search, Zap } from "lucide-react"
import { DeepScan } from "@/components/scanner/DeepScan"
import { QuickScan } from "@/components/scanner/QuickScan"

type Mode = null | "quick" | "deep"

interface Props {
  eventSlug: string
  accessToken: string
  onVerified?: () => void
}

export function ScannerHome({ eventSlug, accessToken, onVerified }: Props) {
  const [mode, setMode] = useState<Mode>(null)

  if (mode === "quick") {
    return (
      <QuickScan
        eventSlug={eventSlug}
        accessToken={accessToken}
        onExit={() => setMode(null)}
        onVerified={onVerified}
      />
    )
  }

  if (mode === "deep") {
    return (
      <DeepScan
        eventSlug={eventSlug}
        accessToken={accessToken}
        onExit={() => setMode(null)}
        onVerified={onVerified}
      />
    )
  }

  return (
    <div className="min-h-[70vh] bg-[#0A0A0A] border border-[#2A2A2A] rounded-2xl flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl grid md:grid-cols-2 gap-4">
        <button
          onClick={() => setMode("quick")}
          className="w-full border border-[#2A2A2A] rounded-2xl p-5 bg-[#141414] text-left hover:border-[#C8F55A]/40 transition-colors group"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#C8F55A]/10 border border-[#C8F55A]/30 flex items-center justify-center shrink-0 group-hover:bg-[#C8F55A]/20 transition-colors">
              <Zap className="w-5 h-5 text-[#C8F55A]" />
            </div>
            <div>
              <p className="text-white font-semibold mb-1">Quick Scan</p>
              <p className="text-[#A3A3A3] text-sm leading-relaxed">
                Verify entry at speed. Camera, upload image, or manual ticket/email/name lookup.
              </p>
              <p className="text-[#C8F55A] text-xs mt-2">Best for entry gates and high volume</p>
            </div>
          </div>
        </button>

        <button
          onClick={() => setMode("deep")}
          className="w-full border border-[#2A2A2A] rounded-2xl p-5 bg-[#141414] text-left hover:border-[#3B82F6]/40 transition-colors group"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 border border-[#3B82F6]/30 flex items-center justify-center shrink-0 group-hover:bg-[#3B82F6]/20 transition-colors">
              <Search className="w-5 h-5 text-[#3B82F6]" />
            </div>
            <div>
              <p className="text-white font-semibold mb-1">Deep Scan</p>
              <p className="text-[#A3A3A3] text-sm leading-relaxed">
                Full attendee profile, previous notes, and mark-attended flow with scanner session export.
              </p>
              <p className="text-[#60A5FA] text-xs mt-2">Best for VIP check-in and workshops</p>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
