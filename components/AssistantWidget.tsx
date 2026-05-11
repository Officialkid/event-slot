"use client"

import { useState, useRef, useEffect } from "react"

type Message = {
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isVoice?: boolean
}

type Channel = "text" | "voice"

export function AssistantWidget() {
  const [isOpen, setIsOpen]             = useState(false)
  const [channel, setChannel]           = useState<Channel | null>(null)
  const [sessionId, setSessionId]       = useState<string | null>(null)
  const [messages, setMessages]         = useState<Message[]>([])
  const [input, setInput]               = useState("")
  const [loading, setLoading]           = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [recording, setRecording]       = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const messagesEndRef                  = useRef<HTMLDivElement>(null)
  const mediaRecorderRef                = useRef<MediaRecorder | null>(null)
  const chunksRef                       = useRef<Blob[]>([])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function addMessage(role: "user" | "assistant", content: string, isVoice = false) {
    setMessages(prev => [...prev, { role, content, timestamp: new Date(), isVoice }])
  }

  async function startSession(selectedChannel: Channel) {
    setChannel(selectedChannel)
    setLoading(true)
    setError(null)

    const res = await fetch("/api/assistant/session", {
      method: "POST",
      headers: { "x-channel": selectedChannel },
    })
    const data = await res.json()

    if (res.status === 429) {
      setError(data.message)
      setSessionEnded(true)
      setLoading(false)
      return
    }

    setSessionId(data.sessionId)
    addMessage("assistant", "Hi! Welcome to EventSlot support. How can I help you today?")
    setLoading(false)
  }

  async function sendMessage(text: string, isVoice = false) {
    if (!text.trim() || !sessionId || sessionEnded || loading) return

    addMessage("user", text, isVoice)
    setInput("")
    setLoading(true)

    const res = await fetch("/api/assistant/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message: text }),
    })
    const data = await res.json()

    addMessage("assistant", data.reply)
    if (data.sessionEnded) setSessionEnded(true)
    setLoading(false)
  }

  async function endSession() {
    if (!sessionId) return
    const res = await fetch(`/api/assistant/session/${sessionId}/end`, {
      method: "POST",
    })
    const data = await res.json()
    addMessage("assistant", data.message)
    setSessionEnded(true)
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const recorder = new MediaRecorder(stream)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
        await transcribeAndSend(blob)
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch {
      addMessage("assistant", "Microphone access was denied. Please type your question instead.")
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  async function transcribeAndSend(blob: Blob) {
    setTranscribing(true)

    const form = new FormData()
    form.append("audio", blob, "voice.webm")
    form.append("sessionId", sessionId ?? "")

    const res = await fetch("/api/assistant/transcribe", { method: "POST", body: form })

    if (!res.ok) {
      const data = await res.json()

      if (res.status === 402) {
        addMessage("assistant", data.message)
        setTranscribing(false)
        return
      }

      addMessage("assistant", "I couldn't process that voice message. Please type your question instead.")
      setTranscribing(false)
      return
    }

    const { text } = await res.json()
    setTranscribing(false)
    await sendMessage(text, true)
  }

  function reset() {
    setChannel(null)
    setSessionId(null)
    setMessages([])
    setInput("")
    setSessionEnded(false)
    setError(null)
    setRecording(false)
    setTranscribing(false)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full
                   bg-[#C8F55A] text-black shadow-xl hover:bg-[#b8e040]
                   hover:scale-110 transition-all duration-200 flex
                   items-center justify-center text-xl"
        aria-label="Open EventSlot Assistant"
      >
        {isOpen ? "✕" : "💬"}
      </button>

      {/* Window */}
      {isOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl
                     overflow-hidden shadow-2xl border border-[#2A2A2A]
                     bg-[#141414]"
          style={{ width: 384, height: 520 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3
                          bg-[#0A0A0A] border-b border-[#2A2A2A]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
              <span className="text-sm font-semibold text-white">
                Event<span className="text-[#C8F55A]">Slot</span>
                <span className="text-[#A3A3A3] font-normal"> Assistant</span>
              </span>
            </div>
            {sessionId && !sessionEnded && (
              <button
                onClick={endSession}
                className="text-xs text-[#525252] hover:text-[#A3A3A3] transition-colors"
              >
                End session
              </button>
            )}
          </div>

          {/* Channel selection */}
          {!channel && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
              {error ? (
                <p className="text-[#EF4444] text-sm text-center">{error}</p>
              ) : (
                <>
                  <p className="text-[#A3A3A3] text-sm text-center">
                    How would you like to connect?
                  </p>
                  <button
                    onClick={() => startSession("text")}
                    disabled={loading}
                    className="w-full bg-[#C8F55A] text-black font-bold py-3
                               rounded-xl flex items-center justify-center gap-2
                               hover:bg-[#b8e040] transition-colors disabled:opacity-50"
                  >
                    💬 Send a Message
                  </button>
                  <button
                    onClick={() => startSession("voice")}
                    disabled={loading}
                    className="w-full border border-[#2A2A2A] text-white font-medium
                               py-3 rounded-xl flex items-center justify-center gap-2
                               hover:border-[#C8F55A] hover:text-[#C8F55A] transition-colors
                               disabled:opacity-50"
                  >
                    🎙️ Use Voice
                  </button>
                  <p className="text-[#525252] text-xs text-center">
                    5 free voice messages per month included
                  </p>
                </>
              )}
            </div>
          )}

          {/* Messages */}
          {channel && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm
                        leading-relaxed
                        ${msg.role === "user"
                          ? "bg-[#C8F55A] text-black rounded-br-sm"
                          : "bg-[#1E1E1E] text-[#E5E5E5] rounded-bl-sm"
                        }`}
                    >
                      {msg.isVoice && (
                        <span className="block text-xs opacity-50 mb-1">
                          🎙️ Voice message
                        </span>
                      )}
                      <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
                    </div>
                  </div>
                ))}

                {(loading || transcribing) && (
                  <div className="flex justify-start">
                    <div className="bg-[#1E1E1E] rounded-2xl rounded-bl-sm px-4 py-3">
                      {transcribing ? (
                        <span className="text-xs text-[#525252] animate-pulse">
                          Transcribing...
                        </span>
                      ) : (
                        <div className="flex gap-1">
                          {[0, 1, 2].map(i => (
                            <div
                              key={i}
                              className="w-2 h-2 rounded-full bg-[#525252] animate-bounce"
                              style={{ animationDelay: `${i * 0.15}s` }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Session ended */}
              {sessionEnded && (
                <div className="p-3 border-t border-[#2A2A2A]">
                  <button
                    onClick={reset}
                    className="w-full text-sm text-[#C8F55A] border
                               border-[#C8F55A]/30 rounded-xl py-2
                               hover:bg-[#C8F55A]/10 transition-colors"
                  >
                    Start a new conversation
                  </button>
                </div>
              )}

              {/* Input */}
              {!sessionEnded && (
                <div className="border-t border-[#2A2A2A] p-3">
                  <div className="flex gap-2 items-end">
                    {channel === "voice" && (
                      <button
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                        onTouchStart={startRecording}
                        onTouchEnd={stopRecording}
                        disabled={loading || transcribing}
                        title="Hold to record"
                        className={`w-10 h-10 rounded-full flex items-center
                                   justify-center flex-shrink-0 transition-all
                                   ${recording
                                     ? "bg-red-500 scale-110 animate-pulse"
                                     : "bg-[#2A2A2A] hover:bg-[#3A3A3A]"
                                   } disabled:opacity-50`}
                      >
                        🎙️
                      </button>
                    )}
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          sendMessage(input)
                        }
                      }}
                      disabled={loading || transcribing}
                      placeholder={
                        channel === "voice"
                          ? "Hold 🎙️ to record, or type here..."
                          : "Type your message..."
                      }
                      rows={1}
                      className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A]
                                 rounded-xl px-3 py-2 text-white text-sm
                                 placeholder:text-[#525252] focus:outline-none
                                 focus:border-[#C8F55A] resize-none transition-colors
                                 disabled:opacity-50"
                    />
                    <button
                      onClick={() => sendMessage(input)}
                      disabled={!input.trim() || loading || transcribing}
                      className="w-10 h-10 rounded-full bg-[#C8F55A] text-black
                                 flex items-center justify-center flex-shrink-0
                                 hover:bg-[#b8e040] transition-colors
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ↑
                    </button>
                  </div>
                  {channel === "voice" && recording && (
                    <p className="text-red-400 text-xs text-center mt-2 animate-pulse">
                      Recording... release to send
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </>
  )
}
