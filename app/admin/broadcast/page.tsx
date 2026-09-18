"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { renderBroadcastEmail, type BroadcastLayoutType } from "@/lib/emailTemplates"

type Mode = "ALL" | "SUBSCRIBED" | "INDIVIDUAL"

type User = {
  id: string
  name: string | null
  email: string | null
  marketingConsent?: boolean
}

type PreviewResponse = {
  mode: Mode
  recipientCount: number
  sampleRecipients: User[]
}

type ScheduledItem = {
  id: string
  title: string | null
  subject: string
  layoutType: string
  preheader: string | null
  bannerUrl: string | null
  content: string
  ctaText: string | null
  ctaUrl: string | null
  eventDateLabel: string | null
  eventLocation: string | null
  eventBadge: string | null
  mode: string
  scheduledFor: string
  status: string
  sentAt: string | null
  sentCount: number
  failedCount: number
  createdAt: string
}

export default function AdminBroadcastPage() {
  const [activeTab, setActiveTab] = useState<"compose" | "scheduled">("compose")
  const [mode, setMode] = useState<Mode>("SUBSCRIBED")
  const [layoutType, setLayoutType] = useState<BroadcastLayoutType>("PROMOTIONAL_HERO")

  // Fields
  const [subject, setSubject] = useState("")
  const [preheader, setPreheader] = useState("")
  const [bannerUrl, setBannerUrl] = useState("")
  const [content, setContent] = useState("Hi {{name}},\n\n")
  const [ctaText, setCtaText] = useState("")
  const [ctaUrl, setCtaUrl] = useState("")
  const [eventDateLabel, setEventDateLabel] = useState("")
  const [eventLocation, setEventLocation] = useState("")
  const [eventBadge, setEventBadge] = useState("")

  // Search for individuals
  const [search, setSearch] = useState("")
  const [foundUsers, setFoundUsers] = useState<User[]>([])
  const [selectedUsers, setSelectedUsers] = useState<User[]>([])
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  // Scheduling
  const [deliveryTiming, setDeliveryTiming] = useState<"immediate" | "scheduled">("immediate")
  const [scheduledDate, setScheduledDate] = useState("")
  const [scheduledTime, setScheduledTime] = useState("10:00")

  // UI state
  const [viewMode, setViewMode] = useState<"editor" | "preview">("editor")
  const [uploadingImage, setUploadingImage] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  // Scheduled broadcasts list
  const [scheduledList, setScheduledList] = useState<ScheduledItem[]>([])
  const [loadingScheduled, setLoadingScheduled] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Calculate min and max dates for scheduling (tomorrow up to 90 days)
  const { minDate, maxDate } = useMemo(() => {
    const today = new Date()
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
    const ninetyDays = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
    return {
      minDate: tomorrow.toISOString().split("T")[0],
      maxDate: ninetyDays.toISOString().split("T")[0],
    }
  }, [])

  // Load scheduled list
  const fetchScheduled = async () => {
    setLoadingScheduled(true)
    try {
      const res = await fetch("/api/admin/broadcast/schedule")
      const data = await res.json()
      if (res.ok && data.scheduled) {
        setScheduledList(data.scheduled)
      }
    } catch {
      // ignore
    } finally {
      setLoadingScheduled(false)
    }
  }

  useEffect(() => {
    if (activeTab === "scheduled") {
      fetchScheduled()
    }
  }, [activeTab])

  // Recipient search
  useEffect(() => {
    if (mode !== "INDIVIDUAL") return
    if (search.trim().length < 2) {
      setFoundUsers([])
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(search)}`)
        const data = (await res.json()) as { users?: User[] }
        setFoundUsers(data.users ?? [])
      } catch {
        setFoundUsers([])
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [search, mode])

  // Recipient preview
  useEffect(() => {
    if (mode === "INDIVIDUAL") {
      setPreview({ mode, recipientCount: selectedUsers.length, sampleRecipients: selectedUsers.slice(0, 5) })
      return
    }

    let cancelled = false
    const run = async () => {
      setLoadingPreview(true)
      try {
        const res = await fetch(`/api/admin/broadcast?mode=${mode}`)
        const data = (await res.json()) as PreviewResponse
        if (!cancelled) setPreview(data)
      } catch {
        if (!cancelled) setPreview(null)
      } finally {
        if (!cancelled) setLoadingPreview(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [mode, selectedUsers])

  const prettyCount = useMemo(() => {
    const count = preview?.recipientCount ?? 0
    return count.toLocaleString()
  }, [preview?.recipientCount])

  // Upload image to Cloudflare R2
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    setStatusError(null)

    const formData = new FormData()
    formData.append("file", file)

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      if (res.ok && data.url) {
        setBannerUrl(data.url)
        setStatusMessage("Banner image uploaded successfully!")
      } else {
        setStatusError(data.error || "Failed to upload image")
      }
    } catch {
      setStatusError("Network error while uploading image")
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  // Submit broadcast (Send Now or Schedule)
  const handleSubmit = async () => {
    setStatusError(null)
    setStatusMessage(null)

    if (!subject.trim()) {
      setStatusError("Subject is required.")
      return
    }
    if (!content.trim()) {
      setStatusError("Message content is required.")
      return
    }

    if (mode === "INDIVIDUAL" && selectedUsers.length === 0) {
      setStatusError("Please select at least one individual user.")
      return
    }

    if (deliveryTiming === "scheduled") {
      if (!scheduledDate || !scheduledTime) {
        setStatusError("Please specify both date and time for scheduled delivery.")
        return
      }

      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`)
      if (isNaN(scheduledDateTime.getTime())) {
        setStatusError("Invalid date/time format.")
        return
      }

      const confirmed = window.confirm(
        `Schedule this broadcast to be sent on ${scheduledDateTime.toLocaleDateString()} at ${scheduledTime}?`
      )
      if (!confirmed) return

      setSubmitting(true)
      try {
        const res = await fetch("/api/admin/broadcast/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject,
            layoutType,
            preheader: preheader.trim() || undefined,
            bannerUrl: bannerUrl.trim() || undefined,
            content,
            ctaText: ctaText.trim() || undefined,
            ctaUrl: ctaUrl.trim() || undefined,
            eventDateLabel: eventDateLabel.trim() || undefined,
            eventLocation: eventLocation.trim() || undefined,
            eventBadge: eventBadge.trim() || undefined,
            mode,
            specificUserIds: mode === "INDIVIDUAL" ? selectedUsers.map((u) => u.id) : undefined,
            scheduledFor: scheduledDateTime.toISOString(),
          }),
        })

        const data = await res.json()
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to schedule broadcast")
        }

        setStatusMessage("✓ Broadcast scheduled successfully! View it in the Scheduled Campaigns tab.")
        setActiveTab("scheduled")
        fetchScheduled()
      } catch (err) {
        setStatusError(err instanceof Error ? err.message : "Failed to schedule")
      } finally {
        setSubmitting(false)
      }
    } else {
      // Immediate Send
      const confirmed = window.confirm(
        `Send this broadcast IMMEDIATELY to ${mode === "INDIVIDUAL" ? selectedUsers.length : prettyCount} recipients?`
      )
      if (!confirmed) return

      setSubmitting(true)
      try {
        const res = await fetch("/api/admin/broadcast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject,
            htmlContent: content,
            mode,
            specificUserIds: mode === "INDIVIDUAL" ? selectedUsers.map((u) => u.id) : undefined,
            layoutType,
            preheader: preheader.trim() || undefined,
            bannerUrl: bannerUrl.trim() || undefined,
            ctaText: ctaText.trim() || undefined,
            ctaUrl: ctaUrl.trim() || undefined,
            eventDateLabel: eventDateLabel.trim() || undefined,
            eventLocation: eventLocation.trim() || undefined,
            eventBadge: eventBadge.trim() || undefined,
          }),
        })

        const data = await res.json()
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to send")
        }

        setStatusMessage(`✓ Broadcast complete: ${data.sent ?? 0} sent successfully, ${data.failed ?? 0} failed.`)
      } catch (err) {
        setStatusError(err instanceof Error ? err.message : "Failed to send broadcast")
      } finally {
        setSubmitting(false)
      }
    }
  }

  // Cancel scheduled broadcast
  const handleCancelScheduled = async (id: string) => {
    if (!window.confirm("Are you sure you want to cancel this scheduled broadcast?")) return

    try {
      const res = await fetch(`/api/admin/broadcast/schedule/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (res.ok && data.success) {
        fetchScheduled()
      } else {
        alert(data.error || "Failed to cancel")
      }
    } catch {
      alert("Network error cancelling broadcast")
    }
  }

  // Trigger Send Now on scheduled item
  const handleSendNowScheduled = async (id: string) => {
    if (!window.confirm("Send this scheduled broadcast right now immediately?")) return

    try {
      const res = await fetch(`/api/admin/broadcast/schedule/${id}`, { method: "POST" })
      const data = await res.json()
      if (res.ok && data.success) {
        alert(`Dispatched! ${data.sent} sent, ${data.failed} failed.`)
        fetchScheduled()
      } else {
        alert(data.error || "Failed to send")
      }
    } catch {
      alert("Network error sending broadcast")
    }
  }

  // Render live preview HTML
  const previewHtml = useMemo(() => {
    return renderBroadcastEmail({
      layoutType,
      subject: subject || "Preview: EventSlot Announcement",
      preheader: preheader || null,
      bannerUrl: bannerUrl || null,
      content: content || "Hi {{name}},\n\nYour message preview will appear here...",
      ctaText: ctaText || null,
      ctaUrl: ctaUrl || null,
      eventDateLabel: eventDateLabel || null,
      eventLocation: eventLocation || null,
      eventBadge: eventBadge || null,
      recipientName: "Daniel",
      userId: "preview-user",
    })
  }, [layoutType, subject, preheader, bannerUrl, content, ctaText, ctaUrl, eventDateLabel, eventLocation, eventBadge])

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Broadcast Studio</h1>
          <p className="text-[var(--text-secondary)] mt-1 text-sm">
            Send instant announcements or preschedule promotional campaigns up to 3 months ahead.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-xl p-1 bg-[var(--surface)] border border-[var(--border)]">
          <button
            type="button"
            onClick={() => setActiveTab("compose")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === "compose"
                ? "bg-[#C8F55A] text-[#0A0A0A] shadow-md shadow-[#C8F55A]/20"
                : "text-[#A3A3A3] hover:text-white"
            }`}
          >
            Compose Broadcast
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scheduled")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
              activeTab === "scheduled"
                ? "bg-[#C8F55A] text-[#0A0A0A] shadow-md shadow-[#C8F55A]/20"
                : "text-[#A3A3A3] hover:text-white"
            }`}
          >
            <span>Scheduled Queue</span>
            {scheduledList.filter((s) => s.status === "SCHEDULED").length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-[#0A0A0A] text-[#C8F55A]">
                {scheduledList.filter((s) => s.status === "SCHEDULED").length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === "compose" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Form (8 Cols or Full) */}
          <div className="lg:col-span-12 space-y-6">
            {/* View Mode Toggle: Editor vs Live Preview */}
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode("editor")}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                    viewMode === "editor"
                      ? "bg-[#262626] text-white border border-[#333]"
                      : "text-[#888] hover:text-white"
                  }`}
                >
                  ✏️ Editor
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("preview")}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                    viewMode === "preview"
                      ? "bg-[#262626] text-[#C8F55A] border border-[#333]"
                      : "text-[#888] hover:text-white"
                  }`}
                >
                  👁️ Live Preview
                </button>
              </div>

              <div className="text-xs text-[#737373]">
                Engine: <span className="text-[#C8F55A] font-medium">Nodemailer Primary (SMTP)</span> · Resend Backup
              </div>
            </div>

            {viewMode === "preview" ? (
              <div className="rounded-2xl border border-[#2A2A2A] bg-[#0A0A0A] p-4 sm:p-8">
                <div className="max-w-2xl mx-auto shadow-2xl rounded-2xl overflow-hidden border border-[#222]">
                  <div className="bg-[#181818] px-4 py-2 text-xs text-[#737373] border-b border-[#2A2A2A] flex items-center justify-between">
                    <span>Email Preview (Desktop & Mobile Responsive)</span>
                    <button
                      type="button"
                      onClick={() => setViewMode("editor")}
                      className="text-[#C8F55A] hover:underline"
                    >
                      Back to Editor
                    </button>
                  </div>
                  <iframe
                    srcDoc={previewHtml}
                    title="Live Email Preview"
                    className="w-full min-h-[600px] border-0 bg-[#0A0A0A]"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 space-y-6">
                {/* 1. Layout Mode Selection */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-white">
                    Template Layout Style
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLayoutType("PROMOTIONAL_HERO")}
                      className={`p-4 rounded-xl text-left border transition-all ${
                        layoutType === "PROMOTIONAL_HERO"
                          ? "border-[#C8F55A] bg-[#C8F55A]/5 shadow-md shadow-[#C8F55A]/10"
                          : "border-[var(--border)] bg-[var(--surface)] hover:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🎨</span>
                        <span className="font-semibold text-white text-sm">Promotional Event Spotlight</span>
                      </div>
                      <p className="text-xs text-[#888] leading-relaxed">
                        Hero poster/banner graphic, event date & venue cards, bold headings, and prominent CTA button.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLayoutType("TEXT_MINIMAL")}
                      className={`p-4 rounded-xl text-left border transition-all ${
                        layoutType === "TEXT_MINIMAL"
                          ? "border-[#C8F55A] bg-[#C8F55A]/5 shadow-md shadow-[#C8F55A]/10"
                          : "border-[var(--border)] bg-[var(--surface)] hover:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">📝</span>
                        <span className="font-semibold text-white text-sm">Clean Announcement (No Hero Banner)</span>
                      </div>
                      <p className="text-xs text-[#888] leading-relaxed">
                        Focused typography, markdown links, bullet lists, and optional action button. Fast and readable.
                      </p>
                    </button>
                  </div>
                </div>

                {/* 2. Target Audience */}
                <div>
                  <label className="block text-sm font-semibold mb-2 text-white">Audience</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["SUBSCRIBED", "ALL", "INDIVIDUAL"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`rounded-xl px-4 py-2.5 text-xs sm:text-sm font-medium transition ${
                          mode === m
                            ? "bg-[#C8F55A] text-black font-semibold"
                            : "bg-[var(--bg-input)] text-[var(--text-secondary)] hover:text-white border border-[var(--border)]"
                        }`}
                      >
                        {m === "SUBSCRIBED" ? "Subscribers" : m === "ALL" ? "All Users" : "Specific Users"}
                      </button>
                    ))}
                  </div>

                  {mode !== "INDIVIDUAL" && (
                    <div className="mt-3 flex items-center justify-between text-xs text-[#888] bg-[var(--surface)] px-3.5 py-2 rounded-xl border border-[var(--border)]">
                      <span>Estimated Recipients:</span>
                      <strong className="text-white text-sm font-bold">{loadingPreview ? "..." : prettyCount}</strong>
                    </div>
                  )}

                  {mode === "INDIVIDUAL" && (
                    <div className="mt-3 space-y-2">
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search user by name or email..."
                        className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white w-full focus:outline-none focus:border-[#C8F55A]"
                      />
                      {foundUsers.length > 0 && (
                        <div className="max-h-36 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
                          {foundUsers.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                if (!selectedUsers.find((x) => x.id === u.id)) {
                                  setSelectedUsers((prev) => [...prev, u])
                                }
                              }}
                              className="w-full text-left px-3 py-1.5 border-b border-[#222] hover:bg-[#202020] text-xs text-white"
                            >
                              {u.name ? `${u.name} (${u.email})` : u.email}
                            </button>
                          ))}
                        </div>
                      )}
                      {selectedUsers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {selectedUsers.map((u) => (
                            <span
                              key={u.id}
                              className="inline-flex items-center gap-1.5 rounded-full bg-[#C8F55A]/10 text-[#C8F55A] border border-[#C8F55A]/30 px-2.5 py-1 text-xs"
                            >
                              {u.email}
                              <button
                                type="button"
                                onClick={() => setSelectedUsers((prev) => prev.filter((x) => x.id !== u.id))}
                                className="hover:text-red-400"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Promotional Fields (when Promotional Mode is active) */}
                {layoutType === "PROMOTIONAL_HERO" && (
                  <div className="space-y-4 rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>🖼️</span> Hero Graphic & Promotional Meta
                    </h3>

                    {/* Preheader Top Hook */}
                    <div>
                      <label className="block text-xs text-[#A3A3A3] mb-1">
                        Top Preheader Tag (Hook / Headline)
                      </label>
                      <input
                        value={preheader}
                        onChange={(e) => setPreheader(e.target.value)}
                        placeholder="e.g. LIGHTS OUT. THE FACTORY RUNS ANYWAY."
                        className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white w-full focus:outline-none focus:border-[#C8F55A]"
                      />
                    </div>

                    {/* Hero Banner Image */}
                    <div>
                      <label className="block text-xs text-[#A3A3A3] mb-1">Hero Poster / Banner Image</label>
                      <div className="flex flex-col sm:flex-row items-center gap-3">
                        <input
                          value={bannerUrl}
                          onChange={(e) => setBannerUrl(e.target.value)}
                          placeholder="Paste image URL (https://...) or upload directly"
                          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white w-full focus:outline-none focus:border-[#C8F55A]"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="px-4 py-2.5 bg-[#262626] border border-[#3A3A3A] text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-[#333] transition shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          {uploadingImage ? "Uploading..." : "Upload Poster"}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </div>

                      {bannerUrl && (
                        <div className="mt-3 relative rounded-xl overflow-hidden border border-[#333] max-h-40 max-w-sm">
                          <img src={bannerUrl} alt="Banner Preview" className="w-full h-auto object-cover" />
                          <button
                            type="button"
                            onClick={() => setBannerUrl("")}
                            className="absolute top-2 right-2 bg-black/80 hover:bg-black text-red-400 text-xs px-2 py-1 rounded-md"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Event Detail Chips */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-[#A3A3A3] mb-1">Date Tag (Optional)</label>
                        <input
                          value={eventDateLabel}
                          onChange={(e) => setEventDateLabel(e.target.value)}
                          placeholder="e.g. SEP 26 - OCT 5"
                          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white w-full focus:outline-none focus:border-[#C8F55A]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#A3A3A3] mb-1">Location Tag (Optional)</label>
                        <input
                          value={eventLocation}
                          onChange={(e) => setEventLocation(e.target.value)}
                          placeholder="e.g. ONLINE or Nairobi"
                          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white w-full focus:outline-none focus:border-[#C8F55A]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#A3A3A3] mb-1">Highlight Badge (Optional)</label>
                        <input
                          value={eventBadge}
                          onChange={(e) => setEventBadge(e.target.value)}
                          placeholder="e.g. $5,000 Cash Prizes"
                          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-white w-full focus:outline-none focus:border-[#C8F55A]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Subject */}
                <div>
                  <label className="block text-sm font-semibold mb-1 text-white">Subject Line</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Quick 2-minute feedback — Help shape EventSlot"
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-white w-full focus:outline-none focus:border-[#C8F55A]"
                  />
                </div>

                {/* 5. Message Content */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-semibold text-white">Message Body</label>
                    <span className="text-xs text-[#737373]">
                      Supports Markdown (<strong>**bold**</strong>, <em>*italic*</em>, links, and lists)
                    </span>
                  </div>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={9}
                    placeholder="Type your announcement or promotional body..."
                    className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm text-white w-full font-mono focus:outline-none focus:border-[#C8F55A] leading-relaxed"
                  />
                  <p className="mt-1 text-xs text-[#737373]">
                    Pro-tip: Use <code className="text-[#C8F55A]">{"{{name}}"}</code> to automatically insert the recipient's first name.
                  </p>
                </div>

                {/* 6. Call-to-Action Button (Optional) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] p-4">
                  <div>
                    <label className="block text-xs text-[#A3A3A3] mb-1">CTA Button Text (Optional)</label>
                    <input
                      value={ctaText}
                      onChange={(e) => setCtaText(e.target.value)}
                      placeholder="e.g. JOIN THE CHALLENGE →"
                      className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white w-full focus:outline-none focus:border-[#C8F55A]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#A3A3A3] mb-1">CTA Button Destination URL</label>
                    <input
                      value={ctaUrl}
                      onChange={(e) => setCtaUrl(e.target.value)}
                      placeholder="e.g. https://www.eventsslot.com/events/..."
                      className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white w-full focus:outline-none focus:border-[#C8F55A]"
                    />
                  </div>
                </div>

                {/* 7. Dispatch Timing: Send Now vs. Schedule */}
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--border)] p-5 space-y-3">
                  <label className="block text-sm font-semibold text-white">Delivery Schedule</label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-white">
                      <input
                        type="radio"
                        name="timing"
                        checked={deliveryTiming === "immediate"}
                        onChange={() => setDeliveryTiming("immediate")}
                        className="accent-[#C8F55A]"
                      />
                      <span>Send Immediately</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm text-white">
                      <input
                        type="radio"
                        name="timing"
                        checked={deliveryTiming === "scheduled"}
                        onChange={() => setDeliveryTiming("scheduled")}
                        className="accent-[#C8F55A]"
                      />
                      <span>Schedule for Later (Up to 3 Months)</span>
                    </label>
                  </div>

                  {deliveryTiming === "scheduled" && (
                    <div className="pt-3 border-t border-[#262626] grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-[#A3A3A3] mb-1">Date</label>
                        <input
                          type="date"
                          min={minDate}
                          max={maxDate}
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white w-full focus:outline-none focus:border-[#C8F55A]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-[#A3A3A3] mb-1">Time</label>
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="bg-[var(--bg-input)] border border-[var(--border)] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white w-full focus:outline-none focus:border-[#C8F55A]"
                        />
                      </div>
                      <p className="sm:col-span-2 text-xs text-[#C8F55A]">
                        🕒 The automated cron worker dispatches queued campaigns at your exact scheduled date and time.
                      </p>
                    </div>
                  )}
                </div>

                {/* Status Messages */}
                {statusError && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    ⚠️ {statusError}
                  </div>
                )}

                {statusMessage && (
                  <div className="p-3.5 rounded-xl bg-[#C8F55A]/10 border border-[#C8F55A]/30 text-[#C8F55A] text-sm">
                    {statusMessage}
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-6 py-3 bg-[#C8F55A] text-[#0A0A0A] font-bold rounded-xl text-sm hover:bg-[#b5e648] transition shadow-lg shadow-[#C8F55A]/20 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting
                      ? "Processing..."
                      : deliveryTiming === "scheduled"
                      ? "📅 Schedule Broadcast"
                      : `🚀 Send Broadcast Now (${mode})`}
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode("preview")}
                    className="px-4 py-3 bg-[#262626] text-white font-semibold rounded-xl text-sm hover:bg-[#333] transition cursor-pointer"
                  >
                    Preview Email
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Scheduled Campaigns Tab */
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#262626]">
            <div>
              <h2 className="text-lg font-bold text-white">Scheduled Broadcast Queue</h2>
              <p className="text-xs text-[#888]">
                Campaigns scheduled in advance. The cron worker checks and sends them at the configured time.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchScheduled}
              disabled={loadingScheduled}
              className="text-xs px-3 py-1.5 rounded-lg border border-[#333] text-[#A3A3A3] hover:text-white"
            >
              {loadingScheduled ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {scheduledList.length === 0 ? (
            <div className="text-center py-12 text-[#737373] text-sm">
              <span className="text-3xl block mb-2">📅</span>
              No scheduled broadcasts found. Use the Compose tab to schedule campaigns up to 3 months ahead!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[#262626] text-[#888]">
                    <th className="pb-3 pr-4 font-semibold">Scheduled Date</th>
                    <th className="pb-3 pr-4 font-semibold">Subject & Style</th>
                    <th className="pb-3 pr-4 font-semibold">Target</th>
                    <th className="pb-3 pr-4 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F1F1F]">
                  {scheduledList.map((item) => (
                    <tr key={item.id} className="text-[#D4D4D4]">
                      <td className="py-3 pr-4 font-mono text-xs text-white">
                        {new Date(item.scheduledFor).toLocaleDateString()} {new Date(item.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-3 pr-4">
                        <strong className="text-white block">{item.subject}</strong>
                        <span className="text-xs text-[#888]">
                          {item.layoutType === "PROMOTIONAL_HERO" ? "🎨 Promotional Poster" : "📝 Minimal Text"}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="px-2 py-0.5 rounded text-xs bg-[var(--surface)] border border-[var(--border)] text-white">
                          {item.mode}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.status === "SCHEDULED"
                              ? "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
                              : item.status === "SENT"
                              ? "bg-green-500/10 text-green-400 border border-green-500/20"
                              : item.status === "SENDING"
                              ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}
                        >
                          {item.status}
                        </span>
                        {item.status === "SENT" && (
                          <span className="block text-[11px] text-[#737373] mt-0.5">
                            {item.sentCount} sent
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {item.status === "SCHEDULED" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSendNowScheduled(item.id)}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#C8F55A] text-black hover:bg-[#b0de43]"
                              >
                                Send Now
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelScheduled(item.id)}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold border border-red-500/30 text-red-400 hover:bg-red-500/10"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
