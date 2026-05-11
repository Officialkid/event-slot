"use client"
import { useState, useEffect } from "react"

const PAYMENTS_ENABLED = process.env.NEXT_PUBLIC_PAYMENTS_ENABLED === "true"

const FEATURE_COSTS = [
  { feature: "Document / Report Generation", tokens: 20, ksh: 100, note: "Per document" },
  { feature: "Voice Transcription (monthly free)", tokens: 0, ksh: 0, note: "5 free per month" },
  { feature: "Voice Transcription (after free quota)", tokens: 10, ksh: 50, note: "Per transcription" },
]

export default function TokensPage() {
  const [balance, setBalance] = useState<number | null>(null)
  const [amount, setAmount]   = useState(20)  // number of tokens to buy

  useEffect(() => {
    fetch("/api/user/tokens")
      .then(r => r.json())
      .then(d => setBalance(d.balance))
      .catch(() => {})
  }, [])

  const kshCost = amount * 5

  async function handlePurchase() {
    if (!PAYMENTS_ENABLED) return
    // Paystack checkout initialisation goes here when live
    // Will call /api/tokens/initiate with { amount, userId }
    alert("Redirecting to payment...")
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
