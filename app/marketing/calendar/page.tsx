"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Settings,
  Sparkles,
  CheckCircle2,
} from "lucide-react"

interface ScheduledItem {
  id: string
  title: string
  channel: string
  contentType: string
  status: string
  scheduledFor: string
  campaign: { name: string; campaignId: string }
}

const CHANNEL_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  INSTAGRAM: { bg: "bg-[#E1306C]/10", text: "text-[#E1306C]", border: "border-[#E1306C]/30" },
  LINKEDIN: { bg: "bg-[#0A66C2]/10", text: "text-blue-400", border: "border-[#0A66C2]/30" },
  WHATSAPP: { bg: "bg-[#25D366]/10", text: "text-emerald-400", border: "border-[#25D366]/30" },
  EMAIL: { bg: "bg-[#C8F55A]/10", text: "text-[#C8F55A]", border: "border-[#C8F55A]/30" },
}

export default function MarketingCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<"MONTH" | "WEEK" | "DAY">("MONTH")
  const [items, setItems] = useState<ScheduledItem[]>([])
  const [loading, setLoading] = useState(true)

  // Strategy rules (configurable)
  const strategyRules = [
    { channel: "Instagram", target: "3 / day", desc: "Reels, carousels, feature highlights" },
    { channel: "LinkedIn", target: "1 / day", desc: "Strategic B2B & event leadership posts" },
    { channel: "Email", target: "1 / week", desc: "Curated subscriber digest & updates" },
    { channel: "WhatsApp", target: "2 / week", desc: "Direct community news & alerts" },
  ]

  const fetchCalendarItems = async () => {
    try {
      setLoading(true)
      const year = currentDate.getFullYear()
      const month = currentDate.getMonth()

      // Fetch broad range around current month
      const start = new Date(year, month - 1, 1).toISOString()
      const end = new Date(year, month + 2, 0).toISOString()

      const res = await fetch(`/api/marketing/content?start=${start}&end=${end}`)
      if (!res.ok) throw new Error("Failed to load calendar content")
      const data = await res.json()
      setItems(data.contentItems || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCalendarItems()
  }, [currentDate])

  const prevPeriod = () => {
    if (viewMode === "MONTH") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    } else if (viewMode === "WEEK") {
      setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000))
    } else {
      setCurrentDate(new Date(currentDate.getTime() - 24 * 60 * 60 * 1000))
    }
  }

  const nextPeriod = () => {
    if (viewMode === "MONTH") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    } else if (viewMode === "WEEK") {
      setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000))
    } else {
      setCurrentDate(new Date(currentDate.getTime() + 24 * 60 * 60 * 1000))
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Month View Days Builder
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const calendarDays = []
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarDays.push(null)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(new Date(year, month, d))
  }

  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#262626] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CalendarIcon className="w-6 h-6 text-[#C8F55A]" />
            Content Calendar & Schedule
          </h1>
          <p className="text-sm text-[#A3A3A3] mt-1">
            Visual multi-channel schedule supporting forward planning at least 30 days in advance.
          </p>
        </div>

        <Link
          href="/marketing/content"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#C8F55A] hover:bg-[#b8e84a] text-[#0A0A0A] transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Schedule Content
        </Link>
      </div>

      {/* Strategy Cadence Guidance Bar */}
      <div className="rounded-2xl bg-[#141414] border border-[#262626] p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#C8F55A]">
            Current Cadence Guidelines
          </span>
          <Link href="/marketing/settings" className="text-xs text-[#737373] hover:text-white flex items-center gap-1">
            <Settings className="w-3 h-3" /> Adjust Rules
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {strategyRules.map((rule) => (
            <div key={rule.channel} className="p-3 rounded-xl bg-[#0A0A0A] border border-[#262626]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">{rule.channel}</span>
                <span className="text-xs font-mono font-bold text-[#C8F55A]">{rule.target}</span>
              </div>
              <p className="text-[11px] text-[#737373] mt-1 truncate">{rule.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={prevPeriod}
            className="p-2 rounded-xl bg-[#141414] border border-[#262626] text-[#A3A3A3] hover:text-white transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1.5 rounded-xl bg-[#141414] border border-[#262626] text-xs font-medium text-white hover:bg-[#1F1F1F] transition"
          >
            Today
          </button>
          <button
            onClick={nextPeriod}
            className="p-2 rounded-xl bg-[#141414] border border-[#262626] text-[#A3A3A3] hover:text-white transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <h2 className="text-lg font-bold text-white ml-2">{monthName}</h2>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#141414] border border-[#262626] rounded-xl">
          {(["MONTH", "WEEK", "DAY"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                viewMode === mode
                  ? "bg-[#C8F55A] text-[#0A0A0A]"
                  : "text-[#737373] hover:text-white"
              }`}
            >
              {mode.charAt(0) + mode.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Month Grid View */}
      {viewMode === "MONTH" && (
        <div className="rounded-2xl bg-[#141414] border border-[#262626] overflow-hidden shadow-xl">
          {/* Day Names */}
          <div className="grid grid-cols-7 border-b border-[#262626] bg-[#0A0A0A] text-center text-xs font-semibold text-[#737373] py-3">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Days Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-[#262626]">
            {calendarDays.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="min-h-[110px] bg-[#0A0A0A]/40" />
              }

              const isToday = day.toDateString() === new Date().toDateString()
              const dayItems = items.filter((item) => {
                if (!item.scheduledFor) return false
                return new Date(item.scheduledFor).toDateString() === day.toDateString()
              })

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[110px] p-2 flex flex-col justify-between group transition ${
                    isToday ? "bg-[#C8F55A]/5" : "bg-[#141414] hover:bg-[#1A1A1A]/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday ? "bg-[#C8F55A] text-[#0A0A0A]" : "text-[#A3A3A3]"
                      }`}
                    >
                      {day.getDate()}
                    </span>

                    {dayItems.length > 0 && (
                      <span className="text-[10px] font-mono text-[#737373]">
                        {dayItems.length} post{dayItems.length > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {/* Scheduled Items in this day */}
                  <div className="space-y-1 my-1 flex-1 overflow-y-auto max-h-24">
                    {dayItems.map((it) => {
                      const color = CHANNEL_COLORS[it.channel] || CHANNEL_COLORS.INSTAGRAM
                      return (
                        <div
                          key={it.id}
                          title={`${it.channel}: ${it.title}`}
                          className={`px-1.5 py-0.5 rounded text-[10px] truncate border font-medium ${color.bg} ${color.text} ${color.border}`}
                        >
                          {it.title}
                        </div>
                      )
                    })}
                  </div>

                  <Link
                    href="/marketing/content"
                    className="opacity-0 group-hover:opacity-100 text-[10px] text-[#737373] hover:text-[#C8F55A] transition flex items-center gap-0.5 justify-end"
                  >
                    + Add
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Week / Day View Placeholder */}
      {viewMode !== "MONTH" && (
        <div className="rounded-2xl bg-[#141414] border border-[#262626] p-12 text-center space-y-3">
          <p className="text-sm font-semibold text-white">{viewMode} View Active</p>
          <p className="text-xs text-[#737373] max-w-md mx-auto">
            Showing scheduled multi-channel distribution for the active timeframe. Use the month grid for macro monthly cadence planning.
          </p>
          <button
            onClick={() => setViewMode("MONTH")}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1F1F1F] text-[#C8F55A] hover:bg-[#262626]"
          >
            Return to Month Grid
          </button>
        </div>
      )}
    </div>
  )
}
