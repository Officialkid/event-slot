"use client"
import { useState, useEffect } from "react"
import { COIN_PACKAGES, COIN_RATE_USD } from "@/lib/coins"
import { formatLocalAmount } from "@/lib/currency"
import { useUserCountry } from "@/hooks/useUserCountry"

const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true"

const FEATURE_COSTS = [
  { feature: "Document / Report Generation", coins: 20, usd: 1.00, note: "Per document" },
  { feature: "Voice Transcription (monthly free)", coins: 0, usd: 0, note: "5 free per month" },
  { feature: "Voice Transcription (after free quota)", coins: 10, usd: 0.50, note: "Per transcription" },
]

export default function TokensPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const { currency } = useUserCountry()
  const [rate, setRate] = useState<number>(1)

  useEffect(() => {
    fetch("/api/user/tokens")
      .then(r => r.json())
      .then((d: { balance?: number }) => setBalance(d.balance ?? 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (currency.code === "USD") { setRate(1); return }
    fetch(`/api/exchange-rate/${currency.code}`)
      .then(r => r.json())
      .then((d: { rate?: number }) => { if (d.rate) setRate(d.rate) })
      .catch(() => {})
  }, [currency.code])

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">
        Event<span className="text-[#C8F55A]">Slot</span> Tokens
      </h1>
      <p className="text-[#A3A3A3] mb-2">
        1 token = ${COIN_RATE_USD.toFixed(2)} USD · Tokens never expire
      </p>

      {/* Current balance */}
      {balance !== null && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 mb-8
                        flex items-center justify-between">
          <div>
            <p className="text-[#525252] text-xs uppercase tracking-wider mb-1">Your Balance</p>
            <p className="text-white text-2xl font-bold">
              {balance}
              <span className="text-[#A3A3A3] text-sm font-normal ml-2">tokens</span>
            </p>
            <p className="text-[#525252] text-xs">
              ≈ ${(balance * COIN_RATE_USD).toFixed(2)} USD
              {currency.code !== "USD" && ` · ≈ ${formatLocalAmount(balance * COIN_RATE_USD, rate, currency.code)}`}
            </p>
          </div>
        </div>
      )}

      {/* Coming soon banner */}
      {!PAYMENTS_ENABLED && (
        <div className="bg-[#C8F55A]/10 border border-[#C8F55A]/30 rounded-xl
                        p-4 mb-8 flex gap-3 items-start">
          <span className="text-2xl">🔔</span>
          <div>
            <p className="text-[#C8F55A] font-semibold text-sm">Coming Very Soon</p>
            <p className="text-[#A3A3A3] text-sm mt-1">
              We&apos;re finalising our payment system. Token top-ups will be
              available shortly. Your 5 free monthly voice messages are
              available now at no cost.
            </p>
          </div>
        </div>
      )}

      {/* Coin packages */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold">Buy Tokens</h2>
          <span className="text-xs text-[#525252]">
            Billed in USD
            {currency.code !== "USD" && ` · shown in ${currency.name}`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {COIN_PACKAGES.map(pkg => (
            <div
              key={pkg.id}
              className={`relative border rounded-xl p-4 bg-[#141414] transition-all
                ${pkg.popular
                  ? "border-[#C8F55A]/40 hover:border-[#C8F55A]/70"
                  : "border-[#2A2A2A] hover:border-[#C8F55A]/40"
                }`}
            >
              {pkg.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2
                                 text-xs bg-[#C8F55A] text-black font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                  Popular
                </span>
              )}
              <p className="text-[#C8F55A] font-bold text-xl">{pkg.coins}</p>
              <p className="text-[#525252] text-xs mb-3">tokens</p>
              <p className="text-white font-bold">${pkg.usd.toFixed(2)}</p>
              {currency.code !== "USD" && (
                <p className="text-[#525252] text-xs">
                  ≈ {formatLocalAmount(pkg.usd, rate, currency.code)}
                </p>
              )}
              <button
                disabled={!PAYMENTS_ENABLED}
                className="mt-3 w-full bg-[#C8F55A] text-black text-sm font-bold
                           py-2 rounded-lg hover:bg-[#b8e040] transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {PAYMENTS_ENABLED ? "Buy" : "Soon"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Feature costs reference */}
      <h2 className="text-white font-semibold mb-4">What Tokens Get You</h2>
      <div className="border border-[#2A2A2A] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0A0A0A] border-b border-[#2A2A2A]">
              <th className="text-left px-4 py-3 text-[#525252] font-medium">Feature</th>
              <th className="text-right px-4 py-3 text-[#525252] font-medium">Tokens</th>
              <th className="text-right px-4 py-3 text-[#525252] font-medium">USD</th>
              {currency.code !== "USD" && (
                <th className="text-right px-4 py-3 text-[#525252] font-medium">{currency.symbol}</th>
              )}
            </tr>
          </thead>
          <tbody>
            {FEATURE_COSTS.map((item, i) => (
              <tr
                key={i}
                className={`border-b border-[#2A2A2A] last:border-0
                           ${i % 2 === 0 ? "bg-[#141414]" : "bg-[#0A0A0A]"}`}
              >
                <td className="px-4 py-3">
                  <p className="text-white">{item.feature}</p>
                  <p className="text-[#525252] text-xs">{item.note}</p>
                </td>
                <td className="px-4 py-3 text-right font-bold text-[#C8F55A]">
                  {item.coins === 0 ? "Free" : `${item.coins}`}
                </td>
                <td className="px-4 py-3 text-right text-[#A3A3A3]">
                  {item.usd === 0 ? "—" : `$${item.usd.toFixed(2)}`}
                </td>
                {currency.code !== "USD" && (
                  <td className="px-4 py-3 text-right text-[#525252] text-xs">
                    {item.usd === 0 ? "—" : formatLocalAmount(item.usd, rate, currency.code)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[#525252] text-xs mt-6 text-center">
        Super admins have unlimited access to all features at no cost.
        Tokens are non-refundable once used.
        For support: info@eventsslot.com
      </p>
    </div>
  )
}

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold text-white mb-2">
        Event<span className="text-[#C8F55A]">Slot</span> Tokens
      </h1>
      <p className="text-[#A3A3A3] mb-2">
        1 token = KSh 5 · Minimum purchase: 10 tokens · Tokens never expire
      </p>

      {/* Current balance */}
      {balance !== null && (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-xl p-4 mb-8
                        flex items-center justify-between">
          <div>
            <p className="text-[#525252] text-xs uppercase tracking-wider mb-1">
              Your Balance
            </p>
            <p className="text-white text-2xl font-bold">
              {balance}
              <span className="text-[#A3A3A3] text-sm font-normal ml-2">tokens</span>
            </p>
            <p className="text-[#525252] text-xs">≈ KSh {balance * 5} value</p>
          </div>
        </div>
      )}

      {/* Coming soon banner */}
      {!PAYMENTS_ENABLED && (
        <div className="bg-[#C8F55A]/10 border border-[#C8F55A]/30 rounded-xl
                        p-4 mb-8 flex gap-3 items-start">
          <span className="text-2xl">🔔</span>
          <div>
            <p className="text-[#C8F55A] font-semibold text-sm">Coming Very Soon</p>
            <p className="text-[#A3A3A3] text-sm mt-1">
              We&apos;re finalising our payment system. Token top-ups will be
              available shortly. Your 5 free monthly voice messages are
              available now at no cost.
            </p>
          </div>
        </div>
      )}

      {/* Top-up calculator */}
      <div className="border border-[#2A2A2A] rounded-xl p-6 mb-8 bg-[#141414]">
        <h2 className="text-white font-semibold mb-4">Top Up Tokens</h2>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <label className="text-[#525252] text-xs mb-2 block">
              How many tokens?
            </label>
            <input
              type="number"
              min={10}
              step={10}
              value={amount}
              onChange={e => setAmount(Math.max(10, parseInt(e.target.value) || 10))}
              disabled={!PAYMENTS_ENABLED}
              className="w-full bg-[#0A0A0A] border border-[#2A2A2A] rounded-lg
                         px-4 py-2.5 text-white text-lg font-bold
                         focus:outline-none focus:border-[#C8F55A]
                         disabled:opacity-50"
            />
            <p className="text-[#525252] text-xs mt-1">Minimum 10 tokens</p>
          </div>
          <div className="text-center">
            <p className="text-[#525252] text-xs mb-2">You pay</p>
            <p className="text-[#C8F55A] text-2xl font-bold">KSh {kshCost}</p>
          </div>
        </div>

        {/* Quick select amounts */}
        <div className="flex gap-2 mb-4">
          {[10, 20, 50, 100, 200].map(n => (
            <button
              key={n}
              onClick={() => setAmount(n)}
              disabled={!PAYMENTS_ENABLED}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors
                         disabled:opacity-40
                         ${amount === n
                           ? "bg-[#C8F55A] text-black border-[#C8F55A]"
                           : "border-[#2A2A2A] text-[#A3A3A3] hover:border-[#C8F55A]"
                         }`}
            >
              {n}
            </button>
          ))}
        </div>

        <button
          onClick={handlePurchase}
          disabled={!PAYMENTS_ENABLED}
          className="w-full py-3 rounded-xl font-bold text-sm transition-colors
                     bg-[#C8F55A] text-black hover:bg-[#b8e040]
                     disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {PAYMENTS_ENABLED
            ? `Buy ${amount} tokens for KSh ${kshCost}`
            : "Payments Coming Soon"}
        </button>
      </div>

      {/* Feature costs reference */}
      <h2 className="text-white font-semibold mb-4">What Tokens Get You</h2>
      <div className="border border-[#2A2A2A] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#0A0A0A] border-b border-[#2A2A2A]">
              <th className="text-left px-4 py-3 text-[#525252] font-medium">Feature</th>
              <th className="text-right px-4 py-3 text-[#525252] font-medium">Cost</th>
              <th className="text-right px-4 py-3 text-[#525252] font-medium">KSh</th>
            </tr>
          </thead>
          <tbody>
            {FEATURE_COSTS.map((item, i) => (
              <tr
                key={i}
                className={`border-b border-[#2A2A2A] last:border-0
                           ${i % 2 === 0 ? "bg-[#141414]" : "bg-[#0A0A0A]"}`}
              >
                <td className="px-4 py-3">
                  <p className="text-white">{item.feature}</p>
                  <p className="text-[#525252] text-xs">{item.note}</p>
                </td>
                <td className="px-4 py-3 text-right font-bold text-[#C8F55A]">
                  {item.tokens === 0 ? "Free" : `${item.tokens} tokens`}
                </td>
                <td className="px-4 py-3 text-right text-[#A3A3A3]">
                  {item.ksh === 0 ? "—" : `KSh ${item.ksh}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[#525252] text-xs mt-6 text-center">
        Super admins have unlimited access to all features at no cost.
        Tokens are non-refundable once used.
        For support: info@eventsslot.com
      </p>
    </div>
  )
}
