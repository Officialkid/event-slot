"use client"

import React, { useState, useRef, useEffect } from "react"
import { v4 as uuidv4 } from "uuid"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { EVENT_TEMPLATES } from "@/lib/eventTemplates"
import { markFeatureUsed } from "@/lib/markFeatureUsed"

type QuestionType = "text" | "email" | "phone" | "select" | "checkbox"

type Question = {
  id: string
  label: string
  type: QuestionType
  required: boolean
  options: string[]
  allowMultiple?: boolean
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone Number" },
  { value: "select", label: "Multiple Choice" },
  { value: "checkbox", label: "Checkboxes" },
]

const defaultQuestion = (): Question => ({
  id: "question-0",
  label: "Full Name",
  type: "text",
  required: true,
  options: [],
})

const typeUsesOptions = (type: QuestionType) => type === "select" || type === "checkbox"

export default function CreateEventPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [capacity, setCapacity] = useState("")
  const [deadline, setDeadline] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [location, setLocation] = useState("")
  const [communityLink, setCommunityLink] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [organizerName, setOrganizerName] = useState("")
  const [organizerEmail, setOrganizerEmail] = useState("")
  const [questions, setQuestions] = useState([defaultQuestion()])
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [eventInfo, setEventInfo] = useState<{ id: string; title: string; slug: string; dashboardToken: string } | null>(null)
  const [error, setError] = useState("")
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [capacitySuggestion, setCapacitySuggestion] = useState<{
    suggestedCapacity: number
    averageFillRate: number
    basedOnEvents: number
    message: string
  } | null>(null)
  const [capacitySuggestionFetched, setCapacitySuggestionFetched] = useState(false)
  const [aiPrediction, setAiPrediction] = useState<{
    suggestedCapacity: number
    confidence: 'low' | 'medium' | 'high'
    reasoning: string
  } | null>(null)
  const [aiPredictionLoading, setAiPredictionLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLDivElement>(null)

  // Auto-fill organizer details from signed-in account
  useEffect(() => {
    markFeatureUsed("create_event")
  }, [])

  useEffect(() => {
    if (session?.user?.name) {
      setOrganizerName(session.user.name)
    }
    if (session?.user?.email) {
      setOrganizerEmail(session.user.email)
    }
  }, [session])

  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/signin?callbackUrl=/create')
    }
  }, [status, router])

  async function fetchCapacitySuggestion() {
    if (capacitySuggestionFetched) return
    setCapacitySuggestionFetched(true)
    try {
      const res = await fetch("/api/events/suggest-capacity")
      const data = await res.json()
      if (data.suggestion) setCapacitySuggestion(data.suggestion)
    } catch { /* ignore */ }
  }

  async function fetchAiPrediction(eventTitle: string, eventDescription?: string) {
    if (!eventTitle.trim()) return
    setAiPredictionLoading(true)
    setAiPrediction(null)
    try {
      const res = await fetch('/api/events/predict-capacity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: eventTitle, description: eventDescription }),
      })
      if (!res.ok) return // Free plan or error — silent skip
      const data = await res.json()
      if (data.prediction) setAiPrediction(data.prediction)
    } catch { /* ignore */ } finally {
      setAiPredictionLoading(false)
    }
  }

  function handlePickTemplate(templateId: string) {
    const tpl = EVENT_TEMPLATES.find(t => t.id === templateId)
    if (!tpl) return
    setQuestions(
      tpl.questions.map(q => ({
        id: q.id,
        label: q.label,
        type: q.type,
        required: q.required,
        options: q.options ?? [],
        allowMultiple: q.allowMultiple ?? false,
      }))
    )
    setSelectedTemplateId(templateId)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }

  // After creation, redirect to the event dashboard
  useEffect(() => {
    if (success && eventInfo) {
      const timer = setTimeout(() => {
        router.push(`/dashboard/events/${eventInfo.slug}`)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [success, eventInfo, router])

  if (status === 'loading' || status === 'unauthenticated') {
    return null
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageError("")
    setImageUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) { setImageError(data.error || "Upload failed"); return }
      setImageUrl(data.url)
    } catch {
      setImageError("Upload failed. Please try again.")
    } finally {
      setImageUploading(false)
    }
  }

  const handleQuestionChange = (idx: number, field: keyof Question, value: string | boolean) => {
    setQuestions(qs =>
      qs.map((q, i) =>
        i === idx
          ? {
              ...q,
              [field]: value,
              ...(field === "type" && typeof value === "string" && !typeUsesOptions(value as QuestionType)
                ? { options: [], allowMultiple: false }
                : {}),
            }
          : q
      )
    )
  }

  const addOption = (idx: number) => {
    setQuestions(qs =>
      qs.map((q, i) => {
        if (i !== idx) return q
        const draft = optionDrafts[q.id]?.trim()
        if (!draft) return q
        if (q.options.some(opt => opt.toLowerCase() === draft.toLowerCase())) return q
        return { ...q, options: [...q.options, draft] }
      })
    )
    const id = questions[idx]?.id
    if (id) {
      setOptionDrafts(prev => ({ ...prev, [id]: "" }))
    }
  }

  const removeOption = (idx: number, optionIdx: number) => {
    setQuestions(qs =>
      qs.map((q, i) =>
        i === idx ? { ...q, options: q.options.filter((_, j) => j !== optionIdx) } : q
      )
    )
  }

  const addQuestion = () => {
    const id = uuidv4()
    setQuestions(qs => [...qs, { id, label: "", type: "text", required: false, options: [], allowMultiple: false }])
    setOptionDrafts(prev => ({ ...prev, [id]: "" }))
  }
  const removeQuestion = (idx: number) =>
    setQuestions(qs => {
      if (qs.length <= 1) return qs
      return qs.filter((_, i) => i !== idx)
    })

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const invalidQuestion = questions.find(q => typeUsesOptions(q.type) && q.options.length === 0)
    if (invalidQuestion) {
      setLoading(false)
      setError(`Please add at least one option for "${invalidQuestion.label || 'Untitled question'}".`)
      return
    }
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          capacity: capacity ? Number(capacity) : undefined,
          deadline: deadline ? new Date(deadline).toISOString() : undefined,
          eventDate: eventDate ? new Date(eventDate).toISOString() : undefined,
          location: location || undefined,
          communityLink: communityLink || undefined,
          imageUrl: imageUrl || undefined,
          questions: questions.map(q => ({
            id: q.id,
            label: q.label,
            type: q.type,
            options: typeUsesOptions(q.type) ? q.options : undefined,
            allowMultiple: q.type === "checkbox" ? !!q.allowMultiple : undefined,
            required: q.required,
          })),
          organizerName,
          organizerEmail: organizerEmail || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setEventInfo(data.event)
        setSuccess(true)
      } else {
        setError(data.error || "Failed to create event.")
      }
    } catch {
      setError("Unexpected error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const activeTpl = selectedTemplateId ? EVENT_TEMPLATES.find(t => t.id === selectedTemplateId) : null

  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-[640px] space-y-6">

        <div>
          <h1 className="text-[1.8rem] font-semibold text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
            Create your event
          </h1>
          <p className="mt-2 text-[0.9rem] font-[300] text-[rgba(240,237,230,0.45)]">
            Set it up once. Share the link. Done.
          </p>
        </div>

        {/* ── Template picker ── */}
        <div>
          <h2
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "1.5rem",
              fontWeight: 400,
              color: "#F0EDE6",
              margin: "0 0 0.375rem",
            }}
          >
            Start with a template
          </h2>
          <p
            style={{
              margin: "0 0 1.125rem",
              fontSize: "0.875rem",
              fontWeight: 300,
              color: "rgba(240,237,230,0.4)",
              fontFamily: "var(--font-dm-sans)",
            }}
          >
            Choose a template or start from scratch.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(172px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {EVENT_TEMPLATES.map(tpl => {
              const isSelected = selectedTemplateId === tpl.id
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handlePickTemplate(tpl.id)}
                  style={{
                    background: isSelected
                      ? "rgba(200,245,90,0.06)"
                      : "#141414",
                    border: isSelected
                      ? "1.5px solid #C8F55A"
                      : "0.5px solid rgba(240,237,230,0.1)",
                    borderRadius: 12,
                    padding: "1.125rem 1rem",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "border-color 0.15s, background 0.15s",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.375rem",
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) {
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(200,245,90,0.4)"
                      ;(e.currentTarget as HTMLButtonElement).style.background = "rgba(200,245,90,0.04)"
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(240,237,230,0.1)"
                      ;(e.currentTarget as HTMLButtonElement).style.background = "#141414"
                    }
                  }}
                >
                  <span style={{ fontSize: "2rem", lineHeight: 1 }}>{tpl.icon}</span>
                  <span
                    style={{
                      fontFamily: "var(--font-instrument-serif)",
                      fontSize: "1rem",
                      fontWeight: 400,
                      color: "#F0EDE6",
                      lineHeight: 1.3,
                    }}
                  >
                    {tpl.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans)",
                      fontWeight: 300,
                      fontSize: "0.8rem",
                      color: "rgba(240,237,230,0.45)",
                      lineHeight: 1.4,
                    }}
                  >
                    {tpl.description}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {selectedTemplateId && !success ? (
          <div ref={formRef}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="bg-[#141414] border border-[rgba(240,237,230,0.08)] rounded-[12px] p-6">
              <h2 className="text-[1.1rem] font-semibold text-[#F0EDE6] mb-4" style={{ fontFamily: "var(--font-instrument-serif)" }}>
                Event Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                    Event Title <span className="text-[#C8F55A]">*</span>
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={e => fetchAiPrediction(e.target.value, description)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                    Description
                  </label>
                  <textarea
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    rows={3}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                    Maximum Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    placeholder="Leave empty for unlimited"
                    value={capacity}
                    onChange={e => setCapacity(e.target.value)}
                    onFocus={fetchCapacitySuggestion}
                  />
                  {aiPredictionLoading && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="rgba(200,245,90,0.3)" strokeWidth="2.5" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="#C8F55A" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                      <span style={{ fontSize: '0.75rem', color: 'rgba(200,245,90,0.6)', fontFamily: 'var(--font-dm-sans)' }}>Analysing your past events…</span>
                    </div>
                  )}
                  {aiPrediction && !capacity && (
                    <div
                      style={{
                        marginTop: '0.625rem',
                        background: 'rgba(200,245,90,0.06)',
                        border: '0.5px solid rgba(200,245,90,0.2)',
                        borderRadius: 8,
                        padding: '0.6rem 0.85rem',
                        display: 'flex',
                        gap: '0.625rem',
                        alignItems: 'flex-start',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, marginTop: 2 }}>
                        <path d="M10 2a6 6 0 0 1 4 10.47V14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-1.53A6 6 0 0 1 10 2Z" fill="rgba(200,245,90,0.2)" stroke="#C8F55A" strokeWidth="1.25" />
                        <path d="M8 17h4" stroke="#C8F55A" strokeWidth="1.25" strokeLinecap="round" />
                        <path d="M9 19h2" stroke="#C8F55A" strokeWidth="1.25" strokeLinecap="round" />
                      </svg>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', color: 'rgba(200,245,90,0.85)', fontFamily: 'var(--font-dm-sans)', fontWeight: 500, lineHeight: 1.4 }}>
                          AI suggestion: <strong>{aiPrediction.suggestedCapacity}</strong> attendees&nbsp;
                          <span style={{ fontWeight: 400, opacity: 0.7 }}>({aiPrediction.confidence} confidence)</span>
                        </p>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'rgba(240,237,230,0.45)', fontFamily: 'var(--font-dm-sans)', fontWeight: 300, lineHeight: 1.4 }}>
                          {aiPrediction.reasoning}
                        </p>
                        <button
                          type="button"
                          onClick={() => setCapacity(String(aiPrediction.suggestedCapacity))}
                          style={{
                            background: 'transparent',
                            border: '0.5px solid rgba(200,245,90,0.35)',
                            borderRadius: 6,
                            padding: '0.3rem 0.75rem',
                            fontSize: '0.72rem',
                            fontWeight: 500,
                            color: '#C8F55A',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-dm-sans)',
                          }}
                        >
                          Use this suggestion
                        </button>
                      </div>
                    </div>
                  )}
                  {capacitySuggestion && !aiPrediction && !capacity && (
                    <div
                      style={{
                        marginTop: "0.625rem",
                        background: "rgba(200,245,90,0.06)",
                        border: "0.5px solid rgba(200,245,90,0.15)",
                        borderRadius: 8,
                        padding: "0.75rem 1rem",
                        display: "flex",
                        gap: "0.625rem",
                        alignItems: "flex-start",
                      }}
                    >
                      <svg
                        width="15" height="15" viewBox="0 0 20 20" fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ flexShrink: 0, marginTop: 2 }}
                      >
                        <path
                          d="M10 2a6 6 0 0 1 4 10.47V14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-1.53A6 6 0 0 1 10 2Z"
                          fill="rgba(200,245,90,0.25)" stroke="#C8F55A" strokeWidth="1.25"
                        />
                        <path d="M8 17h4" stroke="#C8F55A" strokeWidth="1.25" strokeLinecap="round" />
                        <path d="M9 19h2" stroke="#C8F55A" strokeWidth="1.25" strokeLinecap="round" />
                      </svg>
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            margin: "0 0 0.5rem",
                            fontSize: "0.8rem",
                            color: "rgba(200,245,90,0.8)",
                            fontFamily: "var(--font-dm-sans)",
                            lineHeight: 1.5,
                          }}
                        >
                          {capacitySuggestion.message}
                        </p>
                        <button
                          type="button"
                          onClick={() => setCapacity(String(capacitySuggestion.suggestedCapacity))}
                          style={{
                            background: "transparent",
                            border: "0.5px solid rgba(200,245,90,0.35)",
                            borderRadius: 6,
                            padding: "0.3rem 0.75rem",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            color: "#C8F55A",
                            cursor: "pointer",
                            fontFamily: "var(--font-dm-sans)",
                          }}
                        >
                          Use this suggestion
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                    Registration Deadline
                  </label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    value={deadline}
                    onChange={e => setDeadline(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                    Event Date
                  </label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                    Location / Venue
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    placeholder="e.g. iHub, Nairobi"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                    Organizer Name <span className="text-[#C8F55A]">*</span>
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    required
                    value={organizerName}
                    onChange={e => setOrganizerName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                    Organizer Email <span style={{ fontWeight: 400, color: "rgba(240,237,230,0.3)" }}>(optional)</span>
                  </label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    value={organizerEmail}
                    onChange={e => setOrganizerEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                    Community link (optional)
                  </label>
                  <input
                    type="url"
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    placeholder="e.g. WhatsApp group, Telegram, website"
                    value={communityLink}
                    onChange={e => setCommunityLink(e.target.value)}
                  />
                  <p style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", marginTop: "0.35rem" }}>
                    After registering, confirmed attendees will see this link.
                  </p>
                </div>
              </div>
            </div>

            {/* Event Poster */}
            <div className="bg-[#141414] border border-[rgba(240,237,230,0.08)] rounded-[12px] p-6">
              <h2 className="text-[1.1rem] font-semibold text-[#F0EDE6] mb-1" style={{ fontFamily: "var(--font-instrument-serif)" }}>
                Event Poster
              </h2>
              <p className="text-[0.78rem] text-[rgba(240,237,230,0.35)] mb-4">
                Optional flyer or banner. JPEG, PNG, WebP or GIF · max 5 MB.
              </p>
              {imageUrl && (
                <div className="mb-4 rounded-[8px] overflow-hidden border border-[rgba(240,237,230,0.08)]" style={{ backgroundColor: "#0A0A0A", lineHeight: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Event poster preview" style={{ width: "100%", height: "auto", maxHeight: "480px", objectFit: "contain", objectPosition: "center top", display: "block", borderRadius: "8px" }} />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="mt-2 rounded-full bg-[rgba(0,0,0,0.6)] px-2 py-1 text-[0.7rem] text-[rgba(240,237,230,0.7)] border border-[rgba(240,237,230,0.15)]"
                  >
                    Remove
                  </button>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleImageChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUploading}
                className="rounded-full border border-[rgba(240,237,230,0.15)] bg-transparent px-5 py-2 text-[0.82rem] font-medium text-[rgba(240,237,230,0.6)]"
              >
                {imageUploading ? "Uploading…" : imageUrl ? "Replace image" : "Upload image"}
              </button>
              {imageError && <p className="mt-2 text-[0.78rem] text-[#FF6B6B]">{imageError}</p>}
            </div>

            <div className="bg-[#141414] border border-[rgba(240,237,230,0.08)] rounded-[12px] p-6">
              <h2 className="text-[1.1rem] font-semibold text-[#F0EDE6] mb-4" style={{ fontFamily: "var(--font-instrument-serif)" }}>
                Registration Questions
              </h2>

              {activeTpl && activeTpl.id !== "blank" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    background: "rgba(200,245,90,0.07)",
                    border: "0.5px solid rgba(200,245,90,0.25)",
                    borderRadius: 8,
                    padding: "0.6rem 0.875rem",
                    marginBottom: "1.25rem",
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "0.8rem",
                    color: "rgba(200,245,90,0.9)",
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>{activeTpl.icon}</span>
                  <span>
                    Using <strong style={{ fontWeight: 600 }}>{activeTpl.name}</strong> template. You can edit the questions below.
                  </span>
                </div>
              )}
              <div className="space-y-4">
                {questions.map((q, idx) => (
                  <div key={q.id} className="bg-[#1A1A1A] border border-[rgba(240,237,230,0.08)] rounded-[8px] p-4">
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                          Question Label
                        </label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                          value={q.label}
                          onChange={e => handleQuestionChange(idx, "label", e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                          Type
                        </label>
                        <select
                          className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                          value={q.type}
                          onChange={e => handleQuestionChange(idx, "type", e.target.value)}
                        >
                          {QUESTION_TYPES.map(opt => (
                            <option key={opt.value} value={opt.value} className="bg-[#141414] text-[#F0EDE6]">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      {typeUsesOptions(q.type) && (
                        <div>
                          <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                            Options
                          </label>
                          <div className="mt-1 flex gap-2">
                            <input
                              type="text"
                              className="w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                              placeholder="Add option"
                              value={optionDrafts[q.id] ?? ""}
                              onChange={e => setOptionDrafts(prev => ({ ...prev, [q.id]: e.target.value }))}
                              onKeyDown={e => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  addOption(idx)
                                }
                              }}
                            />
                            <button
                              type="button"
                              className="rounded-[8px] border border-[rgba(200,245,90,0.35)] px-3 py-2 text-[0.8rem] text-[#C8F55A]"
                              onClick={() => addOption(idx)}
                            >
                              Add
                            </button>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {q.options.map((opt, optionIdx) => (
                              <span
                                key={`${q.id}-${opt}-${optionIdx}`}
                                className="inline-flex items-center gap-2 rounded-full border border-[rgba(240,237,230,0.15)] px-3 py-1 text-[0.78rem] text-[#F0EDE6]"
                              >
                                {opt}
                                <button
                                  type="button"
                                  className="text-[rgba(240,237,230,0.45)]"
                                  onClick={() => removeOption(idx, optionIdx)}
                                  aria-label={`Remove ${opt}`}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                          {q.options.length === 0 && (
                            <p className="mt-2 text-[0.75rem] text-[rgba(240,237,230,0.35)]">Add at least one option.</p>
                          )}
                        </div>
                      )}
                      {q.type === "checkbox" && (
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`allow-multiple-${q.id}`}
                            className="h-4 w-4 rounded border border-[rgba(240,237,230,0.15)] bg-[#141414] text-[#C8F55A] focus:ring-[#C8F55A]"
                            checked={!!q.allowMultiple}
                            onChange={e => handleQuestionChange(idx, "allowMultiple", e.target.checked)}
                          />
                          <label htmlFor={`allow-multiple-${q.id}`} className="text-[0.9rem] text-[#F0EDE6]">
                            Allow selecting multiple options
                          </label>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`required-${q.id}`}
                          className="h-4 w-4 rounded border border-[rgba(240,237,230,0.15)] bg-[#141414] text-[#C8F55A] focus:ring-[#C8F55A]"
                          checked={q.required}
                          onChange={e => handleQuestionChange(idx, "required", e.target.checked)}
                        />
                        <label htmlFor={`required-${q.id}`} className="text-[0.9rem] text-[#F0EDE6]">
                          Required
                        </label>
                      </div>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          className="mt-2 rounded-full border border-[rgba(255,107,107,0.3)] px-3 py-1 text-[0.75rem] text-[#FF6B6B]"
                          onClick={() => removeQuestion(idx)}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="w-full rounded-full border border-[rgba(240,237,230,0.15)] bg-transparent px-6 py-3 text-[0.875rem] font-medium text-[rgba(240,237,230,0.6)]"
                  onClick={addQuestion}
                >
                  Add Question
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <button
                type="submit"
                className="w-full rounded-full bg-[#C8F55A] px-7 py-3 text-[0.875rem] font-semibold text-[#0A0A0A]"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Event"}
              </button>
              {error && <div className="text-[0.82rem] text-[#FF6B6B] text-center">{error}</div>}
            </div>
          </form>
          </div>
        ) : selectedTemplateId && success ? (
          <div className="bg-[#141414] border border-[rgba(240,237,230,0.08)] rounded-[12px] p-8 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)]">
              <span className="block h-3 w-5 rotate-[-45deg] border-b-4 border-l-4 border-[#C8F55A]" />
            </div>
            <h2 className="text-[1.5rem] text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
              Your event is live!
            </h2>
            <p className="text-[0.875rem] text-[rgba(240,237,230,0.45)]" style={{ fontFamily: "var(--font-dm-sans)" }}>
              Taking you to your event dashboard…
            </p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid rgba(200,245,90,0.2)", borderTopColor: "#C8F55A", animation: "spin 0.8s linear infinite" }} />
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : null}
      </div>
    </div>
  )
}
