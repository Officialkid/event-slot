"use client"

import React, { useEffect, useState } from "react"
import CountdownTimer from "@/components/CountdownTimer"
import { TierBadge } from "@/components/TierBadge"
import { getCommunityLinkLabel, normalizeCommunityLink } from "@/lib/communityLink"

type EventQuestion = {
  id: string
  label: string
  type: string
  options?: string[]
  required: boolean
  allowMultiple?: boolean
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
  consentTransactional: boolean
  consentMarketing: boolean
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
  const [consentTransactional, setConsentTransactional] = useState(false)
  const [consentMarketing, setConsentMarketing] = useState(false)
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
  const [selectedTierId, setSelectedTierId] = useState<string>(event.ticketTiers?.[0]?.id ?? "")
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "card">("mpesa")
  const [mpesaPhone, setMpesaPhone] = useState("")
  const [paidCheckout, setPaidCheckout] = useState<PaidCheckoutResponse | null>(null)
  const [paymentPolling, setPaymentPolling] = useState(false)
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
  const fieldClassName = "mt-1 w-full rounded-[10px] bg-[rgba(255,255,255,0.04)] border border-[rgba(240,237,230,0.16)] px-3 py-2.5 text-[#F0EDE6] text-[0.875rem] placeholder:text-[rgba(240,237,230,0.45)] focus:border-[rgba(200,245,90,0.62)] focus:outline-none focus:ring-2 focus:ring-[rgba(200,245,90,0.15)]"
  const subtleLabelClassName = "mb-1 block text-[0.72rem] font-semibold text-[rgba(240,237,230,0.82)] tracking-[0.04em]"

  const canAddMore = !event.isPaid && attendees.length < maxAttendees
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
      setError("Paid-event checkout is under maintenance right now. Please try again once payments return.")
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
            consentTransactional,
            consentMarketing,
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
            consentTransactional,
            consentMarketing,
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
            consentTransactional,
            consentMarketing,
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

  if (paidCheckout) {
    return (
      <div className="mx-auto w-full max-w-[480px]">
        <div className="rounded-[12px] border border-[rgba(255,184,77,0.2)] bg-[#141414] p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(255,184,77,0.3)] bg-[rgba(255,184,77,0.08)]">
            <span className="text-[#FFB84D] text-xl">₿</span>
          </div>
          <h2 className="text-[1.5rem] text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
            Complete payment on your phone
          </h2>
          <p className="mt-3 text-[0.9rem] text-[rgba(240,237,230,0.55)]" style={{ fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
            We sent an M-Pesa STK push for <strong style={{ color: "#F0EDE6" }}>KES {paidCheckout.amountKes.toLocaleString()}</strong> for the <strong style={{ color: "#F0EDE6" }}>{paidCheckout.ticketTierName}</strong> ticket.
          </p>
          <p className="mt-3 text-[0.82rem] text-[#C8F55A]" style={{ fontFamily: "var(--font-dm-sans)" }}>
            {paidCheckout.customerMessage}
          </p>
          <p className="mt-5 text-[0.78rem] text-[rgba(240,237,230,0.35)]" style={{ fontFamily: "var(--font-dm-sans)" }}>
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
          <div key={i} className="rounded-[12px] border border-[rgba(240,237,230,0.08)] bg-[#141414] p-8">
            {r.status === "confirmed" ? (
              <>
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)]">
                  <span className="block h-3 w-5 rotate-[-45deg] border-b-4 border-l-4 border-[#C8F55A]" />
                </div>
                <h2 className="text-center text-[1.6rem] text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)", fontWeight: 400 }}>
                  {isSingle ? "You're in!" : `Attendee ${i + 1} — You're in!`}
                </h2>
                <p className="mx-auto mt-3 max-w-[360px] text-center text-[0.95rem] text-[rgba(240,237,230,0.6)]" style={{ fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
                  Thank you for registering for {event.title}. Your slot is confirmed and we look forward to seeing you.
                </p>
                <div className="mt-4 flex justify-center">
                  <span className="rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.12)] px-3 py-1 text-[0.7rem] text-[#C8F55A]">
                    Confirmed
                  </span>
                </div>
                {r.registrationNumber && (
                  <p className="mt-3 text-center text-[0.72rem] text-[rgba(240,237,230,0.35)]" style={{ fontFamily: "var(--font-dm-sans)" }}>
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
                      View &amp; Download Ticket →
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
                <h2 className="text-center text-[1.6rem] text-[#F0EDE6]" style={{ fontFamily: "var(--font-instrument-serif)", fontWeight: 400 }}>
                  {isSingle ? "You're on the waitlist" : `Attendee ${i + 1} — Waitlist`}
                </h2>
                <p className="mx-auto mt-3 max-w-[360px] text-center text-[0.95rem] text-[rgba(240,237,230,0.6)]" style={{ fontFamily: "var(--font-dm-sans)", lineHeight: 1.6 }}>
                  Thank you for your interest in {event.title}. You are currently position #{r.waitlistPosition} on the waitlist. We will notify you if a slot opens up.
                </p>
                <div className="mt-4 flex justify-center">
                  <span className="rounded-full border border-[rgba(240,237,230,0.15)] bg-[rgba(240,237,230,0.06)] px-3 py-1 text-[0.7rem] text-[rgba(240,237,230,0.55)]">
                    Waitlist #{r.waitlistPosition}
                  </span>
                </div>
                {r.registrationNumber && (
                  <p className="mt-3 text-center text-[0.72rem] text-[rgba(240,237,230,0.35)]" style={{ fontFamily: "var(--font-dm-sans)" }}>
                    Registration #{String(r.registrationNumber).padStart(4, "0")}
                  </p>
                )}
                {/* Waitlist email capture (if event has no email question) */}
                {!hasEmailQuestion && !waitlistEmailSaved[r.registrationId] && (
                  <div style={{ marginTop: "1.25rem", background: "rgba(240,237,230,0.04)", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 10, padding: "1rem" }}>
                    <p style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", marginBottom: "0.625rem", lineHeight: 1.5 }}>
                      Enter your email to be notified when a slot opens up:
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
                        style={{ flex: 1, minWidth: 0, background: "#0A0A0A", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.5rem 0.75rem", fontSize: "0.82rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", outline: "none" }}
                      />
                      <button
                        type="button"
                        onClick={() => saveWaitlistEmail(r.registrationId, waitlistEmails[r.registrationId] ?? "")}
                        disabled={waitlistEmailSaving[r.registrationId] || !(waitlistEmails[r.registrationId] ?? "").trim()}
                        style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.78rem", fontWeight: 600, color: "#0A0A0A", cursor: waitlistEmailSaving[r.registrationId] ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", whiteSpace: "nowrap", opacity: waitlistEmailSaving[r.registrationId] ? 0.7 : 1 }}
                      >
                        {waitlistEmailSaving[r.registrationId] ? "Saving…" : "Notify me"}
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
                    ✓ You will be notified when a slot opens.
                  </p>
                )}
              </>
            )}
            <div style={{ textAlign: "center", marginTop: "1rem", display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
              <a
                href={`/registration/${r.registrationId}`}
                style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.35)", textDecoration: "none" }}
              >
                View status
              </a>
              <a
                href={`/registration/${r.registrationId}/edit`}
                style={{ fontSize: "0.78rem", color: "rgba(200,245,90,0.5)", textDecoration: "none" }}
              >
                Edit your details →
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
    <div className="mx-auto w-full max-w-[560px]">
      {/* Duplicate warning dialog */}
      {duplicateInfo && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 99, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ background: "#1A1A1A", border: "0.5px solid rgba(240,237,230,0.12)", borderRadius: 16, padding: "1.75rem", width: "min(92vw,460px)" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,168,0,0.12)", border: "0.5px solid rgba(255,168,0,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M9 2L16.5 15H1.5L9 2z" stroke="#FFA800" strokeWidth="1.25" strokeLinejoin="round" />
                <path d="M9 7v4" stroke="#FFA800" strokeWidth="1.25" strokeLinecap="round" />
                <circle cx="9" cy="13" r="0.75" fill="#FFA800" />
              </svg>
            </div>
            <h3 style={{ fontFamily: "var(--font-instrument-serif)", fontSize: "1.2rem", color: "#F0EDE6", marginBottom: "0.5rem" }}>Similar registration found</h3>
            <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.5)", fontFamily: "var(--font-dm-sans)", marginBottom: "1rem", lineHeight: 1.6 }}>
              We found a registration in our system with identical details{duplicateInfo.attendeeIndex > 0 ? ` (attendee ${duplicateInfo.attendeeIndex + 1})` : ""}:
            </p>
            <div style={{ background: "rgba(240,237,230,0.04)", border: "0.5px solid rgba(240,237,230,0.1)", borderRadius: 10, padding: "0.875rem 1rem", marginBottom: "1.25rem" }}>
              {duplicateInfo.registrationNumber !== null && (
                <p style={{ fontSize: "0.82rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", marginBottom: "0.25rem" }}>
                  Registration #{String(duplicateInfo.registrationNumber).padStart(4, "0")}
                </p>
              )}
              {duplicateInfo.name && (
                <p style={{ fontSize: "0.82rem", color: "#F0EDE6", fontFamily: "var(--font-dm-sans)", marginBottom: "0.25rem" }}>
                  Name: {duplicateInfo.name}
                </p>
              )}
              {duplicateInfo.maskedPhone && (
                <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.6)", fontFamily: "var(--font-dm-sans)" }}>
                  Phone: {duplicateInfo.maskedPhone}
                </p>
              )}
            </div>
            <p style={{ fontSize: "0.82rem", color: "rgba(240,237,230,0.55)", fontFamily: "var(--font-dm-sans)", marginBottom: "1.25rem", lineHeight: 1.6 }}>
              Is this the same person — or a different person with the same details?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
              <button
                onClick={() => { setDuplicateInfo(null); setPendingPayload(null) }}
                style={{ background: "transparent", border: "0.5px solid rgba(240,237,230,0.15)", borderRadius: 8, padding: "0.6rem 1rem", fontSize: "0.82rem", color: "rgba(240,237,230,0.6)", cursor: "pointer", fontFamily: "var(--font-dm-sans)", textAlign: "left" }}
              >
                Same person — cancel, I&apos;m already registered
              </button>
              <button
                onClick={handleForceRegister}
                disabled={loading}
                style={{ background: "#C8F55A", border: "none", borderRadius: 8, padding: "0.6rem 1rem", fontSize: "0.82rem", fontWeight: 600, color: "#0A0A0A", cursor: loading ? "not-allowed" : "pointer", fontFamily: "var(--font-dm-sans)", textAlign: "left", opacity: loading ? 0.7 : 1 }}
              >
                Different person — register anyway
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

      <form onSubmit={handleSubmit} className="w-full rounded-[16px] border border-[rgba(240,237,230,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.01)_100%)] p-5 sm:p-7 space-y-6 shadow-[0_16px_36px_rgba(0,0,0,0.25)] backdrop-blur-sm">
        <p style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.6)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Registration form
        </p>

        {event.isPaid && (
          <div className="space-y-4 rounded-[12px] border border-[rgba(255,184,77,0.22)] bg-[rgba(255,184,77,0.05)] p-4">
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-[#FFB84D]">Paid Ticket</p>
              <p className="mt-1 text-[0.82rem] text-[rgba(240,237,230,0.5)]">
                Sorry, this service is under maintenance and will be coming soon.
              </p>
            </div>

            <div className="rounded-[12px] border border-[rgba(255,184,77,0.18)] bg-[rgba(10,10,10,0.18)] p-4">
              <p className="text-[0.84rem] font-semibold text-[#F0EDE6]">
                Paid-event checkout is temporarily unavailable.
              </p>
              <p className="mt-2 text-[0.78rem] leading-7 text-[rgba(240,237,230,0.62)]">
                We are still working on the live payment setup. To avoid failed payments or confusion, paid registrations are paused for now.
              </p>
            </div>
          </div>
        )}

        {/* Bulk prompt row */}
      <div className="flex items-center justify-between rounded-[10px] border border-[rgba(240,237,230,0.1)] bg-[rgba(255,255,255,0.02)] px-3 py-2.5">
        <span style={{ fontSize: "0.8rem", color: "rgba(240,237,230,0.75)", fontFamily: "var(--font-dm-sans)" }}>
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
        <div key={attendeeIndex}>
          {/* Divider between attendees */}
          {attendeeIndex > 0 && (
            <div style={{ borderTop: "0.5px solid rgba(240,237,230,0.1)", margin: "1.25rem 0" }} />
          )}

          {/* Attendee header */}
          <div className="flex items-center justify-between mb-3">
            <span style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.62)", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-dm-sans)" }}>
              Attendee {attendeeIndex + 1}
            </span>
            {attendeeIndex > 0 && (
              <button
                type="button"
                onClick={() => removeAttendee(attendeeIndex)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "rgba(240,237,230,0.35)",
                  cursor: "pointer",
                  fontSize: "1rem",
                  lineHeight: 1,
                  padding: "0 2px",
                }}
                aria-label="Remove attendee"
              >
                ×
              </button>
            )}
          </div>

          {/* Questions for this attendee */}
          <div className="space-y-4">
            {/* System email field — always collected when organiser hasn't added an email question */}
            {!hasEmailQuestion && (
              <div>
                <label className={subtleLabelClassName}>
                  Email address <span style={{ fontWeight: 400, color: "rgba(240,237,230,0.3)" }}>(for your ticket)</span>
                </label>
                <input
                  type="email"
                  placeholder="your@email.com"
                  className={fieldClassName}
                  value={baseEmails[attendeeIndex] ?? ""}
                  onChange={e => setBaseEmails(prev => { const next = [...prev]; next[attendeeIndex] = e.target.value; return next })}
                />
              </div>
            )}
            {event.questions.map(q => (
              <div key={q.id}>
                <label className={subtleLabelClassName}>
                  {q.label}{q.required && <span className="text-[#C8F55A]"> *</span>}
                </label>
                {q.type === "text" && (
                  <input
                    type="text"
                    className={fieldClassName}
                    required={q.required}
                    value={form[q.id]}
                    onChange={e => handleChange(attendeeIndex, q.id, e.target.value)}
                  />
                )}
                {q.type === "email" && (
                  <input
                    type="email"
                    className={fieldClassName}
                    required={q.required}
                    value={form[q.id]}
                    onChange={e => handleChange(attendeeIndex, q.id, e.target.value)}
                  />
                )}
                {q.type === "phone" && (
                  <input
                    type="tel"
                    className={fieldClassName}
                    required={q.required}
                    value={form[q.id]}
                    onChange={e => handleChange(attendeeIndex, q.id, e.target.value)}
                  />
                )}
                {q.type === "select" && (
                  <select
                    className={fieldClassName}
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
                )}
                {q.type === "checkbox" && (
                  <div className="mt-1 space-y-2 rounded-[10px] border border-[rgba(240,237,230,0.12)] bg-[rgba(255,255,255,0.02)] px-3 py-3">
                    {q.options?.map(opt => {
                      const selectedValues = parseCheckboxValue(form[q.id])
                      const isChecked = selectedValues.includes(opt)
                      return (
                        <label key={`${q.id}-${opt}`} className="flex cursor-pointer items-center gap-2 text-[0.85rem] text-[#F0EDE6]">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => {
                              const nextValues = e.target.checked
                                ? (q.allowMultiple ? [...selectedValues, opt] : [opt])
                                : selectedValues.filter(value => value !== opt)
                              handleChange(attendeeIndex, q.id, serializeCheckboxValue(nextValues))
                            }}
                            className="h-4 w-4 rounded border border-[rgba(240,237,230,0.2)] bg-[#141414] text-[#C8F55A] focus:ring-[#C8F55A]"
                          />
                          <span>{opt}</span>
                        </label>
                      )
                    })}
                    {q.required && parseCheckboxValue(form[q.id]).length === 0 && (
                      <p className="text-[0.72rem] text-[rgba(240,237,230,0.35)]">Select at least one option.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Consent checkboxes */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", paddingTop: "0.25rem" }}>
        {/* Checkbox 1 — Optional */}
        <label style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start", cursor: "pointer" }}>
          <span style={{ position: "relative", flexShrink: 0, marginTop: "2px" }}>
            <input
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
              border: consentTransactional ? "1.5px solid #C8F55A" : "1.5px solid rgba(240,237,230,0.2)",
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
          <span style={{ fontSize: "0.8rem", color: "rgba(240,237,230,0.6)", lineHeight: 1.5, fontFamily: "var(--font-dm-sans)" }}>
            I agree to receive updates about this event, including registration confirmation and waitlist notifications. (Optional)
          </span>
        </label>

        {/* Checkbox 2 — Optional */}
        <label style={{ display: "flex", gap: "0.65rem", alignItems: "flex-start", cursor: "pointer" }}>
          <span style={{ position: "relative", flexShrink: 0, marginTop: "2px" }}>
            <input
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
              border: consentMarketing ? "1.5px solid #C8F55A" : "1.5px solid rgba(240,237,230,0.2)",
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
          <span style={{ fontSize: "0.8rem", color: "rgba(240,237,230,0.45)", lineHeight: 1.5, fontFamily: "var(--font-dm-sans)" }}>
            I would like to hear about future events from this organiser. (Optional)
          </span>
        </label>

        {/* Privacy note */}
        <p style={{ fontSize: "0.7rem", color: "rgba(240,237,230,0.25)", lineHeight: 1.5, margin: "0.25rem 0 0", fontFamily: "var(--font-dm-sans)" }}>
          Your data is protected under Kenya&apos;s Data Protection Act 2019. We never sell your information.
        </p>
      </div>

      <button
        type="submit"
        className={`w-full rounded-full px-5 py-3 text-[0.875rem] font-semibold shadow-[0_8px_20px_rgba(200,245,90,0.2)] transition-transform ${(loading || deadlineExpired) ? 'bg-[#C8F55A] text-[#0A0A0A] opacity-60 cursor-not-allowed' : 'bg-[#C8F55A] text-[#0A0A0A] hover:translate-y-[-1px]'}`}
        disabled={loading || deadlineExpired}
      >
        {deadlineExpired ? "Registration closed" : loading ? "Submitting..." : event.isPaid ? "Paid registration paused" : attendees.length > 1 ? `Register ${attendees.length} attendees` : "Register"}
      </button>
      {error && <div className="mt-2 text-[0.82rem] text-[#FF6B6B] text-center">{error}</div>}
      </form>
      {showBranding && <BrandingFooter />}
    </div>
  )
}
