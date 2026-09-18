"use client"

import { useState, useEffect } from "react"
import {
  FileText,
  Plus,
  Sparkles,
  Calendar,
  Clock,
  CheckCircle2,
  Copy,
  Check,
  Share2,
  Send,
  Eye,
  ArrowRight,
  Filter,
  History,
  ShieldCheck,
  AlertCircle,
  Link2,
} from "lucide-react"

interface ContentItem {
  id: string
  campaignId: string
  channel: "INSTAGRAM" | "LINKEDIN" | "EMAIL" | "WHATSAPP" | "TWITTER_X"
  contentType: string
  title: string
  caption: string
  mediaUrls: string[]
  ctaText: string | null
  destinationUrl: string | null
  status: "DRAFT" | "IN_REVIEW" | "APPROVED" | "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED"
  scheduledFor: string | null
  publishedAt: string | null
  createdById: string
  approvedById: string | null
  approvedAt: string | null
  failureReason: string | null
  createdAt: string
  campaign: {
    id: string
    campaignId: string
    name: string
  }
  trackingLink?: {
    id: string
    code: string
    shortUrl: string
    clickCount: number
  } | null
}

interface CampaignOption {
  id: string
  campaignId: string
  name: string
}

const STATUS_PIPELINE = ["DRAFT", "IN_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED"]

const CHANNEL_BADGES: Record<string, { label: string; color: string; border: string }> = {
  INSTAGRAM: { label: "Instagram", color: "bg-[#E1306C]/10 text-[#E1306C]", border: "border-[#E1306C]/30" },
  LINKEDIN: { label: "LinkedIn", color: "bg-[#0A66C2]/10 text-blue-400", border: "border-[#0A66C2]/30" },
  WHATSAPP: { label: "WhatsApp", color: "bg-[#25D366]/10 text-emerald-400", border: "border-[#25D366]/30" },
  EMAIL: { label: "Email Broadcast", color: "bg-[#C8F55A]/10 text-[#C8F55A]", border: "border-[#C8F55A]/30" },
  TWITTER_X: { label: "Twitter / X", color: "bg-neutral-800 text-white", border: "border-neutral-700" },
}

export default function MarketingContentPage() {
  const [items, setItems] = useState<ContentItem[]>([])
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [loading, setLoading] = useState(true)
  const [channelFilter, setChannelFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [showModal, setShowModal] = useState(false)
  const [selectedAuditItem, setSelectedAuditItem] = useState<ContentItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Composer Form State
  const [selectedCampaignId, setSelectedCampaignId] = useState("")
  const [channel, setChannel] = useState<"INSTAGRAM" | "LINKEDIN" | "WHATSAPP" | "EMAIL">("INSTAGRAM")
  const [contentType, setContentType] = useState("Post")
  const [title, setTitle] = useState("")
  const [caption, setCaption] = useState("")
  const [ctaText, setCtaText] = useState("Register Now")
  const [destinationUrl, setDestinationUrl] = useState("https://www.eventsslot.com")
  const [scheduledFor, setScheduledFor] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [generatingAi, setGeneratingAi] = useState(false)
  const [aiTopic, setAiTopic] = useState("")

  const fetchData = async () => {
    try {
      setLoading(true)
      const [cRes, iRes] = await Promise.all([
        fetch("/api/marketing/campaigns"),
        fetch("/api/marketing/content"),
      ])
      const cData = await cRes.json()
      const iData = await iRes.json()
      setCampaigns(cData.campaigns || [])
      setItems(iData.contentItems || [])
      if (cData.campaigns?.length > 0 && !selectedCampaignId) {
        setSelectedCampaignId(cData.campaigns[0].id)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleAiSuggest = async () => {
    if (!aiTopic.trim()) {
      alert("Please enter a brief topic or prompt for Gemini.")
      return
    }

    try {
      setGeneratingAi(true)
      const res = await fetch("/api/marketing/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          topicOrIdea: aiTopic.trim(),
          campaignName: campaigns.find((c) => c.id === selectedCampaignId)?.name || "EventSlot Launch",
          destinationUrl,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "AI generation failed")

      setCaption(data.copy)
    } catch (err) {
      alert(err instanceof Error ? err.message : "AI generation failed")
    } finally {
      setGeneratingAi(false)
    }
  }

  const handleCreateContent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCampaignId || !title.trim() || !caption.trim()) return

    try {
      setSubmitting(true)
      const res = await fetch("/api/marketing/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: selectedCampaignId,
          channel,
          contentType,
          title: title.trim(),
          caption: caption.trim(),
          ctaText: ctaText.trim() || undefined,
          destinationUrl: destinationUrl.trim() || undefined,
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create content")

      setShowModal(false)
      setTitle("")
      setCaption("")
      setAiTopic("")
      fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create content")
    } finally {
      setSubmitting(false)
    }
  }

  const handleWorkflowAction = async (id: string, action: string) => {
    try {
      const res = await fetch(`/api/marketing/content/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowAction: action }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Action failed")

      fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed")
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const filteredItems = items.filter((item) => {
    const matchesChannel = channelFilter === "ALL" || item.channel === channelFilter
    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter
    return matchesChannel && matchesStatus
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#262626] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-[#C8F55A]" />
            Content Studio & Approval Pipeline
          </h1>
          <p className="text-sm text-[#A3A3A3] mt-1">
            Channel-specific composers, strict approval workflow, and multi-channel asset management.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#C8F55A] hover:bg-[#b8e84a] text-[#0A0A0A] transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Create Content Asset
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Channel Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[#141414] border border-[#262626] rounded-xl overflow-x-auto">
          {["ALL", "INSTAGRAM", "LINKEDIN", "WHATSAPP", "EMAIL"].map((c) => (
            <button
              key={c}
              onClick={() => setChannelFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                channelFilter === c
                  ? "bg-[#C8F55A] text-[#0A0A0A]"
                  : "text-[#737373] hover:text-white"
              }`}
            >
              {c === "ALL" ? "All Channels" : c.charAt(0) + c.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Status Dropdown */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#141414] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="APPROVED">Approved</option>
          <option value="SCHEDULED">Scheduled</option>
          <option value="PUBLISHED">Published</option>
        </select>
      </div>

      {/* Content Assets Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-[#737373]">Loading content studio...</div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl bg-[#141414] border border-[#262626] p-16 text-center space-y-3">
          <p className="text-sm text-neutral-400">No content assets created for this view yet.</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#1F1F1F] text-[#C8F55A] hover:bg-[#262626]"
          >
            + Create Content Asset
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => {
            const channelBadge = CHANNEL_BADGES[item.channel] || CHANNEL_BADGES.INSTAGRAM
            return (
              <div
                key={item.id}
                className="rounded-2xl bg-[#141414] border border-[#262626] p-5 flex flex-col justify-between hover:border-[#3A3A3A] transition space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${channelBadge.color} ${channelBadge.border}`}
                    >
                      {item.channel} • {item.contentType}
                    </span>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        item.status === "PUBLISHED"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : item.status === "SCHEDULED"
                          ? "bg-blue-500/20 text-blue-400 border-blue-500/40"
                          : item.status === "APPROVED"
                          ? "bg-[#C8F55A]/20 text-[#C8F55A] border-[#C8F55A]/40"
                          : item.status === "IN_REVIEW"
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                          : "bg-neutral-800 text-neutral-400 border-neutral-700"
                      }`}
                    >
                      {item.status.replace("_", " ")}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white line-clamp-1">{item.title}</h3>
                    <p className="text-xs text-[#737373] line-clamp-1">
                      Campaign: {item.campaign.name}
                    </p>
                  </div>

                  {/* Caption preview box */}
                  <div className="p-3 rounded-xl bg-[#0A0A0A] border border-[#262626] text-xs text-neutral-300 font-sans line-clamp-4 whitespace-pre-line">
                    {item.caption}
                  </div>

                  {/* WhatsApp Quick Actions (1-Click Copy) */}
                  {item.channel === "WHATSAPP" && (
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `${item.caption}\n\n👉 ${item.destinationUrl || "https://www.eventsslot.com"}`,
                            `msg-${item.id}`
                          )
                        }
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-semibold bg-[#25D366]/10 hover:bg-[#25D366]/20 text-emerald-400 border border-[#25D366]/30 transition"
                      >
                        {copiedId === `msg-${item.id}` ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Copy Message
                          </>
                        )}
                      </button>

                      {item.destinationUrl && (
                        <button
                          onClick={() => copyToClipboard(item.destinationUrl!, `link-${item.id}`)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1F1F1F] hover:bg-[#2A2A2A] text-neutral-300 border border-[#333] transition"
                          title="Copy Link"
                        >
                          {copiedId === `link-${item.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Link2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Workflow Action Footers */}
                <div className="pt-3 border-t border-[#1F1F1F] space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-[#737373]">
                    <span>
                      {item.scheduledFor
                        ? `Scheduled: ${new Date(item.scheduledFor).toLocaleDateString()}`
                        : `Created: ${new Date(item.createdAt).toLocaleDateString()}`}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    {item.status === "DRAFT" && (
                      <button
                        onClick={() => handleWorkflowAction(item.id, "submit_for_review")}
                        className="w-full py-1.5 px-3 rounded-lg text-xs font-semibold bg-[#1F1F1F] hover:bg-[#262626] text-amber-400 border border-amber-500/30 transition flex items-center justify-center gap-1"
                      >
                        Submit for Review →
                      </button>
                    )}

                    {item.status === "IN_REVIEW" && (
                      <div className="flex items-center gap-2 w-full">
                        <button
                          onClick={() => handleWorkflowAction(item.id, "approve")}
                          className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-[#C8F55A] hover:bg-[#b8e84a] text-[#0A0A0A] transition flex items-center justify-center gap-1"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button
                          onClick={() => handleWorkflowAction(item.id, "reject")}
                          className="py-1.5 px-2.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-[#1F1F1F]"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {item.status === "APPROVED" && (
                      <div className="flex items-center gap-2 w-full">
                        <button
                          onClick={() => handleWorkflowAction(item.id, "publish")}
                          className="flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition flex items-center justify-center gap-1"
                        >
                          Publish Now
                        </button>
                      </div>
                    )}

                    {item.status === "SCHEDULED" && (
                      <div className="w-full text-center py-1 rounded bg-[#0A0A0A] text-blue-400 text-xs font-medium flex items-center justify-center gap-1.5">
                        <Clock className="w-3 h-3" /> Scheduled for Auto-Publish
                      </div>
                    )}

                    {item.status === "PUBLISHED" && (
                      <div className="w-full text-center py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-semibold flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Published
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Composer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#C8F55A]" />
                Channel Content Composer
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#737373] hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateContent} className="space-y-4">
              {/* Campaign Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                    Associated Campaign *
                  </label>
                  <select
                    required
                    value={selectedCampaignId}
                    onChange={(e) => setSelectedCampaignId(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                  >
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.campaignId} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Channel Selector Tabs */}
                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                    Target Channel *
                  </label>
                  <div className="grid grid-cols-4 gap-1 p-1 bg-[#0A0A0A] border border-[#262626] rounded-xl">
                    {(["INSTAGRAM", "LINKEDIN", "WHATSAPP", "EMAIL"] as const).map((ch) => (
                      <button
                        type="button"
                        key={ch}
                        onClick={() => {
                          setChannel(ch)
                          if (ch === "INSTAGRAM") setContentType("Post")
                          if (ch === "LINKEDIN") setContentType("Article Post")
                          if (ch === "WHATSAPP") setContentType("Community Blast")
                          if (ch === "EMAIL") setContentType("Broadcast")
                        }}
                        className={`py-1.5 text-[11px] font-semibold rounded-lg transition ${
                          channel === ch
                            ? "bg-[#C8F55A] text-[#0A0A0A]"
                            : "text-[#737373] hover:text-white"
                        }`}
                      >
                        {ch === "INSTAGRAM"
                          ? "Instagram"
                          : ch === "LINKEDIN"
                          ? "LinkedIn"
                          : ch === "WHATSAPP"
                          ? "WhatsApp"
                          : "Email"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                    Asset Title / Working Label *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Reel 01 — Capacity feature walkthrough"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                    Content Type / Format
                  </label>
                  <input
                    type="text"
                    value={contentType}
                    onChange={(e) => setContentType(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                  />
                </div>
              </div>

              {/* Gemini AI Copy Ideator Box */}
              <div className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#262626] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#C8F55A]" />
                    Gemini AI Copy Assistant ({channel})
                  </span>
                  <span className="text-[10px] text-[#737373] font-mono">Channel-Tuned</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Describe the post focus for ${channel}...`}
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    className="flex-1 bg-[#141414] border border-[#333] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#737373] focus:outline-none focus:border-[#C8F55A]"
                  />
                  <button
                    type="button"
                    onClick={handleAiSuggest}
                    disabled={generatingAi}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#C8F55A] border border-[#333] transition disabled:opacity-50"
                  >
                    {generatingAi ? "Writing..." : "Generate Copy"}
                  </button>
                </div>
              </div>

              {/* Channel-Specific Caption / Body */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-[#A3A3A3]">
                    {channel === "INSTAGRAM"
                      ? "Instagram Caption & Hashtags *"
                      : channel === "LINKEDIN"
                      ? "LinkedIn Post Copy *"
                      : channel === "WHATSAPP"
                      ? "WhatsApp Message (*bold*, _italics_) *"
                      : "Email Broadcast Content *"}
                  </label>
                  <span className="text-[10px] text-[#737373] font-mono">{caption.length} chars</span>
                </div>
                <textarea
                  required
                  rows={6}
                  placeholder={`Write channel-tailored copy for ${channel}...`}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#C8F55A] font-sans"
                />
              </div>

              {/* Destination URL & CTA */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                    Destination URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.eventsslot.com/pricing"
                    value={destinationUrl}
                    onChange={(e) => setDestinationUrl(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                    Scheduled Publish Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-[#262626]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#737373] hover:text-white bg-[#1F1F1F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-[#C8F55A] text-[#0A0A0A] hover:bg-[#b8e84a] transition disabled:opacity-50"
                >
                  {submitting ? "Saving Draft..." : "Save Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
