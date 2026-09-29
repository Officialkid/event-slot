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
  const [content, setContent] = useState("Hi {{name}},\\n\\n")
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
      content: content || "Hi {{name}},\\n\\nYour message preview will appear here...",
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
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--text-primary)" }}>
            Broadcast Studio
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Send instant announcements or preschedule promotional campaigns to subscribers and platform users.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-xl p-1 border" style={{ background: "var(--bg-surface)", borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={() => setActiveTab("compose")}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition"
            style={{
              background: activeTab === "compose" ? "var(--accent)" : "transparent",
              color: activeTab === "compose" ? "var(--accent-contrast)" : "var(--text-secondary)",
            }}
          >
            Compose Broadcast
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("scheduled")}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
            style={{
              background: activeTab === "scheduled" ? "var(--accent)" : "transparent",
              color: activeTab === "scheduled" ? "var(--accent-contrast)" : "var(--text-secondary)",
            }}
          >
            <span>Scheduled Queue</span>
            {scheduledList.filter((s) => s.status === "SCHEDULED").length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-xs font-bold"
                style={{ background: "var(--bg-elevated)", color: "var(--accent)" }}
              >
                {scheduledList.filter((s) => s.status === "SCHEDULED").length}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === "compose" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-12 space-y-6">
            {/* View Mode Toggle: Editor vs Live Preview */}
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode("editor")}
                  className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition"
                  style={{
                    background: viewMode === "editor" ? "var(--accent)" : "var(--bg-surface)",
                    color: viewMode === "editor" ? "var(--accent-contrast)" : "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  ✏️ Editor
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("preview")}
                  className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition"
                  style={{
                    background: viewMode === "preview" ? "var(--accent)" : "var(--bg-surface)",
                    color: viewMode === "preview" ? "var(--accent-contrast)" : "var(--text-secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  👁️ Live Email Preview
                </button>
              </div>

              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Engine: <strong style={{ color: "var(--accent)" }}>Nodemailer Primary (SMTP)</strong> · Resend Backup
              </div>
            </div>

            {viewMode === "preview" ? (
              <div className="rounded-2xl border p-4 sm:p-8" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                <div className="max-w-2xl mx-auto shadow-2xl rounded-2xl overflow-hidden border" style={{ borderColor: "var(--border)" }}>
                  <div className="px-4 py-2.5 text-xs border-b flex items-center justify-between font-semibold" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)", borderColor: "var(--border)" }}>
                    <span>Subject: {subject || "(No Subject Set)"}</span>
                    <span>To: daniel@example.com</span>
                  </div>
                  <iframe
                    srcDoc={previewHtml}
                    title="Live Email Preview"
                    className="w-full min-h-[600px] border-0"
                    style={{ background: "#FFFFFF" }}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border p-6 sm:p-8 space-y-6" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                {/* 1. Layout Mode Selection */}
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                    Template Layout Style
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLayoutType("PROMOTIONAL_HERO")}
                      className="p-4 rounded-xl text-left border transition-all"
                      style={{
                        borderColor: layoutType === "PROMOTIONAL_HERO" ? "var(--accent)" : "var(--border)",
                        background: layoutType === "PROMOTIONAL_HERO" ? "var(--accent-dim)" : "var(--bg-surface)",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🎨</span>
                        <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                          Promotional Event Spotlight
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        Hero poster/banner graphic, event date & venue cards, bold headings, and prominent CTA button.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setLayoutType("TEXT_MINIMAL")}
                      className="p-4 rounded-xl text-left border transition-all"
                      style={{
                        borderColor: layoutType === "TEXT_MINIMAL" ? "var(--accent)" : "var(--border)",
                        background: layoutType === "TEXT_MINIMAL" ? "var(--accent-dim)" : "var(--bg-surface)",
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">📝</span>
                        <span className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                          Clean Announcement (No Hero Banner)
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                        Focused typography, markdown links, bullet lists, and optional action button. Fast and readable.
                      </p>
                    </button>
                  </div>
                </div>

                {/* 2. Target Audience */}
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                    Select Recipients (Audience)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {( ["SUBSCRIBED", "ALL", "INDIVIDUAL"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className="rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold transition"
                        style={{
                          background: mode === m ? "var(--accent)" : "var(--bg-input)",
                          color: mode === m ? "var(--accent-contrast)" : "var(--text-secondary)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {m === "SUBSCRIBED" ? "Subscribers" : m === "ALL" ? "All Users" : "Specific Users"}
                      </button>
                    ))}
                  </div>

                  {/* Contextual Recipient Metric Card */}
                  {mode !== "INDIVIDUAL" && (
                    <div
                      className="mt-3 flex items-center justify-between text-xs px-4 py-3 rounded-xl border"
                      style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}
                    >
                      <div>
                        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
                          {mode === "SUBSCRIBED"
                            ? "Subscribed Organizers & Registered Users with Marketing Consent"
                            : "All Registered Organizers & Users on the Platform"}
                        </span>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.72rem", marginTop: "2px" }}>
                          {mode === "SUBSCRIBED"
                            ? "Only sends to people who actively agreed to receive promotional updates and broadcasts."
                            : "Sends a global system announcement to every registered account."}
                        </p>
                      </div>
                      <div className="text-right pl-4">
                        <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", display: "block" }}>Total Recipients</span>
                        <strong className="text-sm font-bold" style={{ color: "var(--accent)" }}>
                          {loadingPreview ? "Calculating..." : `${prettyCount} recipients`}
                        </strong>
                      </div>
                    </div>
                  )}

                  {mode === "INDIVIDUAL" && (
                    <div className="mt-3 space-y-2">
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search user by name or email..."
                        className="rounded-xl px-3.5 py-2.5 text-xs sm:text-sm w-full focus:outline-none focus:ring-1"
                        style={{
                          background: "var(--bg-input)",
                          borderColor: "var(--border)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border)",
                        }}
                      />
                      {foundUsers.length > 0 && (
                        <div className="max-h-36 overflow-y-auto rounded-xl border" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
                          {foundUsers.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                if (!selectedUsers.find((x) => x.id === u.id)) {
                                  setSelectedUsers((prev) => [...prev, u])
                                }
                              }}
                              className="w-full text-left px-3 py-2 border-b text-xs transition"
                              style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
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
                              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border"
                              style={{
                                background: "var(--accent-dim)",
                                color: "var(--accent)",
                                borderColor: "var(--border)",
                              }}
                            >
                              {u.email}
                              <button
                                type="button"
                                onClick={() => setSelectedUsers((prev) => prev.filter((x) => x.id !== u.id))}
                                className="hover:text-red-500 font-bold ml-1"
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
                  <div className="space-y-4 rounded-xl border p-5" style={{ background: "var(--bg-elevated)", borderColor: "var(--border)" }}>
                    <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                      <span>🖼️</span> Hero Graphic & Promotional Details
                    </h3>

                    {/* Preheader Top Hook */}
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                        Top Preheader Tag (Hook / Category)
                      </label>
                      <input
                        value={preheader}
                        onChange={(e) => setPreheader(e.target.value)}
                        placeholder="e.g. SPECIAL ANNOUNCEMENT · NAIROBI EXPO 2026"
                        className="rounded-lg px-3 py-2 text-xs w-full focus:outline-none"
                        style={{
                          background: "var(--bg-input)",
                          borderColor: "var(--border)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border)",
                        }}
                      />
                    </div>

                    {/* Banner Image URL / Upload */}
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                        Hero Banner Image URL (or upload from device)
                      </label>
                      <div className="flex gap-2">
                        <input
                          value={bannerUrl}
                          onChange={(e) => setBannerUrl(e.target.value)}
                          placeholder="https://cdn.eventsslot.com/banners/poster.jpg"
                          className="rounded-lg px-3 py-2 text-xs flex-1 focus:outline-none"
                          style={{
                            background: "var(--bg-input)",
                            borderColor: "var(--border)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border)",
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingImage}
                          className="px-3.5 py-2 rounded-lg text-xs font-bold transition"
                          style={{
                            background: "var(--accent)",
                            color: "var(--accent-contrast)",
                          }}
                        >
                          {uploadingImage ? "Uploading..." : "Upload Image"}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                      </div>
                    </div>

                    {/* Event Meta Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                          Event Date Badge
                        </label>
                        <input
                          value={eventDateLabel}
                          onChange={(e) => setEventDateLabel(e.target.value)}
                          placeholder="e.g. Sat, 15 Oct · 2:00 PM"
                          className="rounded-lg px-3 py-2 text-xs w-full focus:outline-none"
                          style={{
                            background: "var(--bg-input)",
                            borderColor: "var(--border)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border)",
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                          Venue Location Badge
                        </label>
                        <input
                          value={eventLocation}
                          onChange={(e) => setEventLocation(e.target.value)}
                          placeholder="e.g. KICC Tsavo Hall, Nairobi"
                          className="rounded-lg px-3 py-2 text-xs w-full focus:outline-none"
                          style={{
                            background: "var(--bg-input)",
                            borderColor: "var(--border)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border)",
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                          Highlight Tag / Price
                        </label>
                        <input
                          value={eventBadge}
                          onChange={(e) => setEventBadge(e.target.value)}
                          placeholder="e.g. FREE ENTRY / VIP PASSHOLDER"
                          className="rounded-lg px-3 py-2 text-xs w-full focus:outline-none"
                          style={{
                            background: "var(--bg-input)",
                            borderColor: "var(--border)",
                            color: "var(--text-primary)",
                            border: "1px solid var(--border)",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Subject & Content */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                      Subject Line *
                    </label>
                    <input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      placeholder="e.g. Introducing EventSlot 2.0: Higher Speed, Better Experience"
                      className="rounded-xl px-4 py-2.5 text-sm w-full font-medium focus:outline-none"
                      style={{
                        background: "var(--bg-input)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border)",
                      }}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        Message Content (Markdown supported) *
                      </label>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        Tip: You can use <code style={{ color: "var(--accent)" }}>{"{{name}}"}</code> for attendee name.
                      </span>
                    </div>
                    <textarea
                      rows={8}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="rounded-xl p-4 text-xs sm:text-sm font-mono w-full focus:outline-none leading-relaxed"
                      style={{
                        background: "var(--bg-input)",
                        borderColor: "var(--border)",
                        color: "var(--text-primary)",
                        border: "1px solid var(--border)",
                      }}
                    />
                  </div>

                  {/* 5. Call to Action Button */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                        CTA Button Text (Optional)
                      </label>
                      <input
                        value={ctaText}
                        onChange={(e) => setCtaText(e.target.value)}
                        placeholder="e.g. Claim Free Ticket / Open Event"
                        className="rounded-lg px-3 py-2 text-xs w-full focus:outline-none"
                        style={{
                          background: "var(--bg-input)",
                          borderColor: "var(--border)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border)",
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>
                        CTA Button URL (Optional)
                      </label>
                      <input
                        value={ctaUrl}
                        onChange={(e) => setCtaUrl(e.target.value)}
                        placeholder="https://www.eventsslot.com/events/tech-summit"
                        className="rounded-lg px-3 py-2 text-xs w-full focus:outline-none"
                        style={{
                          background: "var(--bg-input)",
                          borderColor: "var(--border)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border)",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 6. Scheduling / Delivery Timing */}
                <div className="pt-4 border-t space-y-3" style={{ borderColor: "var(--border)" }}>
                  <label className="block text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                    Delivery Timing
                  </label>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="timing"
                        checked={deliveryTiming === "immediate"}
                        onChange={() => setDeliveryTiming("immediate")}
                        className="accent-green-600"
                      />
                      <span>🚀 Send Immediately</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="timing"
                        checked={deliveryTiming === "scheduled"}
                        onChange={() => setDeliveryTiming("scheduled")}
                        className="accent-green-600"
                      />
                      <span>⏰ Schedule for Future Date</span>
                    </label>
                  </div>

                  {deliveryTiming === "scheduled" && (
                    <div className="flex flex-wrap gap-3 pt-2">
                      <div>
                        <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Date</label>
                        <input
                          type="date"
                          min={minDate}
                          max={maxDate}
                          value={scheduledDate}
                          onChange={(e) => setScheduledDate(e.target.value)}
                          className="rounded-lg px-3 py-1.5 text-xs focus:outline-none border"
                          style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: "var(--text-muted)" }}>Time</label>
                        <input
                          type="time"
                          value={scheduledTime}
                          onChange={(e) => setScheduledTime(e.target.value)}
                          className="rounded-lg px-3 py-1.5 text-xs focus:outline-none border"
                          style={{ background: "var(--bg-input)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Messages */}
                {statusError && (
                  <div className="p-3 rounded-xl border text-xs font-semibold" style={{ background: "rgba(220,38,38,0.08)", borderColor: "#DC2626", color: "#DC2626" }}>
                    ⚠️ {statusError}
                  </div>
                )}
                {statusMessage && (
                  <div className="p-3 rounded-xl border text-xs font-semibold" style={{ background: "rgba(21,128,61,0.08)", borderColor: "#15803D", color: "#15803D" }}>
                    {statusMessage}
                  </div>
                )}

                {/* Submit Buttons */}
                <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: "var(--border)" }}>
                  <button
                    type="button"
                    onClick={() => setViewMode("preview")}
                    className="px-4 py-2 rounded-xl text-xs font-bold border transition"
                    style={{ borderColor: "var(--border)", background: "transparent", color: "var(--text-secondary)" }}
                  >
                    Preview Email First
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-lg transition"
                    style={{
                      background: "var(--accent)",
                      color: "var(--accent-contrast)",
                      opacity: submitting ? 0.7 : 1,
                      cursor: submitting ? "not-allowed" : "pointer",
                    }}
                  >
                    {submitting
                      ? "Dispatching..."
                      : deliveryTiming === "scheduled"
                      ? "⏰ Schedule Broadcast"
                      : `🚀 Send Broadcast (${mode === "INDIVIDUAL" ? selectedUsers.length : prettyCount})`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Scheduled Queue Tab */
        <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: "var(--border)", background: "var(--bg-surface)" }}>
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-base font-bold" style={{ color: "var(--text-primary)" }}>
              Scheduled Broadcast Campaigns
            </h2>
            <button
              type="button"
              onClick={fetchScheduled}
              className="text-xs font-semibold"
              style={{ color: "var(--accent)" }}
            >
              🔄 Refresh List
            </button>
          </div>

          {loadingScheduled ? (
            <p className="text-xs py-8 text-center" style={{ color: "var(--text-muted)" }}>Loading scheduled queue...</p>
          ) : scheduledList.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <span className="text-3xl">📅</span>
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>No upcoming scheduled broadcasts</p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                When you schedule campaigns for future dates, they will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledList.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                        {item.subject}
                      </strong>
                      <span
                        className="px-2 py-0.5 rounded-full text-[0.65rem] font-bold"
                        style={{
                          background: item.status === "SCHEDULED" ? "var(--accent-dim)" : "rgba(100,116,139,0.1)",
                          color: item.status === "SCHEDULED" ? "var(--accent)" : "var(--text-muted)",
                        }}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      Scheduled For: <strong>{new Date(item.scheduledFor).toLocaleString()}</strong> · Audience: {item.mode}
                    </p>
                  </div>

                  {item.status === "SCHEDULED" && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleSendNowScheduled(item.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border"
                        style={{ background: "var(--accent)", color: "var(--accent-contrast)", borderColor: "var(--accent)" }}
                      >
                        Send Now
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelScheduled(item.id)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border"
                        style={{ borderColor: "var(--border)", background: "transparent", color: "#DC2626" }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
