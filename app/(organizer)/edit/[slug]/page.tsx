"use client"

import React, { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { v4 as uuidv4 } from "uuid"
import { EventFAQEditor } from "@/components/events/EventFAQEditor"
import { EventWhatsAppInput } from "@/components/events/EventWhatsAppInput"

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

const typeUsesOptions = (type: QuestionType) => type === "select" || type === "checkbox"

function toDatetimeLocal(val: string | null | undefined): string {
  if (!val) return ""
  const d = new Date(val)
  // format: YYYY-MM-DDTHH:mm
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EditEventPage() {
  const { status } = useSession()
  const router = useRouter()
  const params = useParams()
  const slug = params?.slug as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [capacity, setCapacity] = useState("")
  const [deadline, setDeadline] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [joinOpensAt, setJoinOpensAt] = useState("")
  const [location, setLocation] = useState("")
  const [communityLink, setCommunityLink] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [questions, setQuestions] = useState<Question[]>([])
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({})

  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState("")
  const [category, setCategory] = useState("")
  const [whatsappNumber, setWhatsappNumber] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/signin")
  }, [status, router])

  useEffect(() => {
    if (status !== "authenticated" || !slug) return
    fetch(`/api/events/${slug}/edit`)
      .then(r => r.json())
      .then(data => {
        if (!data.success) {
          setError(data.error || "Event not found")
          return
        }
        const e = data.event
        setTitle(e.title ?? "")
        setDescription(e.description ?? "")
        setCapacity(e.capacity != null ? String(e.capacity) : "")
        setDeadline(toDatetimeLocal(e.deadline))
        setEventDate(toDatetimeLocal(e.eventDate))
        setJoinOpensAt(toDatetimeLocal(e.joinOpensAt))
        setLocation(e.location ?? "")
        setCommunityLink(e.communityLink ?? "")
        setImageUrl(e.imageUrl ?? "")
        setCategory(e.category ?? "")
        setWhatsappNumber(e.whatsappNumber ?? "")
        setQuestions(
          Array.isArray(e.questions)
            ? e.questions.map((q: Question) => ({ ...q, options: q.options ?? [] }))
            : []
        )
      })
      .catch(() => setError("Failed to load event"))
      .finally(() => setLoading(false))
  }, [status, slug])

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

  function handleQuestionChange(idx: number, field: keyof Question, value: string | boolean) {
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

    function addOption(idx: number) {
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

    function removeOption(idx: number, optionIdx: number) {
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
    setQuestions(qs => qs.length > 1 ? qs.filter((_, i) => i !== idx) : qs)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError("")
    const invalidQuestion = questions.find(q => typeUsesOptions(q.type) && q.options.length === 0)
    if (invalidQuestion) {
      setSaving(false)
      setError(`Please add at least one option for "${invalidQuestion.label || 'Untitled question'}".`)
      return
    }
    try {
      const res = await fetch(`/api/events/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          capacity: capacity ? Number(capacity) : undefined,
          deadline: deadline ? new Date(deadline).toISOString() : undefined,
          eventDate: eventDate ? new Date(eventDate).toISOString() : undefined,
          joinOpensAt: joinOpensAt ? new Date(joinOpensAt).toISOString() : undefined,
          location: location || undefined,
          communityLink: communityLink || undefined,
          imageUrl: imageUrl || undefined,
          category: category || undefined,
          questions: questions.map(q => ({
            id: q.id,
            label: q.label,
            type: q.type,
            options: typeUsesOptions(q.type) ? q.options : undefined,
            allowMultiple: q.type === "checkbox" ? !!q.allowMultiple : undefined,
            required: q.required,
          })),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(true)
        setTimeout(() => router.push("/my-events"), 1500)
      } else {
        setError(data.error || "Failed to save changes.")
      }
    } catch {
      setError("Unexpected error. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="px-4 py-12">
        <div className="mx-auto max-w-[640px] text-[rgba(240,237,230,0.4)] text-sm" style={{ fontFamily: "var(--font-dm-sans)" }}>
          Loading…
        </div>
      </div>
    )
  }

  if (error && questions.length === 0) {
    return (
      <div className="px-4 py-12">
        <div className="mx-auto max-w-[640px] rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-8 text-center">
          <p className="text-[#FF6B6B] text-sm">{error}</p>
          <a href="/my-events" className="mt-4 inline-block text-sm text-[rgba(240,237,230,0.45)]">← Back to my events</a>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-[640px] space-y-6">

        <div>
          <h1 className="text-[1.8rem] font-semibold text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
            Edit event
          </h1>
          <p className="mt-2 text-[0.9rem] font-[300] text-[rgba(240,237,230,0.45)]">
            Changes take effect immediately.
          </p>
        </div>

        {success && (
          <div className="rounded-[8px] bg-[rgba(200,245,90,0.1)] border border-[rgba(200,245,90,0.2)] px-4 py-3 text-[0.82rem] text-[#C8F55A]">
            Changes saved! Redirecting…
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Details */}
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
                  required
                  className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
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
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                  Registration Deadline
                </label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
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
                  className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
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
                  className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  value={joinOpensAt}
                  onChange={e => setJoinOpensAt(e.target.value)}
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
                  Community Link (optional)
                </label>
                <input
                  type="text"
                  inputMode="url"
                  className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  placeholder="e.g. WhatsApp group, Telegram, website"
                  value={communityLink}
                  onChange={e => setCommunityLink(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                  Event Category (optional)
                </label>
                <select
                  className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  <option value="" className="bg-[#141414]">Select a category…</option>
                  {["CONFERENCE","WORKSHOP","NETWORKING","CHURCH","CAMPUS","CONCERT","VIRTUAL"].map(c => (
                    <option key={c} value={c} className="bg-[#141414]">
                      {c.charAt(0) + c.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[0.72rem] text-[rgba(240,237,230,0.35)]">
                  Used to suggest relevant FAQ questions
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
              Upload a banner or flyer. Attendees will see it on the registration page. JPEG, PNG, WebP or GIF · max 5 MB.
            </p>

            {imageUrl && (
              <div className="mb-4 rounded-[8px] overflow-hidden border border-[rgba(240,237,230,0.08)]" style={{ backgroundColor: "#0A0A0A", lineHeight: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Event poster" style={{ width: "100%", height: "auto", maxHeight: "480px", objectFit: "contain", objectPosition: "center top", display: "block", borderRadius: "8px" }} />
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
            {imageError && (
              <p className="mt-2 text-[0.78rem] text-[#FF6B6B]">{imageError}</p>
            )}
          </div>

          {/* Questions */}
          <div className="bg-[#141414] border border-[rgba(240,237,230,0.08)] rounded-[12px] p-6">
            <h2 className="text-[1.1rem] font-semibold text-[#F0EDE6] mb-4" style={{ fontFamily: "var(--font-instrument-serif)" }}>
              Registration Questions
            </h2>
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
                        required
                        className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                        value={q.label}
                        onChange={e => handleQuestionChange(idx, "label", e.target.value)}
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
                          className="h-4 w-4 rounded border border-[rgba(240,237,230,0.15)] bg-[#141414]"
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
                        className="h-4 w-4 rounded border border-[rgba(240,237,230,0.15)] bg-[#141414]"
                        checked={q.required}
                        onChange={e => handleQuestionChange(idx, "required", e.target.checked)}
                      />
                      <label htmlFor={`required-${q.id}`} className="text-[0.9rem] text-[#F0EDE6]">Required</label>
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
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {error && <div className="text-[0.82rem] text-[#FF6B6B] text-center">{error}</div>}
          </div>
        </form>

        {/* FAQ editor — lives outside the main form so it saves independently */}
        <EventFAQEditor eventSlug={slug} />
        <EventWhatsAppInput
          eventSlug={slug}
          eventTitle={title}
          eventDate={eventDate ? new Date(eventDate).toISOString() : null}
          initialNumber={whatsappNumber}
        />
      </div>
    </div>
  )
}
