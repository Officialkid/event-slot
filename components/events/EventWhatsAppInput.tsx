"use client"

import { useEffect, useMemo, useState } from "react"
import { Eye, EyeOff, MessageCircle, Phone, CheckCircle2, AlertCircle } from "lucide-react"
import { toTelHref, toWhatsAppHref, type EventContactMode } from "@/lib/eventContact"

interface Props {
  eventSlug: string
  eventTitle: string
  eventDate?: string | null
  initialNumber?: string | null
  initialMode?: EventContactMode
  onChange?: (value: { number: string; mode: EventContactMode }) => void
  onSaved?: (value: { number: string; mode: EventContactMode }) => void
}

function formatDateForMessage(value?: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function EventWhatsAppInput({
  eventSlug,
  eventTitle,
  eventDate,
  initialNumber,
  initialMode = "WHATSAPP",
  onChange,
  onSaved,
}: Props) {
  const [number, setNumber] = useState(initialNumber ?? "")
  const [contactMode, setContactMode] = useState<EventContactMode>(initialMode)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    setNumber(initialNumber ?? "")
  }, [initialNumber])

  useEffect(() => {
    setContactMode(initialMode)
  }, [initialMode])

  const formattedDate = useMemo(() => formatDateForMessage(eventDate), [eventDate])
  const previewMessage = formattedDate
    ? `Hi, I have a question about "${eventTitle}" on ${formattedDate}.`
    : `Hi, I have a question about "${eventTitle}".`

  const sanitizedNumber = number.replace(/\D/g, "")
  const previewUrl = sanitizedNumber
    ? contactMode === "CALL"
      ? toTelHref(sanitizedNumber)
      : toWhatsAppHref(sanitizedNumber, previewMessage)
    : null

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setNumber(val)
    onChange?.({ number: val, mode: contactMode })
  }

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMode = e.target.value === "CALL" ? "CALL" : "WHATSAPP"
    setContactMode(nextMode)
    onChange?.({ number, mode: nextMode })
  }

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError("")

    try {
      const res = await fetch(`/api/events/${eventSlug}/whatsapp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsappNumber: number || null,
          contactMode,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data?.error || "Failed to save organiser contact")
        return
      }

      setNumber(data.whatsappNumber ?? "")
      const nextMode = data.contactMode === "CALL" ? "CALL" : "WHATSAPP"
      setContactMode(nextMode)
      onChange?.({ number: data.whatsappNumber ?? "", mode: nextMode })
      onSaved?.({ number: data.whatsappNumber ?? "", mode: nextMode })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError("Failed to save organiser contact")
    } finally {
      setSaving(false)
    }
  }

  const hasConfiguredContact = Boolean(number.trim())

  return (
    <div className="space-y-4 rounded-[12px] border p-6" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border ${contactMode === "CALL" ? "bg-[#C8F55A]/10 border-[#C8F55A]/30" : "bg-[#25D366]/10 border-[#25D366]/30"}`}>
            {contactMode === "CALL" ? (
              <Phone className="w-4 h-4 text-[#C8F55A]" />
            ) : (
              <MessageCircle className="w-4 h-4 text-[#25D366]" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Organizer Contact</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Optional - attendees can either WhatsApp you or call you directly about this event
            </p>
          </div>
        </div>

        {/* Prominent Live Status Badge */}
        {hasConfiguredContact ? (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.75rem] font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Active Contact
          </span>
        ) : (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.75rem] font-medium border border-neutral-700 bg-neutral-800/40 text-neutral-400">
            Not Configured
          </span>
        )}
      </div>

      {/* Visual Status Card */}
      {hasConfiguredContact ? (
        <div className="rounded-[10px] border p-3 flex items-center justify-between gap-2" style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)", borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)" }}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#C8F55A] shrink-0" />
            <div>
              <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                {contactMode === "CALL" ? "Direct Call Line Active" : "WhatsApp Chat Active"}
              </p>
              <p className="text-[0.78rem] font-mono text-[#C8F55A]">
                {number}
              </p>
            </div>
          </div>
          <span className="text-[0.7rem] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-[#C8F55A]/20 text-[#C8F55A]">
            Live on Event
          </span>
        </div>
      ) : (
        <div className="rounded-[10px] border p-3 flex items-center gap-2" style={{ background: "var(--surface-muted)", borderColor: "var(--border)" }}>
          <AlertCircle className="w-4 h-4 text-neutral-400 shrink-0" />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            No organizer contact currently displayed. Add a number below so attendees can reach out.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-xs" style={{ color: "var(--text-muted)" }}>
          Contact action
        </label>
        <select
          value={contactMode}
          onChange={handleModeChange}
          className="w-full rounded-[8px] border px-4 py-2.5 text-sm transition-colors focus:outline-none"
          style={{ background: "var(--surface-muted)", borderColor: "var(--border)", color: "var(--text-primary)" }}
        >
          <option value="WHATSAPP">Text on WhatsApp</option>
          <option value="CALL">Call organiser</option>
        </select>

        <label className="text-xs" style={{ color: "var(--text-muted)" }}>
          Organizer number (with country code, e.g. +254712345678)
        </label>
        <div className="flex gap-2">
          <input
            type="tel"
            value={number}
            onChange={handleNumberChange}
            placeholder="+254712345678 (leave blank to hide button)"
            className="flex-1 rounded-[8px] border px-4 py-2.5 text-sm placeholder:text-[var(--text-muted)] transition-colors focus:outline-none"
            style={{ background: "var(--surface-muted)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className={`px-4 py-2.5 text-sm font-bold rounded-[8px] transition-colors disabled:opacity-50 shrink-0 ${contactMode === "CALL" ? "bg-[#C8F55A] text-[#0A0A0A] hover:bg-[#b8e34f]" : "bg-[#25D366] text-white hover:bg-[#1fbe5a]"}`}
          >
            {saving ? "..." : saved ? "Saved" : "Save"}
          </button>
        </div>

        {error && <p className="text-[0.78rem] text-[#FF6B6B]">{error}</p>}

        <div className="flex items-start gap-2">
          <span className="text-[#F59E0B] text-xs mt-0.5">!</span>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            This number will be visible to anyone who views your event page. Use the full international format with country code. For example, use +254... instead of 07....
          </p>
        </div>
      </div>

      {number && previewUrl && (
        <div className="rounded-[8px] border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-muted)" }}>
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className="flex w-full items-center gap-2 text-xs transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {preview ? "Hide preview" : contactMode === "CALL" ? "See the call action" : "See what attendees will send you"}
          </button>
          {preview && (
            <div className="mt-3 rounded-lg p-3" style={{ background: "var(--surface)" }}>
              {contactMode === "CALL" ? (
                <>
                  <p className="mb-1 text-xs" style={{ color: "var(--text-muted)" }}>Public action:</p>
                  <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                    Attendees will see a Call organiser button. Tapping it opens the phone dialer and copies the number first.
                  </p>
                </>
              ) : (
                <>
                  <p className="mb-1 text-xs" style={{ color: "var(--text-muted)" }}>Pre-filled WhatsApp message:</p>
                  <p className="text-sm italic" style={{ color: "var(--text-primary)" }}>&ldquo;{previewMessage}&rdquo;</p>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
