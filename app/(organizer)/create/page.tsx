"use client"

import React, { useState, useRef, useEffect } from "react"
import { v4 as uuidv4 } from "uuid"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { EVENT_TEMPLATES } from "@/lib/eventTemplates"
import { getPublicEventUrl } from "@/lib/eventUrls"
import { markFeatureUsed } from "@/lib/markFeatureUsed"
import type { EventContactMode } from "@/lib/eventContact"
import { getEffectivePlanPolicy, getNextPlanKey, normalizePlanKey } from "@/lib/effectivePlanPolicy"
import { isPricingRolloutActive } from "@/lib/pricingRollout"
import { TierBadge } from "@/components/TierBadge"
import { EventPassSelector } from "@/components/billing/EventPassSelector"
import { PaymentMaintenanceBanner } from "@/components/billing/PaymentMaintenanceBanner"
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
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone Number" },
  { value: "select", label: "Multiple Choice" },
  { value: "checkbox", label: "Checkboxes" },
  { value: "file", label: "File upload" },
]

const defaultQuestion = (): Question => ({
  id: "question-0",
  label: "Full Name",
  type: "text",
  required: true,
  options: [],
  optionLimits: {},
})

const typeUsesOptions = (type: QuestionType) => type === "select" || type === "checkbox"

const defaultTicketTier = (): TicketTierDraft => {
  const badge = resolveTierBadgeFields({ name: "Standard", presetKey: "STANDARD" })
  return {
    id: uuidv4(),
    name: badge.name,
    presetKey: badge.presetKey ?? "",
    badgeColor: badge.badgeColor,
    textColor: badge.textColor,
    metallic: badge.metallic,
    prestige: badge.prestige,
    priceKes: "500",
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

const mutedInputStyle: React.CSSProperties = {
  background: "var(--surface-2)",
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

const warningTextStyle: React.CSSProperties = {
  color: "var(--warning)",
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

export default function CreateEventPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [accessType, setAccessType] = useState<"REGISTRATION" | "WALK_IN">("REGISTRATION")
  const [eventType, setEventType] = useState<"PHYSICAL" | "VIRTUAL">("PHYSICAL")
  const [virtualLink, setVirtualLink] = useState("")
  const [capacity, setCapacity] = useState("")
  const [deadline, setDeadline] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [eventEndAt, setEventEndAt] = useState("")
  const [joinOpensAt, setJoinOpensAt] = useState("")
  const [location, setLocation] = useState("")
  const [mapDirectionsUrl, setMapDirectionsUrl] = useState("")
  const [entryFeeLabel, setEntryFeeLabel] = useState("")
  const [attendeeConsentEnabled, setAttendeeConsentEnabled] = useState(true)
  const [attendeeConsentText, setAttendeeConsentText] = useState("")
  const [isPaid, setIsPaid] = useState(false)
  const [ticketPrice, setTicketPrice] = useState("")
  const [ticketTiers, setTicketTiers] = useState<TicketTierDraft[]>([defaultTicketTier()])
  const [communityLink, setCommunityLink] = useState("")
  const [whatsappNumber, setWhatsappNumber] = useState("")
  const [contactMode, setContactMode] = useState<EventContactMode>("WHATSAPP")
  const [imageUrl, setImageUrl] = useState("")
  const [organizerName, setOrganizerName] = useState("")
  const [organizerEmail, setOrganizerEmail] = useState("")
  const [questions, setQuestions] = useState([defaultQuestion()])
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [eventInfo, setEventInfo] = useState<{ id: string; title: string; slug: string; dashboardToken: string; accessType: "REGISTRATION" | "WALK_IN" } | null>(null)
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
  const [showCapacityUpgradeHint, setShowCapacityUpgradeHint] = useState(false)
  const [aiPrediction, setAiPrediction] = useState<{
    suggestedCapacity: number
    confidence: 'low' | 'medium' | 'high'
    reasoning: string
  } | null>(null)
  const [aiPredictionLoading, setAiPredictionLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const isWalkInEvent = accessType === "WALK_IN"
  const isRegistrationEvent = !isWalkInEvent
  const organizerPlan = normalizePlanKey(session?.user?.plan)
  const pricingActive = isPricingRolloutActive()
  const effectivePlan = getEffectivePlanPolicy(organizerPlan)
  const attendeeLimit = effectivePlan.maxAttendeesPerEvent
  const lockedCapacity = pricingActive && isRegistrationEvent && !isPaid && attendeeLimit !== -1
  const nextPlan = getNextPlanKey(organizerPlan)

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

  useEffect(() => {
    if (!isWalkInEvent) return
    setEventType("PHYSICAL")
    setVirtualLink("")
    setIsPaid(false)
    setTicketPrice("")
    setTicketTiers([defaultTicketTier()])
    setCapacity("")
    setDeadline("")
  }, [isWalkInEvent])

  useEffect(() => {
    if (lockedCapacity && !capacity) {
      setCapacity(String(attendeeLimit))
    }
  }, [attendeeLimit, capacity, lockedCapacity])

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
        optionLimits: Object.fromEntries(
          Object.entries(("optionLimits" in q ? q.optionLimits : {}) ?? {}).map(([key, value]) => [key, value == null ? "" : String(value)])
        ),
      }))
    )
    setSelectedTemplateId(templateId)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 50)
  }

  const successRegistrationLink = eventInfo && origin
    ? getPublicEventUrl(origin, eventInfo.slug, eventInfo.accessType)
    : ""

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

  const handleDownloadSuccessQR = async () => {
    if (!eventInfo) return
    try {
      const response = await fetch(`/api/events/${eventInfo.slug}/qr`, { cache: "no-store" })
      if (!response.ok) throw new Error("Unable to generate QR code")
      const blob = await response.blob()
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = objectUrl
      link.download = `qr-${eventInfo.slug}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000)
    } catch {
      window.location.assign(`/api/events/${eventInfo.slug}/qr`)
    }
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
                ? { options: [], allowMultiple: false, optionLimits: {} }
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

  const removeOption = (idx: number, optionIdx: number) => {
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

  const updateOptionLimit = (idx: number, option: string, value: string) => {
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

  const buildOptionLimitsPayload = (question: Question) => {
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
    setQuestions(qs => {
      if (qs.length <= 1) return qs
      return qs.filter((_, i) => i !== idx)
    })

  const updateTicketTier = (id: string, field: keyof TicketTierDraft, value: string | boolean | number) => {
    setTicketTiers((tiers) =>
      tiers.map((tier) => {
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

  const addTicketTier = () => {
    if (ticketTiers.length >= 10) return
    setTicketTiers((tiers) => [...tiers, defaultTicketTier()])
  }

  const removeTicketTier = (id: string) => {
    setTicketTiers((tiers) => {
      if (tiers.length <= 1) return tiers
      return tiers.filter((tier) => tier.id !== id)
    })
  }

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

    if (isWalkInEvent && !imageUrl.trim()) {
      setLoading(false)
      setError("Walk-in events need a poster image so the share card always includes one.")
      return
    }

    if (isPaid) {
      const invalidTier = ticketTiers.find((tier) => {
        const price = Number(tier.priceKes)
        const tierCapacity = Number(tier.capacity || capacity)
        return !tier.name.trim() || !price || price < 50 || !tierCapacity || tierCapacity < 1
      })
      if (invalidTier) {
        setLoading(false)
        setError("Each paid ticket tier needs a name, a price of at least KSh 50, and a capacity.")
        return
      }
    }

    const invalidQuestion = isRegistrationEvent
      ? questions.find(q => typeUsesOptions(q.type) && q.options.length === 0)
      : null
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
          accessType,
          eventType,
          virtualLink: eventType === "VIRTUAL" ? virtualLink || undefined : undefined,
          capacity: isRegistrationEvent && capacity ? Number(capacity) : undefined,
          deadline: isRegistrationEvent && deadline ? new Date(deadline).toISOString() : undefined,
          eventDate: eventDate ? new Date(eventDate).toISOString() : undefined,
          eventEndAt: eventEndAt ? new Date(eventEndAt).toISOString() : undefined,
          joinOpensAt: joinOpensAt ? new Date(joinOpensAt).toISOString() : undefined,
          location: location || undefined,
          mapDirectionsUrl: mapDirectionsUrl || undefined,
          entryFeeLabel: entryFeeLabel || undefined,
          attendeeConsentEnabled,
          attendeeConsentText: attendeeConsentText || undefined,
          isPaid: isRegistrationEvent ? isPaid : false,
          ticketPrice: isRegistrationEvent && isPaid && ticketPrice ? Number(ticketPrice) : undefined,
          ticketTiers: isRegistrationEvent && isPaid
            ? ticketTiers.map((tier) => ({
                name: tier.name.trim(),
                presetKey: tier.presetKey || null,
                badgeColor: tier.badgeColor,
                textColor: tier.textColor,
                metallic: tier.metallic,
                prestige: tier.prestige,
                priceKes: Number(tier.priceKes),
                currency: tier.currency,
                capacity: Number(tier.capacity || capacity),
                description: tier.description || undefined,
                bundleSize: Number(tier.bundleSize || "1"),
              }))
            : undefined,
          communityLink: communityLink || undefined,
          whatsappNumber: whatsappNumber || undefined,
          contactMode,
          imageUrl: imageUrl || undefined,
          questions: isRegistrationEvent
            ? questions.map(q => ({
                id: q.id,
                label: q.label,
                type: q.type,
                options: typeUsesOptions(q.type) ? q.options : undefined,
                allowMultiple: q.type === "checkbox" ? !!q.allowMultiple : undefined,
                optionLimits: typeUsesOptions(q.type) ? buildOptionLimitsPayload(q) : undefined,
                required: q.required,
              }))
            : [],
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
        if (data.code === "PLAN_LIMIT_ATTENDEES") {
          setShowCapacityUpgradeHint(true)
        }
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
                {isWalkInEvent ? "Scan to check in for " : "Scan to register for "}<strong style={{ color: "#F0EDE6" }}>{eventInfo.title}</strong>
              </p>

              <p style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.35)", marginBottom: "1.25rem", lineHeight: "1.55", fontFamily: "var(--font-dm-sans)" }}>
                {isWalkInEvent
                  ? "Add this QR code to your poster, flyer, or WhatsApp image. Attendees scan it to open the walk-in check-in page directly."
                  : "Add this QR code to your poster, flyer, or WhatsApp image. Attendees scan it to open the registration form directly."}
              </p>

              <button
                onClick={handleDownloadSuccessQR}
                style={{
                  background: "var(--accent)",
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
          <h1 className="text-[1.8rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
            Create your event
          </h1>
          <p className="mt-2 text-[0.9rem] font-[300]" style={{ color: "var(--text-secondary)" }}>
            Set it up once. Share the link. Done.
          </p>
          <div className="mt-4 rounded-[12px] border px-4 py-3 text-[0.82rem] leading-6" style={{ borderColor: "rgba(124,199,255,0.22)", background: "rgba(124,199,255,0.08)", color: "color-mix(in srgb, var(--text-primary) 82%, #9FD8FF 18%)" }}>
            {pricingActive
              ? "Your current plan limits apply here. If you need more room, EventSlot will guide you clearly before anything changes."
              : "Free event creation is fully open right now. Paid-event tools and billing controls will appear later when they are ready."}
          </div>
        </div>

        {/* ── Template picker ── */}
        <div>
          <h2
            style={{
              fontFamily: "var(--font-instrument-serif)",
              fontSize: "1.5rem",
              fontWeight: 400,
              color: "var(--text-primary)",
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
              color: "var(--text-secondary)",
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
                      : "var(--surface)",
                    border: isSelected
                      ? "1.5px solid var(--border-emphasis)"
                      : "1px solid var(--border-subtle)",
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
                      ;(e.currentTarget as HTMLButtonElement).style.background = "color-mix(in srgb, var(--surface) 92%, rgba(200,245,90,0.08) 8%)"
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) {
                      ;(e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-subtle)"
                      ;(e.currentTarget as HTMLButtonElement).style.background = "var(--surface)"
                    }
                  }}
                >
                  <span style={{ fontSize: "2rem", lineHeight: 1 }}>{tpl.icon}</span>
                  <span
                    style={{
                      fontFamily: "var(--font-instrument-serif)",
                      fontSize: "1rem",
                      fontWeight: 400,
                      color: "var(--text-primary)",
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
                      color: "var(--text-secondary)",
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
            <div className="rounded-[12px] p-6" style={cardStyle}>
              <h2 className="mb-2 text-[1.1rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                What kind of event is this?
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setAccessType("REGISTRATION")}
                  className="min-h-[160px] rounded-[8px] border px-4 py-4 text-left transition"
                  style={
                    accessType === "REGISTRATION"
                      ? { borderColor: "var(--border-emphasis)", background: "var(--accent-muted)", color: "var(--text-primary)" }
                      : { borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }
                  }
                >
                  <div className="flex items-center gap-2 text-[0.95rem] font-semibold">
                    <span aria-hidden="true">{accessType === "REGISTRATION" ? "◉" : "○"}</span>
                    <span>Registration Event</span>
                  </div>
                  <p className="mt-4 text-[0.84rem] leading-6" style={{ color: "var(--text-secondary)" }}>
                    People sign up in advance. You set a capacity. Waitlist manages overflow.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setAccessType("WALK_IN")}
                  className="min-h-[160px] rounded-[8px] border px-4 py-4 text-left transition"
                  style={
                    accessType === "WALK_IN"
                      ? { borderColor: "rgba(79,172,254,0.5)", background: "rgba(79,172,254,0.1)", color: "var(--text-primary)" }
                      : { borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }
                  }
                >
                  <div className="flex items-center gap-2 text-[0.95rem] font-semibold">
                    <span aria-hidden="true">{accessType === "WALK_IN" ? "◉" : "○"}</span>
                    <span>Walk-In Event</span>
                  </div>
                  <p className="mt-4 text-[0.84rem] leading-6" style={{ color: "var(--text-secondary)" }}>
                    Free and open. People check in when they arrive. Live attendance counts.
                  </p>
                </button>
              </div>
            </div>

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
                    className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    style={inputStyle}
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={e => fetchAiPrediction(e.target.value, description)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                    Description
                  </label>
                  <textarea
                    className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    style={{ ...inputStyle, whiteSpace: "pre-wrap", lineHeight: 1.6 }}
                    placeholder="Briefly describe what this event is about. Line breaks, spacing, and emojis are kept as written."
                    rows={5}
                    maxLength={5000}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                  <p style={{ ...helperStyle, fontSize: "0.7rem", marginTop: "0.35rem" }}>
                    Tip: Date, time, and location are shown automatically from the fields above. Use this field for your caption, spacing, extra notes, and emojis exactly as you want attendees to read them.
                  </p>
                  <p style={{ ...helperStyle, fontSize: "0.7rem", marginTop: "0.25rem" }}>
                    {description.length} / 5000 characters
                  </p>
                </div>
                <div className="space-y-3">
                  <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                    Event Type
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEventType("PHYSICAL")}
                      className={`rounded-[8px] border px-3 py-2 text-[0.82rem] font-medium transition ${
                        eventType === "PHYSICAL"
                          ? ""
                          : ""
                      }`}
                      style={eventType === "PHYSICAL" ? { borderColor: "var(--border-emphasis)", background: "var(--accent-dim)", color: "var(--accent)" } : { borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}
                    >
                      📍 Physical
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isWalkInEvent) return
                        setEventType("VIRTUAL")
                      }}
                      disabled={isWalkInEvent}
                      className={`rounded-[8px] border px-3 py-2 text-[0.82rem] font-medium transition ${
                        eventType === "VIRTUAL"
                          ? ""
                          : ""
                      } ${isWalkInEvent ? "cursor-not-allowed opacity-40" : ""}`}
                      style={eventType === "VIRTUAL" ? { borderColor: "var(--border-emphasis)", background: "var(--accent-dim)", color: "var(--accent)" } : { borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}
                    >
                      💻 Virtual
                    </button>
                  </div>
                </div>

                {eventType === "VIRTUAL" && (
                  <div className="space-y-2">
                    <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                      Google Meet Link <span style={accentTextStyle}>*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                      style={inputStyle}
                      placeholder="meet.google.com/abc-defg-hij"
                      value={virtualLink}
                      onChange={e => setVirtualLink(e.target.value)}
                    />
                    <div className="rounded-xl border p-4" style={cardMutedStyle}>
                      <p className="mb-2 text-xs font-semibold" style={accentTextStyle}>✦ How to get your Google Meet link</p>
                      <ol className="list-inside list-decimal space-y-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                        <li>Go to <span style={{ color: "var(--text-primary)" }}>meet.new</span> or open Google Meet</li>
                        <li>Click <span style={{ color: "var(--text-primary)" }}>New meeting</span></li>
                        <li>Select <span style={{ color: "var(--text-primary)" }}>Create a meeting for later</span></li>
                        <li>Copy the link and paste it above</li>
                        <li>Keep the meeting open - attendees will join on event day after verification</li>
                      </ol>
                      <p className="mt-3 text-xs" style={{ color: "var(--text-muted)" }}>🔒 Your meeting link is encrypted and only revealed to verified attendees on event day.</p>
                    </div>
                  </div>
                )}

                {isRegistrationEvent && (
                <div className="space-y-3">
                  <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                    Pricing
                  </label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsPaid(false)
                        setTicketPrice("")
                        setTicketTiers([defaultTicketTier()])
                      }}
                      className={`rounded-[8px] border px-3 py-2 text-[0.82rem] font-medium transition ${
                        !isPaid
                          ? ""
                          : ""
                      }`}
                      style={!isPaid ? { borderColor: "var(--border-emphasis)", background: "var(--accent-dim)", color: "var(--accent)" } : { borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}
                    >
                      🎟️ Free
                    </button>
                    <button
                      type="button"
                      disabled
                      className="rounded-[8px] border px-3 py-2 text-[0.82rem] font-medium opacity-70"
                      style={{ borderColor: "color-mix(in srgb, var(--warning) 35%, transparent)", background: "var(--surface-2)", color: "var(--warning)", cursor: "not-allowed" }}
                    >
                      💳 Paid
                    </button>
                  </div>
                  <PaymentMaintenanceBanner
                    compact
                    title="Paid events are coming soon"
                    message="We are working on this. Paid-event setup and ticket-tier creation are hidden for now, so please continue creating free events until the payment rollout is ready."
                  />
                  {false && isPaid && (
                    <div className="mt-3 space-y-3 p-4" style={warningCardStyle}>
                      <div className="px-3 py-3" style={warningInsetStyle}>
                        <p className="text-[0.75rem] leading-6" style={{ color: "var(--text-secondary)" }}>
                          EventSlot&apos;s platform commission is non-refundable. If you refund an attendee later, the commission is still deducted from your net balance.
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[0.78rem] font-semibold text-[#FFB84D]">Ticket tiers</p>
                          <p className="mt-1 text-[0.72rem]" style={{ color: "var(--text-secondary)" }}>
                            Add up to 10 paid tiers. Event capacity will be the sum of all tier capacities.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={addTicketTier}
                          disabled={ticketTiers.length >= 10}
                          className="rounded-full border border-[rgba(255,184,77,0.25)] px-3 py-1 text-[0.75rem] text-[#FFB84D] disabled:opacity-40"
                        >
                          + Add tier
                        </button>
                      </div>

                      <div className="space-y-3">
                        {ticketTiers.map((tier, index) => (
                          <div key={tier.id} className="rounded-[10px] border p-3" style={cardMutedStyle}>
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="text-[0.78rem] font-semibold" style={{ color: "var(--text-primary)" }}>Tier {index + 1}</p>
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
                                  onChange={(e) => updateTicketTier(tier.id, "presetKey", e.target.value)}
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
                                <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                                  Preview
                                </p>
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
                                onChange={e => {
                                  updateTicketTier(tier.id, "priceKes", e.target.value)
                                  if (index === 0) setTicketPrice(e.target.value)
                                }}
                              />
                              <div className="rounded-[8px] border px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                                <label className="mb-2 block text-[0.68rem] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                                  Badge colour
                                </label>
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="color"
                                    value={tier.badgeColor}
                                    onChange={(e) => updateTicketTier(tier.id, "badgeColor", e.target.value)}
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
                              placeholder="Optional description of what this tier includes"
                              value={tier.description}
                              onChange={e => updateTicketTier(tier.id, "description", e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                )}

                {isRegistrationEvent && (
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                    Maximum Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={lockedCapacity ? attendeeLimit : undefined}
                    className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    style={inputStyle}
                    placeholder={lockedCapacity ? `Choose any number up to ${attendeeLimit.toLocaleString()}` : "Leave empty for unlimited"}
                    value={capacity}
                    onChange={e => {
                      const nextValue = e.target.value
                      if (lockedCapacity && nextValue) {
                        const parsed = Number(nextValue)
                        if (Number.isFinite(parsed) && parsed > attendeeLimit) {
                          setCapacity(String(attendeeLimit))
                          return
                        }
                      }
                      setCapacity(nextValue)
                    }}
                    onFocus={fetchCapacitySuggestion}
                    onClick={() => {
                      if (lockedCapacity) setShowCapacityUpgradeHint(true)
                    }}
                  />
                  {lockedCapacity ? (
                    <div className="mt-3 rounded-[10px] border px-4 py-3" style={accentPanelStyle}>
                      <p className="text-[0.8rem] leading-6" style={{ color: "var(--text-secondary)" }}>
                        Your <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{effectivePlan.displayName}</span> plan includes up to{" "}
                        <span className="font-semibold" style={accentTextStyle}>{attendeeLimit.toLocaleString()}</span> attendees per event. You can set this specific event lower if you want.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCapacityUpgradeHint((current) => !current)}
                          className="rounded-full border px-3 py-2 text-[0.78rem] font-semibold"
                          style={accentButtonStyle}
                        >
                          Need more capacity?
                        </button>
                      </div>
                      {showCapacityUpgradeHint ? (
                        <div className="mt-3 rounded-[10px] border px-3 py-3 text-[0.78rem] leading-6" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-secondary)" }}>
                          Upgrade to <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{nextPlan ? nextPlan.charAt(0).toUpperCase() + nextPlan.slice(1) : "a higher plan"}</span> for a larger included capacity.
                          Extra paid capacity controls will only appear after the billing rollout is ready.
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {aiPredictionLoading && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" stroke="var(--border-emphasis)" strokeWidth="2.5" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" />
                      </svg>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)' }}>Analysing your past events…</span>
                    </div>
                  )}
                  {aiPrediction && !capacity && (
                    <div
                      style={{
                        marginTop: '0.625rem',
                        ...accentPanelStyle,
                        padding: '0.6rem 0.85rem',
                        display: 'flex',
                        gap: '0.625rem',
                        alignItems: 'flex-start',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, marginTop: 2 }}>
                        <path d="M10 2a6 6 0 0 1 4 10.47V14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-1.53A6 6 0 0 1 10 2Z" fill="var(--accent-dim)" stroke="var(--accent)" strokeWidth="1.25" />
                        <path d="M8 17h4" stroke="var(--accent)" strokeWidth="1.25" strokeLinecap="round" />
                        <path d="M9 19h2" stroke="var(--accent)" strokeWidth="1.25" strokeLinecap="round" />
                      </svg>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', color: 'var(--accent)', fontFamily: 'var(--font-dm-sans)', fontWeight: 500, lineHeight: 1.4 }}>
                          AI suggestion: <strong>{aiPrediction.suggestedCapacity}</strong> attendees&nbsp;
                          <span style={{ fontWeight: 400, opacity: 0.7 }}>({aiPrediction.confidence} confidence)</span>
                        </p>
                        <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)', fontWeight: 300, lineHeight: 1.4 }}>
                          {aiPrediction.reasoning}
                        </p>
                        <button
                          type="button"
                          onClick={() => setCapacity(String(aiPrediction.suggestedCapacity))}
                          style={{
                            background: 'transparent',
                            border: '0.5px solid var(--border-emphasis)',
                            borderRadius: 6,
                            padding: '0.3rem 0.75rem',
                            fontSize: '0.72rem',
                            fontWeight: 500,
                            color: 'var(--accent)',
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
                        ...accentPanelStyle,
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
                          fill="var(--accent-dim)" stroke="var(--accent)" strokeWidth="1.25"
                        />
                        <path d="M8 17h4" stroke="var(--accent)" strokeWidth="1.25" strokeLinecap="round" />
                        <path d="M9 19h2" stroke="var(--accent)" strokeWidth="1.25" strokeLinecap="round" />
                      </svg>
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            margin: "0 0 0.5rem",
                            fontSize: "0.8rem",
                            color: "var(--accent)",
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
                            border: "0.5px solid var(--border-emphasis)",
                            borderRadius: 6,
                            padding: "0.3rem 0.75rem",
                            fontSize: "0.75rem",
                            fontWeight: 500,
                            color: "var(--accent)",
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
                )}
                {isRegistrationEvent && organizerPlan === "free" ? (
                <div className="md:col-span-2">
                  <EventPassSelector
                    eventTitle={title.trim() || "this event"}
                    compact
                  />
                </div>
                ) : null}
                {isRegistrationEvent && (
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                    Registration Deadline (optional)
                  </label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    style={inputStyle}
                    value={deadline}
                    onChange={e => setDeadline(e.target.value)}
                  />
                </div>
                )}
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                    {isWalkInEvent ? "Walk-In Start" : "Event Start"}
                  </label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    style={inputStyle}
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                    {isWalkInEvent ? "Walk-In End (optional)" : "Event End (optional)"}
                  </label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    style={inputStyle}
                    value={eventEndAt}
                    onChange={e => setEventEndAt(e.target.value)}
                  />
                  <p style={{ ...helperStyle, fontSize: "0.72rem", marginTop: "0.35rem" }}>
                    {isWalkInEvent
                      ? "Leave empty for a single-day walk-in event. Use an end date for multi-day events."
                      : "If the deadline is empty, registration will close automatically when the event ends."}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                    Link Opens At (optional)
                  </label>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    style={inputStyle}
                    value={joinOpensAt}
                    onChange={e => setJoinOpensAt(e.target.value)}
                  />
                  <p style={{ ...helperStyle, fontSize: "0.72rem", marginTop: "0.35rem" }}>
                    {isWalkInEvent
                      ? "You can create and share this link ahead of time. Before the event starts, attendees will simply see that check-in is not open yet."
                      : "Leave empty to auto-open 30 minutes before the event start."}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                    {eventType === "VIRTUAL" ? "Host / Base Location (optional)" : "Location / Venue"}
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
                {eventType === "PHYSICAL" && (
                  <div>
                    <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                      Google Maps directions link <span style={{ fontWeight: 400, color: "rgba(240,237,230,0.3)" }}>(optional)</span>
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
                    <p style={{ ...helperStyle, fontSize: "0.72rem", marginTop: "0.35rem" }}>
                      This is the only link attendees use for directions. EventSlot will not guess from the venue name.
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
                )}
                {isRegistrationEvent && (
                  <div>
                    <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                      Entry / contribution note <span style={{ fontWeight: 400, color: "rgba(240,237,230,0.3)" }}>(optional)</span>
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
                    <p style={{ ...helperStyle, fontSize: "0.72rem", marginTop: "0.35rem" }}>
                      This only displays the organizer's fee note. It does not collect payment.
                    </p>
                  </div>
                )}
                {isRegistrationEvent && (
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
                    <p style={{ ...helperStyle, fontSize: "0.72rem", marginTop: "0.35rem" }}>
                      Use this only when your department or event requires a specific consent statement.
                    </p>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                    Organizer Name <span style={accentTextStyle}>*</span>
                  </label>
                  <input
                    type="text"
                    className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    style={inputStyle}
                    required
                    value={organizerName}
                    onChange={e => setOrganizerName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                    Organizer Email <span style={{ fontWeight: 400, color: "rgba(240,237,230,0.3)" }}>(optional)</span>
                  </label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    style={inputStyle}
                    value={organizerEmail}
                    onChange={e => setOrganizerEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                    Community link (optional)
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
                  <p style={{ ...helperStyle, fontSize: "0.72rem", marginTop: "0.35rem" }}>
                    {isWalkInEvent
                      ? "After check-in, attendees can use this link to join your community."
                      : "After registering, confirmed attendees will see this link."}
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-[0.72rem] font-semibold" style={labelStyle}>
                    Contact action (optional)
                  </label>
                  <select
                    className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                    style={inputStyle}
                    value={contactMode}
                    onChange={e => setContactMode(e.target.value === "CALL" ? "CALL" : "WHATSAPP")}
                  >
                    <option value="WHATSAPP">Text on WhatsApp</option>
                    <option value="CALL">Call organiser</option>
                  </select>
                  <label className="mb-1 mt-3 block text-[0.72rem] font-semibold" style={labelStyle}>
                    Organizer number (optional)
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    className="mt-1 w-full rounded-[8px] px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(37,211,102,0.5)] focus:outline-none"
                    style={inputStyle}
                    placeholder="e.g. +254712345678"
                    value={whatsappNumber}
                    onChange={e => setWhatsappNumber(e.target.value)}
                  />
                  <p style={{ ...helperStyle, fontSize: "0.72rem", marginTop: "0.35rem" }}>
                    Attendees will see either a WhatsApp button or a Call organiser button on the event page.
                  </p>
                  {whatsappNumber.trim() && (
                    <p style={{ ...warningTextStyle, fontSize: "0.72rem", marginTop: "0.35rem" }}>
                      This number is public on your event page. Use the full country code, for example +254..., and use a dedicated events or business line where possible.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Event Poster */}
            <div className="rounded-[12px] border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <h2 className="mb-1 text-[1.1rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                Event Poster
              </h2>
              <p className="mb-4 text-[0.78rem]" style={{ color: "var(--text-secondary)" }}>
                {isWalkInEvent
                  ? "Required for walk-in events so the status poster always includes your image. JPEG, PNG, WebP or GIF, up to 15 MB."
                  : "Optional flyer or banner. JPEG, PNG, WebP or GIF, up to 15 MB."}
              </p>
              {imageUrl && (
                <div className="mb-4 overflow-hidden rounded-[8px] border" style={{ borderColor: "var(--border)", background: "var(--surface-muted)", lineHeight: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imageUrl} alt="Event poster preview" style={{ width: "100%", height: "auto", objectFit: "contain", objectPosition: "center top", display: "block", borderRadius: "8px" }} />
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
              {imageError && <p className="mt-2 text-[0.78rem]" style={errorTextStyle}>{imageError}</p>}
            </div>

            {isRegistrationEvent ? (
            <div className="rounded-[12px] border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <h2 className="mb-4 text-[1.1rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                Registration Questions
              </h2>

              {activeTpl && activeTpl.id !== "blank" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    background: "var(--accent-dim)",
                    border: "0.5px solid var(--border-emphasis)",
                    borderRadius: 8,
                    padding: "0.6rem 0.875rem",
                    marginBottom: "1.25rem",
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "0.8rem",
                    color: "var(--accent)",
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
                  <div key={q.id} className="rounded-[8px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}>
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-[0.72rem] font-semibold tracking-[0.04em]" style={{ color: "var(--text-muted)" }}>
                          Question Label
                        </label>
                        <input
                          type="text"
                          className="mt-1 w-full rounded-[8px] border px-3 py-2 text-[0.875rem] font-medium placeholder:text-[var(--text-muted)] focus:border-[rgba(200,245,90,0.5)] focus:outline-none"
                          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                          value={q.label}
                          onChange={e => handleQuestionChange(idx, "label", e.target.value)}
                          required
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
                        <label htmlFor={`required-${q.id}`} className="text-[0.9rem]" style={{ color: "var(--text-primary)" }}>
                          Required
                        </label>
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
            ) : (
            <div className="rounded-[12px] border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <h2 className="mb-2 text-[1.1rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                Walk-In Check-In Fields
              </h2>
              <p className="text-[0.82rem]" style={{ color: "var(--text-secondary)" }}>
                Walk-in events keep attendee check-in intentionally fast. The public page will only ask for name and phone number on the event day.
              </p>
            </div>
            )}

            <div className="space-y-4">
              <button
                type="submit"
                className="w-full rounded-full px-7 py-3 text-[0.875rem] font-semibold text-[#0A0A0A]"
                style={{ background: "var(--accent)" }}
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Event"}
              </button>
              {error && <div className="text-[0.82rem] text-center" style={errorTextStyle}>{error}</div>}
            </div>
          </form>
          </div>
        ) : selectedTemplateId && success ? (
          <div className="rounded-[12px] p-8 text-center space-y-4" style={cardStyle}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border" style={{ borderColor: "var(--border-emphasis)", background: "var(--accent-dim)" }}>
              <span className="block h-3 w-5 rotate-[-45deg] border-b-4 border-l-4" style={{ borderColor: "var(--accent)" }} />
            </div>
            <h2 className="text-[1.5rem]" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
              Your event is live!
            </h2>
            <p className="text-[0.875rem]" style={{ fontFamily: "var(--font-dm-sans)", color: "var(--text-secondary)" }}>
              {isWalkInEvent
                ? "Share your walk-in check-in link now or download a print-ready QR code."
                : "Share your registration link now or download a print-ready QR code."}
            </p>

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
              <div style={{ flex: "1 1 260px", maxWidth: 420, display: "flex", alignItems: "center", background: "var(--surface-2)", border: "1px solid var(--border-subtle)", borderRadius: 8, overflow: "hidden", minWidth: 0 }}>
                <input
                  readOnly
                  value={successRegistrationLink}
                  style={{ flex: 1, background: "transparent", border: "none", padding: "0.5rem 0.75rem", fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", outline: "none", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleCopySuccessLink()}
                style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: "0.45rem 0.875rem", fontSize: "0.78rem", fontWeight: 500, color: copiedSuccessLink ? "var(--accent)" : "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {copiedSuccessLink ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                onClick={() => void handleGenerateSuccessQR()}
                disabled={qrGenerating}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: "100px",
                  padding: "0.5rem 1rem",
                  color: "var(--text-secondary)",
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
                className="w-full rounded-full px-7 py-3 text-[0.875rem] font-semibold text-[#0A0A0A]"
                style={{ background: "var(--accent)" }}
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
