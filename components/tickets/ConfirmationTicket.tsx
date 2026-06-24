"use client"

import { useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import { TierBadge } from "@/components/TierBadge"

export type TicketData = {
  confirmationCode: string
  eventTitle: string
  eventDate: string | null
  eventLocation: string | null
  attendeeName: string
  attendeeEmail: string | null
  attendeePhone: string | null
  ticketTierName?: string | null
  ticketTierBadgeColor?: string | null
  ticketTierTextColor?: string | null
  ticketTierMetallic?: boolean | null
  amountPaidKes?: number | null
  verifyUrl: string
}

export default function ConfirmationTicket({ ticket }: { ticket: TicketData }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [qrDataUrl, setQrDataUrl] = useState<string>("")
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(ticket.verifyUrl, { width: 136, margin: 1, color: { dark: "#0A0A0A", light: "#FAFAF7" } })
      .then((url) => setQrDataUrl(url))
      .catch(console.error)
  }, [ticket.verifyUrl])

  const handleDownload = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const [html2canvas, { default: jsPDF }] = await Promise.all([
        import("html2canvas").then((m) => m.default),
        import("jspdf"),
      ])
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      })
      const imgData = canvas.toDataURL("image/png")
      const pxToMm = (px: number) => px * 0.264583
      const w = pxToMm(canvas.width)
      const h = pxToMm(canvas.height)
      const pdf = new jsPDF({ orientation: w > h ? "landscape" : "portrait", unit: "mm", format: [w, h] })
      pdf.addImage(imgData, "PNG", 0, 0, w, h)
      pdf.save(`ticket-${ticket.confirmationCode}.pdf`)
    } catch (err) {
      console.error("PDF generation failed:", err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)" }}>

      {/* Ticket card — captured for PDF */}
      <div
        ref={cardRef}
        style={{
          background: "#111111",
          border: "1px solid rgba(200,245,90,0.25)",
          borderRadius: 16,
          overflow: "hidden",
          display: "flex",
          maxWidth: 640,
          margin: "0 auto",
          boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
        }}
      >
        {/* ── Left: event + attendee details ─────────────────────────────── */}
        <div style={{ flex: 1, padding: "1.75rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {/* Logo / brand */}
          <p style={{ fontSize: "0.65rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "#C8F55A", margin: "0 0 0.75rem", fontWeight: 600 }}>
            EventSlot · Ticket
          </p>

          {/* Event title */}
          <h2 style={{ fontSize: "1.15rem", fontWeight: 600, color: "#F0EDE6", margin: "0 0 0.5rem", lineHeight: 1.3, fontFamily: "var(--font-instrument-serif, Georgia, serif)" }}>
            {ticket.eventTitle}
          </h2>

          {/* Date / location */}
          {ticket.eventDate && (
            <p style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.55)", margin: "0 0 0.15rem" }}>
              📅 {ticket.eventDate}
            </p>
          )}
          {ticket.eventLocation && (
            <p style={{ fontSize: "0.78rem", color: "rgba(240,237,230,0.55)", margin: "0 0 0.75rem" }}>
              📍 {ticket.eventLocation}
            </p>
          )}

          <hr style={{ border: "none", borderTop: "0.5px solid rgba(240,237,230,0.1)", margin: "0.5rem 0" }} />

          {/* Attendee info */}
          {ticket.attendeeName && (
            <p style={{ fontSize: "0.82rem", color: "#F0EDE6", margin: "0.1rem 0", fontWeight: 500 }}>
              {ticket.attendeeName}
            </p>
          )}
          {ticket.attendeeEmail && (
            <p style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.45)", margin: "0.05rem 0" }}>
              {ticket.attendeeEmail}
            </p>
          )}
          {ticket.attendeePhone && (
            <p style={{ fontSize: "0.75rem", color: "rgba(240,237,230,0.45)", margin: "0.05rem 0" }}>
              {ticket.attendeePhone}
            </p>
          )}
          {(ticket.ticketTierName || ticket.amountPaidKes) && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
              {ticket.ticketTierName && (
                <TierBadge
                  name={ticket.ticketTierName}
                  badgeColor={ticket.ticketTierBadgeColor ?? "#A8A9AD"}
                  textColor={ticket.ticketTierTextColor ?? "#1A1A1A"}
                  metallic={Boolean(ticket.ticketTierMetallic)}
                  size="lg"
                />
              )}
              {ticket.amountPaidKes ? (
                <span style={{ fontSize: "0.72rem", color: "rgba(240,237,230,0.5)" }}>
                  Paid KES {ticket.amountPaidKes.toLocaleString()}
                </span>
              ) : null}
            </div>
          )}

          <hr style={{ border: "none", borderTop: "0.5px solid rgba(240,237,230,0.1)", margin: "0.75rem 0 0.5rem" }} />

          {/* Confirmation code */}
          <p style={{ fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(240,237,230,0.4)", margin: "0 0 0.25rem" }}>
            Confirmation Code
          </p>
          <p style={{ fontFamily: "monospace", fontSize: "1rem", letterSpacing: "0.2em", color: "#C8F55A", fontWeight: 700, margin: 0 }}>
            {ticket.confirmationCode}
          </p>
        </div>

        {/* ── Dashed divider ──────────────────────────────────────────────── */}
        <div style={{ width: 1, borderLeft: "1.5px dashed rgba(200,245,90,0.25)", margin: "1.25rem 0", flexShrink: 0 }} />

        {/* ── Right: QR code ──────────────────────────────────────────────── */}
        <div style={{ width: 168, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1.5rem 1.25rem", gap: "0.75rem" }}>
          {qrDataUrl ? (
            // Plain <img> is required here — html2canvas does not capture Next.js
            // Image components reliably when they wrap data: URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="Scan to verify"
              width={118}
              height={118}
              style={{ borderRadius: 8, display: "block", maxWidth: "100%" }}
            />
          ) : (
            <div style={{ width: 118, height: 118, background: "rgba(240,237,230,0.06)", borderRadius: 8 }} />
          )}
          <p style={{ fontSize: "0.6rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(240,237,230,0.35)", textAlign: "center", margin: 0 }}>
            Scan to verify
          </p>
        </div>
      </div>

      {/* Download button */}
      <div style={{ maxWidth: 640, margin: "1.25rem auto 0", display: "flex", justifyContent: "center" }}>
        <button
          onClick={handleDownload}
          disabled={downloading || !qrDataUrl}
          style={{
            background: downloading || !qrDataUrl ? "rgba(200,245,90,0.35)" : "#C8F55A",
            color: "#0A0A0A",
            border: "none",
            borderRadius: 8,
            padding: "0.6rem 1.5rem",
            fontSize: "0.85rem",
            fontWeight: 600,
            fontFamily: "inherit",
            cursor: downloading || !qrDataUrl ? "not-allowed" : "pointer",
            transition: "background 0.15s",
          }}
        >
          {downloading ? "Generating PDF…" : "Download Ticket as PDF"}
        </button>
      </div>
    </div>
  )
}
