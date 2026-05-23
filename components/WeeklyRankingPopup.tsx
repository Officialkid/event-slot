"use client"

import { useEffect, useState } from "react"
import { APP_URL } from "@/lib/config"

interface RankingData {
  rank: number
  totalPts: number
  weekKey: string
}

function ShareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export function WeeklyRankingPopup() {
  const [data, setData] = useState<RankingData | null>(null)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    // Pioneer modal takes priority — only show if pioneer congratulations is not pending
    fetch("/api/user/pioneer-status")
      .then((r) => r.json())
      .then((pioneer: { showCongratulations?: boolean }) => {
        if (pioneer.showCongratulations) return null
        return fetch("/api/user/weekly-ranking").then((r) => r.json())
      })
      .then((d: { show?: boolean; rank?: number; totalPts?: number; weekKey?: string } | null) => {
        if (d?.show && d.rank !== undefined && d.totalPts !== undefined && d.weekKey) {
          setData({ rank: d.rank, totalPts: d.totalPts, weekKey: d.weekKey })
        }
      })
      .catch(() => {})
  }, [])

  async function dismiss(shared = false) {
    if (!data) return
    setClosing(true)
    try {
      await fetch("/api/user/weekly-ranking/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekKey: data.weekKey, shared }),
      })
    } finally {
      window.setTimeout(() => setData(null), 300)
    }
  }

  async function share() {
    if (!data) return
    const { rank } = data
    const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏅"
    const message =
      rank <= 3
        ? `${medal} I emerged #${rank} this week on EventSlot! Think you can beat me? Try it → ${APP_URL}/signup`
        : `🏅 I ranked #${rank} on EventSlot this week — competing with the best event organisers around. Join me → ${APP_URL}/signup`
    try {
      if (navigator.share) {
        await navigator.share({ text: message })
      } else {
        await navigator.clipboard.writeText(message)
      }
    } catch {
      // user cancelled or clipboard unavailable
    }
    await dismiss(true)
  }

  if (!data) return null

  const { rank, totalPts } = data
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "🏆"
  const rankClr =
    rank === 1
      ? "text-[#FFD700]"
      : rank === 2
      ? "text-[#C0C0C0]"
      : rank === 3
      ? "text-[#CD7F32]"
      : "text-[#C8F55A]"

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4
                  bg-black/70 backdrop-blur-sm transition-opacity duration-300
                  ${closing ? "opacity-0" : "opacity-100"}`}
    >
      <div
        className={`relative w-full max-w-sm bg-[#141414] border border-[#2A2A2A]
                    rounded-2xl p-7 text-center transition-transform duration-300
                    ${closing ? "scale-95" : "scale-100"}`}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => void dismiss(false)}
          className="absolute top-4 right-4 text-[#525252] hover:text-white transition-colors"
        >
          <XIcon />
        </button>

        {/* Medal */}
        <div
          className="w-20 h-20 rounded-full bg-[#C8F55A]/10 border-2 border-[#C8F55A]/30
                      flex items-center justify-center mx-auto mb-4"
        >
          <span className="text-4xl">{medal}</span>
        </div>

        <p className="text-[#A3A3A3] text-xs uppercase tracking-widest mb-1">
          Last Week&apos;s Results
        </p>
        <h2 className="text-white font-bold text-2xl mb-1">Congratulations!</h2>
        <p className="text-[#A3A3A3] text-sm mb-2">You were ranked</p>
        <p className={`font-bold text-5xl mb-1 ${rankClr}`}>#{rank}</p>
        <p className="text-[#525252] text-sm mb-6">with {totalPts} points on EventSlot</p>

        {/* Share message preview */}
        <div className="bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl p-3 mb-5 text-left">
          <p className="text-[#A3A3A3] text-xs leading-relaxed">
            {rank <= 3
              ? `${medal} I emerged #${rank} this week on EventSlot! Think you can beat me? →`
              : `🏅 I ranked #${rank} on EventSlot this week. Join me →`}
            <span className="text-[#C8F55A]"> eventsslot.com</span>
          </p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => void share()}
            className="w-full bg-[#C8F55A] text-black font-bold py-3 rounded-xl
                       flex items-center justify-center gap-2
                       hover:bg-[#b8e040] transition-colors"
          >
            <ShareIcon /> Share My Ranking
          </button>
          <button
            type="button"
            onClick={() => void dismiss(false)}
            className="w-full text-[#525252] text-sm py-2 hover:text-[#A3A3A3] transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  )
}
