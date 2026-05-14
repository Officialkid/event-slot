"use client"

import { useState, useRef, useEffect, useCallback } from "react"

type Message = {
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isVoice?: boolean
}

type Channel = "text" | "voice"

type ChatSession = {
  id: string
  label: string
  messages: Message[]
  channel: Channel
  ended: boolean
  startedAt: Date
}

export default function AssistantPage() {
  const [sessions, setSessions]             = useState<ChatSession[]>([])
  const [activeId, setActiveId]             = useState<string | null>(null)
  const [input, setInput]                   = useState("")
  const [loading, setLoading]               = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [recording, setRecording]           = useState(false)
  const [transcribing, setTranscribing]     = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen]       = useState(false)
  const [renamingId, setRenamingId]         = useState<string | null>(null)
  const [renameValue, setRenameValue]       = useState("")
  const [menuId, setMenuId]                 = useState<string | null>(null)

  const messagesEndRef   = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])
  const textareaRef      = useRef<HTMLTextAreaElement>(null)
  const renameInputRef   = useRef<HTMLInputElement>(null)

  const activeSession = sessions.find(s => s.id === activeId) ?? null

  // Load past sessions on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/assistant/my-sessions")
        if (!res.ok) return
        const { sessions: raw } = await res.json()
        const loaded: ChatSession[] = (raw as {
          id: string
          label: string | null
          channel: string
          status: string
          startedAt: string
          messages: { role: string; content: string; isVoice: boolean; createdAt: string }[]
        }[]).map(s => ({
          id: s.id,
          label: s.label ?? (s.messages.find(m => m.role === "USER" || m.role === "user")?.content.slice(0, 40).trim() ?? "New chat"),
          channel: s.channel.toLowerCase() as Channel,
          ended: s.status !== "ACTIVE",
          startedAt: new Date(s.startedAt),
          messages: s.messages.map(m => ({
            role: m.role.toLowerCase() as "user" | "assistant",
            content: m.content,
            isVoice: m.isVoice,
            timestamp: new Date(m.createdAt),
          })),
        }))
        setSessions(loaded)
        if (loaded.length > 0) setActiveId(loaded[0].id)
      } finally {
        setLoadingHistory(false)
      }
    }
    loadHistory()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeSession?.messages])

  useEffect(() => {
    if (!menuId) return
    function close() { setMenuId(null) }
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [menuId])

  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus()
  }, [renamingId])

  function updateSession(id: string, patch: Partial<ChatSession>) {
    setSessions(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
  }

  const addMessage = useCallback((id: string, role: "user" | "assistant", content: string, isVoice = false) => {
    setSessions(prev =>
      prev.map(s => {
        if (s.id !== id) return s
        const newMsgs: Message[] = [...s.messages, { role, content, timestamp: new Date(), isVoice }]
        const label = s.label === "New chat" && role === "user"
          ? (content.slice(0, 40).trim() || "New chat")
          : s.label
        if (label !== s.label) {
          fetch(/api/assistant/session/, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label }),
          }).catch(() => {})
        }
        return { ...s, messages: newMsgs, label }
      })
    )
  }, [])

  async function startNewSession(selectedChannel: Channel) {
    setLoading(true)
    setError(null)
    const res = await fetch("/api/assistant/session", {
      method: "POST",
      headers: { "x-channel": selectedChannel },
    })
    const data = await res.json()
    if (res.status === 429) { setError(data.message); setLoading(false); return }
    const newSession: ChatSession = {
      id: data.sessionId,
      label: "New chat",
      messages: [{ role: "assistant", content: "Hi! Welcome to EventSlot support. How can I help you today?", timestamp: new Date() }],
      channel: selectedChannel,
      ended: false,
      startedAt: new Date(),
    }
    setSessions(prev => [newSession, ...prev])
    setActiveId(data.sessionId)
    setLoading(false)
    setSidebarOpen(false)
  }

  async function sendMessage(text: string, isVoice = false) {
    if (!text.trim() || !activeSession || activeSession.ended || loading) return
    const sid = activeSession.id
    addMessage(sid, "user", text, isVoice)
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
    setLoading(true)
    const res = await fetch("/api/assistant/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sid, message: text }),
    })
    const data = await res.json()
    addMessage(sid, "assistant", data.reply)
    if (data.sessionEnded) updateSession(sid, { ended: true })
    setLoading(false)
  }

  async function endSession() {
    if (!activeSession) return
    const sid = activeSession.id
    const res = await fetch(/api/assistant/session//end, { method: "POST" })
    const data = await res.json()
    addMessage(sid, "assistant", data.message)
    updateSession(sid, { ended: true })
  }

  async function deleteSession(id: string) {
    setMenuId(null)
    await fetch(/api/assistant/session/, { method: "DELETE" })
    setSessions(prev => prev.filter(s => s.id !== id))
    if (activeId === id) setActiveId(null)
  }

  function startRename(id: string, currentLabel: string) {
    setMenuId(null)
    setRenamingId(id)
    setRenameValue(currentLabel)
  }

  async function commitRename(id: string) {
    const label = renameValue.trim().slice(0, 80) || "New chat"
    setRenamingId(null)
    updateSession(id, { label })
    await fetch(/api/assistant/session/, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    })
  }

  async function startRecording() {
    if (!activeSession) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        await transcribeAndSend(blob)
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      addMessage(activeSession.id, "assistant", "Microphone access was denied. Please check your browser permissions.")
    }
  }

  function stopAndSend() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function transcribeAndSend(blob: Blob) {
    if (!activeSession) return
    setTranscribing(true)
    const form = new FormData()
    form.append("audio", blob, "voice.webm")
    form.append("sessionId", activeSession.id)
    const res = await fetch("/api/assistant/transcribe", { method: "POST", body: form })
    if (!res.ok) {
      const data = await res.json()
      addMessage(activeSession.id, "assistant", res.status === 402 ? data.message : "I couldn't process that voice message. Please type instead.")
      setTranscribing(false)
      return
    }
    const { text } = await res.json()
    setTranscribing(false)
    await sendMessage(text, true)
  }

  function handleTextareaInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"
  }

  return (
    <div className="flex bg-[#0A0A0A] relative overflow-hidden" style={{ height: "calc(100dvh - 4rem - 4.5rem)" }}>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:relative top-0 left-0 h-full z-40 w-72 flex flex-col bg-[#111111] border-r border-[rgba(240,237,230,0.07)] transition-transform duration-300 `}>
        <div className="flex items-center justify-between p-4 border-b border-[rgba(240,237,230,0.07)]">
          <span className="text-sm font-semibold text-[#F0EDE6]" style={{ fontFamily: "var(--font-dm-sans)" }}>
            Event<span className="text-[#C8F55A]">Slot</span> Assistant
          </span>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-[rgba(240,237,230,0.4)] hover:text-[#F0EDE6] text-lg">x</button>
        </div>

        <div className="p-3">
          <button
            onClick={() => { setActiveId(null); setSidebarOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[rgba(240,237,230,0.1)] text-[rgba(240,237,230,0.7)] hover:bg-[rgba(240,237,230,0.05)] hover:text-[#F0EDE6] text-sm transition-colors"
            style={{ fontFamily: "var(--font-dm-sans)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
          {loadingHistory ? (
            <div className="flex flex-col gap-2 mt-4 px-1">
              {[1,2,3].map(i => <div key={i} className="h-10 rounded-xl bg-[rgba(240,237,230,0.04)] animate-pulse" />)}
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-xs text-[rgba(240,237,230,0.25)] text-center mt-6 px-2">Your chats will appear here</p>
          ) : (
            sessions.map(s => (
              <div key={s.id} className="relative group">
                {renamingId === s.id ? (
                  <div className="px-2 py-1">
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitRename(s.id); if (e.key === "Escape") setRenamingId(null) }}
                      onBlur={() => commitRename(s.id)}
                      maxLength={80}
                      className="w-full bg-[#1A1A1A] border border-[rgba(200,245,90,0.4)] rounded-lg px-2.5 py-1.5 text-sm text-[#F0EDE6] focus:outline-none"
                      style={{ fontFamily: "var(--font-dm-sans)" }}
                    />
                  </div>
                ) : (
                  <button
                    onClick={() => { setActiveId(s.id); setSidebarOpen(false) }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors pr-8 `}
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                  >
                    <span className="block truncate">{s.label || "New chat"}</span>
                    <span className="block text-[0.63rem] opacity-40 mt-0.5">{s.ended ? "Ended - " : ""}{s.startedAt.toLocaleDateString()}</span>
                  </button>
                )}

                {renamingId !== s.id && (
                  <button
                    onClick={e => { e.stopPropagation(); setMenuId(menuId === s.id ? null : s.id) }}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-[rgba(240,237,230,0.3)] hover:text-[rgba(240,237,230,0.7)] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                    </svg>
                  </button>
                )}

                {menuId === s.id && (
                  <div onClick={e => e.stopPropagation()} className="absolute right-2 top-full mt-1 z-50 bg-[#1A1A1A] border border-[rgba(240,237,230,0.1)] rounded-xl overflow-hidden shadow-xl w-36">
                    <button
                      onClick={() => startRename(s.id, s.label)}
                      className="w-full text-left px-3 py-2.5 text-xs text-[rgba(240,237,230,0.7)] hover:bg-[rgba(240,237,230,0.05)] hover:text-[#F0EDE6] transition-colors flex items-center gap-2"
                      style={{ fontFamily: "var(--font-dm-sans)" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                      Rename
                    </button>
                    <button
                      onClick={() => deleteSession(s.id)}
                      className="w-full text-left px-3 py-2.5 text-xs text-[#EF4444]/80 hover:bg-[rgba(239,68,68,0.08)] hover:text-[#EF4444] transition-colors flex items-center gap-2"
                      style={{ fontFamily: "var(--font-dm-sans)" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(240,237,230,0.07)] bg-[#0A0A0A] flex-shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden text-[rgba(240,237,230,0.5)] hover:text-[#F0EDE6]" aria-label="Open sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className="text-sm text-[rgba(240,237,230,0.5)] truncate flex-1" style={{ fontFamily: "var(--font-dm-sans)" }}>
            {activeSession ? activeSession.label : "EventSlot Assistant"}
          </span>
          {activeSession && !activeSession.ended && (
            <button onClick={endSession} className="text-xs text-[rgba(240,237,230,0.3)] hover:text-[rgba(240,237,230,0.6)] transition-colors flex-shrink-0">End session</button>
          )}
        </div>

        {!activeSession && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5">
            {error ? (
              <div className="max-w-sm w-full text-center">
                <p className="text-[#EF4444] text-sm">{error}</p>
                <button onClick={() => setError(null)} className="mt-4 text-xs text-[rgba(240,237,230,0.4)] underline">Try again</button>
              </div>
            ) : (
              <div className="max-w-sm w-full flex flex-col items-center gap-5">
                <div className="text-center">
                  <h1 className="text-2xl font-semibold text-[#F0EDE6] mb-1" style={{ fontFamily: "var(--font-instrument-serif)" }}>
                    Event<span className="text-[#C8F55A]">Slot</span> Assistant
                  </h1>
                  <p className="text-sm text-[rgba(240,237,230,0.45)]">How would you like to connect?</p>
                </div>
                <button onClick={() => startNewSession("text")} disabled={loading} className="w-full bg-[#C8F55A] text-black font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:bg-[#b8e040] transition-colors disabled:opacity-50 text-sm" style={{ fontFamily: "var(--font-dm-sans)" }}>
                  Send a Message
                </button>
                <button onClick={() => startNewSession("voice")} disabled={loading} className="w-full border border-[rgba(240,237,230,0.12)] text-[#F0EDE6] font-medium py-3.5 rounded-2xl flex items-center justify-center gap-2 hover:border-[rgba(200,245,90,0.4)] hover:text-[#C8F55A] transition-colors disabled:opacity-50 text-sm" style={{ fontFamily: "var(--font-dm-sans)" }}>
                  Use Voice
                </button>
                <p className="text-xs text-[rgba(240,237,230,0.3)] text-center">5 free voice messages per month included</p>
              </div>
            )}
          </div>
        )}

        {activeSession && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
              {activeSession.messages.map((msg, i) => (
                <div key={i} className={`flex `}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-[#C8F55A] flex items-center justify-center text-xs font-bold text-black mr-2 mt-1 flex-shrink-0">E</div>
                  )}
                  <div
                    className={`max-w-[75%] sm:max-w-[65%] rounded-2xl px-4 py-3 text-sm leading-relaxed `}
                    style={{ fontFamily: "var(--font-dm-sans)" }}
                  >
                    {msg.isVoice && <span className="block text-xs opacity-50 mb-1">Voice message</span>}
                    <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
                  </div>
                </div>
              ))}
              {(loading || transcribing) && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-full bg-[#C8F55A] flex items-center justify-center text-xs font-bold text-black mr-2 mt-1 flex-shrink-0">E</div>
                  <div className="bg-[#1A1A1A] border border-[rgba(240,237,230,0.06)] rounded-2xl rounded-bl-sm px-4 py-3">
                    {transcribing ? (
                      <span className="text-xs text-[rgba(240,237,230,0.3)] animate-pulse">Transcribing...</span>
                    ) : (
                      <div className="flex gap-1.5 items-center h-4">
                        {[0,1,2].map(j => <div key={j} className={`w-1.5 h-1.5 rounded-full bg-[rgba(240,237,230,0.3)] animate-bounce`} style={{ animationDelay: ${j * 0.15}s }} />)}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {activeSession.ended && (
              <div className="px-4 pb-2 flex-shrink-0">
                <div className="flex items-center justify-between rounded-2xl border border-[rgba(200,245,90,0.2)] bg-[rgba(200,245,90,0.05)] px-4 py-3">
                  <span className="text-xs text-[rgba(200,245,90,0.8)]" style={{ fontFamily: "var(--font-dm-sans)" }}>Session ended</span>
                  <button onClick={() => setActiveId(null)} className="text-xs text-[#C8F55A] font-medium hover:underline">+ New chat</button>
                </div>
              </div>
            )}

            {!activeSession.ended && (
              <div className="px-4 pb-3 flex-shrink-0">
                {recording && (
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                    <span className="text-xs text-red-400" style={{ fontFamily: "var(--font-dm-sans)" }}>Recording... press send when done</span>
                  </div>
                )}
                {transcribing && (
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <span className="text-xs text-[rgba(240,237,230,0.4)] animate-pulse" style={{ fontFamily: "var(--font-dm-sans)" }}>Transcribing audio...</span>
                  </div>
                )}
                <div className="flex gap-2 items-end bg-[#141414] border border-[rgba(240,237,230,0.08)] rounded-2xl px-3 py-2">
                  <button
                    onClick={recording ? stopAndSend : startRecording}
                    disabled={loading || transcribing}
                    title={recording ? "Stop and send" : "Start voice recording"}
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all self-end mb-0.5  disabled:opacity-40`}
                  >
                    {recording ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-white"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                    ) : (
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[rgba(240,237,230,0.6)]">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                      </svg>
                    )}
                  </button>
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleTextareaInput}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input) } }}
                    disabled={loading || transcribing || recording}
                    placeholder={recording ? "" : "Message EventSlot Assistant..."}
                    rows={1}
                    className="flex-1 bg-transparent text-[#F0EDE6] text-sm placeholder:text-[rgba(240,237,230,0.25)] focus:outline-none resize-none py-2 max-h-36 overflow-y-auto disabled:opacity-50"
                    style={{ fontFamily: "var(--font-dm-sans)", lineHeight: "1.5" }}
                  />
                  <button
                    onClick={() => { if (recording) { stopAndSend(); return } sendMessage(input) }}
                    disabled={(!input.trim() && !recording) || loading || transcribing}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 hover:opacity-90 transition-colors self-end mb-0.5 `}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
