"use client"

import React, { useState, useRef, useEffect } from "react"
import Link from "next/link"
import type { AsaEventDraft, AsaMessage } from "@/lib/asa/asa-engine"

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
  { label: "Help me create an event", prompt: "Help me create an event." },
  {
    label: "Partners Dinner 2026",
    prompt:
      "I want to create an event called Partners Dinner 2026. It will be on 3 October 2026 at Swiss Lenana, from 3 PM to 6 PM, with a capacity of 500 people.",
  },
  {
    label: "Tech Summit Nairobi",
    prompt: "Create an event called Tech Summit. It will be in Nairobi in December and have 500 attendees.",
  },
]

export default function AsaAssistantPage() {
  const [messages, setMessages] = useState<AsaMessage[]>([INITIAL_GREETING])
  const [draft, setDraft] = useState<AsaEventDraft>({ status: "collecting" })
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [isReview, setIsReview] = useState(false)
  const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, isReview, createdEvent])

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
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to process message with ASA.")
      }

      if (data.created && data.event) {
        setCreatedEvent(data.event)
        setIsReview(false)
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.reply || `🎉 Congratulations! I've created your event **${data.event.title}**!`,
          },
        ])
      } else {
        if (data.draft) setDraft(data.draft)
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

  const handleReset = () => {
    setMessages([INITIAL_GREETING])
    setDraft({ status: "collecting" })
    setIsReview(false)
    setCreatedEvent(null)
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
                Event Creation Assistant
              </span>
            </div>
            <p
              style={{
                margin: "0.15rem 0 0",
                fontSize: "0.78rem",
                color: "var(--text-muted)",
              }}
            >
              Conversational event configuration for EventSlot
            </p>
          </div>
        </div>

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
