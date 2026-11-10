"use client"

import Image from "next/image"
import { useState, useRef, useEffect, useCallback } from "react"
import type { EventDraftPreview } from "@/lib/assistant/draft-preparation"
import { EventDraftPreviewCard } from "@/components/assistant/EventDraftPreviewCard"
import {
  EventRegistrationsCard,
  type RegistrationOverviewEvent,
} from "@/components/assistant/EventRegistrationsCard"

type AssistantExperienceProps = {
  fullPage?: boolean
  onClose?: () => void
}

export type ActionProposalPreview = {
  title: string
  summary: string
  targetEvent: { id: string; slug: string; title: string }
  fields: Array<{ key: string; label: string; previousValue: any; proposedValue: any }>
  impactWarnings?: string[]
}

type Message = {
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isVoice?: boolean
  images?: string[]
  draftPreview?: EventDraftPreview | null
  proposalId?: string | null
  idempotencyKey?: string | null
  actionProposal?: ActionProposalPreview | null
  eventRegistrationsOverview?: RegistrationOverviewEvent[] | null
  confirmedEventResult?: {
    id: string
    title: string
    slug: string
    sideEffectsDeliveryStatus?: "ALL_DISPATCHED" | "PARTIALLY_DISPATCHED" | "FAILED" | "NONE"
  } | null
  proposalStatus?: "PENDING" | "EXECUTING" | "COMPLETED" | "CANCELLED" | "EXPIRED" | "FAILED" | null
  confirmationError?: string | null
}

function isEventDraftPreview(value: unknown): value is EventDraftPreview {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as { draftId?: unknown }).draftId === "string" &&
    (value as { isLiveEvent?: unknown }).isLiveEvent === false
  )
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
  const [confirmingProposalId, setConfirmingProposalId] = useState<string | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  async function copyMessageText(content: string, index: number) {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIndex(index)
      setTimeout(() => {
        setCopiedIndex(null)
      }, 2000)
    } catch {
      // Fallback
    }
  }

  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null)
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [waitMinutes, setWaitMinutes] = useState(0)

  const [pendingImages, setPendingImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])

  const [showFeedback, setShowFeedback] = useState(false)
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackComment, setFeedbackComment] = useState("")
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [sessionStartAttempted, setSessionStartAttempted] = useState(false)
  const [memoryAvailable, setMemoryAvailable] = useState(false)
  const [memoryEnabled, setMemoryEnabled] = useState(false)
  const [memoryBusy, setMemoryBusy] = useState(false)

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

  useEffect(() => {
    let cancelled = false

    async function loadMemoryPreference() {
      try {
        const res = await fetch("/api/assistant/memory")
        const data = await parseJsonSafely(res)
        if (cancelled) return

        if (res.ok && data.available === true) {
          setMemoryAvailable(true)
          setMemoryEnabled(data.memoryEnabled === true)
          return
        }

        setMemoryAvailable(false)
        setMemoryEnabled(false)
      } catch {
        if (!cancelled) {
          setMemoryAvailable(false)
          setMemoryEnabled(false)
        }
      }
    }

    void loadMemoryPreference()

    return () => {
      cancelled = true
    }
  }, [])

  async function toggleMemory() {
    if (!memoryAvailable || memoryBusy) return

    const next = !memoryEnabled
    setMemoryBusy(true)

    try {
      const res = await fetch("/api/assistant/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryEnabled: next }),
      })
      const data = await parseJsonSafely(res)

      if (!res.ok) {
        addMessage("assistant", "Unable to update memory preference right now. Please try again shortly.")
        return
      }

      setMemoryEnabled(data.memoryEnabled === true)
    } catch {
      addMessage("assistant", "Unable to update memory preference right now. Please try again shortly.")
    } finally {
      setMemoryBusy(false)
    }
  }

  function addMessage(
    role: "user" | "assistant",
    content: string,
    images?: string[],
    isVoice = false,
    draftPreview?: EventDraftPreview | null,
    proposalId?: string | null,
    idempotencyKey?: string | null,
    actionProposal?: ActionProposalPreview | null,
    eventRegistrationsOverview?: RegistrationOverviewEvent[] | null
  ) {
    setMessages((prev) => [
      ...prev,
      {
        role,
        content,
        timestamp: new Date(),
        images,
        isVoice,
        draftPreview,
        proposalId,
        idempotencyKey,
        actionProposal,
        eventRegistrationsOverview,
      },
    ])
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

      if (res.status === 401) {
        setError("Please sign in to use the EventSlot assistant.")
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
    if (!sessionId && !sessionEnded && !sessionStartAttempted) {
      setSessionStartAttempted(true)
      void startSession("text")
    }
  }, [sessionId, sessionEnded, sessionStartAttempted, startSession])

  async function sendMessage(text: string, isVoice = false) {
    if ((!text.trim() && pendingImages.length === 0) || !sessionId || sessionEnded || loading) return

    const previews = [...imagePreviews]
    addMessage("user", text, previews.length > 0 ? previews : undefined, isVoice)

    const form = new FormData()
    form.append("sessionId", sessionId)
    form.append("message", text)
    form.append("memoryEnabled", String(memoryEnabled))
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

      const draftPreview = isEventDraftPreview(data.draftPreview) ? data.draftPreview : null
      const proposalObj =
        data.proposal && typeof data.proposal === "object"
          ? (data.proposal as { proposalId?: string; idempotencyKey?: string; preview?: ActionProposalPreview })
          : null
      const eventRegistrationsOverview = Array.isArray(data.eventRegistrationsOverview)
        ? (data.eventRegistrationsOverview as RegistrationOverviewEvent[])
        : null

      addMessage(
        "assistant",
        typeof data.reply === "string" ? data.reply : "I had trouble processing that. Please try again.",
        undefined,
        false,
        draftPreview,
        proposalObj?.proposalId ?? null,
        proposalObj?.idempotencyKey ?? null,
        proposalObj?.preview ?? null,
        eventRegistrationsOverview
      )
      if (data.sessionEnded === true) setSessionEnded(true)
    } catch {
      addMessage("assistant", "I'm having trouble responding right now. Please try again shortly.")
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmCreation(proposalId: string, idempotencyKey: string) {
    if (!sessionId || loading || confirmingProposalId) return
    setLoading(true)
    setConfirmingProposalId(proposalId)
    try {
      const res = await fetch("/api/assistant/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          actionType: "CONFIRM_ACTION",
          proposalId,
          idempotencyKey,
        }),
      })
      const data = await parseJsonSafely(res)
      if (data.ok && (data.createdEvent || data.updatedEvent || data.code === "COMPLETED")) {
        setMessages((prev) =>
          prev.map((m) =>
            m.proposalId === proposalId || (m.draftPreview && !m.proposalId)
              ? {
                  ...m,
                  confirmedEventResult: data.createdEvent
                    ? {
                        id: String((data.createdEvent as Record<string, unknown>).id),
                        title: String((data.createdEvent as Record<string, unknown>).title),
                        slug: String((data.createdEvent as Record<string, unknown>).slug),
                        sideEffectsDeliveryStatus: data.sideEffectsDeliveryStatus as any,
                      }
                    : null,
                  proposalStatus: "COMPLETED",
                  confirmationError: null,
                }
              : m
          )
        )
      } else {
        const status =
          data.code === "PROPOSAL_CANCELLED"
            ? "CANCELLED"
            : data.code === "PROPOSAL_EXPIRED"
            ? "EXPIRED"
            : "FAILED"
        setMessages((prev) =>
          prev.map((m) =>
            m.proposalId === proposalId || (m.draftPreview && !m.proposalId)
              ? {
                  ...m,
                  proposalStatus: status,
                  confirmationError:
                    typeof data.reply === "string"
                      ? data.reply
                      : typeof data.error === "string"
                      ? data.error
                      : "Action could not be completed.",
                }
              : m
          )
        )
      }
      addMessage(
        "assistant",
        typeof data.reply === "string" ? data.reply : "Action completed."
      )
    } catch {
      addMessage("assistant", "I'm having trouble executing that confirmation right now.")
    } finally {
      setLoading(false)
      setConfirmingProposalId(null)
    }
  }

  async function handleCancelProposal(proposalId: string) {
    if (!sessionId || loading || confirmingProposalId) return
    setLoading(true)
    try {
      const res = await fetch("/api/assistant/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          actionType: "CANCEL_ACTION",
          proposalId,
        }),
      })
      const data = await parseJsonSafely(res)
      if (data.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.proposalId === proposalId || (m.draftPreview && !m.proposalId)
              ? {
                  ...m,
                  proposalStatus: "CANCELLED",
                  confirmationError: null,
                }
              : m
          )
        )
      }
      addMessage(
        "assistant",
        typeof data.reply === "string" ? data.reply : "Action cancelled."
      )
    } catch {
      addMessage("assistant", "I'm having trouble cancelling that action right now.")
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
    setSessionStartAttempted(false)
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
      className="flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-[#E2E8F0] dark:border-[#2A2A2A] bg-white dark:bg-[#141414] text-[#0F172A] dark:text-[#F0EDE6]"
      style={fullPage ? { width: "100%", height: "calc(100dvh - 8.5rem)" } : { width: "min(384px, calc(100vw - 2rem))", height: "min(560px, calc(100dvh - 8rem))" }}
    >
      <div className="flex items-center justify-between px-4 py-3 bg-[#F8FAFC] dark:bg-[#0A0A0A] border-b border-[#E2E8F0] dark:border-[#2A2A2A]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#16A34A] animate-pulse" />
          <span className="text-sm font-semibold text-[#0F172A] dark:text-white">
            Event<span className="text-[#15803D] dark:text-[#C8F55A]">Slot</span>
            <span className="text-[#64748B] dark:text-[#A3A3A3] font-normal"> Assistant</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          {memoryAvailable && (
            <button
              type="button"
              onClick={() => void toggleMemory()}
              disabled={memoryBusy}
              className={`text-[11px] border rounded-full px-2.5 py-0.5 transition-colors ${
                memoryEnabled
                  ? "border-[#15803D]/60 bg-[#15803D]/10 text-[#15803D] dark:border-[#C8F55A]/70 dark:bg-transparent dark:text-[#C8F55A]"
                  : "border-[#E2E8F0] bg-white text-[#64748B] dark:border-[#3A3A3A] dark:bg-transparent dark:text-[#7A7A7A] hover:text-[#0F172A] dark:hover:text-[#A3A3A3]"
              } disabled:opacity-50`}
              title={memoryEnabled ? "Assistant memory is ON" : "Assistant memory is OFF"}
            >
              Memory {memoryEnabled ? "ON" : "OFF"}
            </button>
          )}
          {sessionId && !sessionEnded && (
            <button onClick={endSession} className="text-xs text-[#64748B] hover:text-[#0F172A] dark:text-[#525252] dark:hover:text-[#A3A3A3] transition-colors">
              End
            </button>
          )}
          {onClose && (
            <button onClick={onClose} aria-label="Close assistant" className="text-xs text-[#64748B] hover:text-[#0F172A] dark:text-[#525252] dark:hover:text-[#A3A3A3] transition-colors">
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
                  className={`${
                    msg.draftPreview ? "w-full max-w-[95%]" : "max-w-[82%]"
                  } rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user" ? "bg-[#15803D] text-white rounded-br-sm shadow-sm" : "bg-[#F1F5F9] dark:bg-[#1E1E1E] text-[#0F172A] dark:text-[#E5E5E5] rounded-bl-sm border border-[#E2E8F0] dark:border-transparent"
                  }`}
                >
                  {msg.isVoice && <span className="block text-xs opacity-50 mb-1">Voice</span>}
                  {msg.images && msg.images.length > 0 && (
                    <div className="flex gap-1 flex-wrap mb-2">
                      {msg.images.map((src, j) => (
                        <Image
                          key={j}
                          src={src}
                          alt="Screenshot"
                          width={80}
                          height={80}
                          unoptimized
                          className="w-20 h-20 object-cover rounded-lg border border-black/20"
                        />
                      ))}
                    </div>
                  )}
                  <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
                  {msg.role === "assistant" && (
                    <div className="mt-1.5 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => copyMessageText(msg.content, i)}
                        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-[#64748B] hover:text-[#0F172A] dark:text-[#A1A1AA] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                        title="Copy content"
                      >
                        {copiedIndex === i ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 8.5l3.5 3.5 6.5-7" />
                            </svg>
                            <span className="text-[#16A34A] font-medium text-[10px]">Copied!</span>
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="5" y="5" width="8" height="8" rx="1.5" />
                              <path d="M3.5 10.5V3.5a1 1 0 011-1h7" />
                            </svg>
                            <span className="text-[10px]">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  {msg.role === "assistant" && msg.draftPreview && (
                    <EventDraftPreviewCard
                      preview={msg.draftPreview}
                      proposalId={msg.proposalId}
                      idempotencyKey={msg.idempotencyKey}
                      onSuggestCorrection={(promptText) => setInput(promptText)}
                      onConfirmCreation={handleConfirmCreation}
                      onCancelProposal={handleCancelProposal}
                      isConfirming={confirmingProposalId === msg.proposalId || loading}
                      confirmedEventResult={msg.confirmedEventResult}
                      proposalStatus={msg.proposalStatus}
                      errorMessage={msg.confirmationError}
                    />
                  )}

                  {msg.role === "assistant" && msg.actionProposal && (
                    <div
                      data-testid="action-proposal-card"
                      className="mt-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] p-3.5 text-xs text-[#0F172A] dark:text-[#F0EDE6] shadow-sm dark:shadow-lg"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] dark:border-[#2A2A2A] pb-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2 w-2 rounded-full bg-[#15803D] dark:bg-[#C8F55A]" />
                          <span className="font-semibold tracking-wide uppercase text-[11px]">
                            {msg.actionProposal.title}
                          </span>
                        </div>
                        <span className="rounded-full border border-[#15803D]/30 bg-[#15803D]/10 text-[#15803D] dark:border-[#C8F55A]/50 dark:bg-[#C8F55A]/10 dark:text-[#C8F55A] px-2 py-0.5 text-[9px] font-semibold uppercase">
                          Confirmation Required
                        </span>
                      </div>

                      <p className="mt-2 text-[11px] text-[#475569] dark:text-[#A3A3A3]">
                        {msg.actionProposal.summary}
                      </p>

                      <div className="mt-2.5 space-y-1.5">
                        {msg.actionProposal.fields.map((f) => (
                          <div
                            key={f.key}
                            className="rounded-lg bg-[#F8FAFC] dark:bg-[#141414] border border-[#F1F5F9] dark:border-transparent px-2.5 py-1.5"
                          >
                            <span className="block text-[9px] uppercase tracking-wide text-[#64748B] dark:text-[#8A8A8A]">
                              {f.label}
                            </span>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                              <span className="text-[#64748B] dark:text-[#8A8A8A] line-through">
                                {String(f.previousValue ?? "None")}
                              </span>
                              <span className="text-[#15803D] dark:text-[#C8F55A] font-semibold">→</span>
                              <span className="font-medium text-[#0F172A] dark:text-[#F0EDE6]">
                                {String(f.proposedValue)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {msg.actionProposal.impactWarnings && msg.actionProposal.impactWarnings.length > 0 && (
                        <div className="mt-2.5 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-2 text-[10px] text-[#D97706] dark:text-[#F59E0B]">
                          {msg.actionProposal.impactWarnings.join(" ")}
                        </div>
                      )}

                      {msg.proposalStatus === "COMPLETED" ? (
                        <div className="mt-3 rounded-lg border border-[#15803D]/40 bg-[#15803D]/10 p-2 text-center text-xs font-semibold text-[#15803D] dark:text-[#C8F55A]">
                          ✓ Change Applied Successfully
                        </div>
                      ) : msg.proposalStatus === "CANCELLED" ? (
                        <div className="mt-3 rounded-lg border border-[#E2E8F0] dark:border-[#3A3A3A] bg-[#F8FAFC] dark:bg-[#141414] p-2 text-center text-xs text-[#64748B] dark:text-[#A3A3A3]">
                          Proposal Cancelled
                        </div>
                      ) : (
                        msg.proposalId &&
                        msg.idempotencyKey && (
                          <div className="mt-3 border-t border-[#E2E8F0] dark:border-[#2A2A2A] pt-2.5 flex gap-2">
                            <button
                              type="button"
                              disabled={loading || confirmingProposalId === msg.proposalId}
                              onClick={() => void handleConfirmCreation(msg.proposalId!, msg.idempotencyKey!)}
                              className="flex-1 rounded-lg bg-[#15803D] dark:bg-[#C8F55A] py-1.5 text-xs font-semibold text-white dark:text-black hover:opacity-90 transition-opacity disabled:opacity-40"
                            >
                              {confirmingProposalId === msg.proposalId ? "Applying..." : "Confirm & Apply"}
                            </button>
                            <button
                              type="button"
                              disabled={loading || confirmingProposalId === msg.proposalId}
                              onClick={() => void handleCancelProposal(msg.proposalId!)}
                              className="rounded-lg border border-[#E2E8F0] dark:border-[#3A3A3A] bg-white dark:bg-[#141414] px-3 py-1.5 text-xs text-[#64748B] dark:text-[#A3A3A3] hover:text-red-500 transition-colors disabled:opacity-40"
                            >
                              Cancel
                            </button>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {msg.role === "assistant" && msg.eventRegistrationsOverview && msg.eventRegistrationsOverview.length > 0 && (
                    <EventRegistrationsCard
                      events={msg.eventRegistrationsOverview}
                      onSelectEventForInsights={(title) => {
                        setInput(`Give me registration insights for ${title}`)
                      }}
                    />
                  )}
                </div>
              </div>
            ))}

            {(loading || transcribing) && sessionId && (
              <div className="flex justify-start">
                <div className="bg-[#F1F5F9] dark:bg-[#1E1E1E] rounded-2xl rounded-bl-sm px-4 py-3 border border-[#E2E8F0] dark:border-transparent">
                  {transcribing ? (
                    <span className="text-xs text-[#64748B] dark:text-[#525252] animate-pulse">Transcribing...</span>
                  ) : (
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-2 h-2 rounded-full bg-[#94A3B8] dark:bg-[#525252] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {messages.filter((m) => m.role === "user").length === 0 && !sessionEnded && !quotaExceeded && (
              <div className="pt-2 pb-1 px-1">
                <p className="text-[11px] font-medium text-[#64748B] dark:text-[#8A8A8A] mb-2">
                  Suggestions to get started:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setInput("Create a new event")
                    }}
                    className="rounded-full border border-[#E2E8F0] dark:border-[#2A2A2A] bg-white dark:bg-[#1E1E1E] px-3 py-1.5 text-xs text-[#0F172A] dark:text-[#E5E5E5] hover:border-[#15803D] dark:hover:border-[#C8F55A] hover:text-[#15803D] dark:hover:text-[#C8F55A] transition-colors shadow-sm"
                  >
                    ➕ Create a new event
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInput("Check my event registrations")
                    }}
                    className="rounded-full border border-[#E2E8F0] dark:border-[#2A2A2A] bg-white dark:bg-[#1E1E1E] px-3 py-1.5 text-xs text-[#0F172A] dark:text-[#E5E5E5] hover:border-[#15803D] dark:hover:border-[#C8F55A] hover:text-[#15803D] dark:hover:text-[#C8F55A] transition-colors shadow-sm"
                  >
                    📊 Check my registrations
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInput("Draft an event from this poster: ")
                    }}
                    className="rounded-full border border-[#E2E8F0] dark:border-[#2A2A2A] bg-white dark:bg-[#1E1E1E] px-3 py-1.5 text-xs text-[#0F172A] dark:text-[#E5E5E5] hover:border-[#15803D] dark:hover:border-[#C8F55A] hover:text-[#15803D] dark:hover:text-[#C8F55A] transition-colors shadow-sm"
                  >
                    📎 Draft from poster
                  </button>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {showFeedback && !feedbackSubmitted && (
            <div className="border-t border-[#E2E8F0] dark:border-[#2A2A2A] p-4 bg-[#F8FAFC] dark:bg-[#0A0A0A]">
              <p className="text-[#0F172A] dark:text-white text-xs font-semibold mb-2">How was your experience?</p>
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setFeedbackRating(star)} className={`text-xl transition-all ${star <= feedbackRating ? "text-[#15803D] dark:text-[#C8F55A]" : "text-[#CBD5E1] dark:text-[#2A2A2A]"}`}>
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
                    className="w-full bg-white dark:bg-[#141414] border border-[#E2E8F0] dark:border-[#2A2A2A] rounded-lg px-3 py-2 text-[#0F172A] dark:text-white text-xs placeholder:text-[#94A3B8] dark:placeholder:text-[#525252] focus:outline-none focus:border-[#15803D] dark:focus:border-[#C8F55A] resize-none mb-2"
                  />
                  <button onClick={submitFeedback} className="w-full bg-[#15803D] dark:bg-[#C8F55A] text-white dark:text-black text-xs font-bold py-2 rounded-lg hover:bg-[#166534] dark:hover:bg-[#b8e040] transition-colors">
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
            <div className="border-t border-[#E2E8F0] dark:border-[#2A2A2A] p-3 bg-white dark:bg-[#141414]">
              {imagePreviews.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-2">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative">
                      <Image
                        src={src}
                        alt="Preview"
                        width={56}
                        height={56}
                        unoptimized
                        className="w-14 h-14 object-cover rounded-lg"
                      />
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

              <div className="flex items-center gap-1.5 rounded-full border border-[#E2E8F0] dark:border-[#2A2A2A] bg-[#F8FAFC] dark:bg-[#1C1C1E] px-2 py-1.5 shadow-sm focus-within:border-[#15803D] dark:focus-within:border-[#C8F55A] transition-all">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={pendingImages.length >= 3 || loading}
                  title="Upload poster or screenshot (max 3, 4MB each)"
                  className="w-8 h-8 rounded-full bg-white dark:bg-[#2C2C2E] text-[#0F172A] dark:text-[#E5E5E5] flex items-center justify-center text-base font-semibold hover:bg-neutral-100 dark:hover:bg-[#3A3A3C] transition-all disabled:opacity-40 shadow-sm flex-shrink-0"
                >
                  +
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleImageSelect} className="hidden" />

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
                  placeholder={pendingImages.length > 0 ? "Describe this poster..." : "Ask EventSlot Assistant..."}
                  rows={1}
                  className="flex-1 bg-transparent px-2 py-1 text-xs sm:text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#71717A] focus:outline-none resize-none leading-relaxed"
                />

                <button
                  type="button"
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={stopRecording}
                  onTouchStart={startRecording}
                  onTouchEnd={stopRecording}
                  disabled={loading || transcribing || !sessionId}
                  title="Hold to record voice message"
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                    recording
                      ? "bg-red-500 scale-110 animate-pulse text-white"
                      : "text-[#64748B] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10"
                  } disabled:opacity-40`}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>

                <button
                  type="button"
                  onClick={() => void sendMessage(input)}
                  disabled={(!input.trim() && pendingImages.length === 0) || loading || transcribing || !sessionId}
                  className="w-8 h-8 rounded-full bg-[#15803D] dark:bg-[#C8F55A] text-white dark:text-black flex items-center justify-center font-bold hover:scale-105 transition-all disabled:opacity-30 disabled:scale-100 shadow-sm flex-shrink-0"
                  title="Send message"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
