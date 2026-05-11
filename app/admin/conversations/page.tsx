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

  const load = useCallback(async () => {
    setLoading(true)
    const res  = await fetch(`/api/admin/assistant-sessions?filter=${filter}`)
    const data = await res.json()
    setSessions(data.sessions)
    setTotal(data.total)
    setFlagged(data.flaggedCount)
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Sidebar */}
      <div className="w-80 border-r border-[#2A2A2A] flex flex-col shrink-0">
        <div className="p-4 border-b border-[#2A2A2A]">
          <h1 className="text-white font-bold text-base mb-3">
            Assistant Conversations
          </h1>
          <div className="flex gap-2">
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
                             : "border-[#2A2A2A] text-[#525252]"
                           }`}
              >
                {f === "flagged" ? `🚩 Flagged (${flagged})` : `All (${total})`}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="p-4 text-[#525252] text-sm">Loading...</p>
          )}
          {!loading && sessions.length === 0 && (
            <p className="p-4 text-[#525252] text-sm">
              {filter === "flagged" ? "No flagged conversations ✅" : "No conversations yet."}
            </p>
          )}
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={`w-full text-left p-4 border-b border-[#2A2A2A]
                         hover:bg-[#1E1E1E] transition-colors
                         ${selected?.id === s.id ? "bg-[#1E1E1E]" : ""}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-white text-xs font-medium">
                  {s.channel === "VOICE" ? "🎙️" : "💬"} Anonymous User
                </span>
                {s.flagged && (
                  <span className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded">
                    Flagged
                  </span>
                )}
              </div>
              {s.flagReason && (
                <p className="text-[#525252] text-xs truncate mb-1">{s.flagReason}</p>
              )}
              <div className="flex items-center gap-2">
                <span className="text-[#525252] text-xs">
                  {new Date(s.startedAt).toLocaleDateString("en-KE")}
                </span>
                <span className="text-[#525252] text-xs">· {s.messageCount} msgs</span>
                <span className={`text-xs ml-auto ${
                  s.status === "FLAGGED" ? "text-red-400" :
                  s.status === "ENDED"   ? "text-[#525252]" : "text-[#22C55E]"
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
            <div className="p-4 border-b border-[#2A2A2A]">
              <h2 className="text-white font-semibold text-sm">
                {selected.channel === "VOICE" ? "🎙️ Voice" : "💬 Text"} Session
              </h2>
              <p className="text-[#525252] text-xs">
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
                      ? "bg-[#2A2A2A] text-white rounded-br-sm"
                      : "bg-[#C8F55A]/10 text-[#E5E5E5] border border-[#C8F55A]/20 rounded-bl-sm"
                    }`}>
                    <p className="text-[#525252] text-xs mb-1">
                      {msg.role === "USER" ? "User" : "EventSlot Assistant"}
                      {msg.isVoice && " 🎙️"}
                    </p>
                    <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[#525252] text-sm">Select a conversation to view</p>
          </div>
        )}
      </div>
    </div>
  )
}


