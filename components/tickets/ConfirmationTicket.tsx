"use client"

import { useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import { TierBadge } from "@/components/TierBadge"

export type TicketData = {
  confirmationCode: string
  eventTitle: string
  eventDate: string | null
  attendanceDays?: string | null
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
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(ticket.verifyUrl, {
      width: 220,
      margin: 2,
      color: { dark: "#0A0A0A", light: "#FFFFFF" },
    })
      .then((url) => setQrDataUrl(url))
      .catch(console.error)
  }, [ticket.verifyUrl])

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(ticket.confirmationCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback if clipboard API unavailable
    }
  }

  const handleDownload = async () => {
    if (!cardRef.current) return
    setDownloading(true)
    try {
      const [html2canvas, { default: jsPDF }] = await Promise.all([
        import("html2canvas").then((m) => m.default),
        import("jspdf"),
      ])
      const canvas = await html2canvas(cardRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: null,
      })
      const imgData = canvas.toDataURL("image/png")
      const pxToMm = (px: number) => px * 0.264583
      const w = pxToMm(canvas.width)
      const h = pxToMm(canvas.height)
      const pdf = new jsPDF({
        orientation: w > h ? "landscape" : "portrait",
        unit: "mm",
        format: [w, h],
      })
      pdf.addImage(imgData, "PNG", 0, 0, w, h)
      pdf.save(`ticket-${ticket.confirmationCode}.pdf`)
    } catch (err) {
      console.error("PDF generation failed:", err)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={{ fontFamily: "var(--font-dm-sans, system-ui, sans-serif)", width: "100%" }}>
      {/* ── Credential Card ── */}
      <div
        ref={cardRef}
        style={{
          width: "100%",
          maxWidth: 440,
          margin: "0 auto",
          background: "var(--surface)",
          border: "1px solid rgba(200,245,90,0.25)",
          borderRadius: 20,
          position: "relative",
          boxShadow: "0 14px 45px rgba(0,0,0,0.28)",
          overflow: "hidden",
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            padding: "1.1rem 1.4rem 0.9rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
            background: "color-mix(in srgb, var(--surface) 92%, var(--accent) 8%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--accent, #C8F55A)",
              }}
            >
              EventSlot Credential
            </span>
          </div>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.22rem 0.65rem",
              borderRadius: 999,
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              background: "rgba(34, 197, 94, 0.16)",
              color: "#22c55e",
              border: "1px solid rgba(34, 197, 94, 0.35)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#22c55e",
                display: "inline-block",
              }}
            />
            Confirmed
          </span>
        </div>

        {/* Main Event Details */}
        <div style={{ padding: "1.4rem 1.4rem 1.2rem" }}>
          <h2
            style={{
              fontSize: "1.35rem",
              fontWeight: 600,
              color: "var(--text-primary)",
              margin: "0 0 0.75rem",
              lineHeight: 1.25,
              fontFamily: "var(--font-instrument-serif, Georgia, serif)",
              letterSpacing: "-0.01em",
            }}
          >
            {ticket.eventTitle}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {ticket.eventDate && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.85rem", lineHeight: 1.2 }}>📅</span>
                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.35 }}>
                  {ticket.eventDate}
                </span>
              </div>
            )}

            {ticket.attendanceDays && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.85rem", lineHeight: 1.2 }}>🗓️</span>
                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.35 }}>
                  Attending: <strong style={{ color: "var(--text-primary)" }}>{ticket.attendanceDays}</strong>
                </span>
              </div>
            )}

            {ticket.eventLocation && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.85rem", lineHeight: 1.2 }}>📍</span>
                <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.35 }}>
                  {ticket.eventLocation}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Attendee & Tier Row */}
        <div
          style={{
            padding: "1.1rem 1.4rem",
            background: "color-mix(in srgb, var(--surface) 95%, var(--text-primary) 5%)",
            borderTop: "1px solid var(--border-subtle, rgba(255,255,255,0.06))",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            gap: "0.25rem",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontSize: "0.65rem",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                margin: "0 0 0.25rem",
                fontWeight: 700,
              }}
            >
              Attendee
            </p>
            <p
              style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                color: "var(--text-primary)",
                margin: 0,
                textAlign: "center",
                lineHeight: 1.3,
              }}
            >
              {ticket.attendeeName || "Event Guest"}
            </p>
          </div>

          {(ticket.ticketTierName || ticket.amountPaidKes) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "0.35rem", flexWrap: "wrap" }}>
              {ticket.ticketTierName && (
                <TierBadge
                  name={ticket.ticketTierName}
                  badgeColor={ticket.ticketTierBadgeColor ?? "#A8A9AD"}
                  textColor={ticket.ticketTierTextColor ?? "#1A1A1A"}
                  metallic={Boolean(ticket.ticketTierMetallic)}
                  size="md"
                />
              )}
              {ticket.amountPaidKes ? (
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500 }}>
                  KES {ticket.amountPaidKes.toLocaleString()} Paid
                </span>
              ) : null}
            </div>
          )}
        </div>

        {/* Ticket Perforated Divider with Notches */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            margin: "0.5rem 0",
            overflow: "hidden",
          }}
        >
          {/* Left Notch */}
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "var(--bg-page, #0A0A0A)",
              marginLeft: -9,
              flexShrink: 0,
              boxShadow: "inset -1px 0 2px rgba(0,0,0,0.3)",
            }}
          />
          {/* Dashed Line */}
          <div
            style={{
              flex: 1,
              borderTop: "1.5px dashed rgba(200,245,90,0.3)",
              margin: "0 0.4rem",
            }}
          />
          {/* Right Notch */}
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "var(--bg-page, #0A0A0A)",
              marginRight: -9,
              flexShrink: 0,
              boxShadow: "inset 1px 0 2px rgba(0,0,0,0.3)",
            }}
          />
        </div>

        {/* QR Code & Scan Area */}
        <div
          style={{
            padding: "0.75rem 1.4rem 1.4rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* Dedicated High-Contrast QR Plate */}
          <div
            style={{
              background: "#FFFFFF",
              padding: "0.75rem",
              borderRadius: 14,
              boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "0.75rem",
            }}
          >
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrDataUrl}
                alt={`Scan to verify ticket ${ticket.confirmationCode}`}
                width={170}
                height={170}
                style={{
                  display: "block",
                  borderRadius: 4,
                  maxWidth: "100%",
                  height: "auto",
                }}
              />
            ) : (
              <div
                style={{
                  width: 170,
                  height: 170,
                  background: "#F3F4F6",
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9CA3AF",
                  fontSize: "0.75rem",
                }}
              >
                Generating QR...
              </div>
            )}
          </div>

          <p
            style={{
              fontSize: "0.65rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              margin: "0 0 0.85rem",
              textAlign: "center",
            }}
          >
            Scan at entry · Gate check-in
          </p>

          {/* Monospace Confirmation Code Container */}
          <div
            style={{
              width: "100%",
              maxWidth: 320,
              padding: "0.6rem 0.85rem",
              borderRadius: 10,
              background: "color-mix(in srgb, var(--surface) 90%, var(--text-primary) 10%)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <p
                style={{
                  fontSize: "0.58rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  margin: "0 0 0.15rem",
                  fontWeight: 600,
                }}
              >
                Confirmation Code
              </p>
              <p
                style={{
                  fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, monospace)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  color: "var(--accent, #C8F55A)",
                  margin: 0,
                  lineHeight: 1.2,
                }}
              >
                {ticket.confirmationCode}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyCode}
              title="Copy confirmation code"
              style={{
                background: copied ? "rgba(34, 197, 94, 0.2)" : "rgba(255,255,255,0.06)",
                border: copied ? "1px solid #22c55e" : "1px solid var(--border)",
                borderRadius: 6,
                padding: "0.35rem 0.6rem",
                color: copied ? "#22c55e" : "var(--text-secondary)",
                fontSize: "0.68rem",
                fontWeight: 600,
                fontFamily: "inherit",
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
              }}
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Action: Download Ticket ── */}
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          margin: "1.25rem auto 0",
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
        }}
      >
        <button
          onClick={handleDownload}
          disabled={downloading || !qrDataUrl}
          style={{
            width: "100%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
            background: downloading || !qrDataUrl ? "rgba(200,245,90,0.35)" : "#C8F55A",
            color: "#0A0A0A",
            border: "none",
            borderRadius: 12,
            padding: "0.75rem 1.5rem",
            fontSize: "0.88rem",
            fontWeight: 700,
            fontFamily: "inherit",
            cursor: downloading || !qrDataUrl ? "not-allowed" : "pointer",
            boxShadow: "0 4px 16px rgba(200,245,90,0.22)",
            transition: "all 0.15s ease",
          }}
        >
          {downloading ? (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              <span>Generating PDF...</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Download Ticket as PDF</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}
