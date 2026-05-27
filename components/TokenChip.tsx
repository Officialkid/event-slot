"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type TokenResponse = {
  balance?: number
}

export function TokenChip() {
  const [balance, setBalance] = useState<number | null>(null)

  useEffect(() => {
    fetch("/api/user/tokens")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TokenResponse | null) => {
        if (data && typeof data.balance === "number") {
          setBalance(data.balance)
        }
      })
      .catch(() => {})
  }, [])

  if (!balance || balance <= 0) return null

  return (
    <Link
      href="/tokens"
      className="flex items-center gap-1.5 bg-[#C8F55A]/10 border border-[#C8F55A]/30 text-[#C8F55A] text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-[#C8F55A]/20 transition-colors"
      title="Your token balance - click to buy more"
    >
      <span aria-hidden="true" style={{ color: "#F5C542", display: "inline-flex", alignItems: "center" }}>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" fill="currentColor" />
          <circle cx="8" cy="8" r="5" stroke="rgba(0,0,0,0.25)" strokeWidth="1" />
          <path d="M8 5.2v5.6M5.8 8h4.4" stroke="rgba(0,0,0,0.35)" strokeWidth="1" strokeLinecap="round" />
        </svg>
      </span>
      <span>{balance} {balance === 1 ? "token" : "tokens"}</span>
    </Link>
  )
}
