"use client"

import { useState, useEffect } from "react"
import {
  Link2,
  Plus,
  Copy,
  Check,
  ExternalLink,
  BarChart3,
  MousePointerClick,
  Layers,
  Sparkles,
  RefreshCw,
} from "lucide-react"

interface TrackingLink {
  id: string
  code: string
  destinationUrl: string
  utmSource: string
  utmMedium: string
  utmCampaign: string
  utmContent: string | null
  fullUrl: string
  shortUrl: string
  clickCount: number
  createdAt: string
  campaign?: {
    id: string
    campaignId: string
    name: string
  } | null
  _count: {
    touches: number
    contentAssets: number
  }
}

interface CampaignOption {
  id: string
  campaignId: string
  name: string
}

const CHANNEL_PRESETS: Record<string, { medium: string; label: string }> = {
  instagram: { medium: "organic_social", label: "Instagram" },
  linkedin: { medium: "organic_social", label: "LinkedIn" },
  whatsapp: { medium: "community", label: "WhatsApp Community" },
  email: { medium: "promotional", label: "Email Broadcast" },
  twitter_x: { medium: "organic_social", label: "Twitter / X" },
}

export default function MarketingTrackingPage() {
  const [links, setLinks] = useState<TrackingLink[]>([])
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  // Link Builder State
  const [campaignId, setCampaignId] = useState("")
  const [destinationUrl, setDestinationUrl] = useState("https://www.eventsslot.com/pricing")
  const [selectedChannel, setSelectedChannel] = useState("instagram")
  const [customSource, setCustomSource] = useState("")
  const [customMedium, setCustomMedium] = useState("")
  const [utmCampaign, setUtmCampaign] = useState("capacity_management")
  const [utmContent, setUtmContent] = useState("reel_01")
  const [customCode, setCustomCode] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const [lRes, cRes] = await Promise.all([
        fetch("/api/marketing/tracking", { cache: "no-store" }),
        fetch("/api/marketing/campaigns", { cache: "no-store" }),
      ])
      const lData = await lRes.json()
      const cData = await cRes.json()
      setLinks(lData.links || [])
      setCampaigns(cData.campaigns || [])
      if (cData.campaigns?.length > 0 && !campaignId) {
        setCampaignId(cData.campaigns[0].id)
        setUtmCampaign(cData.campaigns[0].name.toLowerCase().replace(/\s+/g, "_"))
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

  const handleCampaignChange = (cId: string) => {
    setCampaignId(cId)
    const found = campaigns.find((c) => c.id === cId)
    if (found) {
      setUtmCampaign(found.name.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 30))
    }
  }

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault()
    const finalSource = selectedChannel === "custom" ? customSource : selectedChannel
    const finalMedium = selectedChannel === "custom" ? customMedium : CHANNEL_PRESETS[selectedChannel]?.medium || "referral"

    if (!destinationUrl.trim() || !finalSource || !finalMedium || !utmCampaign) {
      alert("Please fill in destination URL, source, medium, and campaign.")
      return
    }

    try {
      setSubmitting(true)
      const res = await fetch("/api/marketing/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaignId || undefined,
          destinationUrl: destinationUrl.trim(),
          utmSource: finalSource,
          utmMedium: finalMedium,
          utmCampaign,
          utmContent: utmContent.trim() || undefined,
          customCode: customCode.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create link")

      setShowModal(false)
      setCustomCode("")
      fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error creating link")
    } finally {
      setSubmitting(false)
    }
  }

  const copyLink = (url: string, code: string) => {
    navigator.clipboard.writeText(url)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(null), 2500)
  }

  const totalClicks = links.reduce((acc, l) => acc + l.clickCount, 0)
  const totalTouches = links.reduce((acc, l) => acc + (l._count?.touches || 0), 0)

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#262626] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Link2 className="w-6 h-6 text-[#C8F55A]" />
            UTM Tracking & Shortlink Engine
          </h1>
          <p className="text-sm text-[#A3A3A3] mt-1">
            Automated UTM parameter generator and first-party attribution tracking links (`/l/[code]`).
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#C8F55A] hover:bg-[#b8e84a] text-[#0A0A0A] transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Generate Tracking Link
        </button>
      </div>

      {/* Quick KPI stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#141414] border border-[#262626]">
          <p className="text-xs text-[#737373] uppercase font-semibold">Active Tracking Links</p>
          <p className="text-2xl font-bold text-white mt-1">{links.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-[#141414] border border-[#262626]">
          <p className="text-xs text-[#737373] uppercase font-semibold">Total Clicks Recorded</p>
          <p className="text-2xl font-bold text-[#C8F55A] mt-1">{totalClicks.toLocaleString()}</p>
        </div>
        <div className="p-4 rounded-xl bg-[#141414] border border-[#262626]">
          <p className="text-xs text-[#737373] uppercase font-semibold">Attribution Touches Logged</p>
          <p className="text-2xl font-bold text-blue-400 mt-1">{totalTouches.toLocaleString()}</p>
        </div>
      </div>

      {/* Links Table */}
      <div className="rounded-2xl bg-[#141414] border border-[#262626] overflow-hidden">
        <div className="p-4 border-b border-[#262626] flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Generated Tracking Links</h2>
          <button onClick={fetchData} className="p-1.5 text-[#737373] hover:text-white transition">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-[#737373]">Loading tracking links...</div>
        ) : links.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#737373] space-y-2">
            <p>No tracking links generated yet.</p>
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1F1F1F] text-[#C8F55A]"
            >
              + Create First Link
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0A0A0A] text-[#737373] text-xs uppercase border-b border-[#262626]">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Shortlink / Code</th>
                  <th className="py-3.5 px-4 font-semibold">Campaign</th>
                  <th className="py-3.5 px-4 font-semibold">Source & Medium</th>
                  <th className="py-3.5 px-4 font-semibold">Content Tag</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Clicks</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Copy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626]">
                {links.map((link) => (
                  <tr key={link.id} className="hover:bg-[#1A1A1A]/50 transition">
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-mono font-bold text-white text-xs flex items-center gap-1.5">
                          /l/{link.code}
                        </p>
                        <p className="text-[11px] text-[#737373] truncate max-w-xs">{link.destinationUrl}</p>
                      </div>
                    </td>

                    <td className="py-4 px-4 text-xs text-neutral-300">
                      {link.campaign?.name || link.utmCampaign}
                    </td>

                    <td className="py-4 px-4">
                      <span className="text-xs font-medium text-white">{link.utmSource}</span>
                      <span className="text-[11px] text-[#737373] ml-1.5">({link.utmMedium})</span>
                    </td>

                    <td className="py-4 px-4 text-xs font-mono text-[#A3A3A3]">
                      {link.utmContent || "—"}
                    </td>

                    <td className="py-4 px-4 text-right">
                      <span className="font-mono font-bold text-[#C8F55A] text-sm">
                        {link.clickCount}
                      </span>
                    </td>

                    <td className="py-4 px-4 text-right">
                      <button
                        onClick={() => copyLink(link.shortUrl, link.code)}
                        className="p-1.5 rounded-lg bg-[#1F1F1F] hover:bg-[#2A2A2A] text-white border border-[#333] transition"
                        title="Copy shortlink"
                      >
                        {copiedCode === link.code ? (
                          <Check className="w-3.5 h-3.5 text-[#C8F55A]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Link Generator Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#262626] pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Link2 className="w-5 h-5 text-[#C8F55A]" />
                Generate UTM Tracking Link
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[#737373] hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLink} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  Associated Campaign
                </label>
                <select
                  value={campaignId}
                  onChange={(e) => handleCampaignChange(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.campaignId})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                  Destination URL *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://www.eventsslot.com/pricing"
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                />
              </div>

              {/* Channel Preset Buttons */}
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                  Channel Preset
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(CHANNEL_PRESETS).map(([key, info]) => (
                    <button
                      type="button"
                      key={key}
                      onClick={() => setSelectedChannel(key)}
                      className={`p-2 rounded-xl text-left border transition ${
                        selectedChannel === key
                          ? "bg-[#C8F55A]/10 border-[#C8F55A] text-[#C8F55A]"
                          : "bg-[#0A0A0A] border-[#262626] text-[#737373] hover:text-white"
                      }`}
                    >
                      <p className="text-xs font-bold">{info.label}</p>
                      <p className="text-[10px] text-[#737373] truncate">{info.medium}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                    utm_campaign *
                  </label>
                  <input
                    type="text"
                    required
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                    className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#A3A3A3] mb-1">
                    utm_content (e.g. reel_01)
                  </label>
                  <input
                    type="text"
                    placeholder="reel_01 or post_02"
                    value={utmContent}
                    onChange={(e) => setUtmContent(e.target.value)}
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
                  {submitting ? "Generating..." : "Generate Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
