"use client"

import { useState, useEffect } from "react"
import {
  Send,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertCircle,
  Eye,
  Users,
  ShieldCheck,
  Calendar,
  Image as ImageIcon,
} from "lucide-react"

interface ScheduledBroadcast {
  id: string
  title: string | null
  subject: string
  layoutType: string
  scheduledFor: string
  status: string
  sentCount: number
  failedCount: number
}

export default function MarketingBroadcastsPage() {
  const [recipientCount, setRecipientCount] = useState(0)
  const [scheduledList, setScheduledList] = useState<ScheduledBroadcast[]>([])
  const [loading, setLoading] = useState(true)

  // Form State
  const [subject, setSubject] = useState("")
  const [preheader, setPreheader] = useState("")
  const [layoutType, setLayoutType] = useState("PROMOTIONAL_HERO")
  const [bannerUrl, setBannerUrl] = useState("")
  const [content, setContent] = useState("")
  const [ctaText, setCtaText] = useState("Explore EventSlot")
  const [ctaUrl, setCtaUrl] = useState("https://www.eventsslot.com")
  const [mode, setMode] = useState("SUBSCRIBED")
  const [scheduleFor, setScheduleFor] = useState("")
  const [testEmail, setTestEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const fetchBroadcasts = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/marketing/broadcasts?mode=SUBSCRIBED", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load broadcast stats")
      const data = await res.json()
      setRecipientCount(data.recipientCount || 0)
      setScheduledList(data.scheduled || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBroadcasts()
  }, [])

  const handleSendTest = async () => {
    if (!subject.trim() || !content.trim()) {
      alert("Please enter a subject and content before sending a test.")
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch("/api/marketing/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          preheader,
          layoutType,
          bannerUrl,
          content,
          ctaText,
          ctaUrl,
          isTest: true,
          testEmail: testEmail.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Test failed")
      setActionMessage(data.message)
      setTimeout(() => setActionMessage(null), 4000)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Test failed")
    } finally {
      setSubmitting(false)
    }
  }

  const handleBroadcastOrSchedule = async (isScheduling: boolean) => {
    if (!subject.trim() || !content.trim()) {
      alert("Please enter a subject and content.")
      return
    }

    if (isScheduling && !scheduleFor) {
      alert("Please choose a scheduled time.")
      return
    }

    if (!isScheduling) {
      if (!confirm(`Are you sure you want to send this broadcast to ${recipientCount} active subscribers immediately?`)) {
        return
      }
    }

    try {
      setSubmitting(true)
      const res = await fetch("/api/marketing/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          preheader,
          layoutType,
          bannerUrl,
          content,
          ctaText,
          ctaUrl,
          mode,
          scheduleFor: isScheduling ? scheduleFor : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Broadcast submission failed")

      setActionMessage(data.message)
      fetchBroadcasts()
      if (!isScheduling) {
        setSubject("")
        setContent("")
      }
      setTimeout(() => setActionMessage(null), 5000)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Broadcast failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#262626] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Send className="w-6 h-6 text-[#C8F55A]" />
            Promotional Broadcast Studio
          </h1>
          <p className="text-sm text-[#A3A3A3] mt-1">
            Design, preview, and dispatch platform marketing broadcasts via <strong>hello@eventsslot.com</strong> with RFC 8058 1-click unsubscribe headers.
          </p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141414] border border-[#262626] text-xs">
          <Users className="w-4 h-4 text-[#C8F55A]" />
          <span className="text-[#A3A3A3]">Subscribed Audience:</span>
          <span className="font-bold text-white">{recipientCount.toLocaleString()} users</span>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-xl bg-[#C8F55A]/10 border border-[#C8F55A]/30 text-[#C8F55A] text-sm flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* Main 2-Column: Composer & Scheduled Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Composer (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl bg-[#141414] border border-[#262626] p-6 space-y-5">
          <h2 className="text-base font-bold text-white">Compose Broadcast</h2>

          <div className="space-y-4">
            {/* Layout Style Selector */}
            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                Email Layout Style
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { key: "PROMOTIONAL_HERO", label: "Hero Poster", desc: "Big banner & flyer" },
                  { key: "EDITORIAL", label: "Editorial", desc: "Letter narrative" },
                  { key: "MINIMAL_ANNOUNCEMENT", label: "Minimal", desc: "Clean & direct" },
                ].map((l) => (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => setLayoutType(l.key)}
                    className={`p-2.5 rounded-xl text-left border transition ${
                      layoutType === l.key
                        ? "bg-[#C8F55A]/10 border-[#C8F55A] text-white"
                        : "bg-[#0A0A0A] border-[#262626] text-[#737373] hover:text-white"
                    }`}
                  >
                    <p className="text-xs font-bold">{l.label}</p>
                    <p className="text-[10px] text-[#737373] mt-0.5">{l.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                Email Subject *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Introducing Smart Waitlists & Capacity Controls on EventSlot"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C8F55A]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                Preheader Preview Text (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Never lose an attendee with automated capacity management..."
                value={preheader}
                onChange={(e) => setPreheader(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
              />
            </div>

            {layoutType === "PROMOTIONAL_HERO" && (
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  Poster / Hero Banner URL
                </label>
                <input
                  type="url"
                  placeholder="https://... image link"
                  value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                Broadcast Body Content *
              </label>
              <textarea
                required
                rows={7}
                placeholder="Write your broadcast content (supports **bold**, linebreaks, and bullet points)..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#C8F55A] font-sans leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  Call-To-Action Button Text
                </label>
                <input
                  type="text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  CTA Destination URL
                </label>
                <input
                  type="url"
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                />
              </div>
            </div>

            {/* Test Send Row */}
            <div className="p-3 rounded-xl bg-[#0A0A0A] border border-[#262626] flex items-center gap-2">
              <input
                type="email"
                placeholder="Enter email for test preview..."
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="flex-1 bg-[#141414] border border-[#333] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
              />
              <button
                type="button"
                onClick={handleSendTest}
                disabled={submitting}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1F1F1F] hover:bg-[#2A2A2A] text-white border border-[#333] transition"
              >
                Send Test
              </button>
            </div>

            {/* Scheduling or Dispatch Controls */}
            <div className="pt-2 border-t border-[#262626] space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  Schedule for Future Date (Leave empty to send immediately)
                </label>
                <input
                  type="datetime-local"
                  value={scheduleFor}
                  onChange={(e) => setScheduleFor(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                {scheduleFor ? (
                  <button
                    type="button"
                    onClick={() => handleBroadcastOrSchedule(true)}
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-500 hover:bg-blue-600 text-white transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    {submitting ? "Scheduling..." : "Schedule Broadcast"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleBroadcastOrSchedule(false)}
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-[#C8F55A] hover:bg-[#b8e84a] text-[#0A0A0A] transition disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? "Sending..." : `Send to ${recipientCount} Subscribers`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Scheduled Broadcasts Queue (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl bg-[#141414] border border-[#262626] p-6 space-y-5">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            Broadcast Queue & History
          </h2>

          {loading ? (
            <div className="p-8 text-center text-xs text-[#737373]">Loading queue...</div>
          ) : scheduledList.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#737373]">
              No scheduled or past broadcasts recorded.
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledList.map((item) => (
                <div key={item.id} className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#262626] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                        item.status === "SENT"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : item.status === "SCHEDULED"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                          : "bg-neutral-800 text-neutral-400 border-neutral-700"
                      }`}
                    >
                      {item.status}
                    </span>
                    <span className="text-xs text-[#737373]">
                      {new Date(item.scheduledFor).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white truncate">{item.subject}</p>
                  <div className="text-[11px] text-[#737373] flex items-center justify-between">
                    <span>Layout: {item.layoutType}</span>
                    {item.status === "SENT" && (
                      <span className="text-emerald-400 font-bold">{item.sentCount} delivered</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
