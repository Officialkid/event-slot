"use client"

import { useState, useEffect } from "react"
import { ShieldCheck, Sparkles, Clock, Coins, Mail } from "lucide-react"
import { COIN_RATE_USD } from "@/lib/coins"
import { formatLocalAmount } from "@/lib/currency"
import { useUserCountry } from "@/hooks/useUserCountry"

export default function TokensPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const { currency } = useUserCountry()
  const [rate, setRate] = useState<number>(1)

  useEffect(() => {
    fetch("/api/user/tokens")
      .then((r) => r.json())
      .then((d: { balance?: number }) => setBalance(d.balance ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (currency.code === "USD") {
      setRate(1)
      return
    }
    fetch(`/api/exchange-rate/${currency.code}`)
      .then((r) => r.json())
      .then((d: { rate?: number }) => {
        if (d.rate) setRate(d.rate)
      })
      .catch(() => {})
  }, [currency.code])

  const balanceUsd = (balance ?? 0) * COIN_RATE_USD

  return (
    <div
      className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 text-white"
      style={{ backgroundColor: "var(--bg-page, #0A0A0A)" }}
    >
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center sm:text-left space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-[#C8F55A]/10 text-[#C8F55A] border border-[#C8F55A]/25">
            <Coins className="w-3.5 h-3.5" />
            <span>EventSlot Token Engine</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Payments & <span className="text-[#C8F55A]">Token Subscriptions</span>
          </h1>
          <p className="text-sm sm:text-base text-zinc-400">
            1 token = <span className="text-white font-semibold">${COIN_RATE_USD.toFixed(3)} USD</span> · Tokens never expire
          </p>
        </div>

        {/* Current Balance Card */}
        <div
          className="rounded-2xl border p-6 sm:p-7 shadow-xl transition-all"
          style={{
            backgroundColor: "var(--surface, #141414)",
            borderColor: "var(--border, rgba(255, 255, 255, 0.1))",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 block mb-1">
                Your Current Balance
              </span>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
                  {balance !== null ? balance : "—"}
                </span>
                <span className="text-zinc-400 font-medium text-lg">tokens</span>
              </div>
              <p className="text-xs text-zinc-400 mt-2">
                ≈ ${balanceUsd.toFixed(3)} USD
                {currency.code !== "USD" && ` · ≈ ${formatLocalAmount(balanceUsd, rate, currency.code)}`}
              </p>
            </div>

            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-300">
              <Clock className="w-4 h-4 text-[#C8F55A] shrink-0" />
              <span>Lifetime validity (no expiration)</span>
            </div>
          </div>
        </div>

        {/* Payment & Subscription Redefinition Notice */}
        <div
          className="rounded-2xl border p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden"
          style={{
            backgroundColor: "var(--surface, #141414)",
            borderColor: "var(--border, rgba(255, 255, 255, 0.1))",
          }}
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#C8F55A]/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#C8F55A]/10 border border-[#C8F55A]/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-[#C8F55A]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-1">
                Payments & Subscriptions Redefinition
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                We are transitioning our payment architecture to a unified multi-currency checkout engine.
                Individual token packages and direct top-ups are temporarily paused while our updated payment gateway is finalized.
              </p>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3.5 pt-2">
            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8F55A]">
                <ShieldCheck className="w-4 h-4" />
                <span>Transparent Economy</span>
              </div>
              <p className="text-xs text-zinc-400">
                1 token = $0.005 USD. Predictable pricing with no hidden charges.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8F55A]">
                <Clock className="w-4 h-4" />
                <span>Never Expire</span>
              </div>
              <p className="text-xs text-zinc-400">
                Your acquired tokens remain in your account indefinitely until used.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8F55A]">
                <Sparkles className="w-4 h-4" />
                <span>Complimentary Quota</span>
              </div>
              <p className="text-xs text-zinc-400">
                Monthly free AI voice transcriptions and core organizer tools remain active at zero cost.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#C8F55A]">
                <Coins className="w-4 h-4" />
                <span>Super Admin Access</span>
              </div>
              <p className="text-xs text-zinc-400">
                Administrators enjoy unconstrained access to all document and AI features.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-400">
            <span>Payment checkout will re-open automatically upon rollout.</span>
            <a
              href="mailto:info@eventsslot.com"
              className="inline-flex items-center gap-1.5 text-[#C8F55A] hover:underline font-semibold"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Contact Support: info@eventsslot.com</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
