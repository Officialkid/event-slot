'use client'
import { useEffect, useState } from 'react'

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
  trackedUsers: number
  unknownUsers: number
  coveragePercent: number
  topCountry: CountryRow | null
  fastestGrowing: CountryRow | null
  recommendations: string[]
}

type BackfillResult = {
  ok: boolean
  updatedUsers: number
  filledSignupFromExisting: number
  filledCurrentFromExisting: number
  namedFromExisting: number
  inferredFromOrganizerEvents: number
  inferredFromAttendeeRegistrations: number
  message: string
}

export default function CountryIntelligence() {
  const [data, setData] = useState<CountryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [backfilling, setBackfilling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backfillResult, setBackfillResult] = useState<BackfillResult | null>(null)

  async function loadCountries() {
    setError(null)

    const response = await fetch('/api/admin/countries', { cache: 'no-store' })
    const payload = await response.json()

    if (!response.ok) {
      throw new Error(payload?.error ?? 'Unable to load countries.')
    }

    setData(payload)
  }

  useEffect(() => {
    loadCountries()
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load countries.'))
      .finally(() => setLoading(false))
  }, [])

  async function runBackfill() {
    try {
      setBackfilling(true)
      setError(null)

      const response = await fetch('/api/admin/countries', {
        method: 'POST',
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Country backfill failed.')
      }

      setBackfillResult(payload)
      await loadCountries()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Country backfill failed.')
    } finally {
      setBackfilling(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-center gap-3">
          <svg className="w-6 h-6 text-[#C8F55A]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M3.6 9h16.8M3.6 15h16.8M12 3a12.9 12.9 0 0 1 3 9 12.9 12.9 0 0 1-3 9 12.9 12.9 0 0 1-3-9 12.9 12.9 0 0 1 3-9z" />
          </svg>
          <div>
            <h1 className="text-white font-bold text-2xl">Country Intelligence</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Live country coverage for all users, plus a safe backfill for recoverable older accounts.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={runBackfill}
          disabled={loading || backfilling}
          className="inline-flex items-center justify-center rounded-full bg-[#C8F55A] px-5 py-3 text-sm font-semibold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {backfilling ? 'Backfilling...' : 'Run Safe Backfill'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          { label: 'Countries Active', value: loading ? '...' : (data?.totalCountries ?? '-') },
          { label: 'Total Users', value: loading ? '...' : (data?.totalUsers?.toLocaleString() ?? '-') },
          { label: 'Tracked Users', value: loading ? '...' : (data?.trackedUsers?.toLocaleString() ?? '-') },
          { label: 'Coverage', value: loading ? '...' : `${data?.coveragePercent ?? 0}%` },
          { label: 'Unknown Users', value: loading ? '...' : (data?.unknownUsers?.toLocaleString() ?? '-') },
        ].map((summary) => (
          <div key={summary.label} className="border border-[var(--border)] rounded-xl p-4 bg-[var(--surface)]">
            <p className="text-[var(--text-muted)] text-xs mb-1">{summary.label}</p>
            <p className="text-white font-bold text-xl">{String(summary.value)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-5">
          <p className="text-xs text-[#C8F55A] font-semibold uppercase tracking-[0.22em] mb-3">
            Coverage Notes
          </p>
          <div className="space-y-2 text-sm text-[var(--text-secondary)]">
            <p>
              Older accounts without any recorded geo signal cannot be assigned a true country retroactively.
            </p>
            <p>
              The backfill only fills values from existing user country fields, a single consistent organiser event country, or a single consistent attendee registration country matched by email.
            </p>
            <p>
              Remaining unknown users will improve naturally as they sign in again and the live country capture runs.
            </p>
          </div>
        </div>

        <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-5">
          <p className="text-xs text-[#C8F55A] font-semibold uppercase tracking-[0.22em] mb-3">
            Leaderboard
          </p>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-[var(--text-muted)] mb-1">Top Country</p>
              <p className="text-white font-semibold">{loading ? '...' : (data?.topCountry?.countryName ?? '-')}</p>
            </div>
            <div>
              <p className="text-[var(--text-muted)] mb-1">Fastest Growing</p>
              <p className="text-white font-semibold">{loading ? '...' : (data?.fastestGrowing?.countryName ?? '-')}</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="border border-[#7F1D1D] bg-[#2B1111] rounded-xl p-4 text-sm text-[#FCA5A5]">
          {error}
        </div>
      )}

      {backfillResult && (
        <div className="border border-[#C8F55A]/25 rounded-xl p-5 bg-[#C8F55A]/5">
          <p className="text-sm font-semibold text-white mb-3">{backfillResult.message}</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: 'Users Updated', value: backfillResult.updatedUsers },
              { label: 'Signup Filled', value: backfillResult.filledSignupFromExisting },
              { label: 'Current Country Filled', value: backfillResult.filledCurrentFromExisting },
              { label: 'Country Names Filled', value: backfillResult.namedFromExisting },
              { label: 'Event-Based Inferences', value: backfillResult.inferredFromOrganizerEvents },
              { label: 'Attendee Email Inferences', value: backfillResult.inferredFromAttendeeRegistrations },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
                <p className="text-xs text-[var(--text-muted)] mb-1">{item.label}</p>
                <p className="text-lg font-semibold text-white">{item.value.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {(data?.recommendations?.length ?? 0) > 0 && (
        <div className="border border-[#C8F55A]/20 rounded-xl p-5 bg-[#C8F55A]/5">
          <p className="text-xs text-[#C8F55A] font-semibold uppercase tracking-[0.22em] mb-3">
            Strategic Recommendations
          </p>
          <div className="space-y-2">
            {data!.recommendations.map((recommendation, index) => (
              <div key={index} className="flex items-start gap-3">
                <span className="text-[#C8F55A] text-sm mt-0.5">-&gt;</span>
                <p className="text-[var(--text-secondary)] text-sm">{recommendation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-6 gap-4 px-5 py-3 bg-[var(--surface-muted)] border-b border-[var(--border)]">
              {['Country', 'Users', 'Organisers', 'Events', '7d Growth', 'Currency'].map((heading) => (
                <p key={heading} className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
                  {heading}
                </p>
              ))}
            </div>

            {loading && (
              <div className="px-5 py-5">
                <div className="space-y-2 animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="grid grid-cols-6 gap-4 py-2">
                      <div className="h-4 rounded bg-[var(--bg-elevated)]" />
                      <div className="h-4 rounded bg-[var(--bg-elevated)]" />
                      <div className="h-4 rounded bg-[var(--bg-elevated)]" />
                      <div className="h-4 rounded bg-[var(--bg-elevated)]" />
                      <div className="h-4 rounded bg-[var(--bg-elevated)]" />
                      <div className="h-4 rounded bg-[var(--bg-elevated)]" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && (data?.countries ?? []).length === 0 && (
              <div className="px-5 py-8 text-center text-[var(--text-muted)] text-sm">
                No country data yet.
              </div>
            )}

            {(data?.countries ?? []).map((country) => (
              <div
                key={country.countryCode}
                className="grid grid-cols-6 gap-4 px-5 py-4 border-b border-[var(--border)] hover:bg-[var(--surface-muted)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{country.flag}</span>
                  <div>
                    <p className="text-white text-sm font-medium">{country.countryName}</p>
                    <p className="text-[var(--text-muted)] text-xs">{country.countryCode}</p>
                  </div>
                </div>
                <p className="text-white text-sm self-center">{country.userCount.toLocaleString()}</p>
                <p className="text-white text-sm self-center">{country.organizerCount.toLocaleString()}</p>
                <p className="text-white text-sm self-center">{country.eventCount.toLocaleString()}</p>
                <span className={`text-sm font-medium self-center ${country.growth7d >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                  {country.growth7d >= 0 ? '+' : ''}
                  {country.growth7d}%
                </span>
                <p className="text-[var(--text-secondary)] text-sm self-center">{country.currency}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
