"use client"
import { useState, useEffect, useCallback } from "react"

type SessionData = {
  id: string
  channel: string
  status: string
  flagged: boolean
  flagReason: string | null
  messageCount: number
  startedAt: string
  endedAt: string | null
  messages: { role: string; content: string; isVoice: boolean; createdAt: string }[]
}

export default function ConversationsPage() {
  const [sessions, setSessions]   = useState<SessionData[]>([])
  const [filter, setFilter]       = useState<"flagged" | "all">("flagged")
  const [selected, setSelected]   = useState<SessionData | null>(null)
  const [total, setTotal]         = useState(0)
  const [flagged, setFlagged]     = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState("")

  const parseJsonSafely = async (res: Response): Promise<Record<string, unknown>> => {
    const bodyText = await res.text()
    if (!bodyText) return {}
    try {
      return JSON.parse(bodyText) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res  = await fetch(`/api/admin/assistant-sessions?filter=${filter}`)
      const data = await parseJsonSafely(res)

      if (!res.ok) {
        setSessions([])
        setTotal(0)
        setFlagged(0)
        setError(typeof data.error === "string" ? data.error : "Failed to load conversations.")
        return
      }

      setSessions(Array.isArray(data.sessions) ? (data.sessions as SessionData[]) : [])
      setTotal(typeof data.total === "number" ? data.total : 0)
      setFlagged(typeof data.flaggedCount === "number" ? data.flaggedCount : 0)
    } catch {
      setSessions([])
      setTotal(0)
      setFlagged(0)
      setError("Network error while loading conversations.")
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col lg:flex-row">
      {/* Sidebar */}
      <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r border-[var(--border)] flex flex-col shrink-0">
        <div className="p-4 border-b border-[var(--border)]">
          <h1 className="text-white font-bold text-base mb-3">
            Assistant Conversations
          </h1>
          <div className="flex gap-2 flex-wrap">
            {(["flagged", "all"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 text-xs py-1.5 rounded-lg capitalize
                           transition-colors border
                           ${filter === f
                             ? f === "flagged"
                               ? "bg-red-900/30 text-red-400 border-red-800"
                               : "bg-[#C8F55A]/10 text-[#C8F55A] border-[#C8F55A]/30"
                             : "border-[var(--border)] text-[var(--text-muted)]"
                           }`}
              >
                {f === "flagged" ? `Flagged (${flagged})` : `All (${total})`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <p className="p-4 text-red-400 text-sm">{error}</p>
          )}
          {loading && (
            <div className="p-4 space-y-2 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div className="h-3 w-32 rounded bg-[var(--bg-elevated)] mb-2" />
                  <div className="h-2.5 w-40 rounded bg-[var(--bg-elevated)]" />
                </div>
              ))}
            </div>
          )}
          {!loading && sessions.length === 0 && (
            <p className="p-4 text-[var(--text-muted)] text-sm">
              {filter === "flagged" ? "No flagged conversations yet." : "No conversations yet."}
            </p>
          )}
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={`w-full text-left p-4 border-b border-[var(--border)]
                         hover:bg-[var(--surface-muted)] transition-colors
                         ${selected?.id === s.id ? "bg-[var(--surface-muted)]" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-white text-xs font-medium">
                  {s.channel === "VOICE" ? "Voice" : "Text"} Anonymous User
                </span>
                {s.flagged && (
                  <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded">
                    Flagged
                  </span>
                )}
              </div>
              {s.flagReason && (
                <p className="text-[var(--text-muted)] text-xs truncate mb-1">{s.flagReason}</p>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-muted)] text-xs">
                  {new Date(s.startedAt).toLocaleDateString("en-KE")}
                </span>
                <span className="text-[var(--text-muted)] text-xs">- {s.messageCount} msgs</span>
                <span className={`text-xs ml-auto ${
                  s.status === "FLAGGED" ? "text-red-400" :
                  s.status === "ENDED"   ? "text-[var(--text-muted)]" : "text-[#22C55E]"
                }`}>
                  {s.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Conversation view */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            <div className="p-4 border-b border-[var(--border)]">
              <h2 className="text-white font-semibold text-sm">
                {selected.channel === "VOICE" ? "Voice" : "Text"} Session
              </h2>
              <p className="text-[var(--text-muted)] text-xs">
                {new Date(selected.startedAt).toLocaleString("en-KE")}
                {selected.flagReason && (
                  <span className="ml-3 text-red-400">
                    Issue: {selected.flagReason}
                  </span>
                )}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selected.messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "USER" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm
                    ${msg.role === "USER"
                      ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] rounded-br-sm"
                      : "bg-[var(--accent-dim)] text-[var(--text-primary)] border border-[var(--border-emphasis)] rounded-bl-sm"
                    }`}>
                    <p className="text-[var(--text-muted)] text-xs mb-1">
                      {msg.role === "USER" ? "User" : "EventSlot Assistant"}
                      {msg.isVoice && " (voice)"}
                    </p>
                    <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[var(--text-muted)] text-sm">Select a conversation to view</p>
          </div>
        )}
      </div>
    </div>
  )
}


