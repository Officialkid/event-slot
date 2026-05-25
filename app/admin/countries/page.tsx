'use client'
import { useState, useEffect } from 'react'

type CountryRow = {
  countryCode: string
  countryName: string
  userCount: number
  organizerCount: number
  eventCount: number
  growth7d: number
  flag: string
  currency: string
}

type CountryData = {
  countries: CountryRow[]
  totalCountries: number
  totalUsers: number
  topCountry: CountryRow | null
  fastestGrowing: CountryRow | null
  recommendations: string[]
}

export default function CountryIntelligence() {
  const [data, setData] = useState<CountryData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/countries')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex items-center gap-3">
        {/* Globe icon — inline SVG, no external icon dep needed */}
        <svg className="w-6 h-6 text-[#C8F55A]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M3.6 9h16.8M3.6 15h16.8M12 3a12.9 12.9 0 0 1 3 9 12.9 12.9 0 0 1-3 9 12.9 12.9 0 0 1-3-9 12.9 12.9 0 0 1 3-9z" />
        </svg>
        <h1 className="text-white font-bold text-2xl">Country Intelligence</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Countries Active',  value: loading ? '…' : (data?.totalCountries ?? '—') },
          { label: 'Total Users',       value: loading ? '…' : (data?.totalUsers?.toLocaleString() ?? '—') },
          { label: 'Top Country',       value: loading ? '…' : (data?.topCountry?.countryName ?? '—') },
          { label: 'Fastest Growing',   value: loading ? '…' : (data?.fastestGrowing?.countryName ?? '—') },
        ].map(s => (
          <div key={s.label} className="border border-[#2A2A2A] rounded-xl p-4 bg-[#141414]">
            <p className="text-[#525252] text-xs mb-1">{s.label}</p>
            <p className="text-white font-bold text-xl">{String(s.value)}</p>
          </div>
        ))}
      </div>

      {/* Strategic recommendations */}
      {(data?.recommendations?.length ?? 0) > 0 && (
        <div className="border border-[#C8F55A]/20 rounded-xl p-5 bg-[#C8F55A]/5">
          <p className="text-xs text-[#C8F55A] font-semibold uppercase tracking-wider mb-3">
            ✦ STRATEGIC RECOMMENDATIONS
          </p>
          {data!.recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-3 mb-2">
              <span className="text-[#C8F55A] text-sm mt-0.5">→</span>
              <p className="text-[#A3A3A3] text-sm">{r}</p>
            </div>
          ))}
        </div>
      )}

      {/* Country table */}
      <div className="border border-[#2A2A2A] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
        <div className="min-w-[760px]">
        <div className="grid grid-cols-6 gap-4 px-5 py-3 bg-[#1E1E1E] border-b border-[#2A2A2A]">
          {['Country', 'Users', 'Organisers', 'Events', '7d Growth', 'Currency'].map(h => (
            <p key={h} className="text-[#525252] text-xs font-semibold uppercase tracking-wider">{h}</p>
          ))}
        </div>

        {loading && (
          <div className="px-5 py-5">
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="grid grid-cols-6 gap-4 py-2">
                  <div className="h-4 rounded bg-[#1A1A1A]" />
                  <div className="h-4 rounded bg-[#1A1A1A]" />
                  <div className="h-4 rounded bg-[#1A1A1A]" />
                  <div className="h-4 rounded bg-[#1A1A1A]" />
                  <div className="h-4 rounded bg-[#1A1A1A]" />
                  <div className="h-4 rounded bg-[#1A1A1A]" />
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && (data?.countries ?? []).length === 0 && (
          <div className="px-5 py-8 text-center text-[#525252] text-sm">
            No data yet — country snapshots appear after the first daily cron run.
          </div>
        )}

        {(data?.countries ?? []).map((c) => (
          <div
            key={c.countryCode}
            className="grid grid-cols-6 gap-4 px-5 py-4 border-b border-[#2A2A2A] hover:bg-[#1E1E1E] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{c.flag}</span>
              <div>
                <p className="text-white text-sm font-medium">{c.countryName}</p>
                <p className="text-[#525252] text-xs">{c.countryCode}</p>
              </div>
            </div>
            <p className="text-white text-sm self-center">{c.userCount.toLocaleString()}</p>
            <p className="text-white text-sm self-center">{c.organizerCount.toLocaleString()}</p>
            <p className="text-white text-sm self-center">{c.eventCount.toLocaleString()}</p>
            <span className={`text-sm font-medium self-center ${c.growth7d >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
              {c.growth7d >= 0 ? '+' : ''}{c.growth7d}%
            </span>
            <p className="text-[#A3A3A3] text-sm self-center">{c.currency}</p>
          </div>
        ))}
        </div>
        </div>
      </div>
    </div>
  )
}
