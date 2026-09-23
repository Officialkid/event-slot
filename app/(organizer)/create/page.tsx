"use client"

import React, { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { v4 as uuidv4 } from "uuid"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { CREATE_EVENT_COPY } from "@/lib/createEventContent"
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

type QuestionType = "text" | "textarea" | "number" | "email" | "phone" | "select" | "checkbox" | "file"

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
  { value: "text", label: "Short Text" },
  { value: "textarea", label: "Long Text / Paragraph" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone Number" },
  { value: "select", label: "Multiple Choice (Dropdown)" },
  { value: "checkbox", label: "Checkboxes" },
  { value: "file", label: "File upload" },
]

const EVENT_CATEGORIES = [
  "Technology & Coding",
  "Business & Networking",
  "Workshops & Masterclasses",
  "Conferences & Summits",
  "Faith & Religion",
  "Social & Entertainment",
  "Community & Charity",
  "Health & Sports",
  "Education & Careers",
  "Other",
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
  borderRadius: 16,
}

const cardMutedStyle: React.CSSProperties = {
  background: "var(--surface-muted)",
  border: "1px solid var(--border-subtle)",
  borderRadius: 14,
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

const accentTextStyle: React.CSSProperties = {
  color: "var(--accent)",
}

export default function CreateEventPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Wizard state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)
  const [stepError, setStepError] = useState<string>("")
  const [showAdvancedTickets, setShowAdvancedTickets] = useState(false)
  const [showDesignerGuidelines, setShowDesignerGuidelines] = useState(false)

  // Step 1: Identity & Basics
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PRIVATE")
  const [eventType, setEventType] = useState<"PHYSICAL" | "VIRTUAL">("PHYSICAL")
  const [virtualLink, setVirtualLink] = useState("")
  const [location, setLocation] = useState("")
  const [mapDirectionsUrl, setMapDirectionsUrl] = useState("")
  const [eventDate, setEventDate] = useState("")
  const [eventEndAt, setEventEndAt] = useState("")
  const [hasSpecificTime, setHasSpecificTime] = useState(true)
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<"WEEKLY" | "BIWEEKLY" | "MONTHLY">("WEEKLY")
  const [recurrenceDayOfWeek, setRecurrenceDayOfWeek] = useState<number>(5)
  const [registrationOpensDays, setRegistrationOpensDays] = useState<number>(4)
  const [registrationOpensTime, setRegistrationOpensTime] = useState<string>("08:00")
  const [joinOpensAt, setJoinOpensAt] = useState("")
  const [imageUrl, setImageUrl] = useState("")

  // Step 2: Tickets & Capacity
  const [accessType, setAccessType] = useState<"REGISTRATION" | "WALK_IN">("REGISTRATION")
  const [capacity, setCapacity] = useState("")
  const [showRemainingSpots, setShowRemainingSpots] = useState(true)
  const [isPaid, setIsPaid] = useState(false)
  const [ticketPrice, setTicketPrice] = useState("")
  const [ticketTiers, setTicketTiers] = useState<TicketTierDraft[]>([defaultTicketTier()])
  const [deadline, setDeadline] = useState("")
  const [entryFeeLabel, setEntryFeeLabel] = useState("")
  const [groupRegistrationEnabled, setGroupRegistrationEnabled] = useState(false)
  const [showPaidNotice, setShowPaidNotice] = useState(false)

  // Step 3: Registration Questions
  const [questions, setQuestions] = useState([defaultQuestion()])
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({})
  const [attendeeConsentEnabled, setAttendeeConsentEnabled] = useState(true)
  const [attendeeConsentText, setAttendeeConsentText] = useState("")

  // Step 4: Host Details
  const [organizerName, setOrganizerName] = useState("")
  const [organizerEmail, setOrganizerEmail] = useState("")
  const [communityLink, setCommunityLink] = useState("")
  const [whatsappNumber, setWhatsappNumber] = useState("")
  const [contactMode, setContactMode] = useState<EventContactMode>("WHATSAPP")

  // Submission & Feedback
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [eventInfo, setEventInfo] = useState<{ id: string; title: string; slug: string; dashboardToken: string; accessType: "REGISTRATION" | "WALK_IN" } | null>(null)
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [imageUploading, setImageUploading] = useState(false)
  const [imageError, setImageError] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  // Capacity predictions & QR
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
    confidence: "low" | "medium" | "high"
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

  useEffect(() => {
    markFeatureUsed("create_event")
  }, [])

  // Auto-fill organizer details from signed-in session
  useEffect(() => {
    if (session?.user?.name && !organizerName) {
      setOrganizerName(session.user.name)
    }
    if (session?.user?.email && !organizerEmail) {
      setOrganizerEmail(session.user.email)
    }
  }, [session, organizerName, organizerEmail])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/signin?callbackUrl=/create")
    }
  }, [status, router])

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    if (!isWalkInEvent) return
    setEventType("PHYSICAL")
    setVisibility("PRIVATE")
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

  async function fetchAiPrediction(eventTitle: string, eventDescription?: string) {
    if (!eventTitle.trim()) return
    setAiPredictionLoading(true)
    setAiPrediction(null)
    try {
      const res = await fetch("/api/events/predict-capacity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: eventTitle, description: eventDescription }),
      })
      if (!res.ok) return
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
    } catch { /* ignore */ }
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
      setStepError("")
    } catch {
      setImageError("Upload failed. Please try again.")
    } finally {
      setImageUploading(false)
    }
  }

  // Question management
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

  const buildOptionLimitsPayload = (question: Question) => {
    const entries = Object.entries(question.optionLimits ?? {})
      .map(([label, raw]) => [label, raw.trim()] as const)
      .filter(([, raw]) => raw.length > 0)
      .map(([label, raw]) => [label, Number(raw)] as const)
      .filter(([, value]) => Number.isFinite(value) && value > 0)

    return entries.length > 0 ? Object.fromEntries(entries) : undefined
  }

  const moveQuestionUp = (idx: number) => {
    if (idx <= 0) return
    setQuestions(qs => {
      const next = [...qs]
      const temp = next[idx]
      next[idx] = next[idx - 1]
      next[idx - 1] = temp
      return next
    })
  }

  const moveQuestionDown = (idx: number) => {
    if (idx >= questions.length - 1) return
    setQuestions(qs => {
      const next = [...qs]
      const temp = next[idx]
      next[idx] = next[idx + 1]
      next[idx + 1] = temp
      return next
    })
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

  // Ticket tier management
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

  // Step Validations
  const validateStep1 = (): boolean => {
    setStepError("")
    setError("")
    if (!title.trim()) {
      setStepError("Please provide an event title.")
      document.getElementById("create-field-title")?.focus()
      return false
    }
    if (!category.trim()) {
      setStepError("Please select an event category to help attendees discover your event.")
      return false
    }
    if (visibility === "PUBLIC" && !imageUrl.trim()) {
      setStepError("Public events require a poster image so they can appear on the Events discovery page.")
      fileInputRef.current?.focus()
      return false
    }
    if (visibility === "PUBLIC" && !eventDate) {
      setStepError("Public events require a start date so attendees know when it is happening.")
      return false
    }
    if (visibility === "PUBLIC" && eventType === "PHYSICAL" && !location.trim()) {
      setStepError("Public physical events require a venue location.")
      return false
    }
    if (eventType === "VIRTUAL") {
      if (!virtualLink.trim()) {
        setStepError("A Google Meet link is required for virtual events.")
        return false
      }
      if (!virtualLink.toLowerCase().includes("meet.google.com/")) {
        setStepError("Please provide a valid Google Meet link (e.g. meet.google.com/abc-defg-hij).")
        return false
      }
    }
    return true
  }

  const validateStep2 = (): boolean => {
    setStepError("")
    setError("")
    return true
  }

  const validateStep3 = (): boolean => {
    setStepError("")
    setError("")
    if (isRegistrationEvent) {
      const invalidQuestion = questions.find(q => typeUsesOptions(q.type) && q.options.length === 0)
      if (invalidQuestion) {
        setStepError(`Please add at least one option for "${invalidQuestion.label || 'Untitled question'}".`)
        return false
      }
    }
    return true
  }

  const handleNextStep = (targetStep: 1 | 2 | 3 | 4) => {
    if (targetStep > currentStep) {
      if (currentStep === 1 && !validateStep1()) return
      if (currentStep === 2 && !validateStep2()) return
      if (currentStep === 3 && !validateStep3()) return
    }
    setStepError("")
    setError("")
    setCurrentStep(targetStep)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Format ISO date helper for submittal
  const serializeDate = (d: string, hasTime: boolean) => {
    if (!d) return undefined
    if (hasTime) {
      return new Date(d).toISOString()
    }
    // Date only: YYYY-MM-DD -> add midday UTC
    return new Date(`${d}T12:00:00.000Z`).toISOString()
  }

  // Master Form Submission
  const handleSubmit = async (e?: React.FormEvent<HTMLFormElement>) => {
    e?.preventDefault()
    setError("")
    setStepError("")

    if (!validateStep1()) {
      setCurrentStep(1)
      return
    }
    if (!validateStep2()) {
      setCurrentStep(2)
      return
    }
    if (!validateStep3()) {
      setCurrentStep(3)
      return
    }

    setFieldErrors({})
    setLoading(true)
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          category: category || undefined,
          description: description || undefined,
          visibility,
          accessType,
          eventType,
          virtualLink: eventType === "VIRTUAL" ? virtualLink || undefined : undefined,
          capacity: isRegistrationEvent && capacity ? Number(capacity) : undefined,
          deadline: isRegistrationEvent && deadline ? new Date(deadline).toISOString() : undefined,
          eventDate: serializeDate(eventDate, hasSpecificTime),
          eventEndAt: serializeDate(eventEndAt, hasSpecificTime),
          hasSpecificTime,
          isRecurring,
          recurrenceFrequency: isRecurring ? recurrenceFrequency : undefined,
          recurrenceDayOfWeek: isRecurring ? recurrenceDayOfWeek : undefined,
          registrationOpensDays: isRecurring ? registrationOpensDays : undefined,
          registrationOpensTime: isRecurring ? registrationOpensTime : undefined,
          joinOpensAt: joinOpensAt ? new Date(joinOpensAt).toISOString() : undefined,
          location: location || undefined,
          mapDirectionsUrl: mapDirectionsUrl || undefined,
          entryFeeLabel: entryFeeLabel || undefined,
          showRemainingSpots,
          groupRegistrationEnabled,
          attendeeConsentEnabled,
          attendeeConsentText: attendeeConsentText.trim() || undefined,
          isPaid: false,
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
          organizerName: organizerName.trim() || session?.user?.name || "Organizer",
          organizerEmail: organizerEmail || session?.user?.email || undefined,
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

  if (status === "loading" || status === "unauthenticated") {
    return null
  }

  const STEPS: { num: 1 | 2 | 3 | 4; label: string; icon: string }[] = [
    { num: 1, label: "Identity", icon: "✨" },
    { num: 2, label: "Tickets & Access", icon: "🎟️" },
    { num: 3, label: "Questions", icon: "📝" },
    { num: 4, label: "Review & Launch", icon: "🚀" },
  ]

  return (
    <div className="px-4 py-8 sm:py-12 min-h-screen" style={{ background: "var(--page-bg, #0A0A0A)" }}>
      <div className="mx-auto max-w-[660px] space-y-6" ref={formRef}>
        {/* QR Code Modal for Success */}
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
                background: "var(--surface)",
                border: "0.5px solid var(--border)",
                borderRadius: "16px",
                padding: "2rem",
                maxWidth: "360px",
                width: "100%",
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
                <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "var(--text-primary)", margin: 0 }}>
                  Event QR Code
                </h3>
                <button
                  onClick={() => setShowQrModal(false)}
                  style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.2rem", cursor: "pointer" }}
                >
                  ×
                </button>
              </div>

              <div style={{ background: "var(--surface-muted)", borderRadius: "12px", padding: "1rem", marginBottom: "1rem", display: "inline-block" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Event QR Code" style={{ width: "220px", height: "220px", display: "block" }} />
              </div>

              <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginBottom: "1.25rem", fontFamily: "var(--font-dm-sans)" }}>
                {isWalkInEvent ? "Scan to check in for " : "Scan to register for "}<strong style={{ color: "var(--text-primary)" }}>{eventInfo.title}</strong>
              </p>

              <button
                onClick={handleDownloadSuccessQR}
                style={{
                  background: "#15803d",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "100px",
                  padding: "0.7rem 1.8rem",
                  fontSize: "0.875rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  width: "100%",
                  fontFamily: "var(--font-dm-sans)",
                }}
              >
                ↓ Download High-Res PNG
              </button>
            </div>
          </div>
        )}

        {/* ── Success Celebration Screen ── */}
        {success && eventInfo ? (
          <div className="rounded-[16px] p-8 text-center space-y-5" style={cardStyle}>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border" style={{ borderColor: "rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.12)" }}>
              <span className="block h-3.5 w-6 rotate-[-45deg] border-b-4 border-l-4" style={{ borderColor: "#22c55e" }} />
            </div>
            <div>
              <h2 className="text-[1.8rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                Your event is live!
              </h2>
              <p className="text-[0.875rem] mt-1" style={{ color: "var(--text-secondary)" }}>
                {isWalkInEvent
                  ? "Share your walk-in check-in link now or download a print-ready door QR code."
                  : "Share your registration link now or download your attendee QR code."}
              </p>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
              <div style={{ flex: "1 1 260px", maxWidth: 420, display: "flex", alignItems: "center", background: "var(--surface-2)", border: "1px solid var(--border-subtle)", borderRadius: 10, overflow: "hidden", minWidth: 0 }}>
                <input
                  readOnly
                  value={successRegistrationLink}
                  style={{ flex: 1, background: "transparent", border: "none", padding: "0.6rem 0.85rem", fontSize: "0.82rem", color: "var(--text-secondary)", outline: "none", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleCopySuccessLink()}
                style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 10, padding: "0.55rem 1rem", fontSize: "0.82rem", fontWeight: 600, color: copiedSuccessLink ? "#15803d" : "var(--text-secondary)", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
              >
                {copiedSuccessLink ? "✓ Copied!" : "Copy Link"}
              </button>
              <button
                type="button"
                onClick={() => void handleGenerateSuccessQR()}
                disabled={qrGenerating}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  padding: "0.55rem 1rem",
                  color: "var(--text-secondary)",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: qrGenerating ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  whiteSpace: "nowrap",
                }}
              >
                ▦ {qrGenerating ? "Generating..." : "Get QR Code"}
              </button>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => router.push(`/dashboard/events/${eventInfo.slug}`)}
                className="w-full rounded-full py-3 text-[0.875rem] font-bold text-white transition hover:opacity-90"
                style={{ background: "#15803d" }}
              >
                Go to Event Dashboard
              </button>
              <a
                href={successRegistrationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-full py-3 text-[0.875rem] font-semibold text-center border transition hover:bg-white/5 no-underline"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                View Live Page ↗
              </a>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div>
              <h1 className="text-[1.85rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                Create an Event
              </h1>
              <p className="mt-1 text-[0.88rem]" style={{ color: "var(--text-secondary)" }}>
                Set up registration or walk-in check-in in under 60 seconds.
              </p>
            </div>

            {/* ── Progressive Step Indicator ── */}
            <div className="rounded-[16px] border p-3 sm:p-4" style={cardStyle}>
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {STEPS.map((s) => {
                  const isActive = currentStep === s.num
                  const isCompleted = currentStep > s.num
                  return (
                    <button
                      key={s.num}
                      type="button"
                      onClick={() => {
                        if (s.num < currentStep) {
                          handleNextStep(s.num)
                        }
                      }}
                      className={`flex flex-col items-center justify-center rounded-xl py-2 px-1 text-center transition ${s.num < currentStep ? "cursor-pointer hover:opacity-85" : "cursor-default"}`}
                      style={{
                        background: isActive
                          ? "#15803d"
                          : isCompleted
                          ? "color-mix(in srgb, var(--text-primary) 6%, transparent)"
                          : "transparent",
                        border: isActive ? "1px solid #15803d" : "1px solid transparent",
                      }}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs" style={{ color: isActive ? "#FFFFFF" : undefined }}>
                          {isCompleted ? "✓" : s.icon}
                        </span>
                        <span
                          className="text-[0.68rem] sm:text-[0.75rem] font-bold uppercase tracking-wider"
                          style={{
                            color: isActive ? "#FFFFFF" : isCompleted ? "var(--text-primary)" : "var(--text-muted)",
                          }}
                        >
                          Step {s.num}
                        </span>
                      </div>
                      <span
                        className="text-[0.72rem] sm:text-[0.8rem] font-medium truncate max-w-full mt-0.5"
                        style={{
                          color: isActive ? "#FFFFFF" : isCompleted ? "var(--text-secondary)" : "var(--text-muted)",
                        }}
                      >
                        {s.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Error Banners */}
            {stepError && (
              <div className="rounded-xl border p-4 text-xs font-semibold flex items-center gap-2" style={{ borderColor: "rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>
                <span>⚠️</span>
                <span>{stepError}</span>
              </div>
            )}
            {error && (
              <div className="rounded-xl border p-4 text-xs font-semibold flex items-center gap-2" style={{ borderColor: "rgba(239,68,68,0.4)", background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {/* ── ASA Event Creation Assistant Banner ── */}
            <div
              className="rounded-2xl p-4 flex items-center justify-between gap-4"
              style={{
                background: "color-mix(in srgb, var(--accent) 8%, var(--surface))",
                border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
                  style={{
                    background: "color-mix(in srgb, var(--accent) 15%, var(--surface))",
                    border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                    fontSize: "1.2rem",
                  }}
                >
                  ✨
                </div>
                <div>
                  <p className="m-0 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    Want to create your event faster?
                  </p>
                  <p className="m-0 text-xs" style={{ color: "var(--text-secondary)" }}>
                    Describe your event naturally to ASA and have it configured conversationally.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/assistant"
                className="inline-flex items-center gap-1 text-xs font-semibold px-3.5 py-2 rounded-xl flex-shrink-0"
                style={{
                  background: "var(--accent)",
                  color: "var(--accent-contrast, #FFFFFF)",
                  textDecoration: "none",
                }}
              >
                <span>Create with ASA</span>
                <span>→</span>
              </Link>
            </div>

            {/* ── STEP 1: EVENT IDENTITY ── */}
            {currentStep === 1 && (
              <div className="space-y-5">
                {/* Quick Presets Bar */}
                <div className="rounded-[14px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-[0.72rem] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                      ⚡ Quick-Start Templates (Optional)
                    </span>
                    {selectedTemplateId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedTemplateId(null)
                          setQuestions([defaultQuestion()])
                        }}
                        className="text-[0.7rem] underline"
                        style={{ color: "var(--text-muted)" }}
                      >
                        Clear preset
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {EVENT_TEMPLATES.map(tpl => {
                      const isSelected = selectedTemplateId === tpl.id
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          onClick={() => handlePickTemplate(tpl.id)}
                          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-medium transition whitespace-nowrap"
                          style={{
                            background: isSelected ? "#15803d" : "var(--surface-muted)",
                            color: isSelected ? "#FFFFFF" : "var(--text-secondary)",
                            border: isSelected ? "1px solid #15803d" : "1px solid var(--border-subtle)",
                            fontWeight: isSelected ? 700 : 500,
                            cursor: "pointer",
                          }}
                        >
                          <span>{tpl.icon}</span>
                          <span>{tpl.name}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Event Poster Upload */}
                <div className="rounded-[14px] border p-5 sm:p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h2 className="text-[1.15rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                      Event Poster
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowDesignerGuidelines(!showDesignerGuidelines)}
                      className="text-[0.72rem] font-semibold underline"
                      style={{ color: "#15803d" }}
                    >
                      {showDesignerGuidelines ? "Hide dimensions" : "📐 Designer Guidelines"}
                    </button>
                  </div>

                  <p className="mb-3 text-[0.78rem]" style={{ color: "var(--text-secondary)" }}>
                    {visibility === "PUBLIC"
                      ? "Required for public events on Discover. Upload a vertical flyer (A4) or horizontal banner."
                      : "Optional for private events. Upload your flyer or promotional banner (JPEG, PNG, WebP up to 15 MB)."}
                  </p>

                  {showDesignerGuidelines && (
                    <div className="mb-4 rounded-[10px] p-3 text-[0.76rem] space-y-1.5" style={{ background: "var(--surface-muted)", border: "1px solid var(--border)" }}>
                      <p className="font-semibold" style={{ color: "var(--text-primary)" }}>Recommended Dimensions:</p>
                      <p style={{ color: "var(--text-secondary)" }}>• <strong>Vertical Flyer / A4:</strong> 1240 × 1754 px (or 1080 × 1350 px portrait)</p>
                      <p style={{ color: "var(--text-secondary)" }}>• <strong>Landscape Banner:</strong> 1920 × 1080 px (or 1200 × 675 px 16:9)</p>
                      <p style={{ color: "var(--text-muted)" }}>Both portrait and landscape formats are automatically framed with high-fidelity ambient backdrops on EventSlot.</p>
                    </div>
                  )}

                  {imageUrl ? (
                    <div className="relative overflow-hidden rounded-[12px] border" style={{ borderColor: "var(--border)", background: "#0A0A0A" }}>
                      {/* Ambient blur backdrop */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(20px)", opacity: 0.45 }} />
                      {/* Uncropped sharp poster */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imageUrl} alt="Poster preview" style={{ position: "relative", width: "100%", maxHeight: "320px", objectFit: "contain", display: "block", margin: "0 auto" }} />
                      <button
                        type="button"
                        onClick={() => setImageUrl("")}
                        className="absolute top-2.5 right-2.5 rounded-full px-3 py-1 text-xs font-semibold shadow-md"
                        style={{ background: "#EF4444", color: "#FFFFFF", border: "none", cursor: "pointer", zIndex: 10 }}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="rounded-[12px] border-2 border-dashed p-6 text-center cursor-pointer transition hover:border-[#15803d]"
                      style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="hidden"
                        onChange={handleImageChange}
                        disabled={imageUploading}
                      />
                      <span className="text-2xl block mb-1">🖼️</span>
                      <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                        {imageUploading ? "Uploading flyer..." : "Click or drag to upload event poster"}
                      </p>
                      <p className="text-[0.72rem] mt-1" style={{ color: "var(--text-muted)" }}>
                        JPEG, PNG, WebP or GIF up to 15 MB
                      </p>
                    </div>
                  )}
                  {imageError && <p className="text-xs text-red-500 mt-2">{imageError}</p>}
                </div>

                {/* Title & Category Card */}
                <div className="rounded-[14px] border p-5 sm:p-6 space-y-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <div>
                    <label className="block text-[0.75rem] font-semibold mb-1" style={labelStyle}>
                      Event Title <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <input
                      id="create-field-title"
                      type="text"
                      required
                      placeholder="e.g. Kenya Tech Summit 2026"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={(e) => fetchAiPrediction(e.target.value, description)}
                      className="w-full rounded-[10px] px-3.5 py-2.5 text-[0.95rem] font-medium outline-none focus:border-[#15803d]"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label className="block text-[0.75rem] font-semibold mb-1" style={labelStyle}>
                      Event Category <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-[10px] px-3.5 py-2.5 text-[0.88rem] outline-none"
                      style={inputStyle}
                    >
                      <option value="">Select event category...</option>
                      {EVENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <p className="text-[0.7rem] mt-1" style={{ color: "var(--text-muted)" }}>
                      Required for proper indexing on EventSlot Discover.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[0.75rem] font-semibold mb-1" style={labelStyle}>
                      Event Visibility <span style={{ color: "#EF4444" }}>*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setVisibility("PRIVATE")}
                        className="rounded-xl border p-3.5 text-left transition relative"
                        style={{
                          borderColor: visibility === "PRIVATE" ? "#15803d" : "var(--border)",
                          background: visibility === "PRIVATE" ? "color-mix(in srgb, #15803d 12%, var(--surface))" : "var(--surface-2)",
                          boxShadow: visibility === "PRIVATE" ? "0 0 0 1.5px #15803d" : "none",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                            <span>🔒</span>
                            <span>Private Event</span>
                          </span>
                          {visibility === "PRIVATE" && (
                            <span className="text-[0.68rem] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: "#15803d", color: "#FFFFFF" }}>
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-[0.72rem] mt-1.5" style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}>
                          Unlisted. Only people with your invite link can see and register.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setVisibility("PUBLIC")}
                        disabled={isWalkInEvent}
                        className="rounded-xl border p-3.5 text-left transition relative disabled:opacity-40"
                        style={{
                          borderColor: visibility === "PUBLIC" ? "#15803d" : "var(--border)",
                          background: visibility === "PUBLIC" ? "color-mix(in srgb, #15803d 12%, var(--surface))" : "var(--surface-2)",
                          boxShadow: visibility === "PUBLIC" ? "0 0 0 1.5px #15803d" : "none",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold flex items-center gap-1.5" style={{ color: "var(--text-primary)" }}>
                            <span>🌐</span>
                            <span>Public Event</span>
                          </span>
                          {visibility === "PUBLIC" && (
                            <span className="text-[0.68rem] font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: "#15803d", color: "#FFFFFF" }}>
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-[0.72rem] mt-1.5" style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}>
                          Featured on Discover Events. Anyone can find and attend (requires poster).
                        </p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[0.75rem] font-semibold mb-1" style={labelStyle}>
                      Description
                    </label>
                    <textarea
                      rows={4}
                      maxLength={5000}
                      placeholder="Tell guests what to expect, who should attend, and any agenda items..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full rounded-[10px] px-3.5 py-2.5 text-[0.85rem] outline-none"
                      style={{ ...inputStyle, lineHeight: 1.5 }}
                    />
                    <p className="text-[0.7rem] text-right mt-1" style={{ color: "var(--text-muted)" }}>
                      {description.length} / 5000
                    </p>
                  </div>
                </div>

                {/* Date & Time Card */}
                <div className="rounded-[14px] border p-5 sm:p-6 space-y-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[1.1rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                      Date & Time
                    </h3>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="hasSpecificTimeCheck"
                        checked={hasSpecificTime}
                        onChange={(e) => setHasSpecificTime(e.target.checked)}
                        className="h-4 w-4 rounded"
                      />
                      <label htmlFor="hasSpecificTimeCheck" className="text-xs font-semibold cursor-pointer select-none" style={{ color: "var(--text-secondary)" }}>
                        Specific start time
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[0.75rem] font-semibold mb-1" style={labelStyle}>
                        {hasSpecificTime ? "Starts At (Date & Time)" : "Event Date (Time Not Specified)"}
                      </label>
                      <input
                        type={hasSpecificTime ? "datetime-local" : "date"}
                        value={hasSpecificTime ? eventDate : (eventDate ? eventDate.slice(0, 10) : "")}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="w-full rounded-[10px] px-3 py-2 text-[0.85rem] outline-none"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className="block text-[0.75rem] font-semibold mb-1" style={labelStyle}>
                        {hasSpecificTime ? "Ends At (Optional)" : "End Date (Optional)"}
                      </label>
                      <input
                        type={hasSpecificTime ? "datetime-local" : "date"}
                        value={hasSpecificTime ? eventEndAt : (eventEndAt ? eventEndAt.slice(0, 10) : "")}
                        onChange={(e) => setEventEndAt(e.target.value)}
                        className="w-full rounded-[10px] px-3 py-2 text-[0.85rem] outline-none"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t pt-3" style={{ borderColor: "var(--border-subtle)" }}>
                    <div>
                      <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Recurring Event</span>
                      <p className="text-[0.72rem]" style={{ color: "var(--text-muted)" }}>Happens on a repeating schedule (weekly/monthly)</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="h-4 w-4 rounded"
                    />
                  </div>

                  {isRecurring && (
                    <div className="rounded-xl border p-4 space-y-3" style={cardMutedStyle}>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[0.72rem] font-semibold mb-1" style={labelStyle}>Frequency</label>
                          <select
                            value={recurrenceFrequency}
                            onChange={(e) => setRecurrenceFrequency(e.target.value as "WEEKLY" | "BIWEEKLY" | "MONTHLY")}
                            className="w-full rounded-[8px] px-2.5 py-1.5 text-xs outline-none"
                            style={inputStyle}
                          >
                            <option value="WEEKLY">Weekly</option>
                            <option value="BIWEEKLY">Every 2 Weeks</option>
                            <option value="MONTHLY">Monthly</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[0.72rem] font-semibold mb-1" style={labelStyle}>Day of Week</label>
                          <select
                            value={recurrenceDayOfWeek}
                            onChange={(e) => setRecurrenceDayOfWeek(Number(e.target.value))}
                            className="w-full rounded-[8px] px-2.5 py-1.5 text-xs outline-none"
                            style={inputStyle}
                          >
                            <option value={1}>Monday</option>
                            <option value={2}>Tuesday</option>
                            <option value={3}>Wednesday</option>
                            <option value={4}>Thursday</option>
                            <option value={5}>Friday</option>
                            <option value={6}>Saturday</option>
                            <option value={0}>Sunday</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Location Card */}
                <div className="rounded-[14px] border p-5 sm:p-6 space-y-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[1.1rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                      Location
                    </h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEventType("PHYSICAL")}
                        className="rounded-full px-3.5 py-1 text-xs font-bold transition"
                        style={
                          eventType === "PHYSICAL"
                            ? { background: "#15803d", color: "#FFFFFF" }
                            : { background: "var(--surface-2)", color: "var(--text-secondary)" }
                        }
                      >
                        📍 In-Person
                      </button>
                      <button
                        type="button"
                        onClick={() => setEventType("VIRTUAL")}
                        disabled={isWalkInEvent}
                        className="rounded-full px-3.5 py-1 text-xs font-bold transition"
                        style={
                          eventType === "VIRTUAL"
                            ? { background: "#15803d", color: "#FFFFFF" }
                            : { background: "var(--surface-2)", color: "var(--text-secondary)" }
                        }
                      >
                        💻 Google Meet
                      </button>
                    </div>
                  </div>

                  {eventType === "PHYSICAL" ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[0.75rem] font-semibold mb-1" style={labelStyle}>
                          Venue Address or Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Nairobi National Museum Hall, Museum Hill"
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          className="w-full rounded-[10px] px-3.5 py-2 text-[0.85rem] outline-none"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[0.75rem] font-semibold" style={labelStyle}>
                            Google Maps Link (Optional)
                          </label>
                          <button
                            type="button"
                            disabled={!location.trim()}
                            onClick={() => {
                              if (location.trim()) {
                                setMapDirectionsUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`)
                              }
                            }}
                            className="text-[0.7rem] font-bold text-[#15803d] hover:underline disabled:opacity-40"
                          >
                            ⚡ Auto-fill from venue name
                          </button>
                        </div>
                        <input
                          type="url"
                          placeholder="https://maps.app.goo.gl/... or click auto-fill"
                          value={mapDirectionsUrl}
                          onChange={(e) => setMapDirectionsUrl(e.target.value)}
                          className="w-full rounded-[10px] px-3.5 py-2 text-[0.85rem] outline-none"
                          style={inputStyle}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[0.75rem] font-semibold mb-1" style={labelStyle}>
                          Google Meet Meeting Link <span style={{ color: "#EF4444" }}>*</span>
                        </label>
                        <input
                          type="url"
                          required
                          placeholder="https://meet.google.com/abc-defg-hij"
                          value={virtualLink}
                          onChange={(e) => setVirtualLink(e.target.value)}
                          className="w-full rounded-[10px] px-3.5 py-2 text-[0.85rem] outline-none"
                          style={inputStyle}
                        />
                        <p className="text-[0.7rem] mt-1" style={{ color: "var(--text-muted)" }}>
                          🔒 Secured: Meeting links are only revealed to verified ticket holders.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Next Step CTA */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => handleNextStep(2)}
                    className="w-full sm:w-auto rounded-full px-8 py-3 text-[0.88rem] font-bold text-white shadow-md transition hover:opacity-90"
                    style={{ background: "#15803d" }}
                  >
                    Continue to Tickets & Access →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 2: TICKETS & ACCESS ── */}
            {currentStep === 2 && (
              <div className="space-y-5">
                {/* Access Type (RSVP vs Walk-in) */}
                <div className="rounded-[14px] border p-5 sm:p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <h3 className="text-[1.1rem] font-semibold mb-3" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                    Event Access Type
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setAccessType("REGISTRATION")}
                      className="rounded-[12px] border p-4 text-left transition"
                      style={
                        accessType === "REGISTRATION"
                          ? { borderColor: "#15803d", background: "color-mix(in srgb, #15803d 10%, var(--surface))" }
                          : { borderColor: "var(--border)", background: "var(--surface-2)" }
                      }
                    >
                      <div className="flex items-center gap-2 font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                        <span>{accessType === "REGISTRATION" ? "◉" : "○"}</span>
                        <span>Registration & Tickets</span>
                      </div>
                      <p className="text-xs mt-2" style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}>
                        Attendees register in advance and receive a digital ticket pass with QR code.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAccessType("WALK_IN")}
                      className="rounded-[12px] border p-4 text-left transition"
                      style={
                        accessType === "WALK_IN"
                          ? { borderColor: "#15803d", background: "color-mix(in srgb, #15803d 10%, var(--surface))" }
                          : { borderColor: "var(--border)", background: "var(--surface-2)" }
                      }
                    >
                      <div className="flex items-center gap-2 font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                        <span>{accessType === "WALK_IN" ? "◉" : "○"}</span>
                        <span>Walk-In Check-In</span>
                      </div>
                      <p className="text-xs mt-2" style={{ color: "var(--text-secondary)", lineHeight: 1.4 }}>
                        Free and open admission. Attendees scan a door QR code to check in instantly.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Capacity & Pricing Card */}
                <div className="rounded-[14px] border p-5 sm:p-6 space-y-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[1.1rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                      Pricing & Spots
                    </h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsPaid(false)
                          setShowPaidNotice(false)
                        }}
                        className="rounded-full px-3.5 py-1 text-xs font-bold transition"
                        style={
                          !showPaidNotice
                            ? { background: "#15803d", color: "#FFFFFF" }
                            : { background: "var(--surface-2)", color: "var(--text-secondary)" }
                        }
                      >
                        Free Admission
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPaidNotice(true)
                          setIsPaid(false)
                        }}
                        className="rounded-full px-3.5 py-1 text-xs font-bold transition"
                        style={
                          showPaidNotice
                            ? { background: "#15803d", color: "#FFFFFF" }
                            : { background: "var(--surface-2)", color: "var(--text-secondary)" }
                        }
                      >
                        Paid Tickets (KES)
                      </button>
                    </div>
                  </div>

                  {showPaidNotice && (
                    <PaymentMaintenanceBanner
                      title="Paid Ticketing is Coming Soon"
                      message="We are currently finalizing paid-event ticketing with M-Pesa. All events on EventSlot are currently 100% free to organize and attend."
                    />
                  )}

                  {/* Capacity */}
                  {isRegistrationEvent && (
                    <div className="space-y-4 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
                        <div>
                          <label className="block text-[0.75rem] font-semibold mb-1" style={labelStyle}>
                            Total Available Capacity
                          </label>
                          <input
                            type="number"
                            min="1"
                            placeholder="e.g. 150 (Leave blank for unlimited)"
                            value={capacity}
                            onChange={(e) => setCapacity(e.target.value)}
                            className="w-full rounded-[10px] px-3.5 py-2 text-[0.85rem] outline-none"
                            style={inputStyle}
                          />
                        </div>

                        <div className="flex items-center justify-between pb-2 sm:pb-3">
                          <label className="text-xs font-medium cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                            Show spots remaining
                          </label>
                          <input
                            type="checkbox"
                            checked={showRemainingSpots}
                            onChange={(e) => setShowRemainingSpots(e.target.checked)}
                            className="h-4 w-4 rounded"
                          />
                        </div>
                      </div>

                      {/* Group and Organizational Bookings — Unhidden and prominent */}
                      <div className="rounded-xl border p-4 flex items-center justify-between" style={cardMutedStyle}>
                        <div>
                          <span className="text-xs font-bold block" style={{ color: "var(--text-primary)" }}>
                            👥 Group & Organization Bookings
                          </span>
                          <p className="text-[0.72rem] mt-0.5" style={{ color: "var(--text-secondary)" }}>
                            Allow one person to register multiple attendees / colleagues in a single booking.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={groupRegistrationEnabled}
                          onChange={(e) => setGroupRegistrationEnabled(e.target.checked)}
                          className="h-4 w-4 rounded"
                        />
                      </div>

                      {aiPrediction && (
                        <div className="rounded-xl border p-3 text-xs" style={cardMutedStyle}>
                          <span style={accentTextStyle}>✦ AI Suggested Capacity:</span> <strong>{aiPrediction.suggestedCapacity} attendees</strong> ({aiPrediction.reasoning})
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Collapsible Advanced Settings (Only Registration Deadline) */}
                <div className="rounded-[14px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedTickets(!showAdvancedTickets)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-left"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <span>⚙️ Advanced Settings (Registration Deadline)</span>
                    <span>{showAdvancedTickets ? "▲" : "▼"}</span>
                  </button>

                  {showAdvancedTickets && (
                    <div className="pt-4 mt-3 border-t space-y-3" style={{ borderColor: "var(--border-subtle)" }}>
                      <div>
                        <label className="block text-[0.72rem] font-semibold mb-1" style={labelStyle}>
                          Registration Deadline (Optional)
                        </label>
                        <input
                          type="datetime-local"
                          value={deadline}
                          onChange={(e) => setDeadline(e.target.value)}
                          className="w-full rounded-[8px] px-3 py-2 text-xs outline-none"
                          style={inputStyle}
                        />
                        <p className="text-[0.7rem] mt-1" style={{ color: "var(--text-muted)" }}>
                          Registration automatically closes once this deadline passes.
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="rounded-full px-6 py-2.5 text-xs font-semibold border"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    ← Back to Identity
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNextStep(3)}
                    className="rounded-full px-8 py-3 text-[0.88rem] font-bold text-white shadow-md transition hover:opacity-90"
                    style={{ background: "#15803d" }}
                  >
                    Continue to Questions →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: ATTENDEE QUESTIONS ── */}
            {currentStep === 3 && (
              <div className="space-y-5">
                {isWalkInEvent ? (
                  <div className="rounded-[14px] border p-6 text-center space-y-3" style={cardStyle}>
                    <span className="text-3xl block">🚶</span>
                    <h3 className="text-lg font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-instrument-serif)" }}>
                      Walk-In Events Don&apos;t Require Custom Questions
                    </h3>
                    <p className="text-xs max-w-md mx-auto" style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                      Walk-in attendees check in instantly at your door by scanning a QR code. No registration forms are required!
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-[14px] border p-4 flex items-center gap-3" style={{ borderColor: "rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.08)" }}>
                      <span className="text-lg">✓</span>
                      <p className="text-xs" style={{ color: "var(--text-primary)" }}>
                        <strong>Full Name</strong> and <strong>Email Address</strong> are already included by default for all registrations.
                      </p>
                    </div>

                    {/* Questions Builder */}
                    <div className="rounded-[14px] border p-5 sm:p-6 space-y-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <div className="flex items-center justify-between">
                        <h3 className="text-[1.1rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                          Custom Event Questions
                        </h3>
                        <button
                          type="button"
                          onClick={addQuestion}
                          className="rounded-full px-4 py-1.5 text-xs font-bold shadow-sm"
                          style={{ background: "#15803d", color: "#FFFFFF", border: "none", cursor: "pointer" }}
                        >
                          + Add Question
                        </button>
                      </div>

                      <div className="space-y-4">
                        {questions.map((q, idx) => (
                          <div key={q.id} className="rounded-xl border p-4 space-y-3" style={cardMutedStyle}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#15803d" }}>
                                Question {idx + 1}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => moveQuestionUp(idx)}
                                  className="text-xs px-1.5 py-0.5 rounded border disabled:opacity-30"
                                  style={{ borderColor: "var(--border)" }}
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === questions.length - 1}
                                  onClick={() => moveQuestionDown(idx)}
                                  className="text-xs px-1.5 py-0.5 rounded border disabled:opacity-30"
                                  style={{ borderColor: "var(--border)" }}
                                >
                                  ▼
                                </button>
                                {questions.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => removeQuestion(idx)}
                                    className="text-xs text-red-400 hover:text-red-300 ml-1"
                                  >
                                    ✕ Remove
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="sm:col-span-2">
                                <label className="block text-[0.7rem] font-medium mb-1" style={labelStyle}>Question Prompt</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Dietary preferences, T-shirt size, Job title..."
                                  value={q.label}
                                  onChange={(e) => handleQuestionChange(idx, "label", e.target.value)}
                                  className="w-full rounded-[8px] px-3 py-1.5 text-xs outline-none"
                                  style={inputStyle}
                                />
                              </div>

                              <div>
                                <label className="block text-[0.7rem] font-medium mb-1" style={labelStyle}>Field Type</label>
                                <select
                                  value={q.type}
                                  onChange={(e) => handleQuestionChange(idx, "type", e.target.value as QuestionType)}
                                  className="w-full rounded-[8px] px-2.5 py-1.5 text-xs outline-none"
                                  style={inputStyle}
                                >
                                  {QUESTION_TYPES.map(t => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Options for Select/Checkbox */}
                            {typeUsesOptions(q.type) && (
                              <div className="border-t pt-3 space-y-2" style={{ borderColor: "var(--border-subtle)" }}>
                                <label className="block text-[0.7rem] font-semibold" style={labelStyle}>Options</label>
                                <div className="flex flex-wrap gap-1.5">
                                  {q.options.map((opt, optIdx) => (
                                    <span key={optIdx} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs border" style={{ background: "var(--surface)", borderColor: "var(--border)" }}>
                                      <span>{opt}</span>
                                      <button type="button" onClick={() => removeOption(idx, optIdx)} className="text-red-400 text-xs">×</button>
                                    </span>
                                  ))}
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Add option..."
                                    value={optionDrafts[q.id] || ""}
                                    onChange={(e) => setOptionDrafts(prev => ({ ...prev, [q.id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault()
                                        addOption(idx)
                                      }
                                    }}
                                    className="rounded-[8px] px-2.5 py-1 text-xs outline-none flex-1"
                                    style={inputStyle}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => addOption(idx)}
                                    className="rounded-[8px] px-3 py-1 text-xs font-semibold"
                                    style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="checkbox"
                                id={`req-${q.id}`}
                                checked={q.required}
                                onChange={(e) => handleQuestionChange(idx, "required", e.target.checked)}
                                className="h-3.5 w-3.5 rounded"
                              />
                              <label htmlFor={`req-${q.id}`} className="text-[0.72rem] font-medium cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                                Required question
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Attendee Consent with Customizable Text */}
                    <div className="rounded-[14px] border p-4 space-y-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold block" style={{ color: "var(--text-primary)" }}>
                            Data Processing Consent & Policy Notice
                          </span>
                          <p className="text-[0.72rem]" style={{ color: "var(--text-muted)" }}>
                            Adds a required consent checkbox to the registration form.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={attendeeConsentEnabled}
                          onChange={(e) => setAttendeeConsentEnabled(e.target.checked)}
                          className="h-4 w-4 rounded"
                        />
                      </div>

                      {attendeeConsentEnabled && (
                        <div className="border-t pt-3">
                          <label className="block text-[0.72rem] font-semibold mb-1" style={labelStyle}>
                            Custom Consent Notice / Photography Release (Optional)
                          </label>
                          <textarea
                            rows={2}
                            value={attendeeConsentText}
                            onChange={(e) => setAttendeeConsentText(e.target.value)}
                            placeholder="e.g. Photography & Media Notice: Photos and video recordings will be taken during this event for promotional highlights and social media. By registering, you grant permission to be included in event footage."
                            className="w-full rounded-[8px] px-3 py-2 text-xs outline-none"
                            style={inputStyle}
                          />
                          <p className="text-[0.68rem] mt-1" style={{ color: "var(--text-muted)" }}>
                            If left blank, standard EventSlot attendee data privacy policy text will be used.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="rounded-full px-6 py-2.5 text-xs font-semibold border"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    ← Back to Tickets
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNextStep(4)}
                    className="rounded-full px-8 py-3 text-[0.88rem] font-bold text-white shadow-md transition hover:opacity-90"
                    style={{ background: "#15803d" }}
                  >
                    Review & Launch →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 4: REVIEW & LAUNCH ── */}
            {currentStep === 4 && (
              <div className="space-y-5">
                {/* Host & Communication */}
                <div className="rounded-[14px] border p-5 sm:p-6 space-y-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <div className="border-b pb-3" style={{ borderColor: "var(--border-subtle)" }}>
                    <h3 className="text-[1.15rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                      Host & Communication
                    </h3>
                    <p className="text-[0.78rem]" style={{ color: "var(--text-secondary)" }}>
                      Your event will be published under your verified account.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[0.75rem] font-medium mb-1" style={labelStyle}>
                        Organizer Display Name
                      </label>
                      <input
                        type="text"
                        value={organizerName}
                        onChange={(e) => setOrganizerName(e.target.value)}
                        placeholder={session?.user?.name || "Your name or organization"}
                        className="w-full rounded-[10px] px-3.5 py-2 text-[0.85rem] outline-none"
                        style={inputStyle}
                      />
                      <p className="text-[0.7rem] mt-1" style={{ color: "var(--text-muted)" }}>
                        Shown to attendees as &quot;Hosted by {organizerName || session?.user?.name || "You"}&quot;.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[0.75rem] font-medium mb-1" style={labelStyle}>
                        Account Email
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={organizerEmail || session?.user?.email || ""}
                        className="w-full rounded-[10px] px-3.5 py-2 text-[0.85rem] outline-none opacity-80 cursor-not-allowed"
                        style={mutedInputStyle}
                      />
                      <p className="text-[0.7rem] mt-1" style={{ color: "var(--text-muted)" }}>
                        Verified organizer email linked to your dashboard.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-[0.75rem] font-medium mb-1" style={labelStyle}>
                        WhatsApp Attendee Helpline (Optional)
                      </label>
                      <input
                        type="tel"
                        value={whatsappNumber}
                        onChange={(e) => setWhatsappNumber(e.target.value)}
                        placeholder="+254712345678"
                        className="w-full rounded-[10px] px-3.5 py-2 text-[0.85rem] outline-none"
                        style={inputStyle}
                      />
                      <p className="text-[0.7rem] mt-1" style={{ color: "var(--text-muted)" }}>
                        Enables a floating WhatsApp contact button on your event page.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[0.75rem] font-medium mb-1" style={labelStyle}>
                        Community Group Link (Optional)
                      </label>
                      <input
                        type="url"
                        value={communityLink}
                        onChange={(e) => setCommunityLink(e.target.value)}
                        placeholder="https://chat.whatsapp.com/... or telegram"
                        className="w-full rounded-[10px] px-3.5 py-2 text-[0.85rem] outline-none"
                        style={inputStyle}
                      />
                      <p className="text-[0.7rem] mt-1" style={{ color: "var(--text-muted)" }}>
                        Link shown to registered guests to join your group.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Live Preview Card — With Ambient Blurred Backdrop so posters are never cropped */}
                <div className="rounded-[14px] border p-5 sm:p-6 space-y-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[1.15rem] font-semibold" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
                      Event Preview
                    </h3>
                    <span className="text-[0.7rem] font-semibold uppercase px-2.5 py-0.5 rounded-full" style={{ background: "var(--surface-muted)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
                      {visibility === "PUBLIC" ? "🌐 Public on Discover" : "🔒 Private Event"}
                    </span>
                  </div>

                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-subtle)", background: "var(--surface-muted)" }}>
                    {imageUrl && (
                      <div style={{ position: "relative", width: "100%", overflow: "hidden", background: "#0A0A0A" }}>
                        {/* Ambient blurred backdrop */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", filter: "blur(20px)", opacity: 0.4 }} />
                        {/* Uncropped sharp poster */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imageUrl} alt="Poster preview" style={{ position: "relative", width: "100%", maxHeight: "320px", objectFit: "contain", display: "block", margin: "0 auto" }} />
                      </div>
                    )}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full" style={{ background: "rgba(34,197,94,0.15)", color: "#15803d" }}>
                          Free RSVP
                        </span>
                        {category && (
                          <span className="text-xs text-[var(--text-muted)]">• {category}</span>
                        )}
                      </div>
                      <h4 className="text-lg font-semibold" style={{ color: "var(--text-primary)", fontFamily: "var(--font-instrument-serif)" }}>
                        {title || "Untitled Event"}
                      </h4>
                      {eventDate && (
                        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                          📅 {hasSpecificTime ? new Date(eventDate).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : new Date(eventDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      )}
                      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        📍 {eventType === "VIRTUAL" ? "Google Meet (Virtual)" : location || "Venue to be announced"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Primary Launch Actions */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    className="rounded-full px-6 py-2.5 text-xs font-semibold border"
                    style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                  >
                    ← Back to Questions
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={loading}
                    className="rounded-full px-10 py-3.5 text-[0.95rem] font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: "#15803d" }}
                  >
                    {loading ? "Publishing Event..." : "🚀 Publish Event Now"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
