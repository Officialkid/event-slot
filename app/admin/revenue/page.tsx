"use client"
import { useState, useEffect } from "react"

type RevenueData = {
  // Existing credit revenue
  totalCreditsPurchased: number
  totalCreditsSpent: number
  creditRevenueTotal: number
  estimatedMRR: number
  creditsByMonth: { month: string; revenue: number }[]
  // Token economy
  totalRevenueKsh: number
  thisMonthKsh: number
  lastMonthKsh: number
  revenueChangePercent: string
  totalTokensPurchased: number
  totalTokensSpent: number
  totalTokensHeld: number
  tokensOnDocuments: number
  tokensOnVoice: number
  uniqueBuyerCount: number
  monthlyPurchases: { month: string; tokens: number; ksh: number }[]
}

function StatCard({
  label, value, sub, accent = false,
}: {
  label: string; value: string; sub?: string; accent?: boolean
}) {
  return (
    <div className="border border-[var(--border)] rounded-xl p-5 bg-[var(--surface)]">
      <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">{label}</p>
      <p className={`text-3xl font-bold mb-1 ${accent ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>
        {value}
      </p>
      {sub && <p className="text-[var(--text-muted)] text-xs">{sub}</p>}
    </div>
  )
}

export default function RevenuePage() {
  const [data, setData]       = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/revenue")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 max-w-6xl animate-pulse space-y-4">
        <div className="h-6 w-40 rounded bg-[var(--bg-elevated)]" />
        <div className="h-4 w-72 rounded bg-[var(--bg-elevated)]" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-[var(--border)] rounded-xl p-5 bg-[var(--surface)] space-y-3">
              <div className="h-3 w-20 rounded bg-[var(--bg-elevated)]" />
              <div className="h-8 w-28 rounded bg-[var(--bg-elevated)]" />
              <div className="h-3 w-24 rounded bg-[var(--bg-elevated)]" />
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (!data)   return <div className="p-8 text-red-400">Failed to load revenue data.</div>

  const changePositive = parseFloat(data.revenueChangePercent) >= 0

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-white font-bold text-2xl mb-2">Revenue</h1>
      <p className="text-[var(--text-muted)] text-sm mb-8">
        Token economy — 1 token = KSh 5 · Super admins enjoy unlimited free access to all features
      </p>

      {/* ── Token economy stats ── */}
      <h2 className="text-white font-semibold mb-4">Token Economy</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Token Revenue"
          value={`KSh ${data.totalRevenueKsh.toLocaleString()}`}
          sub={`${data.totalTokensPurchased} tokens sold`}
          accent
        />
        <StatCard
          label="This Month"
          value={`KSh ${data.thisMonthKsh.toLocaleString()}`}
          sub={`${changePositive ? "+" : ""}${data.revenueChangePercent}% vs last month`}
        />
        <StatCard
          label="Tokens in Circulation"
          value={data.totalTokensHeld.toLocaleString()}
          sub={`KSh ${(data.totalTokensHeld * 5).toLocaleString()} outstanding`}
        />
        <StatCard
          label="Unique Buyers"
          value={data.uniqueBuyerCount.toString()}
          sub="Users who have purchased tokens"
        />
      </div>

      {/* Feature breakdown */}
      <h2 className="text-white font-semibold mb-4">Token Usage by Feature</h2>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="border border-[var(--border)] rounded-xl p-5 bg-[var(--surface)]">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">
            Document Generation
          </p>
          <p className="text-white text-2xl font-bold mb-1">
            {data.tokensOnDocuments} tokens
          </p>
          <p className="text-[var(--text-muted)] text-xs">
            {Math.floor(data.tokensOnDocuments / 20)} documents generated
            · KSh {(data.tokensOnDocuments * 5).toLocaleString()} revenue
          </p>
        </div>
        <div className="border border-[var(--border)] rounded-xl p-5 bg-[var(--surface)]">
          <p className="text-[var(--text-muted)] text-xs uppercase tracking-wider mb-3">
            Voice Transcription
          </p>
          <p className="text-white text-2xl font-bold mb-1">
            {data.tokensOnVoice} tokens
          </p>
          <p className="text-[var(--text-muted)] text-xs">
            {Math.floor(data.tokensOnVoice / 10)} paid transcriptions
            · KSh {(data.tokensOnVoice * 5).toLocaleString()} revenue
          </p>
        </div>
      </div>

      {/* Monthly token revenue chart */}
      <h2 className="text-white font-semibold mb-4">Monthly Token Revenue</h2>
      <div className="border border-[var(--border)] rounded-xl p-5 bg-[var(--surface)] mb-10">
        {data.monthlyPurchases.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">No token purchases yet.</p>
        ) : (
          <div className="space-y-3">
            {data.monthlyPurchases.map((m, i) => {
              const maxKsh = Math.max(...data.monthlyPurchases.map(x => x.ksh))
              const pct    = maxKsh > 0 ? (m.ksh / maxKsh) * 100 : 0
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-[var(--text-muted)] text-xs w-20 shrink-0">{m.month}</span>
                  <div className="flex-1 bg-[var(--bg-input)] rounded-full h-2">
                    <div
                      className="bg-[#C8F55A] h-2 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-white text-xs w-24 text-right shrink-0">
                    KSh {m.ksh.toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Existing credit revenue section ── */}
      <h2 className="text-white font-semibold mb-4">Credit Revenue (legacy)</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Total Credits Purchased"
          value={`$${data.totalCreditsPurchased.toLocaleString()}`}
          sub="All-time credit top-ups"
        />
        <StatCard
          label="Credits Spent"
          value={data.totalCreditsSpent.toLocaleString()}
          sub="Feature unlocks via credits"
        />
        <StatCard
          label="Est. MRR"
          value={`$${data.estimatedMRR.toLocaleString()}`}
          sub="From subscriptions"
        />
      </div>

      {data.creditsByMonth.length > 0 && (
        <>
          <h2 className="text-white font-semibold mb-4">Monthly Credit Revenue</h2>
          <div className="border border-[var(--border)] rounded-xl p-5 bg-[var(--surface)] mb-8">
            <div className="space-y-3">
              {data.creditsByMonth.map((m, i) => {
                const maxRev = Math.max(...data.creditsByMonth.map(x => x.revenue))
                const pct    = maxRev > 0 ? (m.revenue / maxRev) * 100 : 0
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[var(--text-muted)] text-xs w-20 shrink-0">{m.month}</span>
                    <div className="flex-1 bg-[var(--bg-input)] rounded-full h-2">
                      <div
                        className="bg-[#C8F55A]/40 h-2 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-white text-xs w-16 text-right shrink-0">
                      ${m.revenue.toLocaleString()}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
