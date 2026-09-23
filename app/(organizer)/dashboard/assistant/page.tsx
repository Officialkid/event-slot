"use client"

import React, { useState, useRef, useEffect } from "react"
import Link from "next/link"
import type {
  AsaEventDraft,
  AsaMessage,
  AsaFormProposal,
  AsaFormQuestion,
  QuestionType,
  AsaEventMetrics,
  AsaManagementAction,
  AsaEventListItem,
} from "@/lib/asa/asa-engine"

type CreatedEvent = {
  id: string
  title: string
  slug: string
  publicUrl: string
  dashboardUrl: string
  eventDate?: string | Date | null
  location?: string | null
  capacity?: number | null
}

const INITIAL_GREETING: AsaMessage = {
  role: "assistant",
  content: "Hi there! I'm ASA, your EventSlot assistant. How can I help you today?",
}

const QUICK_STARTERS = [
  { label: "📊 How is my event doing?", prompt: "How is my event doing?" },
  { label: "👥 Registered today", prompt: "How many people registered today?" },
  { label: "🎟️ Remaining slots", prompt: "How many slots are remaining?" },
  { label: "📍 Check-in status", prompt: "How many people have checked in?" },
  { label: "⚡ Increase capacity to 800", prompt: "Increase capacity to 800" },
  { label: "✨ Help me create an event", prompt: "Help me create an event." },
  {
    label: "Partners Dinner 2026",
    prompt:
      "I want to create an event called Partners Dinner 2026. It will be on 3 October 2026 at Swiss Lenana, from 3 PM to 6 PM, with a capacity of 500 people.",
  },
]

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Short Text",
  textarea: "Paragraph",
  number: "Number",
  email: "Email",
  phone: "Phone",
  select: "Dropdown",
  checkbox: "Checkboxes",
  file: "File Upload",
}

export default function AsaAssistantPage() {
  const [messages, setMessages] = useState<AsaMessage[]>([INITIAL_GREETING])
  const [draft, setDraft] = useState<AsaEventDraft>({ status: "collecting" })
  const [formProposal, setFormProposal] = useState<AsaFormProposal | null>(null)
  const [isFormApplied, setIsFormApplied] = useState(false)
  const [applyingQuestions, setApplyingQuestions] = useState(false)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null)
  const [editLabelText, setEditLabelText] = useState("")
  const [newQuestionLabel, setNewQuestionLabel] = useState("")
  const [newQuestionType, setNewQuestionType] = useState<QuestionType>("text")
  const [newQuestionRequired, setNewQuestionRequired] = useState(false)
  const [showAddQuestionRow, setShowAddQuestionRow] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [isReview, setIsReview] = useState(false)
  const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Phase 3 States: Event Intelligence, Management & Disambiguation
  const [organizerEvents, setOrganizerEvents] = useState<AsaEventListItem[]>([])
  const [selectedEvent, setSelectedEvent] = useState<AsaEventListItem | null>(null)
  const [eventMetrics, setEventMetrics] = useState<AsaEventMetrics | null>(null)
  const [pendingAction, setPendingAction] = useState<AsaManagementAction | null>(null)
  const [disambiguationOptions, setDisambiguationOptions] = useState<AsaEventListItem[] | null>(null)
  const [actionExecuting, setActionExecuting] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, isReview, createdEvent, eventMetrics, pendingAction, disambiguationOptions])

  // Load organizer's active events on mount
  useEffect(() => {
    async function loadOrganizerEvents() {
      try {
        const res = await fetch("/api/assistant/asa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "list_organizer_events" }),
        })
        const data = await res.json()
        if (data.success && Array.isArray(data.events)) {
          setOrganizerEvents(data.events)
          if (data.events.length === 1 && !selectedEvent) {
            setSelectedEvent(data.events[0])
          }
        }
      } catch (e) {
        console.warn("[ASA] Could not pre-fetch organizer events:", e)
      }
    }
    loadOrganizerEvents()
  }, [])

  const handleSend = async (messageText?: string) => {
    const textToSend = (messageText ?? input).trim()
    if (!textToSend || loading) return

    setInput("")
    setError(null)

    const nextMessages: AsaMessage[] = [...messages, { role: "user", content: textToSend }]
    setMessages(nextMessages)
    setLoading(true)

    try {
      const response = await fetch("/api/assistant/asa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages,
          draft,
          proposal: formProposal,
          pendingAction,
          eventId: selectedEvent?.id || formProposal?.eventId || createdEvent?.id,
          eventSlug: selectedEvent?.slug || formProposal?.eventSlug || createdEvent?.slug,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to process message with ASA.")
      }

      if (data.metrics) {
        setEventMetrics(data.metrics)
      }
      if (data.pendingAction) {
        setPendingAction(data.pendingAction)
      }
      if (data.actionExecuted) {
        setPendingAction(null)
      }
      if (data.actionCancelled) {
        setPendingAction(null)
      }
      if (data.needsDisambiguation && Array.isArray(data.eventsList)) {
        setDisambiguationOptions(data.eventsList)
      } else {
        setDisambiguationOptions(null)
      }

      if (data.created && data.event) {
        setCreatedEvent(data.event)
        setIsReview(false)
        if (data.formProposal) {
          setFormProposal(data.formProposal)
          setIsFormApplied(false)
        }
        const newEventItem: AsaEventListItem = {
          id: data.event.id,
          slug: data.event.slug,
          title: data.event.title,
          confirmedCount: 0,
          capacity: data.event.capacity ?? null,
          eventDate: data.event.eventDate ?? null,
          status: "active",
        }
        setOrganizerEvents((prev) => [newEventItem, ...prev])
        setSelectedEvent(newEventItem)
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply || `🎉 Congratulations! I've created your event **${data.event.title}**!`,
          },
        ])
      } else {
        if (data.draft) setDraft(data.draft)
        if (data.proposal) {
          setFormProposal(data.proposal)
          if (data.applied) setIsFormApplied(true)
        }
        setIsReview(Boolean(data.isReviewState))
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply,
          },
        ])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again."
      setError(msg)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Sorry, I encountered an issue: ${msg}`,
        },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  const handleConfirmCreate = async () => {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/assistant/asa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_create",
          draft,
          messages,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to create event.")
      }

      if (data.created && data.event) {
        setCreatedEvent(data.event)
        setIsReview(false)
        if (data.formProposal) {
          setFormProposal(data.formProposal)
          setIsFormApplied(false)
        }
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply || `🎉 Congratulations! I've created your event **${data.event.title}**!`,
          },
        ])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create event."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmManagementAction = async () => {
    if (!pendingAction || actionExecuting) return
    setActionExecuting(true)
    setError(null)
    try {
      const response = await fetch("/api/assistant/asa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute_management_action",
          pendingAction,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to execute management action.")
      }
      setPendingAction(null)
      if (data.metrics) {
        setEventMetrics(data.metrics)
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "✅ Action executed successfully.",
        },
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to execute action."
      setError(msg)
    } finally {
      setActionExecuting(false)
    }
  }

  const handleCancelManagementAction = async () => {
    if (!pendingAction || actionExecuting) return
    setActionExecuting(true)
    setError(null)
    try {
      const response = await fetch("/api/assistant/asa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_management_action",
          pendingAction,
        }),
      })
      const data = await response.json()
      setPendingAction(null)
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "Action cancelled.",
        },
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to cancel action."
      setError(msg)
    } finally {
      setActionExecuting(false)
    }
  }

  const handleToggleRequired = (id: string) => {
    if (!formProposal) return
    setFormProposal({
      ...formProposal,
      questions: formProposal.questions.map((q) =>
        q.id === id ? { ...q, required: !q.required } : q
      ),
    })
  }

  const handleDeleteQuestion = (id: string) => {
    if (!formProposal) return
    setFormProposal({
      ...formProposal,
      questions: formProposal.questions
        .filter((q) => q.id !== id)
        .map((q) => (q.condition?.questionId === id ? { ...q, condition: undefined } : q)),
    })
  }

  const handleMoveQuestion = (index: number, direction: "up" | "down") => {
    if (!formProposal) return
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= formProposal.questions.length) return
    const updated = [...formProposal.questions]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    setFormProposal({
      ...formProposal,
      questions: updated,
    })
  }

  const handleStartEditLabel = (id: string, currentLabel: string) => {
    setEditingQuestionId(id)
    setEditLabelText(currentLabel)
  }

  const handleSaveLabel = (id: string) => {
    if (!formProposal || !editLabelText.trim()) {
      setEditingQuestionId(null)
      return
    }
    setFormProposal({
      ...formProposal,
      questions: formProposal.questions.map((q) =>
        q.id === id ? { ...q, label: editLabelText.trim() } : q
      ),
    })
    setEditingQuestionId(null)
    setEditLabelText("")
  }

  const handleAddQuestion = () => {
    if (!formProposal || !newQuestionLabel.trim()) return
    const newQ: AsaFormQuestion = {
      id: `q_custom_${Date.now()}`,
      label: newQuestionLabel.trim(),
      type: newQuestionType,
      required: newQuestionRequired,
      ...(newQuestionType === "select" || newQuestionType === "checkbox" ? { options: ["Option 1", "Option 2"] } : {}),
    }
    setFormProposal({
      ...formProposal,
      questions: [...formProposal.questions, newQ],
    })
    setNewQuestionLabel("")
    setShowAddQuestionRow(false)
  }

  const handleApplyQuestions = async () => {
    const targetEventId = formProposal?.eventId || createdEvent?.id
    const targetEventSlug = formProposal?.eventSlug || createdEvent?.slug
    if (!formProposal || applyingQuestions || !targetEventId) return
    setApplyingQuestions(true)
    setError(null)
    try {
      const response = await fetch("/api/assistant/asa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "apply_questions",
          eventId: targetEventId,
          eventSlug: targetEventSlug,
          questions: formProposal.questions,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to apply questions.")
      }

      setIsFormApplied(true)
      setFormProposal(data.proposal || { ...formProposal, status: "applied" })
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            data.reply ||
            `🎉 Your registration form has been configured with ${formProposal.questions.length} questions!`,
        },
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to apply questions."
      setError(msg)
    } finally {
      setApplyingQuestions(false)
    }
  }

  const handleProposeQuestionsForEvent = async () => {
    const targetEventId = createdEvent?.id || formProposal?.eventId
    const targetEventSlug = createdEvent?.slug || formProposal?.eventSlug
    if (!targetEventId && !targetEventSlug) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/assistant/asa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "propose_questions",
          eventId: targetEventId,
          eventSlug: targetEventSlug,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to suggest questions.")
      }

      if (data.proposal) {
        setFormProposal(data.proposal)
        setIsFormApplied(false)
      }
      if (data.reply) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply,
          },
        ])
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to suggest questions."
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setMessages([INITIAL_GREETING])
    setDraft({ status: "collecting" })
    setFormProposal(null)
    setIsFormApplied(false)
    setIsReview(false)
    setCreatedEvent(null)
    setEventMetrics(null)
    setPendingAction(null)
    setDisambiguationOptions(null)
    setSelectedEvent(null)
    setEditingQuestionId(null)
    setEditLabelText("")
    setShowAddQuestionRow(false)
    setInput("")
    setError(null)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
    })
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 4.5rem)",
        maxWidth: 820,
        margin: "0 auto",
        padding: "0 1rem 1rem",
      }}
    >
      {/* Top Header Card */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.25rem",
          background: "var(--surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "16px",
          marginTop: "0.75rem",
          marginBottom: "0.75rem",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "12px",
              background: "color-mix(in srgb, var(--accent) 15%, var(--surface))",
              border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
              fontSize: "1.1rem",
              fontWeight: 700,
            }}
          >
            ✨
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.05rem",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                ASA
              </h1>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "999px",
                  background: "color-mix(in srgb, var(--accent) 15%, var(--surface))",
                  color: "var(--accent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                  letterSpacing: "0.02em",
                }}
              >
                Event Assistant
              </span>
            </div>
            <p
              style={{
                margin: "0.15rem 0 0",
                fontSize: "0.78rem",
                color: "var(--text-muted)",
              }}
            >
              Event creation, live intelligence & natural management
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {organizerEvents.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <select
                value={selectedEvent?.id || ""}
                onChange={(e) => {
                  const val = e.target.value
                  if (!val) {
                    setSelectedEvent(null)
                    setEventMetrics(null)
                  } else {
                    const ev = organizerEvents.find((x) => x.id === val) || null
                    setSelectedEvent(ev)
                    if (ev) {
                      handleSend(`How is ${ev.title} doing?`)
                    }
                  }
                }}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "0.4rem 0.65rem",
                  fontSize: "0.78rem",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  maxWidth: 160,
                  outline: "none",
                }}
                title="Choose an event to inspect or manage"
              >
                <option value="">+ New Event Mode</option>
                {organizerEvents.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title} ({ev.confirmedCount})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleReset}
            style={{
              background: "transparent",
              border: "1px solid var(--border-subtle)",
              borderRadius: "8px",
              padding: "0.4rem 0.75rem",
              fontSize: "0.78rem",
              fontWeight: 500,
              color: "var(--text-secondary)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
            title="Start fresh with a new event"
          >
            <span>↺</span>
            <span className="hidden sm:inline">New Event</span>
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "0.5rem 0.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        {messages.map((msg, index) => {
          const isUser = msg.role === "user"
          return (
            <div
              key={index}
              style={{
                display: "flex",
                flexDirection: isUser ? "row-reverse" : "row",
                gap: "0.75rem",
                alignItems: "flex-start",
              }}
            >
              {!isUser && (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "10px",
                    background: "color-mix(in srgb, var(--accent) 15%, var(--surface))",
                    border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.95rem",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  ✨
                </div>
              )}

              <div
                style={{
                  maxWidth: "85%",
                  padding: "0.85rem 1.15rem",
                  borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: isUser ? "var(--accent)" : "var(--surface)",
                  color: isUser ? "var(--accent-contrast, #FFFFFF)" : "var(--text-primary)",
                  border: isUser ? "none" : "1px solid var(--border-subtle)",
                  fontSize: "0.925rem",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  boxShadow: isUser ? "0 2px 10px rgba(0,0,0,0.06)" : "0 2px 8px rgba(0,0,0,0.02)",
                }}
              >
                {msg.content}
              </div>
            </div>
          )
        })}

        {/* Quick Starters (Only shown right at greeting) */}
        {messages.length === 1 && !loading && (
          <div style={{ margin: "0.5rem 0 0.5rem 2.75rem" }}>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
              Try a quick starter:
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {QUICK_STARTERS.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s.prompt)}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "999px",
                    padding: "0.4rem 0.85rem",
                    fontSize: "0.8rem",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--accent)"
                    e.currentTarget.style.color = "var(--text-primary)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-subtle)"
                    e.currentTarget.style.color = "var(--text-secondary)"
                  }}
                >
                  {s.label} →
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Thinking Indicator */}
        {loading && (
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "10px",
                background: "color-mix(in srgb, var(--accent) 15%, var(--surface))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.95rem",
              }}
            >
              ✨
            </div>
            <div
              style={{
                padding: "0.6rem 1rem",
                borderRadius: "14px",
                background: "var(--surface)",
                border: "1px solid var(--border-subtle)",
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <span>ASA is thinking...</span>
            </div>
          </div>
        )}

        {/* Disambiguation Event Selector */}
        {disambiguationOptions && disambiguationOptions.length > 0 && (
          <div
            style={{
              margin: "0.5rem 0 0.5rem 2.75rem",
              background: "var(--surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "16px",
              padding: "1rem",
              boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
            }}
          >
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.82rem", fontWeight: 600, color: "var(--text-primary)" }}>
              Select an event to check or manage:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {disambiguationOptions.map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => {
                    setSelectedEvent(ev)
                    setDisambiguationOptions(null)
                    handleSend(`How is ${ev.title} doing?`)
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.6rem 0.85rem",
                    background: "color-mix(in srgb, var(--accent) 4%, var(--surface))",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "10px",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div>
                    <strong style={{ display: "block", fontSize: "0.88rem", color: "var(--text-primary)" }}>
                      {ev.title}
                    </strong>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {ev.confirmedCount} registered • {ev.capacity ? `${ev.capacity} capacity` : "unlimited"}
                    </span>
                  </div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--accent)" }}>Select →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Management Action Confirmation Card */}
        {pendingAction && (
          <div
            style={{
              margin: "0.5rem 0 0.5rem 2.75rem",
              background: "var(--surface)",
              border: "1.5px solid #F59E0B",
              borderRadius: "18px",
              padding: "1.25rem",
              boxShadow: "0 6px 20px rgba(245, 158, 11, 0.08)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", marginBottom: "0.6rem" }}>
              <span style={{ fontSize: "1rem" }}>⚡</span>
              <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#F59E0B" }}>
                Action Confirmation Required
              </span>
            </div>

            <p style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", color: "var(--text-primary)", fontWeight: 500, lineHeight: 1.5 }}>
              {pendingAction.confirmationMessage}
            </p>

            <div
              style={{
                background: "color-mix(in srgb, #F59E0B 8%, var(--surface))",
                border: "1px solid color-mix(in srgb, #F59E0B 25%, transparent)",
                borderRadius: "10px",
                padding: "0.55rem 0.85rem",
                fontSize: "0.8rem",
                color: "var(--text-secondary)",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.25rem" }}>
                <span>Target: <strong>{pendingAction.eventTitle}</strong></span>
                <span>Field: <strong>{pendingAction.fieldName}</strong></span>
                <span>Current: <strong>{String(pendingAction.currentValue ?? "unspecified")}</strong></span>
                <span>Proposed: <strong style={{ color: "var(--accent)" }}>{String(pendingAction.proposedValue)}</strong></span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.65rem" }}>
              <button
                onClick={handleConfirmManagementAction}
                disabled={actionExecuting}
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-contrast, #FFFFFF)",
                  border: "none",
                  borderRadius: "10px",
                  padding: "0.6rem 1.25rem",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: actionExecuting ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  boxShadow: "0 2px 10px color-mix(in srgb, var(--accent) 30%, transparent)",
                }}
              >
                <span>✓</span>
                <span>{actionExecuting ? "Applying..." : "Confirm & Apply"}</span>
              </button>

              <button
                onClick={handleCancelManagementAction}
                disabled={actionExecuting}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  padding: "0.6rem 1rem",
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  cursor: actionExecuting ? "not-allowed" : "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Live Event Metrics Card */}
        {eventMetrics && (
          <div
            style={{
              margin: "0.5rem 0 0.5rem 2.75rem",
              background: "var(--surface)",
              border: "1.5px solid color-mix(in srgb, var(--accent) 30%, transparent)",
              borderRadius: "18px",
              padding: "1.15rem",
              boxShadow: "0 6px 20px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "999px",
                      background: eventMetrics.status === "active" ? "#10B981" : "#F59E0B",
                    }}
                  />
                  <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 700, color: "var(--accent)" }}>
                    Live Event Intelligence
                  </span>
                </div>
                <h3 style={{ margin: "0.2rem 0 0", fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  {eventMetrics.eventTitle}
                </h3>
                {eventMetrics.eventDate && (
                  <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    📅 {eventMetrics.eventDate} {eventMetrics.timeUntilEvent ? `(${eventMetrics.timeUntilEvent})` : ""}
                  </span>
                )}
              </div>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  padding: "0.2rem 0.55rem",
                  borderRadius: "999px",
                  background: eventMetrics.status === "active" ? "rgba(16, 185, 129, 0.12)" : "rgba(245, 158, 11, 0.12)",
                  color: eventMetrics.status === "active" ? "#10B981" : "#F59E0B",
                  border: eventMetrics.status === "active" ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(245, 158, 11, 0.3)",
                }}
              >
                {eventMetrics.status.toUpperCase()}
              </span>
            </div>

            {/* Capacity bar */}
            {eventMetrics.capacity && eventMetrics.capacity > 0 && (
              <div style={{ marginBottom: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: "0.35rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>
                    Capacity: <strong>{eventMetrics.totalConfirmed}</strong> / {eventMetrics.capacity}
                  </span>
                  <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                    {eventMetrics.utilizationPct ?? 0}%
                  </span>
                </div>
                <div style={{ width: "100%", height: 7, borderRadius: 999, background: "var(--border-subtle)", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, eventMetrics.utilizationPct ?? 0)}%`,
                      height: "100%",
                      background: "var(--accent)",
                      borderRadius: 999,
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>
            )}

            {/* 4 Metric Tiles Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem", marginBottom: "1rem" }}>
              <div style={{ background: "color-mix(in srgb, var(--accent) 4%, var(--surface))", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "0.75rem" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block" }}>Registered Today</span>
                <strong style={{ fontSize: "1.15rem", color: "var(--text-primary)" }}>{eventMetrics.registeredToday}</strong>
                {eventMetrics.registeredYesterday > 0 && (
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>
                    ({eventMetrics.registeredYesterday} yesterday)
                  </span>
                )}
              </div>

              <div style={{ background: "color-mix(in srgb, var(--accent) 4%, var(--surface))", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "0.75rem" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block" }}>Remaining Slots</span>
                <strong style={{ fontSize: "1.15rem", color: eventMetrics.isFull ? "#EF4444" : "var(--text-primary)" }}>
                  {eventMetrics.remainingSlots !== null ? eventMetrics.remainingSlots : "∞"}
                </strong>
                <span style={{ fontSize: "0.7rem", color: eventMetrics.isFull ? "#EF4444" : "var(--text-muted)", display: "block" }}>
                  {eventMetrics.isFull ? "At capacity" : "Available"}
                </span>
              </div>

              <div style={{ background: "color-mix(in srgb, var(--accent) 4%, var(--surface))", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "0.75rem" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block" }}>Check-Ins</span>
                <strong style={{ fontSize: "1.15rem", color: "var(--text-primary)" }}>{eventMetrics.checkedInCount}</strong>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>
                  {eventMetrics.remainingExpectedAttendees} pending check-in
                </span>
              </div>

              <div style={{ background: "color-mix(in srgb, var(--accent) 4%, var(--surface))", border: "1px solid var(--border-subtle)", borderRadius: "12px", padding: "0.75rem" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block" }}>Waitlist</span>
                <strong style={{ fontSize: "1.15rem", color: "var(--text-primary)" }}>{eventMetrics.totalWaitlist}</strong>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "block" }}>
                  {eventMetrics.totalWaitlist > 0 ? "In queue" : "No waitlist"}
                </span>
              </div>
            </div>

            {/* Quick Actions inside Metrics */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
              <button
                onClick={() => {
                  setInput(`Increase capacity to `)
                  inputRef.current?.focus()
                }}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "0.35rem 0.65rem",
                  fontSize: "0.76rem",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                Adjust Capacity
              </button>
              <button
                onClick={() => {
                  setInput(`Update venue to `)
                  inputRef.current?.focus()
                }}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "0.35rem 0.65rem",
                  fontSize: "0.76rem",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                Update Venue
              </button>
              <button
                onClick={() => handleSend("How many people have checked in?")}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "0.35rem 0.65rem",
                  fontSize: "0.76rem",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                Check-In Details
              </button>
              <button
                onClick={() => handleSend(eventMetrics.status === "active" ? "Close registration" : "Reopen registration")}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                  padding: "0.35rem 0.65rem",
                  fontSize: "0.76rem",
                  color: eventMetrics.status === "active" ? "#EF4444" : "var(--accent)",
                  cursor: "pointer",
                }}
              >
                {eventMetrics.status === "active" ? "Close Registration" : "Reopen Registration"}
              </button>
            </div>
          </div>
        )}

        {/* Interactive Event Summary Card (Review State) */}
        {isReview && !createdEvent && (
          <div
            style={{
              margin: "0.5rem 0 0.5rem 2.75rem",
              background: "var(--surface)",
              border: "1.5px solid color-mix(in srgb, var(--accent) 40%, transparent)",
              borderRadius: "18px",
              padding: "1.25rem",
              boxShadow: "0 6px 20px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.85rem" }}>
              <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700, color: "var(--accent)" }}>
                Ready to Create
              </span>
            </div>

            <div style={{ display: "grid", gap: "0.6rem", fontSize: "0.88rem", marginBottom: "1.25rem" }}>
              <div>
                <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", display: "block" }}>Event Name</span>
                <strong style={{ color: "var(--text-primary)", fontSize: "1.05rem" }}>{draft.title || "Untitled"}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", display: "block" }}>Date</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {draft.displayDate || draft.eventDate || "Flexible"}
                  </span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", display: "block" }}>Time</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {draft.displayTime || "Open time"}
                  </span>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", display: "block" }}>Venue / Location</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {draft.location || draft.virtualLink || "TBD"}
                  </span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.78rem", display: "block" }}>Capacity</span>
                  <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                    {draft.capacity ? `${draft.capacity} attendees` : "Unlimited"}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "center" }}>
              <button
                onClick={handleConfirmCreate}
                disabled={loading}
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-contrast, #FFFFFF)",
                  border: "none",
                  borderRadius: "10px",
                  padding: "0.65rem 1.4rem",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  boxShadow: "0 2px 10px color-mix(in srgb, var(--accent) 30%, transparent)",
                }}
              >
                <span>✨</span>
                <span>Create this event</span>
              </button>

              <button
                onClick={() => handleSend("Change the capacity")}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  padding: "0.65rem 1rem",
                  fontSize: "0.82rem",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                Change capacity
              </button>
              <button
                onClick={() => handleSend("Change the venue")}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "10px",
                  padding: "0.65rem 1rem",
                  fontSize: "0.82rem",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                Change venue
              </button>
            </div>
          </div>
        )}

        {/* Success Card (Post Creation) */}
        {createdEvent && (
          <div
            style={{
              margin: "0.5rem 0 0.5rem 2.75rem",
              background: "var(--surface)",
              border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
              borderRadius: "18px",
              padding: "1.25rem",
              boxShadow: "0 8px 24px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "1.2rem" }}>🎉</span>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
                {createdEvent.title} is Live!
              </span>
            </div>

            <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              Your event is published and ready for attendees. Share the link below or open the dashboard to customize questions and tickets.
            </p>

            {/* Link box */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                background: "color-mix(in srgb, var(--accent) 6%, var(--surface))",
                border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)",
                borderRadius: "10px",
                padding: "0.55rem 0.85rem",
                marginBottom: "1rem",
              }}
            >
              <span style={{ flex: 1, fontSize: "0.82rem", color: "var(--text-primary)", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {createdEvent.publicUrl}
              </span>
              <button
                onClick={() => copyToClipboard(createdEvent.publicUrl)}
                style={{
                  background: copiedLink ? "var(--accent)" : "transparent",
                  color: copiedLink ? "var(--accent-contrast, #FFFFFF)" : "var(--accent)",
                  border: "1px solid var(--accent)",
                  borderRadius: "6px",
                  padding: "0.25rem 0.65rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                {copiedLink ? "Copied!" : "Copy"}
              </button>
            </div>

            {/* Links */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
              <Link
                href={createdEvent.dashboardUrl}
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-contrast, #FFFFFF)",
                  textDecoration: "none",
                  borderRadius: "10px",
                  padding: "0.6rem 1.25rem",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <span>Open Dashboard</span>
                <span>→</span>
              </Link>
              <a
                href={createdEvent.publicUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: "transparent",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-subtle)",
                  textDecoration: "none",
                  borderRadius: "10px",
                  padding: "0.6rem 1.1rem",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                }}
              >
                <span>View Event</span>
                <span>↗</span>
              </a>
              <button
                onClick={handleReset}
                style={{
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "none",
                  padding: "0.6rem 1rem",
                  fontSize: "0.82rem",
                  cursor: "pointer",
                }}
              >
                Create Another Event
              </button>

              {!formProposal && (
                <button
                  onClick={handleProposeQuestionsForEvent}
                  disabled={loading}
                  style={{
                    background: "color-mix(in srgb, var(--accent) 15%, var(--surface))",
                    color: "var(--accent)",
                    border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                    borderRadius: "10px",
                    padding: "0.6rem 1.1rem",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                >
                  <span>✨</span>
                  <span>Set up Registration Questions</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Interactive Registration Form Card */}
        {formProposal && formProposal.questions.length > 0 && (
          <div
            style={{
              margin: "0.5rem 0 0.5rem 2.75rem",
              background: "var(--surface)",
              border: isFormApplied
                ? "1.5px solid #38A169"
                : "1.5px solid color-mix(in srgb, var(--accent) 45%, transparent)",
              borderRadius: "18px",
              padding: "1.25rem",
              boxShadow: "0 6px 22px rgba(0,0,0,0.04)",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.1rem" }}>📋</span>
                <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-primary)" }}>
                  Registration Form {formProposal.eventTitle ? `— ${formProposal.eventTitle}` : ""}
                </span>
              </div>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  padding: "0.2rem 0.55rem",
                  borderRadius: "999px",
                  background: isFormApplied
                    ? "color-mix(in srgb, #38A169 15%, var(--surface))"
                    : "color-mix(in srgb, var(--accent) 15%, var(--surface))",
                  color: isFormApplied ? "#2F855A" : "var(--accent)",
                  border: isFormApplied
                    ? "1px solid color-mix(in srgb, #38A169 30%, transparent)"
                    : "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                }}
              >
                {isFormApplied ? "✓ Saved & Live" : "Recommendations (Preview)"}
              </span>
            </div>

            <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
              {isFormApplied
                ? "Attendees will answer these questions when registering for your event."
                : "These are recommended questions based on your event. You can edit, remove, reorder, or add questions before publishing."}
            </p>

            {/* Questions list */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {formProposal.questions.map((q, idx) => (
                <div
                  key={q.id || idx}
                  style={{
                    padding: "0.65rem 0.85rem",
                    borderRadius: "12px",
                    background: "var(--surface-muted, rgba(0,0,0,0.02))",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--accent)" }}>
                        #{idx + 1}
                      </span>

                      {editingQuestionId === q.id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flex: 1 }}>
                          <input
                            value={editLabelText}
                            onChange={(e) => setEditLabelText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveLabel(q.id)
                            }}
                            style={{
                              flex: 1,
                              padding: "0.25rem 0.5rem",
                              borderRadius: "6px",
                              border: "1px solid var(--accent)",
                              background: "var(--surface)",
                              color: "var(--text-primary)",
                              fontSize: "0.85rem",
                            }}
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveLabel(q.id)}
                            style={{
                              background: "var(--accent)",
                              color: "var(--accent-contrast, #FFFFFF)",
                              border: "none",
                              borderRadius: "6px",
                              padding: "0.25rem 0.5rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {q.label}
                        </span>
                      )}

                      <span
                        style={{
                          fontSize: "0.68rem",
                          padding: "0.15rem 0.45rem",
                          borderRadius: "4px",
                          background: "var(--surface)",
                          border: "1px solid var(--border-subtle)",
                          color: "var(--text-secondary)",
                          flexShrink: 0,
                        }}
                      >
                        {QUESTION_TYPE_LABELS[q.type] || q.type}
                      </span>

                      <button
                        onClick={() => handleToggleRequired(q.id)}
                        disabled={isFormApplied}
                        style={{
                          fontSize: "0.68rem",
                          padding: "0.15rem 0.45rem",
                          borderRadius: "4px",
                          border: "none",
                          cursor: isFormApplied ? "default" : "pointer",
                          background: q.required
                            ? "color-mix(in srgb, var(--accent) 15%, var(--surface))"
                            : "var(--surface)",
                          color: q.required ? "var(--accent)" : "var(--text-muted)",
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                        title="Click to toggle required / optional"
                      >
                        {q.required ? "Required" : "Optional"}
                      </button>
                    </div>

                    {!isFormApplied && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.2rem", flexShrink: 0 }}>
                        {editingQuestionId !== q.id && (
                          <button
                            onClick={() => handleStartEditLabel(q.id, q.label)}
                            title="Edit question text"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--text-secondary)",
                              cursor: "pointer",
                              padding: "0.2rem 0.35rem",
                              fontSize: "0.8rem",
                            }}
                          >
                            ✏️
                          </button>
                        )}
                        <button
                          onClick={() => handleMoveQuestion(idx, "up")}
                          disabled={idx === 0}
                          title="Move up"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: idx === 0 ? "var(--text-muted)" : "var(--text-secondary)",
                            cursor: idx === 0 ? "default" : "pointer",
                            padding: "0.2rem 0.35rem",
                            fontSize: "0.75rem",
                          }}
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => handleMoveQuestion(idx, "down")}
                          disabled={idx === formProposal.questions.length - 1}
                          title="Move down"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: idx === formProposal.questions.length - 1 ? "var(--text-muted)" : "var(--text-secondary)",
                            cursor: idx === formProposal.questions.length - 1 ? "default" : "pointer",
                            padding: "0.2rem 0.35rem",
                            fontSize: "0.75rem",
                          }}
                        >
                          ▼
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          title="Delete question"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#E53E3E",
                            cursor: "pointer",
                            padding: "0.2rem 0.35rem",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Options chips */}
                  {Array.isArray(q.options) && q.options.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", paddingLeft: "1.25rem" }}>
                      {q.options.map((opt, optIdx) => (
                        <span
                          key={optIdx}
                          style={{
                            fontSize: "0.72rem",
                            background: "var(--surface)",
                            border: "1px solid var(--border-subtle)",
                            padding: "0.1rem 0.4rem",
                            borderRadius: "4px",
                            color: "var(--text-muted)",
                          }}
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Condition indicator */}
                  {q.condition && (
                    <div style={{ fontSize: "0.72rem", color: "var(--accent)", paddingLeft: "1.25rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <span>⚡ Shown only if response is &quot;{q.condition.value}&quot;</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add question inline row */}
            {!isFormApplied && (
              <div style={{ marginTop: "0.75rem" }}>
                {showAddQuestionRow ? (
                  <div
                    style={{
                      padding: "0.75rem",
                      borderRadius: "12px",
                      background: "color-mix(in srgb, var(--accent) 6%, var(--surface))",
                      border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <input
                      placeholder="Question text (e.g. Dietary Requirements)"
                      value={newQuestionLabel}
                      onChange={(e) => setNewQuestionLabel(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddQuestion()
                      }}
                      style={{
                        padding: "0.4rem 0.65rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border-subtle)",
                        background: "var(--surface)",
                        color: "var(--text-primary)",
                        fontSize: "0.85rem",
                        outline: "none",
                      }}
                      autoFocus
                    />

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                      <select
                        value={newQuestionType}
                        onChange={(e) => setNewQuestionType(e.target.value as QuestionType)}
                        style={{
                          padding: "0.35rem 0.6rem",
                          borderRadius: "8px",
                          border: "1px solid var(--border-subtle)",
                          background: "var(--surface)",
                          color: "var(--text-primary)",
                          fontSize: "0.8rem",
                        }}
                      >
                        {Object.entries(QUESTION_TYPE_LABELS).map(([val, lbl]) => (
                          <option key={val} value={val}>
                            {lbl}
                          </option>
                        ))}
                      </select>

                      <label style={{ fontSize: "0.78rem", display: "flex", alignItems: "center", gap: "0.3rem", color: "var(--text-secondary)", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={newQuestionRequired}
                          onChange={(e) => setNewQuestionRequired(e.target.checked)}
                        />
                        Required
                      </label>

                      <button
                        onClick={handleAddQuestion}
                        disabled={!newQuestionLabel.trim()}
                        style={{
                          background: "var(--accent)",
                          color: "var(--accent-contrast, #FFFFFF)",
                          border: "none",
                          borderRadius: "8px",
                          padding: "0.35rem 0.85rem",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: newQuestionLabel.trim() ? "pointer" : "not-allowed",
                        }}
                      >
                        Add Question
                      </button>

                      <button
                        onClick={() => setShowAddQuestionRow(false)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-muted)",
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddQuestionRow(true)}
                    style={{
                      background: "transparent",
                      border: "1px dashed var(--border-subtle)",
                      borderRadius: "10px",
                      padding: "0.5rem 0.85rem",
                      fontSize: "0.8rem",
                      color: "var(--accent)",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <span>+</span>
                    <span>Add custom question</span>
                  </button>
                )}
              </div>
            )}

            {/* Quick refinement suggestion chips */}
            {!isFormApplied && (
              <div style={{ marginTop: "0.85rem" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: "0.35rem" }}>
                  Quick adjustments:
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                  <button
                    onClick={() => handleSend("Add a question asking whether they need accommodation")}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "999px",
                      padding: "0.25rem 0.65rem",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    + Accommodation
                  </button>
                  <button
                    onClick={() => handleSend("Add dietary requirements")}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "999px",
                      padding: "0.25rem 0.65rem",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    + Dietary
                  </button>
                  <button
                    onClick={() => handleSend("Make phone number optional")}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "999px",
                      padding: "0.25rem 0.65rem",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    Make phone optional
                  </button>
                  <button
                    onClick={() => handleSend("Keep it minimal, only name and email")}
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "999px",
                      padding: "0.25rem 0.65rem",
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    Minimal form
                  </button>
                </div>
              </div>
            )}

            {/* Primary Action Button */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", marginTop: "1.15rem" }}>
              {!isFormApplied ? (
                <>
                  <button
                    onClick={handleApplyQuestions}
                    disabled={applyingQuestions || formProposal.questions.length === 0}
                    style={{
                      background: "var(--accent)",
                      color: "var(--accent-contrast, #FFFFFF)",
                      border: "none",
                      borderRadius: "10px",
                      padding: "0.65rem 1.4rem",
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      cursor: applyingQuestions ? "not-allowed" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      boxShadow: "0 2px 10px color-mix(in srgb, var(--accent) 30%, transparent)",
                    }}
                  >
                    <span>✨</span>
                    <span>{applyingQuestions ? "Applying..." : "Apply to Registration Form"}</span>
                  </button>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    Organizer confirmation required before saving.
                  </span>
                </>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.6rem" }}>
                  <a
                    href={createdEvent?.publicUrl || `/events/${formProposal.eventSlug}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: "var(--accent)",
                      color: "var(--accent-contrast, #FFFFFF)",
                      textDecoration: "none",
                      borderRadius: "10px",
                      padding: "0.6rem 1.2rem",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <span>Preview Registration Form</span>
                    <span>↗</span>
                  </a>
                  <button
                    onClick={() => setIsFormApplied(false)}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "10px",
                      padding: "0.6rem 1rem",
                      fontSize: "0.82rem",
                      color: "var(--text-secondary)",
                      cursor: "pointer",
                    }}
                  >
                    Edit Again
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Composer (Mobile-First Sticky Bottom) */}
      <div
        style={{
          marginTop: "0.5rem",
          background: "var(--surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "18px",
          padding: "0.5rem 0.75rem",
          boxShadow: "0 4px 16px rgba(0,0,0,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            placeholder={isReview ? 'Type "Yes" to create, or type changes...' : "Describe your event or ask ASA..."}
            rows={1}
            disabled={loading}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-primary)",
              fontSize: "0.925rem",
              fontFamily: "var(--font-dm-sans)",
              resize: "none",
              padding: "0.5rem 0.25rem",
              maxHeight: 120,
              minHeight: 24,
            }}
          />

          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            style={{
              width: 36,
              height: 36,
              borderRadius: "12px",
              background: input.trim() && !loading ? "var(--accent)" : "color-mix(in srgb, var(--text-muted) 20%, transparent)",
              color: input.trim() && !loading ? "var(--accent-contrast, #FFFFFF)" : "var(--text-muted)",
              border: "none",
              cursor: input.trim() && !loading ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.15s ease",
            }}
            aria-label="Send message to ASA"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 12V4M4 8l4-4 4 4" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
