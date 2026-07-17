"use client"

import { useEffect, useMemo, useState } from "react"

type Mode = "ALL" | "SUBSCRIBED" | "INDIVIDUAL"

type User = {
  id: string
  name: string | null
  email: string | null
  marketingConsent?: boolean
}

type PreviewResponse = {
  mode: Mode
  recipientCount: number
  sampleRecipients: User[]
}

export default function AdminBroadcastPage() {
  const [mode, setMode] = useState<Mode>("SUBSCRIBED")
  const [subject, setSubject] = useState("")
  const [htmlContent, setHtmlContent] = useState("Hi {{name}},\n\n")
  const [search, setSearch] = useState("")
  const [foundUsers, setFoundUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== "INDIVIDUAL") return
    if (search.trim().length < 2) {
      setFoundUsers([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(search)}`)
        const data = await res.json() as { users?: User[] }
        setFoundUsers(data.users ?? [])
      } catch {
        setFoundUsers([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search, mode])

  useEffect(() => {
    if (mode === "INDIVIDUAL") {
      setPreview({ mode, recipientCount: selectedUsers.length, sampleRecipients: selectedUsers.slice(0, 5) })
      return
    }

    let cancelled = false

    const run = async () => {
      setLoadingPreview(true)
      try {
        const res = await fetch(`/api/admin/broadcast?mode=${mode}`)
        const data = (await res.json()) as PreviewResponse
        if (!cancelled) {
          setPreview(data)
        }
      } catch {
        if (!cancelled) {
          setPreview(null)
        }
      } finally {
        if (!cancelled) {
          setLoadingPreview(false)
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [mode, selectedUsers])

  const prettyCount = useMemo(() => {
    const count = preview?.recipientCount ?? 0
    return count.toLocaleString()
  }, [preview?.recipientCount])

  async function handleSend() {
    if (!subject.trim() || !htmlContent.trim()) {
      setMessage("Subject and content are required")
      return
    }

    if (mode === "INDIVIDUAL" && selectedUsers.length === 0) {
      setMessage("Select at least one user")
      return
    }

    const confirmed = window.confirm(`Send this broadcast in ${mode} mode?`)
    if (!confirmed) return

    setSending(true)
    setMessage(null)

    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          htmlContent,
          mode,
          specificUserIds: mode === "INDIVIDUAL" ? selectedUsers.map((u) => u.id) : undefined,
        }),
      })

      const data = await res.json() as {
        success?: boolean
        sent?: number
        failed?: number
        mode?: Mode
        message?: string
        error?: string
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Failed to send")
      }

      setMessage(data.message ?? `Broadcast sent to ${data.sent ?? 0} users`)
      setSubject("")
      setHtmlContent("")

      if (mode === "INDIVIDUAL") {
        setSelectedUsers([])
        setSearch("")
        setFoundUsers([])
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to send")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Email Broadcast</h1>
        <p className="text-[var(--text-secondary)] mt-1">Send updates to all users, subscribers, or selected individuals.</p>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-6">
        <div>
          <label className="block text-sm mb-2 text-[var(--text-secondary)]">Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {(["ALL", "SUBSCRIBED", "INDIVIDUAL"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  mode === m
                    ? "bg-[#C8F55A] text-black"
                    : "bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"
                }`}
              >
                {m === "ALL" ? "All users" : m === "SUBSCRIBED" ? "Subscribers" : "Individuals"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            {mode === "ALL"
              ? "Sends to every active account with an email address."
              : mode === "SUBSCRIBED"
                ? "Sends only to users who allowed marketing or broadcast emails."
                : "Sends only to the specific users you choose below."}
          </p>
        </div>

        {mode !== "INDIVIDUAL" && (
          <div className="rounded-xl bg-[var(--bg-input)] p-4 border border-[var(--border)]">
            <p className="text-sm text-[var(--text-secondary)]">Recipient preview</p>
            <p className="text-2xl font-bold text-white mt-1">{loadingPreview ? "..." : prettyCount}</p>
            {preview?.sampleRecipients?.length ? (
              <div className="mt-3 text-xs text-[var(--text-muted)] space-y-1">
                {preview.sampleRecipients.map((u) => (
                  <div key={u.id}>{u.email}</div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {mode === "INDIVIDUAL" && (
          <div className="space-y-3">
            <label className="block text-sm text-[var(--text-secondary)]">Find users</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email"
              className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors w-full"
            />

            <div className="max-h-44 overflow-y-auto rounded-xl border border-[var(--border)]">
              {foundUsers.length === 0 ? (
                <p className="p-3 text-sm text-[var(--text-muted)]">No users found</p>
              ) : (
                foundUsers.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      if (!selectedUsers.find((x) => x.id === u.id)) {
                        setSelectedUsers((prev) => [...prev, u])
                      }
                    }}
                    className="w-full text-left px-3 py-2 border-b border-[var(--border)] hover:bg-[var(--surface-muted)]"
                  >
                    <p className="text-sm text-white">{u.name || "No name"}</p>
                    <p className="text-xs text-[var(--text-muted)]">{u.email}</p>
                  </button>
                ))
              )}
            </div>

            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((u) => (
                  <span
                    key={u.id}
                    className="inline-flex items-center gap-2 rounded-full bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/30 px-3 py-1 text-xs"
                  >
                    {u.email}
                    <button
                      type="button"
                      onClick={() => setSelectedUsers((prev) => prev.filter((x) => x.id !== u.id))}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}

            <p className="text-xs text-[var(--text-muted)]">Selected: {selectedUsers.length}</p>
          </div>
        )}

        <div>
          <label className="block text-sm mb-1 text-[var(--text-secondary)]">Subject</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors w-full"
            placeholder="Your subject"
          />
        </div>

        <div>
          <label className="block text-sm mb-1 text-[var(--text-secondary)]">Message</label>
          <textarea
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            rows={10}
            className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors w-full"
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">Use {"{{name}}"} for personalization.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSend}
            disabled={sending}
            className="bg-[#C8F55A] text-black font-bold px-5 py-2 rounded-xl hover:bg-[#b8e040] transition-colors disabled:opacity-50"
          >
            {sending ? "Sending..." : `Send (${mode})`}
          </button>
          <span className="text-xs text-[var(--text-muted)]">
            {mode === "INDIVIDUAL"
              ? `${selectedUsers.length} selected`
              : `${preview?.recipientCount ?? 0} recipients`}
          </span>
        </div>

        {message ? <p className="text-sm text-[var(--text-secondary)]">{message}</p> : null}
      </div>
    </div>
  )
}
