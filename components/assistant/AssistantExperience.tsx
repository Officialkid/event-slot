"use client"

import { useState, useRef, useEffect, useCallback } from "react"

type AssistantExperienceProps = {
  fullPage?: boolean
  onClose?: () => void
}

type Message = {
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isVoice?: boolean
  images?: string[]
}

export function AssistantExperience({ fullPage = false, onClose }: AssistantExperienceProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null)
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [waitMinutes, setWaitMinutes] = useState(0)

  const [pendingImages, setPendingImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])

  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState("")
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function parseJsonSafely(res: Response): Promise<Record<string, unknown>> {
    const bodyText = await res.text()
    if (!bodyText) return {}
    try {
      return JSON.parse(bodyText) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function addMessage(role: "user" | "assistant", content: string, images?: string[], isVoice = false) {
    setMessages((prev) => [...prev, { role, content, timestamp: new Date(), images, isVoice }])
  }

  const startSession = useCallback(async (selectedChannel: "text" | "voice") => {
    if (sessionId || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/assistant/session", {
        method: "POST",
        headers: { "x-channel": selectedChannel },
      })

      const data = await parseJsonSafely(res)

      if (res.status === 429) {
        setError(typeof data.message === "string" ? data.message : "Daily assistant session limit reached.")
        setSessionEnded(true)
        return
      }

      if (!res.ok || typeof data.sessionId !== "string") {
        setError(typeof data.message === "string" ? data.message : "Unable to start assistant right now. Please try again shortly.")
        return
      }

      setSessionId(data.sessionId)
      addMessage("assistant", "Hi! Welcome to EventSlot support. How can I help you today?")
    } catch {
      setError("Unable to start assistant right now. Please try again shortly.")
    } finally {
      setLoading(false)
    }
  }, [loading, sessionId])

  useEffect(() => {
    if (!sessionId && !sessionEnded) {
      void startSession("text")
    }
  }, [sessionId, sessionEnded, startSession])

  async function sendMessage(text: string, isVoice = false) {
    if ((!text.trim() && pendingImages.length === 0) || !sessionId || sessionEnded || loading) return

    const previews = [...imagePreviews]
    addMessage("user", text, previews.length > 0 ? previews : undefined, isVoice)

    const form = new FormData()
    form.append("sessionId", sessionId)
    form.append("message", text)
    pendingImages.forEach((img) => form.append("images", img))

    setInput("")
    setPendingImages([])
    setImagePreviews([])
    setLoading(true)

    try {
      const res = await fetch("/api/assistant/message", { method: "POST", body: form })
      const data = await parseJsonSafely(res)

      if (typeof data.creditsRemaining === "number") setCreditsRemaining(data.creditsRemaining)

      if (res.status === 429) {
        setQuotaExceeded(true)
        setWaitMinutes(typeof data.waitMinutes === "number" ? data.waitMinutes : 0)
        addMessage("assistant", typeof data.reply === "string" ? data.reply : "You have reached your limit for now.")
        if (data.showFeedback === true) setShowFeedback(true)
        return
      }

      if (!res.ok) {
        addMessage("assistant", typeof data.error === "string" ? data.error : "I'm having trouble responding right now. Please try again shortly.")
        return
      }

      addMessage("assistant", typeof data.reply === "string" ? data.reply : "I had trouble processing that. Please try again.")
      if (data.sessionEnded === true) setSessionEnded(true)
    } catch {
      addMessage("assistant", "I'm having trouble responding right now. Please try again shortly.")
    } finally {
      setLoading(false)
    }
  }

  async function endSession() {
    if (!sessionId) return
    try {
      const res = await fetch(`/api/assistant/session/${sessionId}/end`, { method: "POST" })
      const data = await parseJsonSafely(res)
      addMessage(
        "assistant",
        typeof data.message === "string"
          ? data.message
          : "Thank you for contacting EventSlot. This session has ended."
      )
      setSessionEnded(true)
    } catch {
      addMessage("assistant", "Unable to end session cleanly right now. You can start a new chat.")
      setSessionEnded(true)
    }
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (pendingImages.length + files.length > 3) {
      alert("Maximum 3 images per message")
      return
    }

    files.forEach((file) => {
      if (file.size > 4 * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum 4MB per image.`)
        return
      }
      const reader = new FileReader()
      reader.onload = (ev) => {
        setImagePreviews((prev) => [...prev, ev.target?.result as string])
      }
      reader.readAsDataURL(file)
    })

    setPendingImages((prev) => [...prev, ...files])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function removeImage(index: number) {
    setPendingImages((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
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
        stream.getTracks().forEach((t) => t.stop())
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

    try {
      const res = await fetch("/api/assistant/transcribe", { method: "POST", body: form })
      const data = await parseJsonSafely(res)

      if (!res.ok) {
        addMessage("assistant", typeof data.message === "string" ? data.message : "Couldn't process that voice message. Please type instead.")
        return
      }

      const text = typeof data.text === "string" ? data.text : ""
      if (!text.trim()) {
        addMessage("assistant", "Couldn't process that voice message. Please type instead.")
        return
      }

      await sendMessage(text, true)
    } finally {
      setTranscribing(false)
    }
  }

  async function submitFeedback() {
    if (feedbackRating === 0) return
    try {
      await fetch("/api/assistant/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: feedbackRating, comment: feedbackComment }),
      })
      setFeedbackSubmitted(true)
    } catch {
      addMessage("assistant", "Feedback service is temporarily unavailable. Please try again shortly.")
    }
  }

  function reset() {
    setSessionId(null)
    setMessages([])
    setInput("")
    setSessionEnded(false)
    setError(null)
    setQuotaExceeded(false)
    setWaitMinutes(0)
    setPendingImages([])
    setImagePreviews([])
    setShowFeedback(false)
    setFeedbackRating(0)
    setFeedbackComment("")
    setFeedbackSubmitted(false)
    setCreditsRemaining(null)
  }

  const creditColor =
    creditsRemaining === null
      ? "#525252"
      : creditsRemaining <= 3
        ? "#EF4444"
        : creditsRemaining <= 8
          ? "#F59E0B"
          : "#22C55E"

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-[#2A2A2A] bg-[#141414]"
      style={fullPage ? { width: "100%", height: "calc(100dvh - 8.5rem)" } : { width: "min(384px, calc(100vw - 2rem))", height: "min(560px, calc(100dvh - 8rem))" }}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-[#0A0A0A] border-b border-[#2A2A2A]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse" />
          <span className="text-sm font-semibold text-white">
            Event<span className="text-[#C8F55A]">Slot</span>
            <span className="text-[#A3A3A3] font-normal"> Assistant</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {creditsRemaining !== null && !quotaExceeded && (
            <span className="text-xs" style={{ color: creditColor }}>
              {creditsRemaining} credits
            </span>
          )}
          {sessionId && !sessionEnded && (
            <button onClick={endSession} className="text-xs text-[#525252] hover:text-[#A3A3A3] transition-colors">
              End
            </button>
          )}
          {onClose && (
            <button onClick={onClose} aria-label="Close assistant" className="text-xs text-[#525252] hover:text-[#A3A3A3] transition-colors">
              Close
            </button>
          )}
        </div>
      </div>

      {!sessionId && error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <p className="text-[#EF4444] text-sm text-center">{error}</p>
          <button
            onClick={() => {
              setSessionEnded(false)
              setError(null)
            }}
            className="w-full border border-[#2A2A2A] text-white font-medium py-3 rounded-xl hover:border-[#C8F55A] hover:text-[#C8F55A] transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user" ? "bg-[#C8F55A] text-black rounded-br-sm" : "bg-[#1E1E1E] text-[#E5E5E5] rounded-bl-sm"
                  }`}
                >
                  {msg.isVoice && <span className="block text-xs opacity-50 mb-1">Voice</span>}
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-2">
                      {msg.images.map((src, j) => (
                        <img key={j} src={src} alt="Screenshot" className="w-20 h-20 object-cover rounded-lg border border-black/20" />
                      ))}
                    </div>
                  )}
                  <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
                </div>
              </div>
            ))}

            {(loading || transcribing) && sessionId && (
              <div className="flex justify-start">
                <div className="bg-[#1E1E1E] rounded-2xl rounded-bl-sm px-4 py-3">
                  {transcribing ? (
                    <span className="text-xs text-[#525252] animate-pulse">Transcribing...</span>
                  ) : (
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-2 h-2 rounded-full bg-[#525252] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {showFeedback && !feedbackSubmitted && (
            <div className="border-t border-[#2A2A2A] p-4 bg-[#0A0A0A]">
              <p className="text-white text-xs font-semibold mb-2">How was your experience?</p>
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setFeedbackRating(star)} className={`text-xl transition-all ${star <= feedbackRating ? "text-[#C8F55A]" : "text-[#2A2A2A]"}`}>
                    ★
                  </button>
                ))}
              </div>
              {feedbackRating > 0 && (
                <>
                  <textarea
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value.slice(0, 200))}
                    placeholder="Any comments? (optional)"
                    rows={2}
                    className="w-full bg-[#141414] border border-[#2A2A2A] rounded-lg px-3 py-2 text-white text-xs placeholder:text-[#525252] focus:outline-none focus:border-[#C8F55A] resize-none mb-2"
                  />
                  <button onClick={submitFeedback} className="w-full bg-[#C8F55A] text-black text-xs font-bold py-2 rounded-lg hover:bg-[#b8e040] transition-colors">
                    Submit Feedback
                  </button>
                </>
              )}
            </div>
          )}

          {feedbackSubmitted && showFeedback && (
            <div className="border-t border-[#2A2A2A] p-3 text-center">
              <p className="text-[#22C55E] text-xs">Thank you for your feedback! 🌟</p>
            </div>
          )}

          {quotaExceeded && (
            <div className="border-t border-[#2A2A2A] p-3">
              <p className="text-[#F59E0B] text-xs text-center mb-2">Resets in {waitMinutes} minutes</p>
              <button onClick={reset} className="w-full text-xs text-[#525252] border border-[#2A2A2A] rounded-xl py-2 hover:text-[#A3A3A3] transition-colors">
                Close
              </button>
            </div>
          )}

          {sessionEnded && !quotaExceeded && (
            <div className="p-3 border-t border-[#2A2A2A]">
              <button onClick={reset} className="w-full text-sm text-[#C8F55A] border border-[#C8F55A]/30 rounded-xl py-2 hover:bg-[#C8F55A]/10 transition-colors">
                Start new conversation
              </button>
            </div>
          )}

          {!sessionEnded && !quotaExceeded && (
            <div className="border-t border-[#2A2A2A] p-3">
              {imagePreviews.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-2">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} alt="" className="w-14 h-14 object-cover rounded-lg" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center leading-none"
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-end">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pendingImages.length >= 3 || loading}
                  title="Upload screenshot (max 3, 4MB each)"
                  className="w-9 h-9 rounded-full bg-[#2A2A2A] flex items-center justify-center text-sm flex-shrink-0 hover:bg-[#3A3A3A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  📎
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />

                <button
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  disabled={loading || transcribing || !sessionId}
                  className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all text-sm ${recording ? "bg-red-500 scale-110 animate-pulse" : "bg-[#2A2A2A] hover:bg-[#3A3A3A]"} disabled:opacity-50`}
                >
                  🎙️
                </button>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void sendMessage(input)
                    }
                  }}
                  disabled={loading || transcribing || !sessionId}
                  placeholder={pendingImages.length > 0 ? "Add a message about this screenshot..." : "Type or attach a screenshot..."}
                  rows={1}
                  className="flex-1 bg-[#0A0A0A] border border-[#2A2A2A] rounded-xl px-3 py-2 text-white text-sm placeholder:text-[#525252] focus:outline-none focus:border-[#C8F55A] resize-none transition-colors disabled:opacity-50"
                />

                <button
                  onClick={() => void sendMessage(input)}
                  disabled={(!input.trim() && pendingImages.length === 0) || loading || transcribing || !sessionId}
                  className="w-9 h-9 rounded-full bg-[#C8F55A] text-black flex items-center justify-center flex-shrink-0 hover:bg-[#b8e040] transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold"
                >
                  ↑
                </button>
              </div>

              {creditsRemaining !== null && (
                <p className="text-xs text-center mt-1.5" style={{ color: creditColor }}>
                  {creditsRemaining} of 20 credits remaining
                  {pendingImages.length > 0 && ` · images cost ${pendingImages.length * 3} credits`}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
