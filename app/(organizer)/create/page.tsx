"use client"

import React, { useState, useRef, useEffect } from "react"
import { v4 as uuidv4 } from "uuid"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

type QuestionType = "text" | "email" | "phone" | "select"

type Question = {
  id: string
  label: string
  type: QuestionType
  required: boolean
  options: string[]
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone Number" },
  { value: "select", label: "Multiple Choice" },
]

const defaultQuestion = (): Question => ({
  id: "question-0",
  label: "Full Name",
  type: "text",
  required: true,
  options: [],
})

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
  const [organizerEmail, setOrganizerEmail] = useState("")
  const [questions, setQuestions] = useState([defaultQuestion()])
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [eventInfo, setEventInfo] = useState<{ id: string; title: string; slug: string; dashboardToken: string } | null>(null)
  const [error, setError] = useState("")
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-fill organizer email from signed-in account
  useEffect(() => {
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
        i === idx ? { ...q, [field]: value, ...(field === "type" && value !== "select" ? { options: [] } : {}) } : q
      )
    )
  }

  const handleOptionChange = (idx: number, value: string) => {
    setQuestions(qs =>
      qs.map((q, i) =>
        i === idx ? { ...q, options: value.split(",").map(opt => opt.trim()).filter(Boolean) } : q
      )
    )
  }

  const addQuestion = () => setQuestions(qs => [...qs, { id: uuidv4(), label: "", type: "text", required: false, options: [] }])
  const removeQuestion = (idx: number) => setQuestions(qs => qs.length > 1 ? qs.filter((_, i) => i !== idx) : qs)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError("")
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
            options: q.type === "select" ? q.options : undefined,
            required: q.required,
          })),
          organizerEmail,
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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {}
  }

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

        {!success ? (
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
                    Organizer Email <span className="text-[#C8F55A]">*</span>
                  </label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    required
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
                <div className="mb-4 relative rounded-[8px] overflow-hidden border border-[rgba(240,237,230,0.08)]" style={{ height: 180 }}>
                  <Image src={imageUrl} alt="Event poster preview" fill style={{ objectFit: "cover" }} unoptimized />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute top-2 right-2 rounded-full bg-[rgba(0,0,0,0.6)] px-2 py-1 text-[0.7rem] text-[rgba(240,237,230,0.7)] border border-[rgba(240,237,230,0.15)]"
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
                      {q.type === "select" && (
                        <div>
                          <label className="mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.55)] tracking-[0.04em]">
                            Options (comma separated)
                          </label>
                          <input
                            type="text"
                            className="mt-1 w-full rounded-[8px] bg-[#141414] border border-[rgba(240,237,230,0.12)] px-3 py-2 text-[#F0EDE6] text-[0.875rem] font-medium placeholder:text-[rgba(240,237,230,0.25)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                            value={q.options.join(", ")}
                            onChange={e => handleOptionChange(idx, e.target.value)}
                            required
                          />
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
        ) : (
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
        )}
      </div>
    </div>
  )
}
