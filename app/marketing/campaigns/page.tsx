"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Megaphone,
  Plus,
  Calendar,
  Layers,
  Link2,
  FileText,
  Search,
  Filter,
  CheckCircle,
  Clock,
  PauseCircle,
  Archive,
  RefreshCw,
} from "lucide-react"

interface Campaign {
  id: string
  campaignId: string
  name: string
  objective: string
  description: string | null
  startDate: string
  endDate: string | null
  status: "DRAFT" | "PLANNED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED"
  targetAudience: string | null
  channels: string[]
  notes: string | null
  _count: {
    contentAssets: number
    trackingLinks: number
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Active", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" },
  PLANNED: { label: "Planned", color: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  DRAFT: { label: "Draft", color: "bg-neutral-500/10 text-neutral-400 border-neutral-500/30" },
  PAUSED: { label: "Paused", color: "bg-amber-500/10 text-amber-400 border-amber-500/30" },
  COMPLETED: { label: "Completed", color: "bg-[#C8F55A]/20 text-[#C8F55A] border-[#C8F55A]/40" },
  ARCHIVED: { label: "Archived", color: "bg-neutral-800 text-neutral-400 border-neutral-700" },
}

const CHANNELS_LIST = [
  { key: "INSTAGRAM", label: "Instagram", color: "#E1306C" },
  { key: "LINKEDIN", label: "LinkedIn", color: "#0A66C2" },
  { key: "EMAIL", label: "Email Broadcast", color: "#C8F55A" },
  { key: "WHATSAPP", label: "WhatsApp", color: "#25D366" },
  { key: "TWITTER_X", label: "Twitter / X", color: "#FFFFFF" },
]

export default function MarketingCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [showModal, setShowModal] = useState(false)

  // Modal form state
  const [name, setName] = useState("")
  const [campaignId, setCampaignId] = useState("")
  const [objective, setObjective] = useState("Brand Awareness & Acquisition")
  const [targetAudience, setTargetAudience] = useState("Event Organizers, Venues, Campuses")
  const [description, setDescription] = useState("")
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0])
  const [endDate, setEndDate] = useState("")
  const [selectedChannels, setSelectedChannels] = useState<string[]>(["INSTAGRAM", "LINKEDIN", "WHATSAPP", "EMAIL"])
  const [status, setStatus] = useState("PLANNED")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/marketing/campaigns", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load campaigns")
      const data = await res.json()
      setCampaigns(data.campaigns || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaigns()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !objective.trim() || !startDate) return

    try {
      setSubmitting(true)
      const res = await fetch("/api/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          campaignId: campaignId.trim() || undefined,
          objective: objective.trim(),
          description: description.trim() || undefined,
          startDate,
          endDate: endDate || undefined,
          status,
          targetAudience: targetAudience.trim() || undefined,
          channels: selectedChannels,
          notes: notes.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to create campaign")
      }

      setShowModal(false)
      setName("")
      setCampaignId("")
      setDescription("")
      setNotes("")
      fetchCampaigns()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error creating campaign")
    } finally {
      setSubmitting(false)
    }
  }

  const toggleChannel = (channel: string) => {
    setSelectedChannels((prev) =>
      prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]
    )
  }

  const filteredCampaigns = campaigns.filter((c) => {
    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter
    const matchesSearch =
      !searchQuery ||
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.campaignId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.objective.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#262626] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5" style={{ color: "#FFFFFF" }}>
            <Megaphone className="w-6 h-6 text-[#C8F55A]" style={{ color: "#C8F55A" }} />
            Marketing Campaigns
          </h1>
          <p className="text-sm text-[#D4D4D4] mt-1" style={{ color: "#D4D4D4" }}>
            Central orchestration object for multi-channel content assets, schedules, and attribution telemetry.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#C8F55A] hover:bg-[#b8e84a] text-[#0A0A0A] transition shadow-sm"
          style={{ color: "#0A0A0A" }}
        >
          <Plus className="w-4 h-4" />
          Create Campaign
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1 p-1 bg-[#141414] border border-[#262626] rounded-xl overflow-x-auto w-full sm:w-auto">
          {["ALL", "ACTIVE", "PLANNED", "PAUSED", "COMPLETED", "ARCHIVED"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                statusFilter === s
                  ? "bg-[#C8F55A] text-[#0A0A0A] font-semibold"
                  : "text-[#A3A3A3] hover:text-white"
              }`}
              style={{ color: statusFilter === s ? "#0A0A0A" : "#D4D4D4" }}
            >
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-[#A3A3A3] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-[#141414] border border-[#262626] rounded-xl text-xs text-white placeholder-[#737373] focus:outline-none focus:border-[#C8F55A]"
            style={{ color: "#FFFFFF" }}
          />
        </div>
      </div>

      {/* Campaigns Grid */}
      {loading ? (
        <div className="p-16 text-center text-xs text-[#A3A3A3]" style={{ color: "#A3A3A3" }}>Loading campaigns...</div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="rounded-2xl bg-[#141414] border border-[#262626] p-16 text-center space-y-3">
          <p className="text-sm text-[#D4D4D4]" style={{ color: "#D4D4D4" }}>No campaigns found matching the current filters.</p>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#1F1F1F] text-[#C8F55A] hover:bg-[#262626]"
          >
            + Create Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCampaigns.map((c) => {
            const statusConfig = STATUS_CONFIG[c.status] || STATUS_CONFIG.PLANNED
            return (
              <div
                key={c.id}
                className="rounded-2xl bg-[#141414] border border-[#262626] p-5 flex flex-col justify-between hover:border-[#3A3A3A] transition space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-[#737373] font-bold">
                      {c.campaignId}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusConfig.color}`}
                    >
                      {statusConfig.label}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white line-clamp-1">{c.name}</h3>
                    <p className="text-xs text-[#A3A3A3] line-clamp-2 mt-1">
                      {c.objective}
                    </p>
                  </div>

                  {/* Channel Badges */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {c.channels.map((ch) => (
                      <span
                        key={ch}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-[#0A0A0A] text-neutral-300 border border-[#262626]"
                      >
                        {ch}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1F1F1F] flex items-center justify-between text-xs text-[#737373]">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1" title="Content Assets">
                      <FileText className="w-3.5 h-3.5 text-[#C8F55A]" />
                      {c._count.contentAssets}
                    </span>
                    <span className="flex items-center gap-1" title="Tracking Links">
                      <Link2 className="w-3.5 h-3.5 text-blue-400" />
                      {c._count.trackingLinks}
                    </span>
                  </div>

                  <span className="text-[11px]">
                    {new Date(c.startDate).toLocaleDateString()}
                    {c.endDate ? ` - ${new Date(c.endDate).toLocaleDateString()}` : ""}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-[#C8F55A]" />
                Create New Campaign
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-[#737373] hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Capacity Management Launch"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C8F55A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                    Campaign ID (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CAP-2026-09"
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C8F55A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  Core Objective *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acquire 200 event organizers for university workshops"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C8F55A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  Target Audience
                </label>
                <input
                  type="text"
                  placeholder="e.g. Campus tech club leads, campus event heads"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C8F55A]"
                />
              </div>

              {/* Channels Selector */}
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-2">
                  Target Channels
                </label>
                <div className="flex flex-wrap gap-2">
                  {CHANNELS_LIST.map((c) => {
                    const active = selectedChannels.includes(c.key)
                    return (
                      <button
                        type="button"
                        key={c.key}
                        onClick={() => toggleChannel(c.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                          active
                            ? "bg-[#C8F55A] text-[#0A0A0A] border-[#C8F55A]"
                            : "bg-[#0A0A0A] text-[#737373] border-[#262626] hover:text-white"
                        }`}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C8F55A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[#C8F55A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  Strategic Notes & Brief
                </label>
                <textarea
                  rows={3}
                  placeholder="Key messaging points, themes, or experiment hypothesis..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                />
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
                  {submitting ? "Creating..." : "Save Campaign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
