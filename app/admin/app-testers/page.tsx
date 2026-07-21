'use client'

import { useEffect, useMemo, useState } from "react"

type AppTester = {
  id: string
  email: string
  createdAt: string
  inviteSentAt: string | null
  installedAt: string | null
  notes: string | null
  progressUpdatedAt: string | null
}

type AppTestersPayload = {
  testers: AppTester[]
  summary: {
    total: number
    invited: number
    installed: number
    latestSignupAt: string | null
  }
  settings: {
    promptEnabled: boolean
    optInUrlConfigured: boolean
  }
  playConsole: {
    track: string
    note: string
  }
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("en-GB") : "-"
}

export default function AdminAppTestersPage() {
  const [data, setData] = useState<AppTestersPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    setError(null)
    const response = await fetch("/api/admin/app-testers", { cache: "no-store" })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(payload?.error ?? "Unable to load app testers.")
    }
    setData(payload)
  }

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load app testers."))
      .finally(() => setLoading(false))
  }, [])

  const emailList = useMemo(
    () => data?.testers.map((tester) => tester.email).join("\n") ?? "",
    [data?.testers],
  )

  const updateProgress = async (action: string, email?: string, promptEnabled?: boolean) => {
    setSaving(email ? `${action}:${email}` : action)
    setError(null)
    try {
      const response = await fetch("/api/admin/app-testers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, email, promptEnabled }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to update app tester progress.")
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update app tester progress.")
    } finally {
      setSaving(null)
    }
  }

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
          Track people who joined the EventSlot tester list, copy their emails into Play Console, and manually confirm invite/install progress.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total testers", value: data?.summary.total ?? 0 },
          { label: "Invite sent", value: data?.summary.invited ?? 0 },
          { label: "Installed / confirmed", value: data?.summary.installed ?? 0 },
          { label: "Popup", value: data?.settings.promptEnabled ? "Active" : "Hidden" },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{loading ? "..." : item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Play Console invite workflow</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Add these emails to Internal testing. After the release is published, copy the opt-in link and send it to testers.
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
            {data?.settings.optInUrlConfigured
              ? "The Play testing opt-in link is configured. New tester signups will receive it automatically by email."
              : "The Play testing opt-in link is not configured yet. Google shows the link after the internal release is published."}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Homepage tester popup</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Keep it active while recruiting testers. Hide it when testing is full or no longer needed.
          </p>
          <button
            type="button"
            onClick={() => updateProgress("setPromptEnabled", undefined, !(data?.settings.promptEnabled ?? true))}
            disabled={saving === "setPromptEnabled"}
            className="mt-4 rounded-full border border-[var(--border)] px-5 py-3 text-sm font-bold text-[var(--text-primary)] disabled:opacity-50"
          >
            {data?.settings.promptEnabled ? "Hide popup" : "Enable popup"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-[#7F1D1D] bg-[#2B1111] p-4 text-sm text-[#FCA5A5]">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="grid min-w-[980px] grid-cols-[1.5fr_1fr_1fr_1fr_1.4fr] gap-4 border-b border-[var(--border)] bg-[var(--surface-muted)] px-5 py-3">
          {["Email", "Joined", "Invite sent", "Installed", "Actions"].map((heading) => (
            <p key={heading} className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              {heading}
            </p>
          ))}
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            {loading ? (
              <div className="space-y-3 p-5">
                {[1, 2, 3].map((item) => (
                  <div key={item} className="grid animate-pulse grid-cols-5 gap-4">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={index} className="h-4 rounded bg-[var(--bg-elevated)]" />
                    ))}
                  </div>
                ))}
              </div>
            ) : (data?.testers.length ?? 0) === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--text-muted)]">No app tester signups yet.</div>
            ) : (
              data?.testers.map((tester) => (
                <div key={tester.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1.4fr] gap-4 border-b border-[var(--border-subtle)] px-5 py-4 text-sm">
                  <div className="break-all font-medium text-[var(--text-primary)]">{tester.email}</div>
                  <div className="text-[var(--text-secondary)]">{formatDate(tester.createdAt)}</div>
                  <div className={tester.inviteSentAt ? "text-[#C8F55A]" : "text-[var(--text-muted)]"}>{formatDate(tester.inviteSentAt)}</div>
                  <div className={tester.installedAt ? "text-[#C8F55A]" : "text-[var(--text-muted)]"}>{formatDate(tester.installedAt)}</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => updateProgress("markInviteSent", tester.email)}
                      disabled={saving === `markInviteSent:${tester.email}`}
                      className="rounded-full border border-[var(--border)] px-3 py-2 text-xs font-bold text-[var(--text-primary)] disabled:opacity-50"
                    >
                      Mark invited
                    </button>
                    <button
                      type="button"
                      onClick={() => updateProgress("markInstalled", tester.email)}
                      disabled={saving === `markInstalled:${tester.email}`}
                      className="rounded-full border border-[#C8F55A]/40 px-3 py-2 text-xs font-bold text-[#C8F55A] disabled:opacity-50"
                    >
                      Mark installed
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
