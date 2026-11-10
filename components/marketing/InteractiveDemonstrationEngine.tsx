"use client"

import { useState } from "react"
import {
  Calendar,
  CheckCircle2,
  Clock3,
  MapPin,
  QrCode,
  ScanLine,
  ShieldCheck,
  Sliders,
  Sparkles,
  Ticket,
  Users2,
  AlertCircle,
  BarChart3,
  ArrowRight,
  Download,
  Share2,
} from "lucide-react"
import { SignatureDigitalTicket } from "./SignatureDigitalTicket"

export function InteractiveDemonstrationEngine() {
  const [activeStage, setActiveStage] = useState<number>(1)

  // Unified deterministic sample event state across all 6 stages
  const [eventTitle, setEventTitle] = useState("The Creative Leadership Summit")
  const [eventDate, setEventDate] = useState("Fri, 14 Nov · 5:30 PM")
  const [venue, setVenue] = useState("Sarit Expo Hall · Nairobi")
  const [capacity, setCapacity] = useState(150)
  const [attendeeCount, setAttendeeCount] = useState(148)
  const [customQuestion, setCustomQuestion] = useState("Portfolio Link or LinkedIn Profile")

  // Waitlist promotion simulation state
  const [waitlistQueue, setWaitlistQueue] = useState([
    { id: "w1", name: "Zuhura Hassan", email: "zuhura@example.com", position: 1, promoted: false },
    { id: "w2", name: "Brian Omondi", email: "brian@example.com", position: 2, promoted: false },
    { id: "w3", name: "Fatima Noor", email: "fatima@example.com", position: 3, promoted: false },
  ])
  const [promotionNotice, setPromotionNotice] = useState<string | null>(null)

  // Scanner & Gate verification state
  const [scannedStatus, setScannedStatus] = useState<"IDLE" | "SUCCESS" | "DUPLICATE">("IDLE")
  const [scanTimestamp, setScanTimestamp] = useState<string | null>(null)

  const isOverCapacity = attendeeCount >= capacity
  const waitlistCount = Math.max(0, attendeeCount - capacity)
  const confirmedCount = Math.min(attendeeCount, capacity)
  const baselineCheckIns = Math.round(confirmedCount * 0.75)
  const isScanned = scannedStatus === "SUCCESS" || scannedStatus === "DUPLICATE"
  const checkInCount = confirmedCount === 0 ? 0 : Math.min(confirmedCount, isScanned ? baselineCheckIns + 1 : baselineCheckIns)

  // Handle slot cancellation & atomic waitlist promotion (Stage 3)
  const handleSimulateCancellation = () => {
    if (waitlistQueue.length === 0) return
    const candidate = waitlistQueue[0]
    setPromotionNotice(`Slot opened! ${candidate.name} (Waitlist #1) was atomically promoted to Confirmed. Confirmation ticket dispatched!`)
    setWaitlistQueue((prev) =>
      prev.slice(1).map((item, idx) => ({ ...item, position: idx + 1 }))
    )
    if (attendeeCount > capacity) {
      setAttendeeCount((prev) => Math.max(capacity, prev - 1))
    }
  }

  const handleResetWaitlist = () => {
    setWaitlistQueue([
      { id: "w1", name: "Zuhura Hassan", email: "zuhura@example.com", position: 1, promoted: false },
      { id: "w2", name: "Brian Omondi", email: "brian@example.com", position: 2, promoted: false },
      { id: "w3", name: "Fatima Noor", email: "fatima@example.com", position: 3, promoted: false },
    ])
    setPromotionNotice(null)
  }

  // Handle Door Gate Scanner (Stage 5)
  const handleSimulateScan = () => {
    if (scannedStatus === "IDLE") {
      setScannedStatus("SUCCESS")
      setScanTimestamp("5:32 PM · Gate 1 Entrance")
    } else {
      // Repeated scan triggers duplicate prevention demonstration
      setScannedStatus("DUPLICATE")
    }
  }

  const handleResetScan = () => {
    setScannedStatus("IDLE")
    setScanTimestamp(null)
  }

  const STAGES = [
    { num: 1, label: "01 Create", title: "Organizer Setup" },
    { num: 2, label: "02 Register", title: "Capacity Control" },
    { num: 3, label: "03 Waitlist", title: "Atomic Promotion" },
    { num: 4, label: "04 Ticket", title: "Digital Pass" },
    { num: 5, label: "05 Check-In", title: "Door Scanner" },
    { num: 6, label: "06 Analytics", title: "Attendance Data" },
  ]

  return (
    <section id="event-journey" className="py-16 lg:py-24 border-t border-[#E5E7EB] bg-[#F8FAFC]">
      <div className="marketing-shell px-4 sm:px-6 lg:px-8">
        {/* Section Header - Centered */}
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-[2rem] sm:text-[2.6rem] font-normal tracking-tight text-[#0A0A0A] leading-tight">
            Follow one event through its{" "}
            <span className="italic font-serif text-[#166534]" style={{ fontFamily: "var(--font-instrument-serif)" }}>
              entire journey.
            </span>
          </h2>
          <p className="mt-4 text-[0.98rem] leading-relaxed text-[#475569] max-w-2xl mx-auto">
            Interact with the actual moments that make or break an event. See how registration, capacity, ticketing, door check-in, and attendance data work together.
          </p>
        </div>

        {/* Coordinated Stage Navigation Pills - Centered */}
        <div className="mt-10 flex items-center justify-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {STAGES.map((s) => (
            <button
              key={s.num}
              type="button"
              onClick={() => setActiveStage(s.num)}
              className={`shrink-0 rounded-full px-4 py-2 text-[0.8rem] font-semibold transition-all flex items-center gap-2 ${
                activeStage === s.num
                  ? "bg-[#166534] text-white shadow-[0_4px_14px_rgba(22,101,52,0.25)]"
                  : "border border-[#E5E7EB] bg-white text-[#475569] hover:border-[#166534] hover:text-[#0A0A0A] shadow-sm"
              }`}
            >
              <span>{s.label}</span>
              {activeStage > s.num && <span className="text-[0.7rem] text-[#16A34A]">✓</span>}
            </button>
          ))}
        </div>

        {/* Demonstration Workspace Container */}
        <div className="mt-6 rounded-[28px] border border-[#E5E7EB] bg-white p-5 sm:p-8 lg:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.06)] relative overflow-hidden">
          {/* Subtle Stage Background Ambient Light */}
          <div className="absolute top-0 right-0 w-[450px] h-[300px] bg-[radial-gradient(ellipse_at_top_right,rgba(200,245,90,0.1)_0%,transparent_70%)] pointer-events-none" />

          {/* ========================================================================= */}
          {/* STAGE 1: CREATE AN EVENT (DEMO A)                                          */}
          {/* ========================================================================= */}
          {activeStage === 1 && (
            <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
              <div>
                <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[#166534]">
                  Stage 01 · Organizer Setup
                </div>
                <h3 className="mt-2 text-[1.45rem] font-semibold text-[#0A0A0A]">
                  Define the event and its capacity in seconds
                </h3>
                <p className="mt-2 text-[0.88rem] text-[#475569] leading-relaxed">
                  No complex setup. Organizers set dates, venue, capacity, and custom attendee intake questions. Your shareable event page is ready immediately.
                </p>

                {/* Interactive Controls */}
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-[0.72rem] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">
                      Event Title
                    </label>
                    <input
                      type="text"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      className="w-full rounded-xl border border-[#D1D5DB] bg-[#FAFAF9] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#166534] focus:bg-white focus:outline-none shadow-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[0.72rem] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">
                        Date &amp; Time
                      </label>
                      <input
                        type="text"
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="w-full rounded-xl border border-[#D1D5DB] bg-[#FAFAF9] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#166534] focus:bg-white focus:outline-none shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[0.72rem] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">
                        Slot Capacity
                      </label>
                      <input
                        type="number"
                        value={capacity}
                        onChange={(e) => setCapacity(Math.max(10, parseInt(e.target.value) || 10))}
                        className="w-full rounded-xl border border-[#D1D5DB] bg-[#FAFAF9] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#166534] focus:bg-white focus:outline-none shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[0.72rem] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">
                      Venue
                    </label>
                    <input
                      type="text"
                      value={venue}
                      onChange={(e) => setVenue(e.target.value)}
                      className="w-full rounded-xl border border-[#D1D5DB] bg-[#FAFAF9] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#166534] focus:bg-white focus:outline-none shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[0.72rem] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">
                      Custom Attendee Question
                    </label>
                    <input
                      type="text"
                      value={customQuestion}
                      onChange={(e) => setCustomQuestion(e.target.value)}
                      className="w-full rounded-xl border border-[#D1D5DB] bg-[#FAFAF9] px-3.5 py-2.5 text-sm text-[#0A0A0A] focus:border-[#166534] focus:bg-white focus:outline-none shadow-sm"
                    />
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <span className="text-[0.72rem] text-[#6B7280]">
                    Real-time preview updates automatically
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveStage(2)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#C8F55A] px-5 py-2 text-xs font-bold text-[#0A0A0A] hover:bg-[#b8e040] transition shadow-sm"
                  >
                    Next: Registration &amp; Capacity
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Live Reactive Public Event Card Preview */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAF9] p-6 shadow-md relative">
                <div className="flex items-center justify-between text-[0.68rem] text-[#6B7280] border-b border-[#E5E7EB] pb-3">
                  <span className="flex items-center gap-1.5 font-mono text-[#166534] font-semibold">
                    <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
                    eventsslot.com/demo-event
                  </span>
                  <span>Public Registration View</span>
                </div>

                <div className="mt-4">
                  <span className="inline-block rounded-full bg-[rgba(200,245,90,0.25)] px-2.5 py-0.5 text-[0.68rem] font-bold text-[#166534]">
                    FREE ENTRY · REGISTRATION OPEN
                  </span>
                  <h4 className="mt-3 text-[1.4rem] font-bold text-[#0A0A0A] leading-snug">
                    {eventTitle}
                  </h4>

                  <div className="mt-3 space-y-1.5 text-xs text-[#475569]">
                    <p className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-[#16A34A]" />
                      <span>{eventDate}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-[#16A34A]" />
                      <span>{venue}</span>
                    </p>
                    <p className="flex items-center gap-2">
                      <Users2 className="h-3.5 w-3.5 text-[#16A34A]" />
                      <span>{capacity} Total Capacity Slots</span>
                    </p>
                  </div>

                  <div className="mt-5 rounded-xl border border-[#E5E7EB] bg-white p-3 text-xs shadow-sm">
                    <span className="text-[0.68rem] uppercase font-bold text-[#6B7280]">
                      Required Registration Field:
                    </span>
                    <p className="mt-1 font-medium text-[#0A0A0A]">{customQuestion}</p>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-[#E5E7EB] pt-4">
                    <div className="text-[0.72rem] text-[#6B7280]">
                      Instant link generation
                    </div>
                    <span className="rounded-full bg-[#C8F55A] px-4 py-1.5 text-xs font-bold text-[#0A0A0A] shadow-sm">
                      Register for Event
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 2: REGISTRATION & CAPACITY DYNAMICS (DEMO B)                          */}
          {/* ========================================================================= */}
          {activeStage === 2 && (
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[#166534]">
                  Stage 02 · Real-Time Capacity Control
                </div>
                <h3 className="mt-2 text-[1.45rem] font-semibold text-[#0A0A0A]">
                  Watch how slots fill and protect venue capacity
                </h3>
                <p className="mt-2 text-[0.88rem] text-[#475569] leading-relaxed">
                  EventSlot tracks spots in real time without spreadsheets. Drag the interactive slider below to simulate registrations flooding into the event.
                </p>

                {/* Interactive Registrations Slider */}
                <div className="mt-6 rounded-2xl border border-[#E5E7EB] bg-[#FAFAF9] p-5 shadow-sm">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-[#0A0A0A]">Simulated Registrations:</span>
                    <span className="text-xl font-mono font-bold text-[#16A34A]">
                      {attendeeCount} <span className="text-xs text-[#6B7280]">/ {capacity} cap</span>
                    </span>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={180}
                    value={attendeeCount}
                    onChange={(e) => setAttendeeCount(parseInt(e.target.value))}
                    className="mt-4 w-full accent-[#16A34A] cursor-pointer"
                  />

                  <div className="mt-2 flex justify-between text-[0.7rem] text-[#6B7280]">
                    <span>0 (Empty)</span>
                    <span>100 (Filling)</span>
                    <span className="text-[#16A34A] font-semibold">150 (Full Cap)</span>
                    <span className="text-[#F59E0B] font-semibold">180 (Waitlist Overflow)</span>
                  </div>

                  {/* Preset Quick Buttons */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setAttendeeCount(80)}
                      className="rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1 text-xs text-[#374151] hover:border-[#166534] shadow-sm"
                    >
                      50% Capacity (80)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendeeCount(148)}
                      className="rounded-lg border border-[#D1D5DB] bg-white px-2.5 py-1 text-xs text-[#374151] hover:border-[#166534] shadow-sm"
                    >
                      Almost Full (148)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAttendeeCount(165)}
                      className="rounded-lg border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.1)] px-2.5 py-1 text-xs text-[#B45309] font-semibold shadow-sm"
                    >
                      Waitlist Active (165)
                    </button>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveStage(1)}
                    className="text-xs text-[#6B7280] hover:text-[#0A0A0A]"
                  >
                    ← Back to Builder
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStage(3)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#C8F55A] px-5 py-2 text-xs font-bold text-[#0A0A0A] hover:bg-[#b8e040] transition shadow-sm"
                  >
                    Next: Waitlist &amp; Promotion
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Dynamic Capacity Health Display */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAF9] p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-xs uppercase font-bold tracking-wider text-[#6B7280]">
                    Live Event Status
                  </div>
                  {isOverCapacity ? (
                    <span className="rounded-full bg-[rgba(245,158,11,0.15)] border border-[#F59E0B] px-3 py-1 text-xs font-bold text-[#B45309]">
                      Capacity Reached · Waitlist Queue Active
                    </span>
                  ) : (
                    <span className="rounded-full bg-[rgba(200,245,90,0.25)] border border-[#16A34A] px-3 py-1 text-xs font-bold text-[#166534]">
                      Registration Open · {capacity - attendeeCount} spots left
                    </span>
                  )}
                </div>

                {/* Big Metric Display */}
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                    <div className="text-[0.7rem] uppercase tracking-wider text-[#6B7280]">
                      Confirmed Attendees
                    </div>
                    <div className="mt-1 text-3xl font-mono font-bold text-[#0A0A0A]">
                      {confirmedCount}
                    </div>
                    <div className="mt-1 text-xs text-[#16A34A] font-medium">
                      {capacity > 0 ? Math.round((confirmedCount / capacity) * 100) : 0}% venue filled
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                    <div className="text-[0.7rem] uppercase tracking-wider text-[#6B7280]">
                      Waitlisted Registrants
                    </div>
                    <div className={`mt-1 text-3xl font-mono font-bold ${waitlistCount > 0 ? "text-[#F59E0B]" : "text-[#9CA3AF]"}`}>
                      {waitlistCount}
                    </div>
                    <div className="mt-1 text-xs text-[#6B7280]">
                      {waitlistCount > 0 ? "Queued in order" : "No overflow yet"}
                    </div>
                  </div>
                </div>

                {/* Progress Visual Bar */}
                <div className="mt-6">
                  <div className="h-3 w-full rounded-full bg-[#E5E7EB] overflow-hidden flex">
                    <div
                      className="h-full bg-[#16A34A] transition-all duration-300"
                      style={{ width: `${capacity > 0 ? Math.min(100, (confirmedCount / capacity) * 100) : 0}%` }}
                    />
                    {waitlistCount > 0 && (
                      <div
                        className="h-full bg-[#F59E0B] transition-all duration-300 animate-pulse"
                        style={{ width: `${capacity > 0 ? Math.min(100, (waitlistCount / capacity) * 100) : 0}%` }}
                      />
                    )}
                  </div>
                </div>

                <p className="mt-4 text-xs text-[#6B7280] leading-relaxed">
                  When capacity is reached, EventSlot does not show a disappointing dead-end. Instead, it seamlessly captures high-intent demand into an orderly waitlist.
                </p>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 3: WAITLIST & ATOMIC PROMOTION (DEMO C)                               */}
          {/* ========================================================================= */}
          {activeStage === 3 && (
            <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
              <div>
                <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[#166534]">
                  Stage 03 · Fair Queueing &amp; Auto-Promotion
                </div>
                <h3 className="mt-2 text-[1.45rem] font-semibold text-[#0A0A0A]">
                  Never lose an attendee when capacity opens up
                </h3>
                <p className="mt-2 text-[0.88rem] text-[#475569] leading-relaxed">
                  In real life, people cancel or organizers expand capacity. EventSlot automatically promotes the next person in line without requiring organizers to manually chase spreadsheets or send panicked WhatsApp messages.
                </p>

                {/* Interactive Promotion Trigger */}
                <div className="mt-6 rounded-2xl border border-[rgba(245,158,11,0.3)] bg-[rgba(245,158,11,0.06)] p-5">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#B45309]">
                    <Clock3 className="h-4 w-4" />
                    Simulate a Slot Opening Up
                  </div>
                  <p className="mt-1 text-xs text-[#475569] leading-relaxed">
                    Tap the button below to simulate an attendee cancellation. Watch how Person #1 in the queue is automatically promoted to confirmed status.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleSimulateCancellation}
                      disabled={waitlistQueue.length === 0}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#F59E0B] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#d97706] transition disabled:opacity-50 shadow-sm"
                    >
                      Simulate Attendee Cancellation
                    </button>
                    {waitlistQueue.length === 0 && (
                      <button
                        type="button"
                        onClick={handleResetWaitlist}
                        className="rounded-xl border border-[#D1D5DB] bg-white px-4 py-2.5 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB] shadow-sm"
                      >
                        Reset Demo Queue
                      </button>
                    )}
                  </div>

                  {promotionNotice && (
                    <div className="mt-3 rounded-lg border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.1)] p-3 text-xs text-[#15803D]">
                      {promotionNotice}
                    </div>
                  )}
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveStage(2)}
                    className="text-xs text-[#6B7280] hover:text-[#0A0A0A]"
                  >
                    ← Back to Capacity
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStage(4)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#C8F55A] px-5 py-2 text-xs font-bold text-[#0A0A0A] hover:bg-[#b8e040] transition shadow-sm"
                  >
                    Next: Digital Ticket
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Live Waitlist Queue Visual Table */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAF9] p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                  <div className="text-xs uppercase font-bold text-[#6B7280]">
                    Live Waitlist Order
                  </div>
                  <span className="text-xs font-mono font-bold text-[#B45309]">
                    {waitlistQueue.length} Active in Queue
                  </span>
                </div>

                <div className="mt-4 space-y-2.5">
                  {waitlistQueue.length > 0 ? (
                    waitlistQueue.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border border-[#E5E7EB] bg-white p-3 text-xs shadow-sm transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(245,158,11,0.15)] font-mono font-bold text-[#B45309]">
                            #{item.position}
                          </span>
                          <div>
                            <div className="font-semibold text-[#0A0A0A]">{item.name}</div>
                            <div className="text-[0.68rem] text-[#6B7280]">{item.email}</div>
                          </div>
                        </div>
                        <span className="rounded-full bg-[rgba(245,158,11,0.1)] px-2 py-0.5 text-[0.65rem] font-bold text-[#B45309]">
                          Next in Line
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-8 text-center text-xs text-[#6B7280]">
                      All waitlisted guests have been promoted to confirmed attendees!
                    </div>
                  )}
                </div>

                <div className="mt-5 rounded-xl border border-[rgba(21,128,61,0.2)] bg-[rgba(200,245,90,0.15)] p-3 text-xs text-[#374151] leading-relaxed">
                  <strong className="text-[#166534]">Production Rule:</strong> Promoted attendees receive an email with their ticket and QR code. If an RSVP confirmation window is configured, unclaimed slots move safely to the next person.
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 4: DIGITAL TICKET GENERATION (DEMO D)                                */}
          {/* ========================================================================= */}
          {activeStage === 4 && (
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[#166534]">
                  Stage 04 · Verified Digital Passes
                </div>
                <h3 className="mt-2 text-[1.45rem] font-semibold text-[#0A0A0A]">
                  Clear, mobile-ready tickets delivered instantly
                </h3>
                <p className="mt-2 text-[0.88rem] text-[#475569] leading-relaxed">
                  Every confirmed attendee gets an official EventSlot pass with a high-contrast QR code, event schedule, and gate verification reference.
                </p>

                <div className="mt-6 space-y-3 text-xs text-[#374151]">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                    <span>Downloadable as PDF or saved to Apple / Google Wallet</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                    <span>Attendance lookup on event page without logging in</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-[#16A34A]" />
                    <span>Securely verifiable ticket reference code</span>
                  </div>
                </div>

                <div className="mt-8 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveStage(3)}
                    className="text-xs text-[#6B7280] hover:text-[#0A0A0A]"
                  >
                    ← Back to Waitlist
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStage(5)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#C8F55A] px-5 py-2 text-xs font-bold text-[#0A0A0A] hover:bg-[#b8e040] transition shadow-sm"
                  >
                    Next: Test Door Scanner
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* The Interactive Ticket in Stage 4 */}
              <div className="flex justify-center">
                <SignatureDigitalTicket
                  eventTitle={eventTitle}
                  eventDate={eventDate}
                  venue={venue}
                  attendeeName="Amani Kibet"
                  ticketCode="ES-8942-NBO"
                  status="CONFIRMED"
                  interactive={true}
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 5: DOOR CHECK-IN & SCANNER (DEMO E)                                  */}
          {/* ========================================================================= */}
          {activeStage === 5 && (
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[#166534]">
                  Stage 05 · Door Operations
                </div>
                <h3 className="mt-2 text-[1.45rem] font-semibold text-[#0A0A0A]">
                  Fast, duplicate-safe check-in on event day
                </h3>
                <p className="mt-2 text-[0.88rem] text-[#475569] leading-relaxed">
                  Volunteers and door teams use their phone camera at <code className="text-[#166534] bg-[rgba(200,245,90,0.25)] px-1.5 py-0.5 rounded font-mono">/verify-tickets</code>. No hardware required. It scans in under a second and prevents anyone from sharing or reusing a ticket.
                </p>

                {/* Scan Action Controls */}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSimulateScan}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#C8F55A] px-5 py-3 text-xs font-bold text-[#0A0A0A] shadow-md hover:bg-[#b8e040] transition"
                  >
                    <ScanLine className="h-4 w-4" />
                    Simulate Gate Scan
                  </button>

                  {scannedStatus !== "IDLE" && (
                    <button
                      type="button"
                      onClick={handleResetScan}
                      className="rounded-xl border border-[#D1D5DB] bg-white px-4 py-3 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB] shadow-sm"
                    >
                      Reset Simulator
                    </button>
                  )}
                </div>

                <div className="mt-4 text-xs text-[#6B7280]">
                  💡 <em>Tap &quot;Simulate Gate Scan&quot; a second time to see how EventSlot detects and prevents duplicate scans.</em>
                </div>

                <div className="mt-8 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setActiveStage(4)}
                    className="text-xs text-[#6B7280] hover:text-[#0A0A0A]"
                  >
                    ← Back to Ticket
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveStage(6)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#C8F55A] px-5 py-2 text-xs font-bold text-[#0A0A0A] hover:bg-[#b8e040] transition shadow-sm"
                  >
                    Next: Organizer Analytics
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Simulated Mobile Gate Scanner Viewfinder */}
              <div className="mx-auto w-full max-w-[340px] rounded-[28px] border-2 border-[#1E293B] bg-[#0A0A0A] p-4 shadow-2xl">
                {/* Mobile Camera Frame Header */}
                <div className="flex items-center justify-between border-b border-[rgba(240,237,230,0.08)] pb-2.5 text-[0.7rem] text-[rgba(240,237,230,0.5)]">
                  <span className="font-mono text-[#C8F55A]">EventSlot Door Gate</span>
                  <span>Battery 98%</span>
                </div>

                {/* Viewfinder Area */}
                <div className="relative mt-3 aspect-square rounded-2xl border border-[rgba(240,237,230,0.1)] bg-[#111311] overflow-hidden flex flex-col items-center justify-center p-4">
                  {/* Scanner Laser Animation */}
                  <div className="absolute inset-x-0 h-0.5 bg-[#C8F55A] opacity-80 shadow-[0_0_12px_#C8F55A] animate-pulse" />

                  {/* Corner Reticle Markers */}
                  <div className="absolute top-4 left-4 h-6 w-6 border-t-2 border-l-2 border-[#C8F55A]" />
                  <div className="absolute top-4 right-4 h-6 w-6 border-t-2 border-r-2 border-[#C8F55A]" />
                  <div className="absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-[#C8F55A]" />
                  <div className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-[#C8F55A]" />

                  {scannedStatus === "IDLE" && (
                    <div className="text-center text-xs text-[rgba(240,237,230,0.4)]">
                      <QrCode className="mx-auto h-12 w-12 text-[rgba(200,245,90,0.3)] mb-2" />
                      Point camera at attendee QR code
                    </div>
                  )}

                  {scannedStatus === "SUCCESS" && (
                    <div className="rounded-xl border border-[rgba(34,197,94,0.4)] bg-[rgba(34,197,94,0.15)] p-4 text-center">
                      <CheckCircle2 className="mx-auto h-10 w-10 text-[#22C55E]" />
                      <div className="mt-2 text-sm font-bold text-[#FFFFFF]">ENTRY VERIFIED</div>
                      <div className="mt-0.5 text-xs text-[#22C55E] font-medium">Amani Kibet</div>
                      <div className="mt-1 text-[0.65rem] text-[rgba(240,237,230,0.6)] font-mono" suppressHydrationWarning>
                        {scanTimestamp}
                      </div>
                    </div>
                  )}

                  {scannedStatus === "DUPLICATE" && (
                    <div className="rounded-xl border border-[rgba(245,158,11,0.4)] bg-[rgba(245,158,11,0.15)] p-4 text-center">
                      <AlertCircle className="mx-auto h-10 w-10 text-[#F59E0B]" />
                      <div className="mt-2 text-sm font-bold text-[#F59E0B]">ALREADY CHECKED IN</div>
                      <div className="mt-0.5 text-xs text-[#FFFFFF] font-medium">Ticket ES-8942-NBO</div>
                      <div className="mt-1 text-[0.65rem] text-[rgba(240,237,230,0.6)] font-mono">
                        Scanned at 5:32 PM (Gate 1)
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 text-center text-[0.65rem] text-[rgba(240,237,230,0.4)]">
                  Live Gate Scanner Mode · EventSlot Verify
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STAGE 6: ATTENDANCE & ANALYTICS (DEMO F)                                   */}
          {/* ========================================================================= */}
          {activeStage === 6 && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E5E7EB] pb-5">
                <div>
                  <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[#166534]">
                    Stage 06 · Post-Event Intelligence
                  </div>
                  <h3 className="mt-1 text-[1.45rem] font-semibold text-[#0A0A0A]">
                    Real data for smarter future events
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-[#D1D5DB] bg-[#FAFAF9] px-3 py-1 text-xs text-[#374151] flex items-center gap-1.5 shadow-sm">
                    <Download className="h-3.5 w-3.5 text-[#16A34A]" />
                    Export CSV
                  </span>
                  <span className="rounded-full border border-[#D1D5DB] bg-[#FAFAF9] px-3 py-1 text-xs text-[#374151] flex items-center gap-1.5 shadow-sm">
                    <Share2 className="h-3.5 w-3.5 text-[#16A34A]" />
                    Share Report
                  </span>
                </div>
              </div>

              {/* Connected Dashboard Grid (Reflecting earlier user actions) */}
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAF9] p-5 shadow-sm">
                  <div className="text-[0.72rem] uppercase font-bold text-[#6B7280]">
                    Total Registrations
                  </div>
                  <div className="mt-2 text-3xl font-mono font-bold text-[#0A0A0A]">
                    {attendeeCount}
                  </div>
                  <div className="mt-1 text-xs text-[#16A34A] font-medium">
                    {confirmedCount} confirmed · {waitlistCount} waitlist
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAF9] p-5 shadow-sm">
                  <div className="text-[0.72rem] uppercase font-bold text-[#6B7280]">
                    Door Check-Ins
                  </div>
                  <div className="mt-2 text-3xl font-mono font-bold text-[#16A34A]">
                    {checkInCount}
                  </div>
                  <div className="mt-1 text-xs text-[#6B7280]">
                    {confirmedCount > 0 ? Math.round((checkInCount / confirmedCount) * 100) : 0}% turnout recorded
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAF9] p-5 shadow-sm">
                  <div className="text-[0.72rem] uppercase font-bold text-[#6B7280]">
                    Capacity Utilization
                  </div>
                  <div className="mt-2 text-3xl font-mono font-bold text-[#0A0A0A]">
                    {capacity > 0 ? Math.round((confirmedCount / capacity) * 100) : 0}%
                  </div>
                  <div className="mt-1 text-xs text-[#16A34A] font-medium">
                    {confirmedCount} / {capacity} slots allocated
                  </div>
                </div>

                <div className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAF9] p-5 shadow-sm">
                  <div className="text-[0.72rem] uppercase font-bold text-[#6B7280]">
                    Waitlist Retention
                  </div>
                  <div className="mt-2 text-3xl font-mono font-bold text-[#B45309]">
                    100%
                  </div>
                  <div className="mt-1 text-xs text-[#6B7280]">
                    0 dropouts during promotion
                  </div>
                </div>
              </div>

              {/* Attendance Breakdown Bar */}
              <div className="mt-6 rounded-2xl border border-[#E5E7EB] bg-[#FAFAF9] p-5 shadow-sm">
                <div className="flex items-center justify-between text-xs text-[#475569]">
                  <span>Turnout Breakdown (Arrivals vs Pending)</span>
                  <span className="font-mono text-[#16A34A] font-bold">{checkInCount} Checked In</span>
                </div>
                <div className="mt-3 h-2.5 w-full rounded-full bg-[#E5E7EB] overflow-hidden flex">
                  <div
                    className="h-full bg-[#16A34A] transition-all duration-300"
                    style={{
                      width: `${confirmedCount > 0 ? Math.min(100, (checkInCount / confirmedCount) * 100) : 0}%`,
                    }}
                  />
                  <div
                    className="h-full bg-[#CBD5E1] transition-all duration-300"
                    style={{
                      width: `${confirmedCount > 0 ? Math.max(0, Math.min(100, ((confirmedCount - checkInCount) / confirmedCount) * 100)) : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between border-t border-[#E5E7EB] pt-5">
                <button
                  type="button"
                  onClick={() => setActiveStage(5)}
                  className="text-xs text-[#6B7280] hover:text-[#0A0A0A]"
                >
                  ← Back to Door Scanner
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStage(1)}
                  className="text-xs text-[#166534] font-semibold hover:underline"
                >
                  ↻ Restart Lifecycle Journey
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default InteractiveDemonstrationEngine
