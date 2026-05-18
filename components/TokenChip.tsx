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
      <span aria-hidden="true">🪙</span>
      <span>{balance} {balance === 1 ? "token" : "tokens"}</span>
    </Link>
  )
}
