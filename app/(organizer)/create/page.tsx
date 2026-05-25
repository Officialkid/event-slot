"use client"

import React, { useState, useRef, useEffect } from "react"
import { v4 as uuidv4 } from "uuid"
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
  const [eventType, setEventType] = useState<"PHYSICAL" | "VIRTUAL">("PHYSICAL")
  const [virtualLink, setVirtualLink] = useState("")
  const [capacity, setCapacity] = useState("")
  const [deadline, setDeadline] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [joinOpensAt, setJoinOpensAt] = useState("")
  const [location, setLocation] = useState("")
  const [isPaid, setIsPaid] = useState(false)
  const [ticketPrice, setTicketPrice] = useState("")
  const [communityLink, setCommunityLink] = useState("")
  const [whatsappNumber, setWhatsappNumber] = useState("")
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
  const [origin, setOrigin] = useState("")
  const [copiedSuccessLink, setCopiedSuccessLink] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [qrGenerating, setQrGenerating] = useState(false)
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

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

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

  const successRegistrationLink = eventInfo && origin ? `${origin}/${eventInfo.slug}` : ""

  const handleCopySuccessLink = async () => {
    if (!successRegistrationLink) return
    try {
      await navigator.clipboard.writeText(successRegistrationLink)
      setCopiedSuccessLink(true)
      setTimeout(() => setCopiedSuccessLink(false), 2000)
    } catch {
      // Ignore clipboard errors to match existing page behavior.
    }
  }

  const handleGenerateSuccessQR = async () => {
    if (!eventInfo || !successRegistrationLink) return
    setQrGenerating(true)
    try {
      const QRCode = (await import("qrcode")).default
      const dataUrl = await QRCode.toDataURL(successRegistrationLink, {
        width: 300,
        margin: 2,
        color: { dark: "#0A0A0A", light: "#F0EDE6" },
        errorCorrectionLevel: "H",
      })
      setQrDataUrl(dataUrl)
      setShowQrModal(true)
    } finally {
      setQrGenerating(false)
    }
  }

  const handleDownloadSuccessQR = () => {
    if (!eventInfo) return
    window.open(`/api/events/${eventInfo.slug}/qr`, "_blank")
  }

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

    if (eventType === "VIRTUAL" && !virtualLink.trim()) {
      setLoading(false)
      setError("Google Meet link is required for virtual events.")
      return
    }

    if (isPaid && !ticketPrice) {
      setLoading(false)
      setError("Please enter a ticket price for paid events.")
      return
    }

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
          eventType,
          virtualLink: eventType === "VIRTUAL" ? virtualLink || undefined : undefined,
          capacity: capacity ? Number(capacity) : undefined,
          deadline: deadline ? new Date(deadline).toISOString() : undefined,
          eventDate: eventDate ? new Date(eventDate).toISOString() : undefined,
          joinOpensAt: joinOpensAt ? new Date(joinOpensAt).toISOString() : undefined,
          location: location || undefined,
          isPaid,
          ticketPrice: isPaid && ticketPrice ? Number(ticketPrice) : undefined,
          communityLink: communityLink || undefined,
          whatsappNumber: whatsappNumber || undefined,
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
        {showQrModal && qrDataUrl && eventInfo && (
          <div
            onClick={() => setShowQrModal(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              background: "rgba(0,0,0,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "1.5rem",
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: "#141414",
                border: "0.5px solid rgba(240,237,230,0.1)",
                borderRadius: "16px",
                padding: "2rem",
                maxWidth: "360px",
                width: "100%",
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6", margin: 0 }}>
                  Event QR Code
                </h3>
                <button
                  onClick={() => setShowQrModal(false)}
                  style={{ background: "none", border: "none", color: "rgba(240,237,230,0.4)", fontSize: "1.2rem", cursor: "pointer" }}
                >
                  ×
                </button>
              </div>

              <div style={{ background: "#F0EDE6", borderRadius: "12px", padding: "1rem", marginBottom: "1rem", display: "inline-block" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Event QR Code" style={{ width: "220px", height: "220px", display: "block" }} />
              </div>

              <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.55)", marginBottom: "1.25rem", fontFamily: "var(--font-dm-sans)" }}>
                Scan to register for <strong style={{ color: "#F0EDE6" }}>{eventInfo.title}</strong>
              </p>

              <p style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.35)", marginBottom: "1.25rem", lineHeight: "1.55", fontFamily: "var(--font-dm-sans)" }}>
                Add this QR code to your poster, flyer, or WhatsApp image. Attendees scan it to open the registration form directly.
              </p>

              <button
                onClick={handleDownloadSuccessQR}
                style={{
                  background: "#C8F55A",
                  color: "#0A0A0A",
                  border: "none",
                  borderRadius: "100px",
                  padding: "0.7rem 1.8rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  width: "100%",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                ↓ Download High-Res PNG
              </button>

              <p style={{ fontSize: "0.7rem", color: "rgba(240,237,230,0.25)", marginTop: "0.75rem", fontFamily: "var(--font-dm-sans)" }}>
                1024x1024px · Print-ready resolution
              </p>
            </div>
          </div>
        )}

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
                    placeholder="Briefly describe what this event is about. Date, time and location are already shown automatically - no need to repeat them here."
                    rows={3}
                    maxLength={500}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                  <p style={{ fontSize: "0.7rem", color: "rgba(240,237,230,0.3)", marginTop: "0.35rem" }}>
                    Tip: Date, time, and location are shown automatically from the fields above. Use this field to describe the event content only.
                  </p>
                  <p style={{ fontSize: "0.7rem", color: "rgba(240,237,230,0.35)", marginTop: "0.25rem" }}>
                    {description.length} / 300 characters
                  </p>
                </div>
                <div className="space-y-3">
                  <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                    Event Type
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEventType("PHYSICAL")}
                      className={`rounded-[8px] border px-3 py-2 text-[0.82rem] font-medium transition ${
                        eventType === "PHYSICAL"
                          ? "border-[rgba(200,245,90,0.55)] bg-[rgba(200,245,90,0.08)] text-[#C8F55A]"
                          : "border-[rgba(240,237,230,0.12)] text-[rgba(240,237,230,0.65)]"
                      }`}
                    >
                      📍 Physical
                    </button>
                    <button
                      type="button"
                      onClick={() => setEventType("VIRTUAL")}
                      className={`rounded-[8px] border px-3 py-2 text-[0.82rem] font-medium transition ${
                        eventType === "VIRTUAL"
                          ? "border-[rgba(200,245,90,0.55)] bg-[rgba(200,245,90,0.08)] text-[#C8F55A]"
                          : "border-[rgba(240,237,230,0.12)] text-[rgba(240,237,230,0.65)]"
                      }`}
                    >
                      💻 Virtual
                    </button>
                  </div>
                </div>

                {eventType === "VIRTUAL" && (
                  <div className="space-y-2">
                    <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                      Google Meet Link <span className="text-[#C8F55A]">*</span>
                    </label>
                    <input
                      type="url"
                      required
                      className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                      placeholder="https://meet.google.com/..."
                      value={virtualLink}
                      onChange={e => setVirtualLink(e.target.value)}
                    />
                    <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
                      <p className="mb-2 text-xs font-semibold text-[#C8F55A]">✦ How to get your Google Meet link</p>
                      <ol className="list-inside list-decimal space-y-1 text-xs text-[#A3A3A3]">
                        <li>Go to <span className="text-white">meet.new</span> or open Google Meet</li>
                        <li>Click <span className="text-white">New meeting</span></li>
                        <li>Select <span className="text-white">Create a meeting for later</span></li>
                        <li>Copy the link and paste it above</li>
                        <li>Keep the meeting open - attendees will join on event day after verification</li>
                      </ol>
                      <p className="mt-3 text-xs text-[#525252]">🔒 Your meeting link is encrypted and only revealed to verified attendees on event day.</p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                    Pricing
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPaid(false)
                        setTicketPrice("")
                      }}
                      className={`rounded-[8px] border px-3 py-2 text-[0.82rem] font-medium transition ${
                        !isPaid
                          ? "border-[rgba(200,245,90,0.55)] bg-[rgba(200,245,90,0.08)] text-[#C8F55A]"
                          : "border-[rgba(240,237,230,0.12)] text-[rgba(240,237,230,0.65)]"
                      }`}
                    >
                      🎟️ Free
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsPaid(true)
                        setTicketPrice((previous) => previous || "500")
                      }}
                      className={`rounded-[8px] border px-3 py-2 text-[0.82rem] font-medium transition ${
                        isPaid
                          ? "border-[rgba(255,184,77,0.6)] bg-[rgba(255,184,77,0.08)] text-[#FFB84D]"
                          : "border-[rgba(240,237,230,0.12)] text-[rgba(240,237,230,0.65)]"
                      }`}
                    >
                      💳 Paid
                    </button>
                  </div>
                  {isPaid && (
                    <div className="mt-2 rounded-[8px] border border-[rgba(255,184,77,0.3)] bg-[rgba(255,184,77,0.08)] p-3">
                      <p className="text-[0.75rem] font-semibold text-[#C8F55A]">🔔 Paid Events - Coming Soon</p>
                      <p className="mt-1 text-[0.72rem] text-[rgba(240,237,230,0.45)]">
                        Payment integration is coming very soon. For now, please use the <span className="font-medium text-white">Free</span> option and handle payments manually with your attendees. Your event setup will be saved and payment activation requires no changes when we go live.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setIsPaid(false)
                          setTicketPrice("")
                        }}
                        className="mt-3 text-xs text-[#C8F55A] underline"
                      >
                        Switch to Free →
                      </button>
                    </div>
                  )}

                  {isPaid && (
                    <div className="mt-2 space-y-2 opacity-50 pointer-events-none">
                        <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                          Ticket Price (KSh)
                        </label>
                        <input
                          type="number"
                          min="1"
                          className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(255,184,77,0.5)] focus:outline-none"
                          placeholder="e.g. 500"
                          value={ticketPrice}
                          onChange={e => setTicketPrice(e.target.value)}
                        />
                        <p className="text-xs text-[#525252]">Minimum KSh 50</p>
                      </div>
                  )}
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
                    Link Opens At (optional)
                  </label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    value={joinOpensAt}
                    onChange={e => setJoinOpensAt(e.target.value)}
                  />
                  <p style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", marginTop: "0.35rem" }}>
                    Leave empty to auto-open 30 minutes before the event start.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                    {eventType === "VIRTUAL" ? "Host / Base Location (optional)" : "Location / Venue"}
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
                    type="text"
                    inputMode="url"
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    placeholder="e.g. WhatsApp group, Telegram, website"
                    value={communityLink}
                    onChange={e => setCommunityLink(e.target.value)}
                  />
                  <p style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", marginTop: "0.35rem" }}>
                    After registering, confirmed attendees will see this link.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                    WhatsApp contact (optional)
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(37,211,102,0.5)] focus:outline-none"
                    placeholder="e.g. 254712345678"
                    value={whatsappNumber}
                    onChange={e => setWhatsappNumber(e.target.value)}
                  />
                  <p style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.3)", marginTop: "0.35rem" }}>
                    Attendees will see a floating WhatsApp chat button on this event page if you add a number.
                  </p>
                  {whatsappNumber.trim() && (
                    <p style={{ fontSize: "0.72rem", color: "#F59E0B", marginTop: "0.35rem" }}>
                      This number is public on your event page. Use a dedicated events or business line.
                    </p>
                  )}
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
                  <img src={imageUrl} alt="Event poster preview" style={{ width: "100%", height: "auto", objectFit: "contain", objectPosition: "center top", display: "block", borderRadius: "8px" }} />
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
              Share your registration link now or download a print-ready QR code.
            </p>

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
              <div style={{ flex: "1 1 260px", maxWidth: 420, display: "flex", alignItems: "center", background: "rgba(240,237,230,0.04)", border: "0.5px solid rgba(240,237,230,0.08)", borderRadius: 8, overflow: "hidden", minWidth: 0 }}>
                <input
                  readOnly
                  value={successRegistrationLink}
                  style={{ flex: 1, background: "transparent", border: "none", padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "rgba(240,237,230,0.45)", fontFamily: "var(--font-dm-sans)", outline: "none", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleCopySuccessLink()}
                style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 8, padding: "0.45rem 0.875rem", fontSize: "0.78rem", fontWeight: 500, color: copiedSuccessLink ? "#C8F55A" : "rgba(240,237,230,0.5)", cursor: "pointer", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {copiedSuccessLink ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => void handleGenerateSuccessQR()}
                disabled={qrGenerating}
                style={{
                  background: "transparent",
                  border: "0.5px solid rgba(240,237,230,0.15)",
                  borderRadius: "100px",
                  padding: "0.5rem 1rem",
                  color: "rgba(240,237,230,0.6)",
                  fontSize: "0.82rem",
                  cursor: qrGenerating ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  fontFamily: "var(--font-dm-sans)",
                  whiteSpace: "nowrap",
                  opacity: qrGenerating ? 0.6 : 1,
                }}
              >
                ▦ {qrGenerating ? "Generating..." : "Get QR Code"}
              </button>
            </div>

            {eventInfo && (
              <button
                type="button"
                onClick={() => router.push(`/dashboard/events/${eventInfo.slug}`)}
                className="w-full rounded-full bg-[#C8F55A] px-7 py-3 text-[0.875rem] font-semibold text-[#0A0A0A]"
              >
                Continue to Dashboard
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
