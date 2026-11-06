"use client"

import { useState, useRef, useEffect } from "react"
import { CheckCircle2, QrCode, Sparkles, Clock3, ShieldCheck } from "lucide-react"

interface SignatureDigitalTicketProps {
  eventTitle?: string
  eventDate?: string
  venue?: string
  attendeeName?: string
  ticketCode?: string
  status?: "CONFIRMED" | "WAITLIST" | "CHECKED_IN"
  waitlistPosition?: number
  interactive?: boolean
  className?: string
}

export function SignatureDigitalTicket({
  eventTitle = "The Creative Leadership Summit",
  eventDate = "Fri, 14 Nov 2026 · 5:30 PM",
  venue = "Sarit Expo Centre · Nairobi",
  attendeeName = "Amani Kibet",
  ticketCode = "ES-8942-NBO",
  status = "CONFIRMED",
  waitlistPosition = 1,
  interactive = true,
  className = "",
}: SignatureDigitalTicketProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotateX, setRotateX] = useState(0)
  const [rotateY, setRotateY] = useState(0)
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 })
  const [isHovered, setIsHovered] = useState(false)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const centerX = rect.width / 2
    const centerY = rect.height / 2

    // Max 8 degrees tilt for tasteful, restrained motion
    const rotX = ((y - centerY) / centerY) * -7
    const rotY = ((x - centerX) / centerX) * 7

    setRotateX(Number.isFinite(rotX) ? rotX : 0)
    setRotateY(Number.isFinite(rotY) ? rotY : 0)
    setGlarePos({
      x: Number.isFinite(x / rect.width) ? (x / rect.width) * 100 : 50,
      y: Number.isFinite(y / rect.height) ? (y / rect.height) * 100 : 50,
      opacity: 0.35,
    })
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setRotateX(0)
    setRotateY(0)
    setGlarePos((prev) => ({ ...prev, opacity: 0 }))
  }

  const isWaitlist = status === "WAITLIST"
  const isCheckedIn = status === "CHECKED_IN"

  return (
    <div
      style={{ perspective: "1000px" }}
      className={`relative inline-block w-full max-w-[360px] select-none ${className}`}
    >
      {/* Outer ambient glow behind the ticket */}
      <div
        className="absolute -inset-1 rounded-[28px] opacity-40 blur-xl transition-opacity duration-500 pointer-events-none"
        style={{
          background: isWaitlist
            ? "radial-gradient(circle, rgba(245,158,11,0.25) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(200,245,90,0.3) 0%, transparent 70%)",
          opacity: isHovered ? 0.6 : 0.35,
        }}
      />

      {/* 3D Tilting Card Body */}
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
          transition: isHovered ? "transform 0.08s ease-out" : "transform 0.4s ease-out",
          transformStyle: "preserve-3d",
        }}
        className="relative overflow-hidden rounded-[24px] border border-[rgba(240,237,230,0.12)] bg-[#121411] text-[#F0EDE6] shadow-[0_25px_60px_rgba(0,0,0,0.65)] transition-shadow duration-300"
      >
        {/* Dynamic Holographic / Specular Sheen Layer */}
        <div
          className="absolute inset-0 pointer-events-none z-20 transition-opacity duration-300"
          style={{
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(200,245,90,0.18) 0%, rgba(240,237,230,0.06) 35%, transparent 65%)`,
            opacity: glarePos.opacity,
          }}
        />

        {/* Top Header Section */}
        <div className="p-5 pb-4 border-b border-dashed border-[rgba(240,237,230,0.12)] relative">
          {/* Brand & Status Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-[#C8F55A] animate-pulse" />
              <span className="text-[0.72rem] font-bold tracking-[0.16em] uppercase text-[#C8F55A]">
                EventSlot Pass
              </span>
            </div>

            {/* Dynamic Status Badge */}
            {isWaitlist ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider text-[#F59E0B]">
                <Clock3 className="h-3 w-3" />
                Waitlist #{waitlistPosition}
              </span>
            ) : isCheckedIn ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(34,197,94,0.35)] bg-[rgba(34,197,94,0.12)] px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider text-[#22C55E]">
                <CheckCircle2 className="h-3 w-3" />
                Checked In
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(200,245,90,0.3)] bg-[rgba(200,245,90,0.08)] px-2.5 py-0.5 text-[0.68rem] font-bold uppercase tracking-wider text-[#C8F55A]">
                <ShieldCheck className="h-3 w-3" />
                Verified Confirmed
              </span>
            )}
          </div>

          {/* Event Title */}
          <h4 className="mt-3 text-[1.2rem] font-semibold tracking-tight text-[#FFFFFF] line-clamp-2 leading-snug">
            {eventTitle}
          </h4>

          {/* Date & Venue */}
          <div className="mt-3 space-y-1 text-[0.78rem] text-[rgba(240,237,230,0.7)]">
            <div className="flex items-center gap-2">
              <span className="text-[rgba(200,245,90,0.9)]">📅</span>
              <span>{eventDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[rgba(200,245,90,0.9)]">📍</span>
              <span className="truncate">{venue}</span>
            </div>
          </div>

          {/* Perforation Left & Right Cutout Notches */}
          <div className="absolute -left-3 -bottom-3 h-6 w-6 rounded-full bg-[#0A0A0A] border-r border-[rgba(240,237,230,0.14)]" />
          <div className="absolute -right-3 -bottom-3 h-6 w-6 rounded-full bg-[#0A0A0A] border-l border-[rgba(240,237,230,0.14)]" />
        </div>

        {/* Bottom Stub Section: Attendee & Verification QR */}
        <div className="p-5 pt-4 bg-[linear-gradient(180deg,rgba(18,20,17,0.95)_0%,rgba(10,12,10,0.98)_100%)]">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[rgba(240,237,230,0.45)]">
                Attendee
              </div>
              <div className="text-[0.95rem] font-bold text-[#FFFFFF] truncate mt-0.5">
                {attendeeName}
              </div>

              <div className="mt-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[rgba(240,237,230,0.45)]">
                Ticket Reference
              </div>
              <div className="text-[0.78rem] font-mono tracking-wider text-[#C8F55A] mt-0.5">
                {ticketCode}
              </div>
            </div>

            {/* Stylized QR Visual Mockup (Non-scannable deterministic sample pattern) */}
            <div className="relative shrink-0 rounded-xl border border-[rgba(240,237,230,0.16)] bg-[#0A0A0A] p-2 shadow-inner">
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* 3 Corner Finder Patterns */}
                <rect x="4" y="4" width="20" height="20" rx="3" stroke="#C8F55A" strokeWidth="2" fill="none"/>
                <rect x="8" y="8" width="12" height="12" rx="1" fill="#C8F55A"/>

                <rect x="48" y="4" width="20" height="20" rx="3" stroke="#C8F55A" strokeWidth="2" fill="none"/>
                <rect x="52" y="8" width="12" height="12" rx="1" fill="#C8F55A"/>

                <rect x="4" y="48" width="20" height="20" rx="3" stroke="#C8F55A" strokeWidth="2" fill="none"/>
                <rect x="8" y="52" width="12" height="12" rx="1" fill="#C8F55A"/>

                {/* Decorative Matrix Bit Patterns */}
                <rect x="28" y="6" width="4" height="4" fill="#F0EDE6"/>
                <rect x="36" y="6" width="6" height="4" fill="#C8F55A"/>
                <rect x="28" y="14" width="8" height="4" fill="#F0EDE6"/>
                <rect x="38" y="18" width="4" height="6" fill="#F0EDE6"/>

                <rect x="6" y="28" width="4" height="6" fill="#F0EDE6"/>
                <rect x="14" y="32" width="6" height="4" fill="#C8F55A"/>
                <rect x="18" y="40" width="4" height="4" fill="#F0EDE6"/>

                {/* Center Core */}
                <rect x="28" y="28" width="16" height="16" rx="2" fill="rgba(200,245,90,0.12)" stroke="#C8F55A" strokeWidth="1"/>
                <circle cx="36" cy="36" r="3" fill="#C8F55A"/>

                <rect x="48" y="28" width="4" height="8" fill="#F0EDE6"/>
                <rect x="56" y="32" width="6" height="4" fill="#C8F55A"/>
                <rect x="64" y="40" width="4" height="4" fill="#F0EDE6"/>

                <rect x="28" y="48" width="6" height="4" fill="#F0EDE6"/>
                <rect x="38" y="52" width="4" height="6" fill="#C8F55A"/>
                <rect x="48" y="48" width="8" height="4" fill="#F0EDE6"/>
                <rect x="60" y="52" width="6" height="6" fill="#C8F55A"/>
              </svg>

              <div className="mt-1 text-center text-[0.55rem] font-mono uppercase tracking-widest text-[rgba(240,237,230,0.4)]">
                DEMO PASS
              </div>
            </div>
          </div>

          {/* Micro Footer Bar with Security Notch */}
          <div className="mt-4 pt-3 border-t border-[rgba(240,237,230,0.06)] flex items-center justify-between text-[0.68rem] text-[rgba(240,237,230,0.4)]">
            <span>Entry Gate 1 · General Admission</span>
            <span className="font-mono text-[#C8F55A]">VALID FOR ENTRY</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SignatureDigitalTicket
