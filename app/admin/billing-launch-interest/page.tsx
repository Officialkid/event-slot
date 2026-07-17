'use client'

import { useEffect, useState } from "react"

type BillingLaunchInterest = {
  id: string
  email: string
  name: string | null
  accountType: string | null
  previewMode: string | null
  source: string
  createdAt: string
  updatedAt: string
  user: {
    id: string
    plan: string
  } | null
}

type BillingLaunchInterestPayload = {
  interests: BillingLaunchInterest[]
  summary: {
    total: number
    visuals: number
    text: number
    admins: number
    organisers: number
  }
}

export default function AdminBillingLaunchInterestPage() {
  const [data, setData] = useState<BillingLaunchInterestPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/admin/billing-launch-interest", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to load billing launch interest.")
        }
        setData(payload)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load billing launch interest."))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-white font-bold text-2xl mb-2">Billing Launch Interest</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          People who already want to be notified when EventSlot billing officially opens.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: "Total Interested", value: data?.summary.total ?? 0 },
          { label: "Visual Preview", value: data?.summary.visuals ?? 0 },
          { label: "Text Preview", value: data?.summary.text ?? 0 },
          { label: "Organisers", value: data?.summary.organisers ?? 0 },
          { label: "Admins", value: data?.summary.admins ?? 0 },
        ].map((item) => (
          <div key={item.label} className="border border-[var(--border)] rounded-xl p-4 bg-[var(--surface)]">
            <p className="text-[var(--text-muted)] text-xs mb-1">{item.label}</p>
            <p className="text-white font-bold text-xl">{loading ? "..." : item.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {error ? (
        <div className="border border-[#7F1D1D] bg-[#2B1111] rounded-xl p-4 text-sm text-[#FCA5A5]">
          {error}
        </div>
      ) : null}

      <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--surface)]">
        <div className="grid grid-cols-6 gap-4 px-5 py-3 bg-[var(--surface-muted)] border-b border-[var(--border)] min-w-[900px]">
          {["User", "Email", "Account", "Preview", "Plan", "Updated"].map((heading) => (
            <p key={heading} className="text-[var(--text-muted)] text-xs font-semibold uppercase tracking-wider">
              {heading}
            </p>
          ))}
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {loading ? (
              <div className="px-5 py-5">
                <div className="space-y-2 animate-pulse">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="grid grid-cols-6 gap-4 py-2">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="h-4 rounded bg-[var(--bg-elevated)]" />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : (data?.interests.length ?? 0) === 0 ? (
              <div className="px-5 py-8 text-center text-[var(--text-muted)] text-sm">
                No launch-interest signups yet.
              </div>
            ) : (
              data?.interests.map((interest) => (
                <div key={interest.id} className="grid grid-cols-6 gap-4 px-5 py-4 border-b border-[var(--border-subtle)] text-sm">
                  <div className="text-white">{interest.name ?? "Unnamed user"}</div>
                  <div className="text-[var(--text-secondary)] break-all">{interest.email}</div>
                  <div className="text-[var(--text-primary)] capitalize">{(interest.accountType ?? "organiser").replaceAll("_", " ")}</div>
                  <div className="text-[#C8F55A] capitalize">{interest.previewMode ?? "visuals"}</div>
                  <div className="text-[var(--text-secondary)] uppercase">{interest.user?.plan ?? "-"}</div>
                  <div className="text-[var(--text-muted)]">{new Date(interest.updatedAt).toLocaleString("en-GB")}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
