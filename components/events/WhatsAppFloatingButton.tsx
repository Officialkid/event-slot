"use client"

import { useState } from "react"
import { toTelHref, toWhatsAppHref, type EventContactMode } from "@/lib/eventContact"

interface Props {
  contactNumber: string
  contactMode: EventContactMode
  eventTitle: string
  eventDate?: string
}

export function WhatsAppFloatingButton({ contactNumber, contactMode, eventTitle, eventDate }: Props) {
  const [copied, setCopied] = useState(false)

  if (!contactNumber) return null

  const message = eventDate
    ? `Hi, I have a question about "${eventTitle}" on ${eventDate}.`
    : `Hi, I have a question about "${eventTitle}".`

  const isCall = contactMode === "CALL"
  const href = isCall ? toTelHref(contactNumber) : toWhatsAppHref(contactNumber, message)

  const handleCallClick = async () => {
    try {
      await navigator.clipboard.writeText(`+${contactNumber}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard support is best-effort only.
    }
  }

  return (
    <a
      href={href}
      target={isCall ? undefined : "_blank"}
      rel={isCall ? undefined : "noopener noreferrer"}
      onClick={isCall ? () => { void handleCallClick() } : undefined}
      className="fixed bottom-6 right-6 z-40 group"
      aria-label={isCall ? "Call organiser" : "Chat with organiser on WhatsApp"}
    >
      <span className={`absolute inset-0 rounded-full animate-ping opacity-25 ${isCall ? "bg-[#C8F55A]" : "bg-[#25D366]"}`} />

      <div className={`relative flex items-center gap-2 rounded-full pl-3 pr-4 py-3 text-sm font-medium text-white shadow-lg transition-colors ${isCall ? "bg-[#C8F55A] text-[#0A0A0A] hover:bg-[#b8e34f]" : "bg-[#25D366] hover:bg-[#1fbe5a]"}`}>
        {isCall ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path fill="currentColor" d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24a11.36 11.36 0 0 0 3.57.57c.56 0 1 .45 1 1V20a1 1 0 0 1-1 1C10.3 21 3 13.7 3 4a1 1 0 0 1 1-1h3.5c.55 0 1 .44 1 1c0 1.24.2 2.43.57 3.57c.11.35.03.74-.25 1.02z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-white" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
          </svg>
        )}
        <span>{isCall ? (copied ? "Number copied. Calling..." : "Call organiser") : "Chat with organiser"}</span>
      </div>
    </a>
  )
}
