"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Sparkles, CheckCircle2, Sliders, ShieldCheck } from "lucide-react"
import { SignatureDigitalTicket } from "./SignatureDigitalTicket"

interface SpatialHeroProps {
  onExploreJourney?: () => void
}

export function SpatialHero({ onExploreJourney }: SpatialHeroProps) {
  const [ticketStatus, setTicketStatus] = useState<"CONFIRMED" | "WAITLIST" | "CHECKED_IN">("CONFIRMED")
  const [attendeeCount, setAttendeeCount] = useState(148)
  const capacity = 150

  const handleSimulateStatus = (nextStatus: "CONFIRMED" | "WAITLIST" | "CHECKED_IN") => {
    setTicketStatus(nextStatus)
    if (nextStatus === "WAITLIST") {
      setAttendeeCount(156)
    } else if (nextStatus === "CONFIRMED") {
      setAttendeeCount(148)
    } else if (nextStatus === "CHECKED_IN") {
      setAttendeeCount(150)
    }
  }

  return (
    <section className="relative overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-24 bg-white">
      {/* Background Spatial Atmosphere */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Soft radial lime bloom */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[450px] bg-[radial-gradient(ellipse_at_top,rgba(200,245,90,0.18)_0%,transparent_70%)] blur-2xl" />
        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(#0A0A0A 1px, transparent 1px), linear-gradient(90deg, #0A0A0A 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="marketing-shell px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
          {/* Left Column: Vision & Primary Actions */}
          <div className="max-w-2xl">
            {/* Headline with Instrument Serif Expressive Accent */}
            <h1 className="text-[2.6rem] sm:text-[3.5rem] lg:text-[4.2rem] font-normal tracking-tight text-[#0A0A0A] leading-[1.04]">
              Every great event starts with a{" "}
              <span className="italic font-normal font-serif text-[#166534]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
                better experience.
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mt-6 text-[1.02rem] sm:text-[1.12rem] leading-relaxed text-[#475569] font-normal max-w-xl">
              Create your event, open registration, manage capacity, and welcome attendees with an all-in-one system designed to run smoothly from first signup to the final door check-in.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <Link
                href="/signup"
                className="inline-flex min-h-[50px] items-center justify-center gap-2.5 rounded-full bg-[#166534] px-7 text-[0.95rem] font-semibold text-white shadow-[0_4px_14px_rgba(22,101,52,0.25)] transition-all hover:bg-[#14532d] hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Create Your Event</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <a
                href="#event-journey"
                onClick={(e) => {
                  e.preventDefault()
                  if (onExploreJourney) onExploreJourney()
                  document.getElementById("event-journey")?.scrollIntoView({ behavior: "smooth" })
                }}
                className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full border border-[#D1D5DB] bg-white px-6 text-[0.92rem] font-medium text-[#0A0A0A] transition-all hover:border-[#166534] hover:bg-[#F9FAFB]"
              >
                <span>See How It Works</span>
                <span className="text-[0.75rem] text-[#6B7280]">↓</span>
              </a>
            </div>

            {/* Verified Trust Badges */}
            <div className="mt-10 pt-6 border-t border-[#E5E7EB] flex flex-wrap items-center gap-x-6 gap-y-3 text-[0.8rem] text-[#475569]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                <span>Free for community &amp; campus events</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                <span>Instant QR camera verification</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                <span>Automated capacity waitlists</span>
              </div>
            </div>
          </div>

          {/* Right Column: Spatial Ticket & Simulator Controls */}
          <div className="flex flex-col items-center lg:items-end">
            <div className="w-full max-w-[380px]">
              {/* Interactive Status Simulation Selector Bar */}
              <div className="mb-4 inline-flex items-center gap-1 rounded-full border border-[#E5E7EB] bg-white p-1 text-[0.72rem] shadow-sm">
                <span className="px-2.5 py-1 text-[0.68rem] font-semibold text-[#6B7280]">
                  Ticket preview:
                </span>
                <button
                  type="button"
                  onClick={() => handleSimulateStatus("CONFIRMED")}
                  className={`rounded-full px-3 py-1 font-semibold transition-all ${
                    ticketStatus === "CONFIRMED"
                      ? "bg-[#166534] text-white shadow-sm"
                      : "text-[#475569] hover:text-[#0A0A0A]"
                  }`}
                >
                  Confirmed
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulateStatus("WAITLIST")}
                  className={`rounded-full px-3 py-1 font-semibold transition-all ${
                    ticketStatus === "WAITLIST"
                      ? "bg-[#D97706] text-white shadow-sm"
                      : "text-[#475569] hover:text-[#0A0A0A]"
                  }`}
                >
                  Waitlist
                </button>
                <button
                  type="button"
                  onClick={() => handleSimulateStatus("CHECKED_IN")}
                  className={`rounded-full px-3 py-1 font-semibold transition-all ${
                    ticketStatus === "CHECKED_IN"
                      ? "bg-[#16A34A] text-white shadow-sm"
                      : "text-[#475569] hover:text-[#0A0A0A]"
                  }`}
                >
                  Scanned
                </button>
              </div>

              {/* The Tactile 3D Ticket */}
              <SignatureDigitalTicket
                eventTitle="The Creative Leadership Summit"
                eventDate="Fri, 14 Nov · 5:30 PM"
                venue="Sarit Expo Hall · Nairobi"
                attendeeName="Amani Kibet"
                ticketCode="ES-8942-NBO"
                status={ticketStatus}
                waitlistPosition={1}
                interactive={true}
              />

              {/* Real-time Connected Micro-Capacity Bar below ticket */}
              <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-white p-3 shadow-md">
                <div className="flex items-center justify-between text-[0.72rem] text-[#6B7280]">
                  <span className="font-medium text-[#374151]">Capacity Tracking</span>
                  <span className="font-mono text-[#0A0A0A]">
                    <strong className="text-[#16A34A]">{attendeeCount}</strong> / {capacity} slots
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-[#F3F4F6] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (attendeeCount / capacity) * 100)}%`,
                      background: attendeeCount >= capacity ? "#F59E0B" : "#16A34A",
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[0.66rem]">
                  <span className={attendeeCount >= capacity ? "text-[#D97706] font-semibold" : "text-[#16A34A] font-semibold"}>
                    {attendeeCount >= capacity ? "● Over capacity · Waitlist queue open" : "● Registration open · Instant confirmation"}
                  </span>
                  <span className="text-[#9CA3AF]">Interactive Demo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default SpatialHero
