"use client"

import React, { useState, useEffect, useCallback } from "react"

export interface PresentationSlide {
  id: string
  slideNumber: number
  badge: string
  title: string
  subtitle: string
  category: 'overview' | 'attendance' | 'timeline' | 'engagement' | 'strategy'
  highlights: { label: string; value: string; detail?: string }[]
  keyFindings: string[]
  committeeTakeaways: string[]
}

export interface PresentationDeck {
  deckTitle: string
  cohortLabel: string
  generatedAt: string
  organizationName: string
  totalEventsCovered: number
  slides: PresentationSlide[]
}

interface ExecutiveReportModalProps {
  isOpen: boolean
  onClose: () => void
  deck: PresentationDeck | null
  loading: boolean
  onRegenerate: () => void
}

export default function ExecutiveReportModal({
  isOpen,
  onClose,
  deck,
  loading,
  onRegenerate,
}: ExecutiveReportModalProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)

  // Keyboard slide navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault()
      setCurrentSlideIndex(prev => (deck ? Math.min(deck.slides.length - 1, prev + 1) : prev))
    } else if (e.key === "ArrowLeft") {
      e.preventDefault()
      setCurrentSlideIndex(prev => Math.max(0, prev - 1))
    } else if (e.key === "Escape") {
      onClose()
    }
  }, [isOpen, deck, onClose])

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen) return null

  const slides = deck?.slides ?? []
  const currentSlide = slides[currentSlideIndex]

  const handlePrint = () => {
    window.print()
  }

  return (
    <div
      className="executive-modal-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(10, 15, 12, 0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .executive-modal-backdrop,
          .executive-printable-deck,
          .executive-printable-deck * {
            visibility: visible !important;
          }
          .executive-modal-backdrop {
            position: absolute !important;
            inset: 0 !important;
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .executive-printable-deck {
            display: block !important;
            width: 100% !important;
          }
          .executive-slide-page {
            page-break-after: always !important;
            break-after: page !important;
            height: 100vh !important;
            max-height: 100vh !important;
            box-sizing: border-box !important;
            padding: 2.5rem !important;
            background: #ffffff !important;
            color: #111827 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* MODAL ACTION BAR */}
      <div
        className="no-print"
        style={{
          width: "100%",
          maxWidth: 1060,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.85rem",
          color: "#F9FAFB",
          fontFamily: "var(--font-dm-sans)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span
            style={{
              fontSize: "0.74rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "0.3rem 0.65rem",
              borderRadius: 6,
              background: "rgba(34, 197, 94, 0.2)",
              color: "#4ADE80",
              border: "1px solid rgba(34, 197, 94, 0.35)",
            }}
          >
            Board Meeting Deck
          </span>
          <span style={{ fontSize: "0.85rem", color: "#9CA3AF" }}>
            {deck?.cohortLabel}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <button
            onClick={onRegenerate}
            disabled={loading}
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#F3F4F6",
              borderRadius: 8,
              padding: "0.45rem 0.85rem",
              fontSize: "0.78rem",
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            🔄 {loading ? "Analyzing..." : "Re-Analyze with Gemini"}
          </button>

          <button
            onClick={handlePrint}
            style={{
              background: "#22C55E",
              color: "#052e16",
              border: "none",
              borderRadius: 8,
              padding: "0.45rem 1rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              boxShadow: "0 2px 10px rgba(34, 197, 94, 0.3)",
            }}
          >
            🖨️ Print / Save PDF Deck
          </button>

          <button
            onClick={onClose}
            style={{
              background: "rgba(255, 255, 255, 0.1)",
              border: "none",
              color: "#9CA3AF",
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: "1.1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* SCREEN SLIDE VIEWER */}
      <div
        className="no-print"
        style={{
          width: "100%",
          maxWidth: 1060,
          aspectRatio: "16 / 9",
          background: "#111827",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: 16,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          padding: "2.5rem 3rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div style={{ margin: "auto", textAlign: "center", color: "#9CA3AF" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem", animation: "spin 1.5s linear infinite" }}>✨</div>
            <p style={{ fontSize: "0.95rem", fontWeight: 500, color: "#E5E7EB" }}>
              Gemini is synthesizing committee presentation slides...
            </p>
            <p style={{ fontSize: "0.8rem", color: "#9CA3AF" }}>
              Extracting peak velocity, retention benchmarks, and action items
            </p>
          </div>
        ) : currentSlide ? (
          <>
            {/* SLIDE TOP HEADER */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem" }}>
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "#4ADE80",
                    fontFamily: "var(--font-dm-sans)",
                  }}
                >
                  {currentSlide.badge}
                </span>
                <span style={{ fontSize: "0.75rem", color: "#6B7280", fontFamily: "var(--font-dm-sans)" }}>
                  {deck?.organizationName} • {deck?.generatedAt}
                </span>
              </div>

              <h2
                style={{
                  fontSize: "1.95rem",
                  fontFamily: "var(--font-instrument-serif)",
                  color: "#F9FAFB",
                  margin: 0,
                  lineHeight: 1.15,
                  fontWeight: 400,
                }}
              >
                {currentSlide.title}
              </h2>
              <p style={{ fontSize: "0.88rem", color: "#9CA3AF", margin: "0.4rem 0 0", fontFamily: "var(--font-dm-sans)" }}>
                {currentSlide.subtitle}
              </p>
            </div>

            {/* SLIDE BODY: HIGHLIGHT METRICS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", margin: "1.5rem 0" }}>
              {currentSlide.highlights.map((h, i) => (
                <div
                  key={i}
                  style={{
                    background: "rgba(255, 255, 255, 0.03)",
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                    borderRadius: 12,
                    padding: "1.1rem 1.25rem",
                  }}
                >
                  <div style={{ fontSize: "0.74rem", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "var(--font-dm-sans)" }}>
                    {h.label}
                  </div>
                  <div style={{ fontSize: "2rem", fontWeight: 700, color: "#F9FAFB", margin: "0.2rem 0", fontFamily: "var(--font-dm-sans)" }}>
                    {h.value}
                  </div>
                  {h.detail && (
                    <div style={{ fontSize: "0.74rem", color: "#34D399", fontFamily: "var(--font-dm-sans)" }}>
                      {h.detail}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* SLIDE BOTTOM: FINDINGS & COMMITTEE TAKEAWAYS */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem" }}>
              <div
                style={{
                  background: "rgba(0, 0, 0, 0.25)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 12,
                  padding: "1rem 1.25rem",
                }}
              >
                <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", color: "#9CA3AF", textTransform: "uppercase", marginBottom: "0.5rem", fontFamily: "var(--font-dm-sans)" }}>
                  Key Telemetry Findings
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.82rem", color: "#D1D5DB", lineHeight: 1.6, fontFamily: "var(--font-dm-sans)" }}>
                  {currentSlide.keyFindings.map((kf, i) => (
                    <li key={i}>{kf}</li>
                  ))}
                </ul>
              </div>

              <div
                style={{
                  background: "rgba(34, 197, 94, 0.06)",
                  border: "1px solid rgba(34, 197, 94, 0.2)",
                  borderRadius: 12,
                  padding: "1rem 1.25rem",
                }}
              >
                <div style={{ fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", color: "#4ADE80", textTransform: "uppercase", marginBottom: "0.5rem", fontFamily: "var(--font-dm-sans)" }}>
                  Committee Takeaways & Actions
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.82rem", color: "#E5E7EB", lineHeight: 1.6, fontFamily: "var(--font-dm-sans)" }}>
                  {currentSlide.committeeTakeaways.map((ct, i) => (
                    <li key={i}>{ct}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* SLIDE FOOTER NAVIGATION */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "1rem",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                marginTop: "0.5rem",
              }}
            >
              <div style={{ display: "flex", gap: "0.4rem" }}>
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlideIndex(idx)}
                    style={{
                      width: idx === currentSlideIndex ? 24 : 8,
                      height: 6,
                      borderRadius: 3,
                      background: idx === currentSlideIndex ? "#22C55E" : "rgba(255, 255, 255, 0.2)",
                      border: "none",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      padding: 0,
                    }}
                  />
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#6B7280", fontFamily: "var(--font-dm-sans)" }}>
                  Slide {currentSlideIndex + 1} of {slides.length} • Use Arrow Keys
                </span>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button
                    onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentSlideIndex === 0}
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "none",
                      color: "#F3F4F6",
                      borderRadius: 6,
                      padding: "0.3rem 0.75rem",
                      fontSize: "0.8rem",
                      cursor: currentSlideIndex === 0 ? "not-allowed" : "pointer",
                      opacity: currentSlideIndex === 0 ? 0.4 : 1,
                    }}
                  >
                    ◀ Prev
                  </button>
                  <button
                    onClick={() => setCurrentSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}
                    disabled={currentSlideIndex === slides.length - 1}
                    style={{
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "none",
                      color: "#F3F4F6",
                      borderRadius: 6,
                      padding: "0.3rem 0.75rem",
                      fontSize: "0.8rem",
                      cursor: currentSlideIndex === slides.length - 1 ? "not-allowed" : "pointer",
                      opacity: currentSlideIndex === slides.length - 1 ? 0.4 : 1,
                    }}
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* PRINTABLE MULTI-PAGE SLIDE DECK (VISIBLE ONLY DURING PRINT / SAVE PDF) */}
      <div className="executive-printable-deck" style={{ display: "none" }}>
        {slides.map((slide, index) => (
          <div key={slide.id || index} className="executive-slide-page">
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #E5E7EB", paddingBottom: "0.75rem", marginBottom: "1.25rem" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#16A34A", letterSpacing: "0.08em" }}>
                  {slide.badge}
                </span>
                <span style={{ fontSize: "0.85rem", color: "#6B7280" }}>
                  {deck?.organizationName} • {deck?.generatedAt}
                </span>
              </div>

              <h1 style={{ fontSize: "2.4rem", margin: "0 0 0.5rem 0", color: "#111827", fontFamily: "serif" }}>
                {slide.title}
              </h1>
              <p style={{ fontSize: "1.1rem", color: "#4B5563", margin: "0 0 2rem 0" }}>
                {slide.subtitle}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1.5rem", marginBottom: "2.5rem" }}>
                {slide.highlights.map((h, i) => (
                  <div key={i} style={{ border: "1px solid #D1D5DB", borderRadius: 8, padding: "1.25rem" }}>
                    <div style={{ fontSize: "0.8rem", color: "#6B7280", textTransform: "uppercase" }}>{h.label}</div>
                    <div style={{ fontSize: "2.2rem", fontWeight: 800, color: "#111827", margin: "0.4rem 0" }}>{h.value}</div>
                    {h.detail && <div style={{ fontSize: "0.85rem", color: "#16A34A" }}>{h.detail}</div>}
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "2rem" }}>
                <div style={{ border: "1px solid #E5E7EB", borderRadius: 8, padding: "1.5rem" }}>
                  <h3 style={{ fontSize: "0.9rem", color: "#4B5563", textTransform: "uppercase", margin: "0 0 0.75rem 0" }}>
                    Key Telemetry Findings
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.95rem", lineHeight: 1.7, color: "#1F2937" }}>
                    {slide.keyFindings.map((kf, i) => (
                      <li key={i}>{kf}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ border: "2px solid #BBF7D0", background: "#F0FDF4", borderRadius: 8, padding: "1.5rem" }}>
                  <h3 style={{ fontSize: "0.9rem", color: "#166534", textTransform: "uppercase", margin: "0 0 0.75rem 0" }}>
                    Committee Action Items
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.95rem", lineHeight: 1.7, color: "#14532D" }}>
                    {slide.committeeTakeaways.map((ct, i) => (
                      <li key={i}>{ct}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #E5E7EB", paddingTop: "0.75rem", fontSize: "0.8rem", color: "#9CA3AF" }}>
              <span>EventSlot Executive Presentation System • {deck?.cohortLabel}</span>
              <span>Slide {index + 1} of {slides.length}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
