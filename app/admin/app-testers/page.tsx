'use client'

import { useEffect, useMemo, useState } from "react"

type AppTester = {
  id: string
  email: string
  createdAt: string
}

type AppTestersPayload = {
  testers: AppTester[]
  summary: {
    total: number
    latestSignupAt: string | null
  }
  playConsole: {
    track: string
    note: string
  }
}

export default function AdminAppTestersPage() {
  const [data, setData] = useState<AppTestersPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch("/api/admin/app-testers", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
          throw new Error(payload?.error ?? "Unable to load app testers.")
        }
        setData(payload)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load app testers."))
      .finally(() => setLoading(false))
  }, [])

  const emailList = useMemo(
    () => data?.testers.map((tester) => tester.email).join("\n") ?? "",
    [data?.testers],
  )

  const copyEmails = async () => {
    if (!emailList) return
    await navigator.clipboard.writeText(emailList)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#C8F55A]">Play Store Testing</p>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">App Testers</h1>
        <p className="max-w-3xl text-sm text-[var(--text-secondary)]">
          These are people who joined the EventSlot early tester list from the homepage popup. Use this page to copy their emails into Google Play Console.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Total testers</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{loading ? "..." : data?.summary.total ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Play track</p>
          <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{data?.playConsole.track ?? "Internal testing"}</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Latest signup</p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
            {data?.summary.latestSignupAt ? new Date(data.summary.latestSignupAt).toLocaleString("en-GB") : loading ? "..." : "None yet"}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">How to invite testers</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              In Play Console, open Internal testing, add these emails to the tester list, save changes, then copy the opt-in link and send it to testers.
            </p>
          </div>
          <button
            type="button"
            onClick={copyEmails}
            disabled={!emailList}
            className="rounded-full border border-[#C8F55A]/40 bg-[#C8F55A] px-5 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied ? "Copied emails" : "Copy emails"}
          </button>
        </div>
        <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 text-sm text-[var(--text-secondary)]">
          The confirmation email currently tells people they are saved for testing. The actual Play Store install link is created by Google after the internal testing release is active, so we send that link after the Play Console track is ready.
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-[#7F1D1D] bg-[#2B1111] p-4 text-sm text-[#FCA5A5]">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="grid min-w-[680px] grid-cols-3 gap-4 border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-3">
          {["Email", "Joined", "Status"].map((heading) => (
            <p key={heading} className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {heading}
            </p>
          ))}
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            {loading ? (
              <div className="space-y-3 p-5">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="grid animate-pulse grid-cols-3 gap-4">
                    <div className="h-4 rounded bg-[var(--bg-elevated)]" />
                    <div className="h-4 rounded bg-[var(--bg-elevated)]" />
                    <div className="h-4 rounded bg-[var(--bg-elevated)]" />
                  </div>
                ))}
              </div>
            ) : (data?.testers.length ?? 0) === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--text-muted)]">No app tester signups yet.</div>
            ) : (
              data?.testers.map((tester) => (
                <div key={tester.id} className="grid grid-cols-3 gap-4 border-b border-[var(--border-subtle)] px-5 py-4 text-sm">
                  <div className="break-all font-medium text-[var(--text-primary)]">{tester.email}</div>
                  <div className="text-[var(--text-secondary)]">{new Date(tester.createdAt).toLocaleString("en-GB")}</div>
                  <div className="text-[#C8F55A]">Ready to add in Play Console</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
