"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { BillingPausedNotice } from "@/components/billing/BillingPausedNotice"
import CountdownTimer from "@/components/CountdownTimer"
import { getCommunityLinkLabel, normalizeCommunityLink } from "@/lib/communityLink"
import { getBillingNoticeCopy } from "@/lib/billingNotice"

type EventQuestion = {
  id: string
  label: string
  type: string
  options?: string[]
  required: boolean
  allowMultiple?: boolean
  optionLimits?: Record<string, number | null | undefined>
}

type EventTicketTier = {
  id: string
  name: string
  presetKey?: string | null
  badgeColor: string
  textColor: string
  metallic: boolean
  prestige: number
  priceKes: number
  currency: string
  capacity: number
  description?: string | null
  soldCount: number
  waitlistCount: number
  bundleSize: number
}

type EventProps = {
  event: {
    slug: string
    title: string
    description?: string | null
    capacity?: number | null
    confirmedCount: number
    questions: EventQuestion[]
    organizerEmail: string
    organizerName?: string | null
    eventDate?: Date | string | null
    deadline?: Date | string | null
    location?: string | null
    communityLink?: string | null
    imageUrl?: string | null
    createdAt: Date | string
    isPaid?: boolean
    ticketTiers?: EventTicketTier[]
  }
  showBranding?: boolean
  maxAttendees?: number
  compactHeader?: boolean
}

function BrandingFooter() {
  return (
    <div style={{ textAlign: "center", marginTop: "2rem", fontSize: "0.72rem", color: "rgba(240,237,230,0.2)", fontFamily: "var(--font-dm-sans)" }}>
      Powered by{" "}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "rgba(200,245,90,0.4)", textDecoration: "none", transition: "color 0.2s" }}
        onMouseEnter={e => (e.currentTarget.style.color = "#C8F55A")}
        onMouseLeave={e => (e.currentTarget.style.color = "rgba(200,245,90,0.4)")}
      >
        EventSlot
      </a>
    </div>
  )
}

type AttendeeResult = {
  status: 'confirmed' | 'waitlist'
  waitlistPosition?: number
  registrationId: string
  registrationNumber?: number
  confirmationCode?: string
}

type BulkResult = {
  success: true
  results: AttendeeResult[]
  eventTitle: string
}

type AttendeeAnswers = Record<string, string>

function parseCheckboxValue(raw: string | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === "string")
  } catch {
    // Backward compatibility with older delimiter values.
    return raw.split("|").map(v => v.trim()).filter(Boolean)
  }
  return []
}

function serializeCheckboxValue(values: string[]): string {
  const uniqueSorted = Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))
  return JSON.stringify(uniqueSorted)
}

function emptyAnswers(questions: EventQuestion[]): AttendeeAnswers {
  return Object.fromEntries(questions.map(q => [q.id, ""]))
}

type DuplicateInfo = {
  attendeeIndex: number
  registrationNumber: number | null
  name: string
  maskedPhone: string
}

type PendingPayload = {
  eventSlug: string
  attendeesPayload: Array<{ answers: Array<{ questionId: string; value: string }>; baseEmail?: string }>
  consentDataProcessing: boolean
  consentTransactional: boolean
  consentMarketing: boolean
  sendResponseCopy: boolean
  source: string
  refCode?: string
  utmSource?: string
}

type PaidCheckoutResponse = {
  success: true
  orderId: string
  checkoutRequestId: string
  url?: string
  customerMessage: string
  amountKes: number
  eventTitle: string
  ticketTierName: string
  paymentMethod: "mpesa" | "paystack"
}

export default function RegistrationForm({ event, showBranding = false, maxAttendees = 3, compactHeader = false }: EventProps) {
  const [attendees, setAttendees] = useState<AttendeeAnswers[]>([emptyAnswers(event.questions)])
  const [loading, setLoading] = useState(false)
  const [bulkResult, setBulkResult] = useState<BulkResult | null>(null)
  const [error, setError] = useState("")
  const [consentDataProcessing, setConsentDataProcessing] = useState(false)
  const [consentTransactional, setConsentTransactional] = useState(false)
  const [consentMarketing, setConsentMarketing] = useState(false)
  const [sendResponseCopy, setSendResponseCopy] = useState(false)
  // Duplicate detection
  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo | null>(null)
  const [pendingPayload, setPendingPayload] = useState<PendingPayload | null>(null)
  // Waitlist email capture (shown when event has no email question)
  const [waitlistEmails, setWaitlistEmails] = useState<Record<string, string>>({})
  const [waitlistEmailSaving, setWaitlistEmailSaving] = useState<Record<string, boolean>>({})
  const [waitlistEmailSaved, setWaitlistEmailSaved] = useState<Record<string, boolean>>({})
  const [waitlistEmailErrors, setWaitlistEmailErrors] = useState<Record<string, string>>({})
  // Base email inputs — always collected when event has no email question
  const [baseEmails, setBaseEmails] = useState<string[]>([""])
  const [registrationSource, setRegistrationSource] = useState<string>("unknown")
  const [registrationRefCode, setRegistrationRefCode] = useState<string | undefined>(undefined)
  const [registrationUtmSource, setRegistrationUtmSource] = useState<string | undefined>(undefined)
  const [selectedTierId] = useState<string>(event.ticketTiers?.[0]?.id ?? "")
  const [paymentMethod] = useState<"mpesa" | "card">("mpesa")
  const [mpesaPhone] = useState("")
  const [paidCheckout, setPaidCheckout] = useState<PaidCheckoutResponse | null>(null)
  const [paymentPolling, setPaymentPolling] = useState(false)
  const [draftEmail, setDraftEmail] = useState("")
  const [draftState, setDraftState] = useState<"idle" | "loading" | "saving" | "saved" | "error">("idle")
  const [draftMessage, setDraftMessage] = useState("")
  const [restoredDraftEmail, setRestoredDraftEmail] = useState("")
  const [deadlineExpired, setDeadlineExpired] = useState(() => {
    if (!event.deadline) return false
    return new Date(event.deadline).getTime() <= Date.now()
  })

  useEffect(() => {
    const sourceKey = `event_source_${event.slug}`
    const refKey = `event_ref_${event.slug}`
    const utmKey = `event_utm_source_${event.slug}`

    const params = new URLSearchParams(window.location.search)
    const ref = params.get("ref")?.trim() || ""
    const utmSource = params.get("utm_source")?.trim() || ""
    const referrer = document.referrer || ""

    let source = "unknown"
    if (ref) {
      source = "referral"
    } else if (!referrer) {
      source = "direct"
    } else {
      try {
        const refHost = new URL(referrer).host
        source = refHost.includes("eventslot") ? "shared" : "unknown"
      } catch {
        source = "unknown"
      }
    }

    sessionStorage.setItem(sourceKey, source)
    if (ref) sessionStorage.setItem(refKey, ref)
    if (utmSource) sessionStorage.setItem(utmKey, utmSource)

    const storedSource = sessionStorage.getItem(sourceKey) || source
    const storedRef = sessionStorage.getItem(refKey) || undefined
    const storedUtmSource = sessionStorage.getItem(utmKey) || undefined

    setRegistrationSource(storedSource)
    setRegistrationRefCode(storedRef)
    setRegistrationUtmSource(storedUtmSource)
  }, [event.slug])

  useEffect(() => {
    if (!paidCheckout?.orderId) return

    let cancelled = false
    setPaymentPolling(true)

    const poll = async () => {
      try {
        const res = await fetch(`/api/paid-events/orders/${paidCheckout.orderId}`, { cache: "no-store" })
        const data = await res.json()
        if (!res.ok || cancelled) return

        if (data.status === "PAID" && data.confirmationCode) {
          window.location.href = `/register/success/${data.confirmationCode}`
          return
        }

        if (data.status === "EXPIRED") {
          setError("Your payment hold expired. Please choose your ticket tier again.")
          setPaidCheckout(null)
          setPaymentPolling(false)
          return
        }

        if (data.status === "FAILED" || data.status === "CANCELLED") {
          setError("Payment was not completed. Please try again.")
          setPaidCheckout(null)
          setPaymentPolling(false)
          return
        }

        window.setTimeout(poll, 4000)
      } catch {
        if (!cancelled) {
          window.setTimeout(poll, 5000)
        }
      }
    }

    poll()

    return () => {
      cancelled = true
      setPaymentPolling(false)
    }
  }, [paidCheckout])

  const hasEmailQuestion = event.questions.some(q => q.type === 'email')
  const emailQuestion = event.questions.find((question) => question.type === "email")
  const fieldClassName = "mt-1 w-full rounded-[12px] border px-3.5 py-3 text-[0.9rem] transition placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2"
  const subtleLabelClassName = "mb-1.5 block text-[0.72rem] font-semibold tracking-[0.08em] uppercase"
  const fieldStyle = {
    background: "var(--bg-input)",
    borderColor: "color-mix(in srgb, var(--text-primary) 14%, transparent)",
    color: "var(--text-primary)",
    boxShadow: "0 0 0 0 transparent",
  } satisfies React.CSSProperties
  const subtleLabelStyle = { color: "var(--text-secondary)" } satisfies React.CSSProperties
  const questionCardStyle = {
    border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)",
    background: "color-mix(in srgb, var(--surface) 94%, white 6%)",
  } satisfies React.CSSProperties
  const mutedCardStyle = {
    border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)",
    background: "color-mix(in srgb, var(--surface) 88%, transparent)",
  } satisfies React.CSSProperties
  const resultCardStyle = {
    border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)",
    background: "color-mix(in srgb, var(--surface) 96%, white 4%)",
  } satisfies React.CSSProperties
  const softPanelStyle = {
    background: "color-mix(in srgb, var(--surface) 90%, transparent)",
    border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)",
  } satisfies React.CSSProperties

  const currentEmailFromAnswers = emailQuestion ? attendees[0]?.[emailQuestion.id]?.trim() ?? "" : ""
  const effectiveDraftEmail = (draftEmail || currentEmailFromAnswers || baseEmails[0] || "").trim().toLowerCase()

  useEffect(() => {
    try {
      const lastEmail = window.localStorage.getItem(`eventslot-draft-email:${event.slug}`) ?? ""
      if (lastEmail) setDraftEmail(lastEmail)
    } catch {
      // Ignore storage issues.
    }
  }, [event.slug])

  useEffect(() => {
    if (!hasEmailQuestion && draftEmail && !baseEmails[0]) {
      setBaseEmails((current) => {
        const next = [...current]
        next[0] = draftEmail
        return next
      })
    }
  }, [baseEmails, draftEmail, hasEmailQuestion])

  useEffect(() => {
    if (hasEmailQuestion && currentEmailFromAnswers && currentEmailFromAnswers !== draftEmail) {
      setDraftEmail(currentEmailFromAnswers)
    }
  }, [currentEmailFromAnswers, draftEmail, hasEmailQuestion])

  useEffect(() => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveDraftEmail)) return
    if (restoredDraftEmail === effectiveDraftEmail) return

    let cancelled = false
    setDraftState("loading")
    setDraftMessage("Checking for saved progress...")

    void fetch(`/api/register/draft?eventSlug=${encodeURIComponent(event.slug)}&email=${encodeURIComponent(effectiveDraftEmail)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok || cancelled) return
        if (!data.draft) {
          setRestoredDraftEmail(effectiveDraftEmail)
          setDraftState("idle")
          setDraftMessage("")
          return
        }

        const draftAnswers = Array.isArray(data.draft.answers) ? data.draft.answers : []
        const nextAttendees = draftAnswers
          .map((entry: Record<string, string>) => {
            const answerMap = emptyAnswers(event.questions)
            for (const [key, value] of Object.entries(entry ?? {})) {
              answerMap[key] = typeof value === "string" ? value : ""
            }
            return answerMap
          })
          .filter((entry: AttendeeAnswers) => Object.values(entry).some(Boolean))

        if (nextAttendees.length > 0) {
          setAttendees(nextAttendees)
        }
        if (Array.isArray(data.draft.baseEmails) && data.draft.baseEmails.length > 0) {
          setBaseEmails(data.draft.baseEmails.map((value: unknown) => (typeof value === "string" ? value : "")))
        }
        setConsentDataProcessing(Boolean(data.draft.consentDataProcessing))
        setConsentTransactional(Boolean(data.draft.consentTransactional))
        setConsentMarketing(Boolean(data.draft.consentMarketing))
        setSendResponseCopy(Boolean(data.draft.sendResponseCopy))
        setRestoredDraftEmail(effectiveDraftEmail)
        setDraftState("saved")
        setDraftMessage("Saved progress restored.")
      })
      .catch(() => {
        if (!cancelled) {
          setDraftState("error")
          setDraftMessage("We could not load saved progress right now.")
        }
      })

    return () => {
      cancelled = true
    }
  }, [effectiveDraftEmail, event.questions, event.slug, restoredDraftEmail])

  useEffect(() => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveDraftEmail)) return
    if (bulkResult) return

    try {
      window.localStorage.setItem(`eventslot-draft-email:${event.slug}`, effectiveDraftEmail)
    } catch {
      // Ignore storage issues.
    }

    const timeout = window.setTimeout(() => {
      setDraftState("saving")
      setDraftMessage("Saving your progress...")
      void fetch("/api/register/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventSlug: event.slug,
          email: effectiveDraftEmail,
          answers: attendees,
          attendeeCount: attendees.length,
          baseEmails,
          consentDataProcessing,
          consentTransactional,
          consentMarketing,
          sendResponseCopy,
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("save_failed")
          }
          setDraftState("saved")
          setDraftMessage("Progress saved.")
        })
        .catch(() => {
          setDraftState("error")
          setDraftMessage("We could not save your progress.")
        })
    }, 900)

    return () => window.clearTimeout(timeout)
  }, [
    attendees,
    baseEmails,
    bulkResult,
    consentDataProcessing,
    consentMarketing,
    consentTransactional,
    effectiveDraftEmail,
    event.slug,
    sendResponseCopy,
  ])

  const canAddMore = !event.isPaid && attendees.length < maxAttendees
  const isSubmitBlocked = loading || deadlineExpired || event.isPaid
  function addAttendee() {
    if (!canAddMore) return
    setAttendees(a => [...a, emptyAnswers(event.questions)])
    setBaseEmails(e => [...e, ""])
  }

  function removeAttendee(index: number) {
    setAttendees(a => a.filter((_, i) => i !== index))
    setBaseEmails(e => e.filter((_, i) => i !== index))
  }

  function handleChange(attendeeIndex: number, qId: string, value: string) {
    setAttendees(a => {
      const next = [...a]
      next[attendeeIndex] = { ...next[attendeeIndex], [qId]: value }
      return next
    })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError("")

    if (deadlineExpired) {
      setError("Registration has closed.")
      return
    }
    if (!consentDataProcessing) {
      setError("Please confirm the data-processing consent before submitting.")
      return
    }

    // Client-side required field validation
    for (let i = 0; i < attendees.length; i++) {
      for (const q of event.questions) {
        if (!q.required) continue
        const answer = attendees[i][q.id] || ""
        const hasValue = q.type === "checkbox"
          ? parseCheckboxValue(answer).length > 0
          : answer.trim().length > 0
        if (!hasValue) {
          setError(`Please fill in "${q.label}"${attendees.length > 1 ? ` for attendee ${i + 1}` : ""}.`)
          return
        }
      }
    }

    if (event.isPaid) {
      setError(getBillingNoticeCopy("paidEventRegistration").error)
      return
    }

    setLoading(true)
    try {
      const attendeesPayload = attendees.map((form, i) => ({
        answers: event.questions.map(q => ({ questionId: q.id, value: form[q.id] || "" })),
        ...((!hasEmailQuestion && baseEmails[i]) ? { baseEmail: baseEmails[i] } : {}),
      }))

      if (event.isPaid) {
        const res = await fetch("/api/paid-events/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventSlug: event.slug,
            ticketTierId: selectedTierId,
            attendee: attendeesPayload[0],
            consentDataProcessing,
            consentTransactional,
            consentMarketing,
            sendResponseCopy,
            paymentMethod,
            mpesaPhone,
            source: registrationSource,
            refCode: registrationRefCode,
            utmSource: registrationUtmSource,
          }),
        })
        const data = await res.json()

        if (data.success && data.url) {
          window.location.href = data.url
        } else if (data.success && data.checkoutRequestId) {
          setPaidCheckout(data)
        } else if (data.success && data.results) {
          setBulkResult(data)
        } else {
          setError(data.error || "Unable to start payment.")
        }
      } else {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventSlug: event.slug,
            attendees: attendeesPayload,
            consentDataProcessing,
            consentTransactional,
            consentMarketing,
            sendResponseCopy,
            source: registrationSource,
            refCode: registrationRefCode,
            utmSource: registrationUtmSource,
          }),
        })
        const data = await res.json()
        if (data.success) {
          setBulkResult(data)
        } else if (data.duplicate) {
          setDuplicateInfo({
            attendeeIndex: data.attendeeIndex ?? 0,
            registrationNumber: data.existing?.registrationNumber ?? null,
            name: data.existing?.name ?? "",
            maskedPhone: data.existing?.maskedPhone ?? "",
          })
          setPendingPayload({
            eventSlug: event.slug,
            attendeesPayload,
            consentDataProcessing,
            consentTransactional,
            consentMarketing,
            sendResponseCopy,
            source: registrationSource,
            refCode: registrationRefCode,
            utmSource: registrationUtmSource,
          })
        } else {
          setError(data.error || "Registration failed.")
        }
      }
    } catch {
      setError("Unexpected error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleForceRegister = async () => {
    if (!pendingPayload) return
    setLoading(true)
    setDuplicateInfo(null)
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...pendingPayload,
          attendees: pendingPayload.attendeesPayload,
          forceDuplicate: true,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setBulkResult(data)
        setPendingPayload(null)
      } else {
        setError(data.error || "Registration failed.")
      }
    } catch {
      setError("Unexpected error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const saveWaitlistEmail = async (registrationId: string, email: string) => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setWaitlistEmailErrors(prev => ({ ...prev, [registrationId]: "Enter a valid email address." }))
      return
    }

    setWaitlistEmailErrors(prev => ({ ...prev, [registrationId]: "" }))
    setWaitlistEmailSaving(prev => ({ ...prev, [registrationId]: true }))
    try {
      const res = await fetch(`/api/registrations/${registrationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendeeEmail: trimmedEmail }),
      })
      if (res.ok) {
        setWaitlistEmailSaved(prev => ({ ...prev, [registrationId]: true }))
      } else {
        const data = await res.json().catch(() => ({}))
        setWaitlistEmailErrors(prev => ({ ...prev, [registrationId]: data.error || "Unable to save your email right now." }))
      }
    } catch {
      setWaitlistEmailErrors(prev => ({ ...prev, [registrationId]: "Network error. Please try again." }))
    } finally {
      setWaitlistEmailSaving(prev => ({ ...prev, [registrationId]: false }))
    }
  }

  const clearForm = async () => {
    const emailToClear = effectiveDraftEmail
    setAttendees([emptyAnswers(event.questions)])
    setBaseEmails([""])
    setConsentDataProcessing(false)
    setConsentTransactional(false)
    setConsentMarketing(false)
    setSendResponseCopy(false)
    setDraftEmail("")
    setError("")
    setDuplicateInfo(null)
    setPendingPayload(null)
    try {
      window.localStorage.removeItem(`eventslot-draft-email:${event.slug}`)
    } catch {
      // Ignore storage issues.
    }
    if (!emailToClear) return

    try {
      await fetch(`/api/register/draft?eventSlug=${encodeURIComponent(event.slug)}&email=${encodeURIComponent(emailToClear)}`, {
        method: "DELETE",
      })
      setDraftState("idle")
      setDraftMessage("Saved progress cleared.")
      setRestoredDraftEmail("")
    } catch {
      setDraftState("error")
      setDraftMessage("We cleared the form, but the saved draft could not be removed.")
    }
  }

  if (paidCheckout) {
    return (
      <div className="mx-auto w-full max-w-[480px]">
        <div
          className="rounded-[16px] p-8 text-center"
          style={{
            border: "1px solid rgba(255,184,77,0.24)",
            background: "color-mix(in srgb, var(--surface) 94%, rgba(255,184,77,0.06) 6%)",
          }}
        >
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(255,184,77,0.3)] bg-[rgba(255,184,77,0.08)]">
            <span className="text-[#FFB84D] text-xl">₿</span>
          </div>
          <h2 className="text-[1.5rem]" style={{ fontFamily: "var(--font-instrument-serif)", color: "var(--text-primary)" }}>
            Complete payment on your phone
          </h2>
          <p className="mt-3 text-[0.9rem]" style={{ fontFamily: "var(--font-dm-sans)", lineHeight: 1.6, color: "var(--text-secondary)" }}>
            We sent an M-Pesa STK push for <strong style={{ color: "var(--text-primary)" }}>KES {paidCheckout.amountKes.toLocaleString()}</strong> for the <strong style={{ color: "var(--text-primary)" }}>{paidCheckout.ticketTierName}</strong> ticket.
          </p>
          <p className="mt-3 text-[0.82rem] text-[#C8F55A]" style={{ fontFamily: "var(--font-dm-sans)" }}>
            {paidCheckout.customerMessage}
          </p>
          <p className="mt-5 text-[0.78rem]" style={{ fontFamily: "var(--font-dm-sans)", color: "var(--text-muted)" }}>
            {paymentPolling ? "Waiting for payment confirmation..." : "Checking payment status..."}
          </p>
        </div>
      </div>
    )
  }

  // Success screen
  if (bulkResult) {
    const isSingle = bulkResult.results.length === 1
    const communityLink = normalizeCommunityLink(event.communityLink)

    return (
      <div className="mx-auto w-full max-w-[480px]">
        <div className="space-y-4">
        {bulkResult.results.map((r, i) => (
          <div key={i} className="rounded-[16px] p-8" style={resultCardStyle}>
            {r.status === "confirmed" ? (
              <>
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)]">
                  <span className="block h-3 w-5 rotate-[-45deg] border-b-4 border-l-4 border-[#C8F55A]" />
                </div>
                <h2 className="text-center text-[1.6rem]" style={{ fontFamily: "var(--font-instrument-serif)", fontWeight: 400, color: "var(--text-primary)" }}>
                  {isSingle ? "You're in!" : `Attendee ${i + 1} - You're in!`}
                </h2>
                <p className="mx-auto mt-3 max-w-[360px] text-center text-[0.95rem]" style={{ fontFamily: "var(--font-dm-sans)", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                  Your spot for {event.title} is confirmed. We look forward to seeing you.
                </p>
                <div className="mt-4 flex justify-center">
                  <span className="rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)] px-3 py-1 text-[0.7rem] text-[#C8F55A]">
                    Confirmed
                  </span>
                </div>
                {r.registrationNumber && (
                  <p className="mt-3 text-center text-[0.72rem]" style={{ fontFamily: "var(--font-dm-sans)", color: "var(--text-muted)" }}>
                    Registration #{String(r.registrationNumber).padStart(4, "0")}
                  </p>
                )}
                {r.confirmationCode && (
                  <div className="mt-4 flex justify-center">
                    <a
                      href={`/register/success/${r.confirmationCode}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(200,245,90,0.4)] bg-[rgba(200,245,90,0.08)] px-4 py-2 text-[0.8rem] text-[#C8F55A]"
                      style={{ fontFamily: "var(--font-dm-sans)", textDecoration: "none", fontWeight: 500 }}
                    >
                      View &amp; Download Ticket
                    </a>
                  </div>
                )}
                {communityLink && (
                  <div className="mt-5 rounded-[8px] px-5 py-4" style={{ background: "rgba(200,245,90,0.06)", border: "0.5px solid rgba(200,245,90,0.15)" }}>
                    <p style={{ fontSize: "0.7rem", color: "#C8F55A", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>
                      Join the community
                    </p>
                    <a
                      href={communityLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full rounded-full border border-[rgba(200,245,90,0.4)] px-4 py-2 text-center text-[0.875rem] text-[#C8F55A]"
                      style={{ fontFamily: "var(--font-dm-sans)" }}
                    >
                      {getCommunityLinkLabel(communityLink)}
                    </a>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(240,237,230,0.15)] bg-[rgba(240,237,230,0.06)]">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(240,237,230,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h2 className="text-center text-[1.6rem]" style={{ fontFamily: "var(--font-instrument-serif)", fontWeight: 400, color: "var(--text-primary)" }}>
                  {isSingle ? "You're on the waitlist" : `Attendee ${i + 1} - Waitlist`}
                </h2>
                <p className="mx-auto mt-3 max-w-[360px] text-center text-[0.95rem]" style={{ fontFamily: "var(--font-dm-sans)", lineHeight: 1.6, color: "var(--text-secondary)" }}>
                  You are currently position #{r.waitlistPosition} for {event.title}. We will notify you if a slot opens.
                </p>
                <div className="mt-4 flex justify-center">
                  <span className="rounded-full border border-[rgba(240,237,230,0.15)] bg-[rgba(240,237,230,0.06)] px-3 py-1 text-[0.7rem] text-[rgba(240,237,230,0.55)]">
                    Waitlist #{r.waitlistPosition}
                  </span>
                </div>
                {r.registrationNumber && (
                  <p className="mt-3 text-center text-[0.72rem]" style={{ fontFamily: "var(--font-dm-sans)", color: "var(--text-muted)" }}>
                    Registration #{String(r.registrationNumber).padStart(4, "0")}
                  </p>
                )}
                {/* Waitlist email capture (if event has no email question) */}
                {!hasEmailQuestion && !waitlistEmailSaved[r.registrationId] && (
                  <div style={{ marginTop: "1.25rem", borderRadius: 10, padding: "1rem", ...softPanelStyle }}>
                    <p style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.625rem", lineHeight: 1.5 }}>
                      Enter your email so we can notify you if a slot opens:
                    </p>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        value={waitlistEmails[r.registrationId] ?? ""}
                        onChange={e => {
                          setWaitlistEmails(prev => ({ ...prev, [r.registrationId]: e.target.value }))
                          if (waitlistEmailErrors[r.registrationId]) {
                            setWaitlistEmailErrors(prev => ({ ...prev, [r.registrationId]: "" }))
                          }
                        }}
                        style={{ flex: 1, minWidth: 0, background: "var(--bg-input)", border: "0.5px solid color-mix(in srgb, var(--text-primary) 15%, transparent)", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.82rem", color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)", outline: "none" }}
                      />
                      <button
                        type="button"
                        onClick={() => saveWaitlistEmail(r.registrationId, waitlistEmails[r.registrationId] ?? "")}
                        disabled={waitlistEmailSaving[r.registrationId] || !(waitlistEmails[r.registrationId] ?? "").trim()}
                        style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.78rem", fontWeight: 600, color: "#0A0A0A", cursor: waitlistEmailSaving[r.registrationId] ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap", opacity: waitlistEmailSaving[r.registrationId] ? 0.7 : 1 }}
                      >
                        {waitlistEmailSaving[r.registrationId] ? "Saving..." : "Notify me"}
                      </button>
                    </div>
                    {waitlistEmailErrors[r.registrationId] && (
                      <p style={{ marginTop: "0.5rem", fontSize: "0.75rem", color: "#FF6B6B", fontFamily: "var(--font-dm-sans)" }}>
                        {waitlistEmailErrors[r.registrationId]}
                      </p>
                    )}
                  </div>
                )}
                {!hasEmailQuestion && waitlistEmailSaved[r.registrationId] && (
                  <p style={{ marginTop: "1rem", textAlign: "center", fontSize: "0.78rem", color: "#C8F55A", fontFamily: "var(--font-dm-sans)" }}>
                    We will notify you if a slot opens.
                  </p>
                )}
              </>
            )}
            <div style={{ textAlign: "center", marginTop: "1rem", display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              <a
                href={`/registration/${r.registrationId}`}
                style={{ fontSize: "0.78rem", color: "var(--text-muted)", textDecoration: "none" }}
              >
                View status
              </a>
              <a
                href={`/registration/${r.registrationId}/edit`}
                style={{ fontSize: "0.78rem", color: "#C8F55A", textDecoration: "none" }}
              >
                Edit your details
              </a>
            </div>
          </div>
        ))}
        </div>
        {showBranding && <BrandingFooter />}
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[840px]">
      {/* Duplicate warning dialog */}
      {duplicateInfo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", backdropFilter: "blur(6px)", zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "color-mix(in srgb, var(--surface) 96%, white 4%)", border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)", borderRadius: 18, padding: "1.75rem", width: "min(92vw,460px)", boxShadow: "0 18px 40px rgba(0,0,0,0.24)" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,168,0,0.12)", border: "0.5px solid rgba(255,168,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L16.5 15H1.5L9 2z" stroke="#FFA800" strokeWidth="1.25" strokeLinejoin="round" />
                <path d="M9 7v4" stroke="#FFA800" strokeWidth="1.25" strokeLinecap="round" />
                <circle cx="9" cy="13" r="0.75" fill="#FFA800" />
              </svg>
            </div>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#F59E0B", fontFamily: "var(--font-dm-sans)" }}>
              Check before submitting
            </p>
            <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "var(--text-primary)", marginBottom: "0.5rem" }}>Similar registration found</h3>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", marginBottom: "1rem", lineHeight: 1.6 }}>
              We found a registration in our system with identical details{duplicateInfo.attendeeIndex > 0 ? ` (attendee ${duplicateInfo.attendeeIndex + 1})` : ""}:
            </p>
            <div style={{ background: "color-mix(in srgb, var(--surface) 92%, transparent)", border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)", borderRadius: 12, padding: "0.875rem 1rem", marginBottom: "1.25rem" }}>
              {duplicateInfo.registrationNumber !== null && (
                <p style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.25rem" }}>
                  Registration #{String(duplicateInfo.registrationNumber).padStart(4, "0")}
                </p>
              )}
              {duplicateInfo.name && (
                <p style={{ fontSize: "0.82rem", color: "var(--text-primary)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.25rem" }}>
                  Name: {duplicateInfo.name}
                </p>
              )}
              {duplicateInfo.maskedPhone && (
                <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)" }}>
                  Phone: {duplicateInfo.maskedPhone}
                </p>
              )}
            </div>
            <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
              Is this the same person, or someone different with matching details?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              <button
                onClick={() => { setDuplicateInfo(null); setPendingPayload(null) }}
                style={{ background: "transparent", border: "1px solid color-mix(in srgb, var(--text-primary) 12%, transparent)", borderRadius: 10, padding: "0.75rem 1rem", fontSize: "0.82rem", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "var(--font-dm-sans)", textAlign: "left" }}
              >
                Same person - I&apos;m already registered
              </button>
              <button
                onClick={handleForceRegister}
                disabled={loading}
                style={{ background: "#C8F55A", border: "none", borderRadius: 10, padding: "0.75rem 1rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: loading ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", textAlign: "left", opacity: loading ? 0.7 : 1 }}
              >
                Different person - continue anyway
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Event details are rendered by EventInvitationCard on the parent page. */}

      {/* Countdown shown only when not in compact mode (EventInvitationCard already shows it above) */}
      {!compactHeader && event.deadline && (
        <CountdownTimer
          deadline={event.deadline}
          urgentMode
          onExpiredChange={setDeadlineExpired}
        />
      )}
      {/* Hidden timer keeps expired-state in sync even in compact mode */}
      {compactHeader && event.deadline && (
        <div style={{ display: 'none' }}>
          <CountdownTimer
            deadline={event.deadline}
            urgentMode
            onExpiredChange={setDeadlineExpired}
          />
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="w-full overflow-hidden rounded-[22px] shadow-[0_18px_42px_rgba(0,0,0,0.18)]"
        style={{
          border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 97%, white 3%) 0%, color-mix(in srgb, var(--surface) 100%, transparent) 100%)",
        }}
      >
        {event.imageUrl && (
          <div className="px-4 pt-4 sm:px-6 sm:pt-6" style={{ borderBottom: "1px solid color-mix(in srgb, var(--text-primary) 8%, transparent)" }}>
            <div className="mx-auto max-w-[360px] overflow-hidden rounded-[14px] p-2 shadow-[0_10px_30px_rgba(0,0,0,0.14)]" style={{ border: "1px solid color-mix(in srgb, var(--text-primary) 10%, transparent)", background: "color-mix(in srgb, var(--surface) 98%, white 2%)" }}>
              <div className="relative h-[180px] w-full overflow-hidden rounded-[10px]">
                <Image
                  src={event.imageUrl}
                  alt={`${event.title} event visual`}
                  fill
                  sizes="320px"
                  unoptimized
                  className="object-contain"
                />
              </div>
            </div>
          </div>
        )}

        <div className="h-3 w-full bg-[linear-gradient(90deg,rgba(200,245,90,0.92)_0%,rgba(200,245,90,0.28)_50%,rgba(200,245,90,0.08)_100%)]" />

        <div className="space-y-6 p-5 sm:p-7">
          <div className="space-y-5">
            <p style={{ fontSize: "0.72rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Registration form
            </p>
            <div className="space-y-3">
              <h2 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "clamp(1.65rem,4vw,2.3rem)", color: "var(--text-primary)", lineHeight: 1.12, margin: 0 }}>
                {event.title}
              </h2>
              {event.description && (
                <p style={{ fontSize: "1rem", color: "var(--text-secondary)", lineHeight: 1.75, margin: 0 }}>
                  {event.description}
                </p>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {event.eventDate && (
                <div className="rounded-[16px] px-4 py-3" style={mutedCardStyle}>
                  <p className="mb-1 text-[0.72rem] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>Date</p>
                  <p className="m-0 text-[0.96rem]" style={{ color: "var(--text-primary)" }}>{new Date(event.eventDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
              )}
              {event.location && (
                <div className="rounded-[16px] px-4 py-3" style={mutedCardStyle}>
                  <p className="mb-1 text-[0.72rem] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>Location</p>
                  <p className="m-0 text-[0.96rem]" style={{ color: "var(--text-primary)" }}>{event.location}</p>
                </div>
              )}
              <div className="rounded-[16px] px-4 py-3" style={mutedCardStyle}>
                <p className="mb-1 text-[0.72rem] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>Entry</p>
                <p className="m-0 text-[0.96rem]" style={{ color: "var(--text-primary)" }}>{event.isPaid ? "Paid event" : "Free"}</p>
              </div>
              {event.organizerName && (
                <div className="rounded-[16px] px-4 py-3" style={mutedCardStyle}>
                  <p className="mb-1 text-[0.72rem] uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>Hosted by</p>
                  <p className="m-0 text-[0.96rem]" style={{ color: "var(--text-primary)" }}>{event.organizerName}</p>
                </div>
              )}
            </div>

            <div className="rounded-[16px] px-4 py-3" style={mutedCardStyle}>
              <p className="m-0 text-[0.92rem] leading-7" style={{ color: "var(--text-secondary)" }}>
                Fill in the details below to secure your spot. You can save progress with your email and continue later.
              </p>
            </div>

            <div className="rounded-[18px] px-4 py-4" style={{ border: "1px solid color-mix(in srgb, var(--accent) 18%, transparent)", background: "color-mix(in srgb, var(--accent) 8%, var(--surface) 92%)" }}>
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <label className={subtleLabelClassName} style={{ ...subtleLabelStyle, display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--text-secondary)" }}>
                      <rect x="1.5" y="3" width="13" height="10" rx="2" />
                      <path d="M2 4l6 4 6-4" />
                    </svg>
                    Save your progress with email
                  </label>
                  <input
                    type="email"
                    placeholder="your@email.com"
                    className={fieldClassName}
                    style={fieldStyle}
                    value={draftEmail}
                    onChange={e => setDraftEmail(e.target.value)}
                  />
                </div>
                <div className="min-w-[180px] text-[0.76rem]" style={{ color: "var(--text-secondary)" }}>
                  {draftState === "saving" || draftState === "loading" ? draftMessage : draftMessage || "Open this same link again to restore your saved progress."}
                </div>
              </div>
            </div>
          </div>

        {event.isPaid && (
          <BillingPausedNotice context="paidEventRegistration" compact />
        )}

        {/* Bulk prompt row */}
      <div className="flex items-center justify-between gap-3 rounded-[16px] px-4 py-3" style={mutedCardStyle}>
        <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", fontFamily: "var(--font-dm-sans)" }}>
          {attendees.length > 1 ? `Registering ${attendees.length} people` : "Registering 1 person"}
        </span>
        {canAddMore && (
          <button
            type="button"
            onClick={addAttendee}
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(200,245,90,0.12)",
              border: "0.5px solid rgba(200,245,90,0.3)",
              color: "#C8F55A",
              fontSize: "1.1rem",
              lineHeight: 1,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            aria-label="Add attendee"
          >
            +
          </button>
        )}
      </div>

      {/* Attendee blocks */}
      {attendees.map((form, attendeeIndex) => (
        <div key={attendeeIndex} className="rounded-[20px] px-4 py-4 sm:px-5" style={questionCardStyle}>
          {/* Divider between attendees */}
          {attendeeIndex > 0 && (
            <div style={{ borderTop: "0.5px solid color-mix(in srgb, var(--text-primary) 10%, transparent)", margin: "1.25rem 0" }} />
          )}

          {/* Attendee header */}
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: "0.72rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-dm-sans)" }}>
              Attendee {attendeeIndex + 1}
            </span>
            {attendeeIndex > 0 && (
              <button
                type="button"
                onClick={() => removeAttendee(attendeeIndex)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "1rem",
                  lineHeight: 1,
                  padding: "0 2px",
                }}
                aria-label="Remove attendee"
              >
                x
              </button>
            )}
          </div>

          {/* Questions for this attendee */}
          <div className="space-y-4">
            {/* System email field — always collected when organiser hasn't added an email question */}
            {!hasEmailQuestion && (
              <div>
                <label
                  htmlFor={`base-email-${attendeeIndex}`}
                  className={subtleLabelClassName}
                  style={subtleLabelStyle}
                >
                  Email address <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(for your ticket)</span>
                </label>
                <input
                  id={`base-email-${attendeeIndex}`}
                  type="email"
                  placeholder="your@email.com"
                  className={fieldClassName}
                  style={fieldStyle}
                  value={baseEmails[attendeeIndex] ?? ""}
                  onChange={e => setBaseEmails(prev => { const next = [...prev]; next[attendeeIndex] = e.target.value; return next })}
                />
              </div>
            )}
            {event.questions.map(q => (
              <div key={q.id}>
                <label
                  htmlFor={`attendee-${attendeeIndex}-${q.id}`}
                  className={subtleLabelClassName}
                  style={subtleLabelStyle}
                >
                  {q.label}{q.required && <span className="text-[#C8F55A]"> *</span>}
                </label>
                {q.type === "text" && (
                  <input
                    id={`attendee-${attendeeIndex}-${q.id}`}
                    type="text"
                    className={fieldClassName}
                    style={fieldStyle}
                    required={q.required}
                    value={form[q.id]}
                    onChange={e => handleChange(attendeeIndex, q.id, e.target.value)}
                  />
                )}
                {q.type === "email" && (
                  <input
                    id={`attendee-${attendeeIndex}-${q.id}`}
                    type="email"
                    className={fieldClassName}
                    style={fieldStyle}
                    required={q.required}
                    value={form[q.id]}
                    onChange={e => handleChange(attendeeIndex, q.id, e.target.value)}
                  />
                )}
                {q.type === "phone" && (
                  <input
                    id={`attendee-${attendeeIndex}-${q.id}`}
                    type="tel"
                    className={fieldClassName}
                    style={fieldStyle}
                    required={q.required}
                    value={form[q.id]}
                    onChange={e => handleChange(attendeeIndex, q.id, e.target.value)}
                  />
                )}
                {q.type === "select" && (
                  <>
                    <select
                      id={`attendee-${attendeeIndex}-${q.id}`}
                      className={fieldClassName}
                      style={fieldStyle}
                      required={q.required}
                      value={form[q.id]}
                      onChange={e => handleChange(attendeeIndex, q.id, e.target.value)}
                    >
                      <option value="" className="bg-[#141414] text-[#F0EDE6]">Select...</option>
                      {q.options?.map(opt => (
                        <option key={opt} value={opt} className="bg-[#141414] text-[#F0EDE6]">
                          {opt}
                        </option>
                      ))}
                    </select>
                    {q.optionLimits && Object.keys(q.optionLimits).length > 0 && (
                      <p className="mt-2 text-[0.72rem]" style={{ color: "var(--text-muted)" }}>
                        Some positions have limited slots and may close once full.
                      </p>
                    )}
                  </>
                )}
                {q.type === "checkbox" && (
                  <div className="mt-1 space-y-2 rounded-[14px] px-3 py-3" style={mutedCardStyle}>
                    {q.options?.map(opt => {
                      const selectedValues = parseCheckboxValue(form[q.id])
                      const isChecked = selectedValues.includes(opt)
                      return (
                        <label key={`${q.id}-${opt}`} className="flex cursor-pointer items-center gap-2 text-[0.85rem]" style={{ color: "var(--text-primary)" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              const nextValues = e.target.checked
                                ? (q.allowMultiple ? [...selectedValues, opt] : [opt])
                                : selectedValues.filter(value => value !== opt)
                              handleChange(attendeeIndex, q.id, serializeCheckboxValue(nextValues))
                            }}
                            className="h-4 w-4 rounded text-[#C8F55A] focus:ring-[#C8F55A]"
                            style={{ borderColor: "color-mix(in srgb, var(--text-primary) 20%, transparent)", background: "var(--bg-input)" }}
                          />
                          <span>{opt}</span>
                        </label>
                      )
                    })}
                    {q.required && parseCheckboxValue(form[q.id]).length === 0 && (
                      <p className="text-[0.72rem]" style={{ color: "var(--text-muted)" }}>Select at least one option.</p>
                    )}
                    {q.optionLimits && Object.keys(q.optionLimits).length > 0 && (
                      <p className="text-[0.72rem]" style={{ color: "var(--text-muted)" }}>Some options have limited slots and may stop accepting selections once full.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-[18px] p-4 sm:p-5" style={questionCardStyle}>
        <div className="mb-4">
          <p className="m-0 text-[1rem] font-semibold" style={{ color: "var(--text-primary)" }}>Consent for Data Processing</p>
          <p className="mt-2 text-[0.92rem] leading-8" style={{ color: "var(--text-secondary)" }}>
            Do you consent to {event.organizerName ?? "the organiser"} collecting and using your personal information for registration, event communication, attendee coordination, and event-day planning purposes?
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          <label style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", cursor: "pointer" }}>
            <span style={{ position: "relative", flexShrink: 0, marginTop: "2px" }}>
              <input
                id="consent-data-processing"
                type="checkbox"
                checked={consentDataProcessing}
                onChange={e => setConsentDataProcessing(e.target.checked)}
                style={{ position: "absolute", opacity: 0, width: 18, height: 18, margin: 0, cursor: "pointer" }}
              />
              <span style={{
                display: "block",
                width: 18,
                height: 18,
                borderRadius: 4,
                border: consentDataProcessing ? "1.5px solid #C8F55A" : "1.5px solid color-mix(in srgb, var(--text-primary) 22%, transparent)",
                background: consentDataProcessing ? "#C8F55A" : "transparent",
                transition: "background 0.15s, border 0.15s",
              }}>
                {consentDataProcessing && (
                  <svg width="10" height="7" viewBox="0 0 10 7" fill="none" style={{ display: "block", margin: "5px auto 0" }}>
                    <path d="M1 3.5L3.8 6 9 1" stroke="#0A0A0A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
            </span>
            <span style={{ fontSize: "0.9rem", color: "var(--text-primary)", lineHeight: 1.7, fontFamily: "var(--font-dm-sans)" }}>
              I consent to my data being collected and used for event registration, communication, and event planning purposes.
              <span className="ml-1 text-[#C8F55A]">*</span>
            </span>
          </label>

          <div style={{ height: 1, background: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingTop: "0.1rem" }}>
            <label style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start", cursor: "pointer" }}>
              <span style={{ position: "relative", flexShrink: 0, marginTop: "2px" }}>
                <input
                  id="consent-transactional"
                  type="checkbox"
                  checked={consentTransactional}
                  onChange={e => setConsentTransactional(e.target.checked)}
                  style={{ position: "absolute", opacity: 0, width: 16, height: 16, margin: 0, cursor: "pointer" }}
                />
                <span style={{
                  display: "block",
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  border: consentTransactional ? "1.5px solid #C8F55A" : "1.5px solid color-mix(in srgb, var(--text-primary) 18%, transparent)",
                  background: consentTransactional ? "#C8F55A" : "transparent",
                  flexShrink: 0,
                  transition: "background 0.15s, border 0.15s",
                }}>
                  {consentTransactional && (
                    <svg width="10" height="7" viewBox="0 0 10 7" fill="none" style={{ display: "block", margin: "3px auto 0" }}>
                      <path d="M1 3.5L3.8 6 9 1" stroke="#0A0A0A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: 1.5, fontFamily: "var(--font-dm-sans)" }}>
                I agree to receive updates about this event, including registration confirmation and waitlist notifications. (Optional)
              </span>
            </label>

            <label style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start", cursor: "pointer" }}>
              <span style={{ position: "relative", flexShrink: 0, marginTop: "2px" }}>
                <input
                  id="consent-marketing"
                  type="checkbox"
                  checked={consentMarketing}
                  onChange={e => setConsentMarketing(e.target.checked)}
                  style={{ position: "absolute", opacity: 0, width: 16, height: 16, margin: 0, cursor: "pointer" }}
                />
                <span style={{
                  display: "block",
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  border: consentMarketing ? "1.5px solid #C8F55A" : "1.5px solid color-mix(in srgb, var(--text-primary) 18%, transparent)",
                  background: consentMarketing ? "#C8F55A" : "transparent",
                  flexShrink: 0,
                  transition: "background 0.15s, border 0.15s",
                }}>
                  {consentMarketing && (
                    <svg width="10" height="7" viewBox="0 0 10 7" fill="none" style={{ display: "block", margin: "3px auto 0" }}>
                      <path d="M1 3.5L3.8 6 9 1" stroke="#0A0A0A" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
              </span>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.5, fontFamily: "var(--font-dm-sans)" }}>
                I would like to hear about future events from this organiser. (Optional)
              </span>
            </label>

            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.5, margin: "0.25rem 0 0", fontFamily: "var(--font-dm-sans)" }}>
              Your data is protected under Kenya&apos;s Data Protection Act 2019. We never sell your information.
            </p>
          </div>
        </div>
      </div>

      <label className="flex items-center gap-3 rounded-[18px] px-4 py-4" style={questionCardStyle}>
        <input
          id="send-response-copy"
          type="checkbox"
          checked={sendResponseCopy}
          onChange={e => setSendResponseCopy(e.target.checked)}
          className="h-4 w-4 rounded text-[#C8F55A] focus:ring-[#C8F55A]"
          style={{ borderColor: "color-mix(in srgb, var(--text-primary) 20%, transparent)", background: "var(--bg-input)" }}
        />
        <span className="flex items-center gap-2 text-[0.9rem]" style={{ fontFamily: "var(--font-dm-sans)", color: "var(--text-primary)" }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--text-secondary)", flexShrink: 0 }}>
            <rect x="1.5" y="3" width="13" height="10" rx="2" />
            <path d="M2 4l6 4 6-4" />
          </svg>
          <span>Send me a copy of my responses.</span>
        </span>
      </label>

      <div className="flex items-center justify-between gap-4 border-t pt-4" style={{ borderColor: "color-mix(in srgb, var(--text-primary) 8%, transparent)" }}>
        <button
          type="submit"
          className={`rounded-[10px] px-5 py-3 text-[0.875rem] font-semibold shadow-[0_8px_20px_rgba(200,245,90,0.2)] transition-transform ${isSubmitBlocked ? 'bg-[#C8F55A] text-[#0A0A0A] opacity-60 cursor-not-allowed' : 'bg-[#C8F55A] text-[#0A0A0A] hover:translate-y-[-1px]'}`}
          disabled={isSubmitBlocked}
        >
          {deadlineExpired ? "Registration closed" : loading ? "Submitting..." : event.isPaid ? "Paid registration paused" : attendees.length > 1 ? `Submit ${attendees.length} responses` : "Submit"}
        </button>
        <button
          type="button"
          onClick={() => void clearForm()}
          className="text-[0.9rem]"
          style={{ fontFamily: "var(--font-dm-sans)", color: "var(--text-secondary)" }}
        >
          Clear form
        </button>
      </div>
      <div className="flex flex-col gap-2 text-center">
        <p className="m-0 text-[0.76rem]" style={{ color: "var(--text-muted)" }}>
          Never submit passwords or sensitive financial credentials through this form.
        </p>
        <p className="m-0 text-[0.76rem] leading-6" style={{ color: "var(--text-muted)" }}>
          By submitting, you acknowledge the organiser&apos;s event notice and EventSlot&apos;s <a href="/privacy" target="_blank" rel="noreferrer" className="text-[#C8F55A] underline-offset-2 hover:underline">Privacy Policy</a> and <a href="/terms" target="_blank" rel="noreferrer" className="text-[#C8F55A] underline-offset-2 hover:underline">Terms of Service</a>.
        </p>
        <p className="m-0 text-[0.76rem] leading-6" style={{ color: "var(--text-muted)" }}>
          This form is created by the event organiser and hosted through EventSlot. It is not attendee account signup.
        </p>
      </div>
      {error && <div className="mt-2 text-[0.82rem] text-[#FF6B6B] text-center">{error}</div>}
        </div>
      </form>
      {showBranding && <BrandingFooter />}
    </div>
  )
}
