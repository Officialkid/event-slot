"use client"

import React, { useState, useEffect, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import { v4 as uuidv4 } from "uuid"
import { EventFAQEditor } from "@/components/events/EventFAQEditor"
import { EventWhatsAppInput } from "@/components/events/EventWhatsAppInput"
import { PaymentMaintenanceBanner } from "@/components/billing/PaymentMaintenanceBanner"
import type { EventContactMode } from "@/lib/eventContact"
import { TierBadge } from "@/components/TierBadge"
import { TIER_PRESET_COLOR_PALETTE, TIER_PRESETS, getBadgeTextColor, getTierPreset, resolveTierBadgeFields } from "@/lib/tierPresets"

type QuestionType = "text" | "email" | "phone" | "select" | "checkbox" | "file"

type Question = {
  id: string
  label: string
  type: QuestionType
  required: boolean
  options: string[]
  allowMultiple?: boolean
  optionLimits?: Record<string, string>
}

type TicketTierDraft = {
  id: string
  name: string
  presetKey: string
  badgeColor: string
  textColor: string
  metallic: boolean
  prestige: number
  priceKes: string
  currency: string
  capacity: string
  description: string
  bundleSize: string
  soldCount?: number
  waitlistCount?: number
  status?: string
}

function defaultTicketTier(): TicketTierDraft {
  const badge = resolveTierBadgeFields({ name: "Standard", presetKey: "STANDARD" })
  return {
    id: crypto.randomUUID(),
    name: badge.name,
    presetKey: badge.presetKey ?? "",
    badgeColor: badge.badgeColor,
    textColor: badge.textColor,
    metallic: badge.metallic,
    prestige: badge.prestige,
    priceKes: "",
    currency: "KES",
    capacity: "",
    description: "",
    bundleSize: "1",
  }
}

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 12,
}

const cardMutedStyle: React.CSSProperties = {
  background: "var(--surface-muted)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 12,
}

const inputStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  color: "var(--text-primary)",
}

const labelStyle: React.CSSProperties = {
  color: "var(--text-secondary)",
  letterSpacing: "0.04em",
}

const helperStyle: React.CSSProperties = {
  color: "var(--text-muted)",
}

const accentPanelStyle: React.CSSProperties = {
  background: "var(--accent-dim)",
  border: "1px solid var(--border-emphasis)",
  borderRadius: 10,
}

const accentButtonStyle: React.CSSProperties = {
  borderColor: "var(--border-emphasis)",
  color: "var(--accent)",
}

const accentTextStyle: React.CSSProperties = {
  color: "var(--accent)",
}

const errorTextStyle: React.CSSProperties = {
  color: "var(--error)",
}

const warningCardStyle: React.CSSProperties = {
  background: "rgba(255,184,77,0.05)",
  border: "1px solid rgba(255,184,77,0.22)",
  borderRadius: 10,
}

const warningInsetStyle: React.CSSProperties = {
  background: "rgba(255,184,77,0.04)",
  border: "1px solid rgba(255,184,77,0.18)",
  borderRadius: 10,
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone Number" },
  { value: "select", label: "Multiple Choice" },
  { value: "checkbox", label: "Checkboxes" },
  { value: "file", label: "File upload" },
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
  const [accessType, setAccessType] = useState<"REGISTRATION" | "WALK_IN">("REGISTRATION")
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PRIVATE")
  const [capacity, setCapacity] = useState("")
  const [deadline, setDeadline] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [eventEndAt, setEventEndAt] = useState("")
  const [joinOpensAt, setJoinOpensAt] = useState("")
  const [location, setLocation] = useState("")
  const [mapDirectionsUrl, setMapDirectionsUrl] = useState("")
  const [entryFeeLabel, setEntryFeeLabel] = useState("")
  const [showRemainingSpots, setShowRemainingSpots] = useState(true)
  const [attendeeConsentEnabled, setAttendeeConsentEnabled] = useState(true)
  const [attendeeConsentText, setAttendeeConsentText] = useState("")
  const [communityLink, setCommunityLink] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [questions, setQuestions] = useState<Question[]>([])
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({})

  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState("")
  const [category, setCategory] = useState("")
  const [whatsappNumber, setWhatsappNumber] = useState("")
  const [contactMode, setContactMode] = useState<EventContactMode>("WHATSAPP")
  const [isPaid, setIsPaid] = useState(false)
  const [ticketTiers, setTicketTiers] = useState<TicketTierDraft[]>([defaultTicketTier()])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/signin")
  }, [status, router])

  useEffect(() => {
    if (accessType !== "WALK_IN") return
    setVisibility("PRIVATE")
  }, [accessType])

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
        setAccessType(e.accessType === "WALK_IN" ? "WALK_IN" : "REGISTRATION")
        setVisibility(e.visibility === "PUBLIC" ? "PUBLIC" : "PRIVATE")
        setCapacity(e.capacity != null ? String(e.capacity) : "")
        setDeadline(toDatetimeLocal(e.deadline))
        setEventDate(toDatetimeLocal(e.eventDate))
        setEventEndAt(toDatetimeLocal(e.eventEndAt))
        setJoinOpensAt(toDatetimeLocal(e.joinOpensAt))
        setLocation(e.location ?? "")
        setMapDirectionsUrl(e.mapDirectionsUrl ?? "")
        setEntryFeeLabel(e.entryFeeLabel ?? "")
        setShowRemainingSpots(e.showRemainingSpots !== false)
        setAttendeeConsentEnabled(e.attendeeConsentEnabled !== false)
        setAttendeeConsentText(e.attendeeConsentText ?? "")
        setCommunityLink(e.communityLink ?? "")
        setImageUrl(e.imageUrl ?? "")
        setCategory(e.category ?? "")
        setWhatsappNumber(e.whatsappNumber ?? "")
        setContactMode(e.contactMode === "CALL" ? "CALL" : "WHATSAPP")
        setIsPaid(Boolean(e.isPaid))
        setTicketTiers(
          Array.isArray(e.ticketTiers) && e.ticketTiers.length > 0
            ? e.ticketTiers.map((tier: {
              id: string
              name: string
              presetKey?: string | null
              badgeColor?: string | null
              textColor?: string | null
              metallic?: boolean | null
              prestige?: number | null
              priceKes: number
              currency?: string | null
              capacity: number
                description?: string | null
                bundleSize?: number | null
                soldCount?: number
                waitlistCount?: number
                status?: string
              }) => ({
                id: tier.id,
                name: tier.name ?? "",
                presetKey: tier.presetKey ?? "",
                badgeColor: tier.badgeColor ?? "#A8A9AD",
                textColor: tier.textColor ?? "#1A1A1A",
                metallic: Boolean(tier.metallic),
                prestige: tier.prestige ?? 0,
                priceKes: String(tier.priceKes ?? ""),
                currency: tier.currency ?? "KES",
                capacity: String(tier.capacity ?? ""),
                description: tier.description ?? "",
                bundleSize: String(tier.bundleSize ?? 1),
                soldCount: tier.soldCount ?? 0,
                waitlistCount: tier.waitlistCount ?? 0,
                status: tier.status ?? "ACTIVE",
              }))
            : [defaultTicketTier()]
        )
        setQuestions(
          Array.isArray(e.questions)
            ? e.questions.map((q: Question) => ({
                ...q,
                options: q.options ?? [],
                optionLimits: Object.fromEntries(
                  Object.entries(q.optionLimits ?? {}).map(([key, value]) => [key, value == null ? "" : String(value)])
                ),
              }))
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
                  ? { options: [], allowMultiple: false, optionLimits: {} }
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
          return {
            ...q,
            options: [...q.options, draft],
            optionLimits: { ...(q.optionLimits ?? {}), [draft]: q.optionLimits?.[draft] ?? "" },
          }
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
          i === idx
            ? {
                ...q,
                options: q.options.filter((_, j) => j !== optionIdx),
                optionLimits: Object.fromEntries(
                  Object.entries(q.optionLimits ?? {}).filter(([label]) => label !== q.options[optionIdx])
                ),
              }
            : q
        )
      )
  }

  function updateOptionLimit(idx: number, option: string, value: string) {
    setQuestions(qs =>
      qs.map((q, i) =>
        i === idx
          ? {
              ...q,
              optionLimits: {
                ...(q.optionLimits ?? {}),
                [option]: value.replace(/[^\d]/g, ""),
              },
            }
          : q
      )
    )
  }

  function buildOptionLimitsPayload(question: Question) {
    const entries = Object.entries(question.optionLimits ?? {})
      .map(([label, raw]) => [label, raw.trim()] as const)
      .filter(([, raw]) => raw.length > 0)
      .map(([label, raw]) => [label, Number(raw)] as const)
      .filter(([, value]) => Number.isFinite(value) && value > 0)

    return entries.length > 0 ? Object.fromEntries(entries) : undefined
  }

  const addQuestion = () => {
    const id = uuidv4()
    setQuestions(qs => [...qs, { id, label: "", type: "text", required: false, options: [], allowMultiple: false, optionLimits: {} }])
    setOptionDrafts(prev => ({ ...prev, [id]: "" }))
  }

  const removeQuestion = (idx: number) =>
    setQuestions(qs => qs.length > 1 ? qs.filter((_, i) => i !== idx) : qs)

  function updateTicketTier(id: string, field: keyof TicketTierDraft, value: string | boolean | number) {
    setTicketTiers((current) =>
      current.map((tier) => {
        if (tier.id !== id) return tier

        if (field === "presetKey") {
          const preset = getTierPreset(String(value))
          if (!preset) {
            const badgeColor = tier.badgeColor || TIER_PRESET_COLOR_PALETTE[0]
            return {
              ...tier,
              presetKey: "",
              badgeColor,
              textColor: getBadgeTextColor(badgeColor),
              metallic: false,
              prestige: 0,
            }
          }
          return {
            ...tier,
            presetKey: preset.key,
            name: preset.defaultName,
            badgeColor: preset.badgeColor,
            textColor: preset.textColor,
            metallic: preset.metallic,
            prestige: preset.prestige,
          }
        }

        if (field === "badgeColor") {
          const badgeColor = String(value)
          return {
            ...tier,
            presetKey: "",
            badgeColor,
            textColor: getBadgeTextColor(badgeColor),
            metallic: false,
            prestige: 0,
          }
        }

        return { ...tier, [field]: value }
      })
    )
  }

  function addTicketTier() {
    setTicketTiers((current) => current.length >= 10 ? current : [...current, defaultTicketTier()])
  }

  function removeTicketTier(id: string) {
    setTicketTiers((current) => (current.length > 1 ? current.filter((tier) => tier.id !== id) : current))
  }

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
    if (isPaid) {
      const invalidTier = ticketTiers.find((tier) => {
        const price = Number(tier.priceKes)
        const capacityValue = Number(tier.capacity)
        const bundleSize = Number(tier.bundleSize || "1")
        return !tier.name.trim() || !price || price < 50 || !capacityValue || capacityValue < 1 || bundleSize < 1
      })
      if (invalidTier) {
        setSaving(false)
        setError("Each paid tier needs a name, a price of at least KSh 50, a capacity, and a bundle size of at least 1.")
        return
      }
    }
    if (visibility === "PUBLIC" && !imageUrl.trim()) {
      setSaving(false)
      setError("Public events require a poster image so they can appear on the Events page.")
      return
    }
    if (visibility === "PUBLIC" && !eventDate) {
      setSaving(false)
      setError("Public events require a start date so attendees can see when the event is happening.")
      return
    }
    if (visibility === "PUBLIC" && !location.trim()) {
      setSaving(false)
      setError("Public events require a visible location or venue label so attendees can discover where to go.")
      return
    }
    try {
      const res = await fetch(`/api/events/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || undefined,
          visibility,
          capacity: capacity ? Number(capacity) : undefined,
          deadline: deadline ? new Date(deadline).toISOString() : undefined,
          eventDate: eventDate ? new Date(eventDate).toISOString() : undefined,
          eventEndAt: eventEndAt ? new Date(eventEndAt).toISOString() : undefined,
          joinOpensAt: joinOpensAt ? new Date(joinOpensAt).toISOString() : undefined,
          location: location || undefined,
          mapDirectionsUrl: mapDirectionsUrl || undefined,
          entryFeeLabel: entryFeeLabel || undefined,
          showRemainingSpots,
          attendeeConsentEnabled,
          attendeeConsentText: attendeeConsentText || undefined,
          communityLink: communityLink || undefined,
          imageUrl: imageUrl || undefined,
          category: category || undefined,
          whatsappNumber: whatsappNumber || undefined,
          contactMode,
          questions: questions.map(q => ({
            id: q.id,
            label: q.label,
            type: q.type,
            options: typeUsesOptions(q.type) ? q.options : undefined,
            allowMultiple: q.type === "checkbox" ? !!q.allowMultiple : undefined,
            optionLimits: typeUsesOptions(q.type) ? buildOptionLimitsPayload(q) : undefined,
            required: q.required,
          })),
        }),
      })
      const data = await res.json()
      if (data.success) {
        if (isPaid) {
          const tierRes = await fetch(`/api/events/${slug}/ticket-tiers`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ticketTiers: ticketTiers.map((tier) => ({
                id: tier.id.startsWith("c") ? tier.id : undefined,
                name: tier.name.trim(),
                presetKey: tier.presetKey || null,
                badgeColor: tier.badgeColor,
                textColor: tier.textColor,
                metallic: tier.metallic,
                prestige: tier.prestige,
                priceKes: Number(tier.priceKes),
                currency: tier.currency,
                capacity: Number(tier.capacity),
                description: tier.description.trim() || null,
                bundleSize: Number(tier.bundleSize || "1"),
              })),
            }),
          })
          const tierData = await tierRes.json()
          if (!tierRes.ok || !tierData.success) {
            setError(tierData.error || "Event details saved, but ticket tiers failed to update.")
            setSaving(false)
            return
          }
        }
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
        <div className="mx-auto max-w-[640px] space-y-3 animate-pulse">
          <div className="h-6 w-40 rounded" style={{ background: "var(--surface-muted)" }} />
          <div className="h-4 w-64 rounded" style={{ background: "var(--surface-muted)" }} />
          <div className="h-40 rounded-xl border" style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }} />
        </div>
      </div>
    )
  }

  if (error && questions.length === 0) {
    return (
      <div className="px-4 py-12">
        <div className="mx-auto max-w-[640px] rounded-[12px] border p-8 text-center" style={cardStyle}>
          <p className="text-sm" style={errorTextStyle}>{error}</p>
          <a href="/my-events" className="mt-4 inline-block text-sm" style={{ color: "var(--text-secondary)" }}>← Back to my events</a>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-[640px] space-y-6">

        <div>
          <h1 className="text-[1.8rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
            Edit event
          </h1>
          <p className="mt-2 text-[0.9rem] font-[300]" style={{ color: "var(--text-secondary)" }}>
            Changes take effect immediately.
          </p>
        </div>

        {success && (
          <div className="rounded-[8px] border px-4 py-3 text-[0.82rem]" style={{ ...accentPanelStyle, color: "var(--accent)" }}>
            Changes saved! Redirecting…
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Details */}
          <div className="rounded-[12px] p-6" style={cardStyle}>
            <h2 className="mb-4 text-[1.1rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
              Event Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                  Event Title <span style={accentTextStyle}>*</span>
                </label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  style={inputStyle}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                  Description
                </label>
                <textarea
                  className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  style={{ ...inputStyle, whiteSpace: "pre-wrap", lineHeight: 1.6 }}
                  rows={5}
                  maxLength={5000}
                  placeholder="Your caption, spacing, line breaks, and emojis will be kept as written."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
                <p className="mt-2 text-[0.72rem]" style={{ color: "var(--text-secondary)" }}>
                  Line breaks, spacing, and emojis are preserved on the public event page and registration form.
                </p>
              </div>
              <div>
                {isPaid && (
                  <PaymentMaintenanceBanner
                    compact
                    title="Paid events are coming soon"
                    message="We are working on this. Paid ticket-tier editing is hidden for now while the payment rollout is still paused."
                  />
                )}
                {false && isPaid && (
                  <div className="mb-4 p-4" style={warningCardStyle}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[0.78rem] font-semibold text-[#FFB84D]">Paid ticket tiers</p>
                        <p className="mt-1 text-[0.72rem]" style={{ color: "var(--text-secondary)" }}>
                          Manage prices, capacities, and bundle sizes without changing existing registrations.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addTicketTier}
                        disabled={ticketTiers.length >= 10}
                        className="rounded-full border px-3 py-1 text-[0.75rem] disabled:opacity-40"
                        style={{ borderColor: "color-mix(in srgb, var(--warning) 35%, transparent)", color: "var(--warning)" }}
                      >
                        + Add tier
                      </button>
                    </div>

                    <div className="space-y-3">
                      {ticketTiers.map((tier, index) => (
                        <div key={tier.id} className="rounded-[10px] border p-3" style={cardMutedStyle}>
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[0.78rem] font-semibold" style={{ color: "var(--text-primary)" }}>Tier {index + 1}</p>
                              {(tier.soldCount || tier.waitlistCount) ? (
                                <p className="mt-1 text-[0.72rem]" style={{ color: "var(--text-secondary)" }}>
                                  {tier.soldCount ?? 0} sold · {tier.waitlistCount ?? 0} on waitlist
                                </p>
                              ) : null}
                            </div>
                            {ticketTiers.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeTicketTier(tier.id)}
                                className="text-[0.72rem]"
                                style={errorTextStyle}
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          <div className="mb-3 grid gap-3 md:grid-cols-[1.2fr,0.8fr]">
                            <div>
                              <label className="mb-1 block text-[0.7rem] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                                Preset tier
                              </label>
                              <select
                                value={tier.presetKey}
                                onChange={e => updateTicketTier(tier.id, "presetKey", e.target.value)}
                                className="w-full rounded-[8px] px-3 py-2 text-[0.84rem] font-medium focus:border-[rgba(255,184,77,0.5)] focus:outline-none"
                                style={inputStyle}
                              >
                                <option value="">Custom tier</option>
                                {TIER_PRESETS.map((preset) => (
                                  <option key={preset.key} value={preset.key}>
                                    {preset.defaultName}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="rounded-[10px] border px-3 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                              <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>Preview</p>
                              <TierBadge
                                name={tier.name || "Tier"}
                                badgeColor={tier.badgeColor}
                                textColor={tier.textColor}
                                metallic={tier.metallic}
                                size="md"
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <input
                              type="text"
                              className="w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(255,184,77,0.5)] focus:outline-none"
                              style={inputStyle}
                              placeholder="Tier name"
                              value={tier.name}
                              onChange={e => updateTicketTier(tier.id, "name", e.target.value)}
                            />
                            <input
                              type="number"
                              min="50"
                              className="w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(255,184,77,0.5)] focus:outline-none"
                              style={inputStyle}
                              placeholder="Price (KES)"
                              value={tier.priceKes}
                              onChange={e => updateTicketTier(tier.id, "priceKes", e.target.value)}
                            />
                            <div className="rounded-[8px] border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                              <label className="mb-2 block text-[0.68rem] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                                Badge colour
                              </label>
                              <div className="flex flex-wrap items-center gap-2">
                                <input
                                  type="color"
                                  value={tier.badgeColor}
                                  onChange={e => updateTicketTier(tier.id, "badgeColor", e.target.value)}
                                  className="h-9 w-11 rounded border bg-transparent"
                                  style={{ borderColor: "var(--border)" }}
                                />
                                {TIER_PRESET_COLOR_PALETTE.map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() => updateTicketTier(tier.id, "badgeColor", color)}
                                    className="h-6 w-6 rounded-full border"
                                    style={{ background: color, borderColor: "var(--border-subtle)" }}
                                    aria-label={`Use ${color} badge colour`}
                                  />
                                ))}
                              </div>
                            </div>
                            <input
                              type="number"
                              min="1"
                              className="w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(255,184,77,0.5)] focus:outline-none"
                              style={inputStyle}
                              placeholder="Tier capacity"
                              value={tier.capacity}
                              onChange={e => updateTicketTier(tier.id, "capacity", e.target.value)}
                            />
                            <input
                              type="number"
                              min="1"
                              className="w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(255,184,77,0.5)] focus:outline-none"
                              style={inputStyle}
                              placeholder="Bundle size"
                              value={tier.bundleSize}
                              onChange={e => updateTicketTier(tier.id, "bundleSize", e.target.value)}
                            />
                          </div>

                          <textarea
                            className="mt-3 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(255,184,77,0.5)] focus:outline-none"
                            style={inputStyle}
                            rows={2}
                            placeholder="Optional description"
                            value={tier.description}
                            onChange={e => updateTicketTier(tier.id, "description", e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                  Maximum Capacity
                </label>
                <input
                  type="number"
                  min="1"
                  className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  style={inputStyle}
                  placeholder="Leave empty for unlimited"
                  value={capacity}
                  onChange={e => setCapacity(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                  Registration Deadline (optional)
                </label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  style={inputStyle}
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                  Event Start
                </label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  style={inputStyle}
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                  Event End (optional)
                </label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  style={inputStyle}
                  value={eventEndAt}
                  onChange={e => setEventEndAt(e.target.value)}
                />
                <p className="mt-1 text-[0.72rem]" style={{ color: "var(--text-muted)" }}>
                  If you leave the deadline blank, registration stays open during the event and closes when the event ends.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                  Link Opens At (optional)
                </label>
                <input
                  type="datetime-local"
                  className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  style={inputStyle}
                  value={joinOpensAt}
                  onChange={e => setJoinOpensAt(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                  Location / Venue
                </label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  style={inputStyle}
                  placeholder="e.g. iHub, Nairobi"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                  Google Maps directions link <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <input
                  type="url"
                  inputMode="url"
                  className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  style={inputStyle}
                  placeholder="Paste the exact Google Maps share link"
                  value={mapDirectionsUrl}
                  onChange={e => setMapDirectionsUrl(e.target.value)}
                />
                <p className="mt-1 text-[0.72rem]" style={{ color: "var(--text-muted)" }}>
                  EventSlot only shows directions when this link is provided by the organiser.
                </p>
                <a
                  href={location.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}` : "https://www.google.com/maps"}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex rounded-full border px-3 py-2 text-[0.78rem] font-semibold"
                  style={{ ...accentButtonStyle, textDecoration: "none" }}
                >
                  Search venue on Google Maps
                </a>
              </div>
              <div>
                <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                  Entry / contribution note <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={200}
                  className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  style={inputStyle}
                  placeholder="e.g. KSh 1,000 per person or Early bird: KSh 1,500"
                  value={entryFeeLabel}
                  onChange={e => setEntryFeeLabel(e.target.value)}
                />
                <p className="mt-1 text-[0.72rem]" style={{ color: "var(--text-muted)" }}>
                  This only displays the organizer's fee note. It does not collect payment.
                </p>
              </div>
              <div className="md:col-span-2 rounded-[12px] p-4" style={cardMutedStyle}>
                <label className="flex items-center gap-3 text-[0.82rem] font-semibold" style={{ color: "var(--text-primary)" }}>
                  <input
                    type="checkbox"
                    checked={attendeeConsentEnabled}
                    onChange={e => setAttendeeConsentEnabled(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Show consent checkbox on attendee form
                </label>
                {attendeeConsentEnabled && (
                  <textarea
                    className="mt-3 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    style={inputStyle}
                    rows={3}
                    maxLength={1000}
                    placeholder="Optional custom consent wording. Leave blank to use the EventSlot default."
                    value={attendeeConsentText}
                    onChange={e => setAttendeeConsentText(e.target.value)}
                  />
                )}
                <p className="mt-1 text-[0.72rem]" style={{ color: "var(--text-muted)" }}>
                  Use this only when your department or event requires a specific consent statement.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                  Community Link (optional)
                </label>
                <input
                  type="text"
                  inputMode="url"
                  className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  style={inputStyle}
                  placeholder="e.g. WhatsApp group, Telegram, website"
                  value={communityLink}
                  onChange={e => setCommunityLink(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                  Event Category (optional)
                </label>
                <select
                  className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                  style={inputStyle}
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  <option value="">Select a category…</option>
                  {["CONFERENCE","WORKSHOP","NETWORKING","CHURCH","CAMPUS","CONCERT","VIRTUAL"].map(c => (
                    <option key={c} value={c}>
                      {c.charAt(0) + c.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[0.72rem]" style={{ color: "var(--text-muted)" }}>
                  Used to suggest relevant FAQ questions
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[12px] border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <h2 className="mb-2 text-[1.1rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
              Event Visibility
            </h2>
            <p className="mb-4 text-[0.78rem]" style={{ color: "var(--text-secondary)" }}>
              Choose whether this event should appear on the public Events discovery page.
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  if (accessType === "WALK_IN") return
                  setVisibility("PUBLIC")
                }}
                className="rounded-[10px] border p-4 text-left"
                disabled={accessType === "WALK_IN"}
                style={visibility === "PUBLIC" ? { borderColor: "var(--border-emphasis)", background: "var(--accent-dim)" } : { borderColor: "var(--border)", background: "var(--surface-2)" }}
              >
                <div className="text-[0.88rem] font-semibold" style={{ color: visibility === "PUBLIC" ? "var(--accent)" : "var(--text-primary)" }}>Public</div>
                <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-secondary)" }}>
                  Show this event on the EventSlot Events page so anyone can discover and register.
                </p>
              </button>
              <button
                type="button"
                onClick={() => setVisibility("PRIVATE")}
                className="rounded-[10px] border p-4 text-left"
                style={visibility === "PRIVATE" ? { borderColor: "var(--border-emphasis)", background: "var(--accent-dim)" } : { borderColor: "var(--border)", background: "var(--surface-2)" }}
              >
                <div className="text-[0.88rem] font-semibold" style={{ color: visibility === "PRIVATE" ? "var(--accent)" : "var(--text-primary)" }}>Private</div>
                <p className="mt-1 text-[0.75rem]" style={{ color: "var(--text-secondary)" }}>
                  Keep this event off public discovery and accessible only through the shared registration link.
                </p>
              </button>
            </div>
            {accessType === "WALK_IN" && (
              <p className="mt-3 text-[0.72rem]" style={{ color: "var(--text-muted)" }}>
                Walk-in events stay private for now because the discovery page is built for standard registration events.
              </p>
            )}
          </div>

          {/* Event Poster */}
          <div className="rounded-[12px] border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <h2 className="mb-1 text-[1.1rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
              Event Poster
            </h2>
            <p className="mb-4 text-[0.78rem]" style={{ color: "var(--text-secondary)" }}>
              {visibility === "PUBLIC"
                ? "Required for public events so your listing has a strong visual on the Events page. JPEG, PNG, WebP or GIF, up to 15 MB."
                : "Upload a banner or flyer. Attendees will see it on the registration page. JPEG, PNG, WebP or GIF, up to 15 MB."}
            </p>

            {imageUrl && (
              <div className="mb-4 overflow-hidden rounded-[8px] border" style={{ borderColor: "var(--border)", background: "var(--surface-muted)", lineHeight: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Event poster" style={{ width: "100%", height: "auto", maxHeight: "480px", objectFit: "contain", objectPosition: "center top", display: "block", borderRadius: "8px" }} />
                <button
                  type="button"
                  onClick={() => setImageUrl("")}
                  className="mt-2 rounded-full border px-2 py-1 text-[0.7rem]"
                  style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-secondary)" }}
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
              className="rounded-full border bg-transparent px-5 py-2 text-[0.82rem] font-medium"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              {imageUploading ? "Uploading..." : imageUrl ? "Replace image" : "Upload image"}
            </button>
            {imageError && (
              <p className="mt-2 text-[0.78rem]" style={errorTextStyle}>{imageError}</p>
            )}
          </div>

          {/* Questions */}
          <div className="rounded-[12px] border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <h2 className="mb-4 text-[1.1rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
              Registration Questions
            </h2>
            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div key={q.id} className="rounded-[8px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-[0.72rem] font-semibold tracking-[0.04em]" style={{ color: "var(--text-muted)" }}>
                        Question Label
                      </label>
                      <input
                        type="text"
                        required
                        className="mt-1 w-full rounded-[8px] border px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                        style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                        value={q.label}
                        onChange={e => handleQuestionChange(idx, "label", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[0.72rem] font-semibold tracking-[0.04em]" style={{ color: "var(--text-muted)" }}>
                        Type
                      </label>
                      <select
                        className="mt-1 w-full rounded-[8px] border px-3 py-2 text-[0.875rem] font-medium focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                        style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                        value={q.type}
                        onChange={e => handleQuestionChange(idx, "type", e.target.value)}
                      >
                        {QUESTION_TYPES.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    {typeUsesOptions(q.type) && (
                      <div>
                        <label className="mb-1 block text-[0.72rem] font-semibold tracking-[0.04em]" style={{ color: "var(--text-muted)" }}>
                          Options
                        </label>
                        <div className="mt-1 flex gap-2">
                          <input
                            type="text"
                            className="w-full rounded-[8px] border px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
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
                            className="rounded-[8px] border px-3 py-2 text-[0.8rem]"
                            style={accentButtonStyle}
                            onClick={() => addOption(idx)}
                          >
                            Add
                          </button>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {q.options.map((opt, optionIdx) => (
                            <span
                              key={`${q.id}-${opt}-${optionIdx}`}
                              className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.78rem]"
                              style={{ borderColor: "var(--border)", color: "var(--text-primary)", background: "var(--surface)" }}
                            >
                              {opt}
                              <button
                                type="button"
                                className="text-[0.8rem]"
                                style={{ color: "var(--text-muted)" }}
                                onClick={() => removeOption(idx, optionIdx)}
                                aria-label={`Remove ${opt}`}
                              >
                                x
                              </button>
                            </span>
                          ))}
                        </div>
                        {q.options.length > 0 && (
                          <div className="mt-3 space-y-2 rounded-[10px] border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                            <p className="text-[0.72rem]" style={{ color: "var(--text-muted)" }}>
                              Optional per-option slots. Leave blank if an option should stay unlimited.
                            </p>
                            {q.options.map((opt) => (
                              <div key={`${q.id}-${opt}-limit`} className="flex items-center gap-3">
                                <span className="min-w-0 flex-1 truncate text-[0.78rem]" style={{ color: "var(--text-primary)" }}>{opt}</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className="w-[120px] rounded-[8px] border px-2 py-1.5 text-[0.75rem] placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                                  style={{ background: "var(--surface-muted)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                                  placeholder="Slots"
                                  value={q.optionLimits?.[opt] ?? ""}
                                  onChange={e => updateOptionLimit(idx, opt, e.target.value)}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                        {q.options.length === 0 && (
                          <p className="mt-2 text-[0.75rem]" style={{ color: "var(--text-muted)" }}>Add at least one option.</p>
                        )}
                      </div>
                    )}
                    {q.type === "checkbox" && (
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`allow-multiple-${q.id}`}
                          className="h-4 w-4 rounded border focus:ring-[#C8F55A]"
                          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--accent)" }}
                          checked={!!q.allowMultiple}
                          onChange={e => handleQuestionChange(idx, "allowMultiple", e.target.checked)}
                        />
                        <label htmlFor={`allow-multiple-${q.id}`} className="text-[0.9rem]" style={{ color: "var(--text-primary)" }}>
                          Allow selecting multiple options
                        </label>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`required-${q.id}`}
                        className="h-4 w-4 rounded border focus:ring-[#C8F55A]"
                        style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--accent)" }}
                        checked={q.required}
                        onChange={e => handleQuestionChange(idx, "required", e.target.checked)}
                      />
                      <label htmlFor={`required-${q.id}`} className="text-[0.9rem]" style={{ color: "var(--text-primary)" }}>Required</label>
                    </div>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        className="mt-2 rounded-full border px-3 py-1 text-[0.75rem]"
                        style={{ borderColor: "color-mix(in srgb, var(--error) 35%, transparent)", color: "var(--error)" }}
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
                className="w-full rounded-full border bg-transparent px-6 py-3 text-[0.875rem] font-medium"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                onClick={addQuestion}
              >
                Add Question
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <button
              type="submit"
              className="w-full rounded-full px-7 py-3 text-[0.875rem] font-semibold text-[#0A0A0A]"
              style={{ background: "var(--accent)" }}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
            {error && <div className="text-[0.82rem] text-center" style={errorTextStyle}>{error}</div>}
          </div>
        </form>

        {/* FAQ editor — lives outside the main form so it saves independently */}
        <EventFAQEditor eventSlug={slug} />
        <EventWhatsAppInput
          eventSlug={slug}
          eventTitle={title}
          eventDate={eventDate ? new Date(eventDate).toISOString() : null}
          initialNumber={whatsappNumber}
          initialMode={contactMode}
          onSaved={({ number, mode }) => {
            setWhatsappNumber(number)
            setContactMode(mode)
          }}
        />
      </div>
    </div>
  )
}
