"use client"

import { useMemo, useState } from "react"
import { Eye, EyeOff, MessageCircle } from "lucide-react"

interface Props {
  eventSlug: string
  eventTitle: string
  eventDate?: string | null
  initialNumber?: string | null
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
}: Props) {
  const [number, setNumber] = useState(initialNumber ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState(false)
  const [error, setError] = useState("")

  const formattedDate = useMemo(() => formatDateForMessage(eventDate), [eventDate])
  const previewMessage = formattedDate
    ? `Hi, I have a question about "${eventTitle}" on ${formattedDate}.`
    : `Hi, I have a question about "${eventTitle}".`

  const previewUrl = number
    ? `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(previewMessage)}`
    : null

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError("")

    try {
      const res = await fetch(`/api/events/${eventSlug}/whatsapp`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsappNumber: number || null }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data?.error || "Failed to save WhatsApp number")
        return
      }

      setNumber(data.whatsappNumber ?? "")
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch {
      setError("Failed to save WhatsApp number")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-[rgba(240,237,230,0.08)] rounded-[12px] p-6 bg-[#141414] space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#25D366]/10 border border-[#25D366]/30 flex items-center justify-center shrink-0">
          <MessageCircle className="w-4 h-4 text-[#25D366]" />
        </div>
        <div>
          <p className="text-[#F0EDE6] font-semibold text-sm">WhatsApp Contact</p>
          <p className="text-[rgba(240,237,230,0.35)] text-xs">
            Optional · Attendees can message you directly about this event
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-[rgba(240,237,230,0.45)]">
          WhatsApp number (with country code, e.g. 254712345678)
        </label>
        <div className="flex gap-2">
          <input
            type="tel"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="254712345678 (leave blank to hide button)"
            className="flex-1 bg-[#0A0A0A] border border-[rgba(240,237,230,0.12)] rounded-[8px] px-4 py-2.5 text-[#F0EDE6] text-sm placeholder:text-[rgba(240,237,230,0.25)] focus:outline-none focus:border-[#25D366]/50 transition-colors"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="px-4 py-2.5 bg-[#25D366] text-white text-sm font-bold rounded-[8px] hover:bg-[#1fbe5a] transition-colors disabled:opacity-50 shrink-0"
          >
            {saving ? "..." : saved ? "✓" : "Save"}
          </button>
        </div>

        {error && <p className="text-[0.78rem] text-[#FF6B6B]">{error}</p>}

        <div className="flex items-start gap-2">
          <span className="text-[#F59E0B] text-xs mt-0.5">!</span>
          <p className="text-[rgba(240,237,230,0.35)] text-xs leading-relaxed">
            This number will be visible to anyone who views your event page. Consider using a WhatsApp Business number or a dedicated events line.
          </p>
        </div>
      </div>

      {number && previewUrl && (
        <div className="border border-[rgba(240,237,230,0.08)] rounded-[8px] p-3 bg-[#0A0A0A]">
          <button
            type="button"
            onClick={() => setPreview(!preview)}
            className="flex items-center gap-2 text-xs text-[rgba(240,237,230,0.45)] hover:text-[rgba(240,237,230,0.7)] transition-colors w-full"
          >
            {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {preview ? "Hide preview" : "See what attendees will send you"}
          </button>
          {preview && (
            <div className="mt-3 bg-[#1E1E1E] rounded-lg p-3">
              <p className="text-[rgba(240,237,230,0.35)] text-xs mb-1">Pre-filled WhatsApp message:</p>
              <p className="text-[rgba(240,237,230,0.7)] text-sm">{previewMessage}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
