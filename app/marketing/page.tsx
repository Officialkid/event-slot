"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  Megaphone,
  Calendar,
  Send,
  BarChart3,
  Users,
  Eye,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  Layers,
  HelpCircle,
  Share2,
} from "lucide-react"

interface DashboardData {
  range: string
  kpis: {
    activeCampaigns: number
    totalCampaigns: number
    scheduledContent: number
    publishedContent: number
    pendingApprovals: number
    websiteVisits: number
    trackedVisitors: number
    totalTrackingClicks: number
    signups: number
    eventsCreated: number
    eventsPublished: number
    conversionRate: string
  }
  attributionBreakdown: {
    tracked: number
    attributed: number
    direct: number
    unknown: number
  }
  channelPerformance: Record<string, { visits: number; clicks: number; signups: number; events: number }>
  upcomingScheduled: Array<{
    id: string
    title: string
    channel: string
    contentType: string
    scheduledFor: string
    campaign: { name: string; campaignId: string }
  }>
}

interface AIInsights {
  summary: string
  whatPerformedWell: string[]
  whatUnderperformed: string[]
  recommendations: string[]
}

const RANGES = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last_7_days", label: "Last 7 Days" },
  { key: "last_30_days", label: "Last 30 Days" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
]

export default function MarketingDashboardPage() {
  const [range, setRange] = useState("last_30_days")
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)

  const fetchDashboard = async (selectedRange: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/marketing/analytics?range=${selectedRange}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load analytics")
      const json = await res.json()
      setData(json)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchAiInsights = async (selectedRange: string) => {
    try {
      setLoadingAi(true)
      const res = await fetch(`/api/marketing/ai/insights?range=${selectedRange}`, { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load AI insights")
      const json = await res.json()
      setAiInsights(json.insights)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingAi(false)
    }
  }

  useEffect(() => {
    fetchDashboard(range)
    fetchAiInsights(range)
  }, [range])

  const totalAttributionTouches =
    (data?.attributionBreakdown.tracked || 0) +
    (data?.attributionBreakdown.attributed || 0) +
    (data?.attributionBreakdown.direct || 0) +
    (data?.attributionBreakdown.unknown || 0)

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Welcome & Range Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5" style={{ color: "#FFFFFF" }}>
            Marketing Overview
          </h1>
          <p className="text-sm text-[#D4D4D4] mt-1" style={{ color: "#D4D4D4" }}>
            Real-time operating metrics, multi-channel performance, and campaign conversion telemetry.
          </p>
        </div>

        {/* Range Selector */}
        <div className="flex items-center gap-1.5 p-1 bg-[#141414] border border-[#262626] rounded-xl overflow-x-auto">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                range === r.key
                  ? "bg-[#C8F55A] text-[#0A0A0A] font-semibold"
                  : "text-[#A3A3A3] hover:text-white"
              }`}
              style={{ color: range === r.key ? "#0A0A0A" : "#D4D4D4" }}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => {
              fetchDashboard(range)
              fetchAiInsights(range)
            }}
            className="p-1.5 rounded-lg text-[#737373] hover:text-white transition ml-1"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] space-y-1">
          <div className="flex items-center justify-between text-[#737373]">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Campaigns</span>
            <Megaphone className="w-4 h-4 text-[#C8F55A]" />
          </div>
          <p className="text-3xl font-extrabold text-white">
            {loading ? "..." : data?.kpis.activeCampaigns || 0}
          </p>
          <p className="text-xs text-[#737373]">
            {data?.kpis.totalCampaigns || 0} total campaigns configured
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] space-y-1">
          <div className="flex items-center justify-between text-[#737373]">
            <span className="text-xs font-semibold uppercase tracking-wider">Scheduled Posts</span>
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-3xl font-extrabold text-white">
            {loading ? "..." : data?.kpis.scheduledContent || 0}
          </p>
          <p className="text-xs text-[#737373]">
            {data?.kpis.pendingApprovals || 0} items awaiting approval
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] space-y-1">
          <div className="flex items-center justify-between text-[#737373]">
            <span className="text-xs font-semibold uppercase tracking-wider">Tracked Visits</span>
            <Eye className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-3xl font-extrabold text-white">
            {loading ? "..." : data?.kpis.websiteVisits.toLocaleString() || 0}
          </p>
          <p className="text-xs text-[#737373]">
            {data?.kpis.trackedVisitors || 0} unique visitor footprints
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[#141414] border border-[#262626] space-y-1">
          <div className="flex items-center justify-between text-[#737373]">
            <span className="text-xs font-semibold uppercase tracking-wider">Signups & Events</span>
            <TrendingUp className="w-4 h-4 text-[#C8F55A]" />
          </div>
          <p className="text-3xl font-extrabold text-[#C8F55A]">
            {loading ? "..." : `${data?.kpis.signups || 0} / ${data?.kpis.eventsCreated || 0}`}
          </p>
          <p className="text-xs text-[#737373]">
            {data?.kpis.conversionRate} visitor-to-signup rate
          </p>
        </div>
      </div>

      {/* Attribution & Traffic Breakdown (Honest Telemetry) */}
      <div className="rounded-2xl bg-[#141414] border border-[#262626] p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#262626] pb-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#C8F55A]" />
              Attribution Model Breakdown
            </h2>
            <p className="text-xs text-[#A3A3A3] mt-0.5">
              Honest telemetry distinguishing verified campaign sources from organic, direct, and un-attributed visits.
            </p>
          </div>
          <span className="text-xs font-mono text-[#737373]">
            Total Touches: {totalAttributionTouches.toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1">
          <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626]">
            <div className="flex items-center justify-between text-xs text-[#A3A3A3]">
              <span>Attributed (Campaign)</span>
              <span className="w-2 h-2 rounded-full bg-[#C8F55A]"></span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">
              {data?.attributionBreakdown.attributed || 0}
            </p>
            <p className="text-[11px] text-[#737373] mt-0.5">
              Verified UTM Campaign + conversion journey
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626]">
            <div className="flex items-center justify-between text-xs text-[#A3A3A3]">
              <span>Tracked (Channel)</span>
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">
              {data?.attributionBreakdown.tracked || 0}
            </p>
            <p className="text-[11px] text-[#737373] mt-0.5">
              Identified source without specific campaign
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626]">
            <div className="flex items-center justify-between text-xs text-[#A3A3A3]">
              <span>Direct Traffic</span>
              <span className="w-2 h-2 rounded-full bg-neutral-400"></span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">
              {data?.attributionBreakdown.direct || 0}
            </p>
            <p className="text-[11px] text-[#737373] mt-0.5">
              Bookmarked or direct URL navigation
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626]">
            <div className="flex items-center justify-between text-xs text-[#A3A3A3]">
              <span>Unknown / Untracked</span>
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            </div>
            <p className="text-2xl font-bold text-white mt-1">
              {data?.attributionBreakdown.unknown || 0}
            </p>
            <p className="text-[11px] text-[#737373] mt-0.5">
              No referrer or tracking header detected
            </p>
          </div>
        </div>
      </div>

      {/* Main 2-Column: Channel Performance & Upcoming Scheduled */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (7 cols): Channel Performance */}
        <div className="lg:col-span-7 rounded-2xl bg-[#141414] border border-[#262626] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#262626] pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#C8F55A]" />
                Channel Performance
              </h2>
              <p className="text-xs text-[#A3A3A3] mt-0.5">
                Visits, clicks, and converted event creations by channel.
              </p>
            </div>
            <Link
              href="/marketing/analytics"
              className="text-xs text-[#C8F55A] hover:underline flex items-center gap-1"
            >
              Full Analytics <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {[
              { key: "instagram", name: "Instagram", color: "#E1306C" },
              { key: "linkedin", name: "LinkedIn", color: "#0A66C2" },
              { key: "email", name: "Email Broadcasts", color: "#C8F55A" },
              { key: "whatsapp", name: "WhatsApp Community", color: "#25D366" },
              { key: "direct", name: "Direct / Organic", color: "#A8A9AD" },
            ].map((c) => {
              const stats = data?.channelPerformance[c.key] || { visits: 0, clicks: 0, signups: 0, events: 0 }
              return (
                <div
                  key={c.key}
                  className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }}></span>
                    <div>
                      <p className="text-sm font-semibold text-white">{c.name}</p>
                      <p className="text-xs text-[#737373]">{stats.visits} visits &nbsp;•&nbsp; {stats.clicks} link clicks</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-white">
                      {stats.signups} signups
                    </p>
                    <p className="text-xs text-[#C8F55A]">
                      {stats.events} events created
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column (5 cols): Upcoming Scheduled Posts */}
        <div className="lg:col-span-5 rounded-2xl bg-[#141414] border border-[#262626] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#262626] pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                Upcoming Queue
              </h2>
              <p className="text-xs text-[#A3A3A3] mt-0.5">
                Next scheduled multi-channel publications.
              </p>
            </div>
            <Link
              href="/marketing/calendar"
              className="text-xs text-[#C8F55A] hover:underline flex items-center gap-1"
            >
              Calendar View <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-[#737373]">Loading queue...</div>
          ) : !data?.upcomingScheduled || data.upcomingScheduled.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#737373] space-y-2">
              <p>No content scheduled for publication.</p>
              <Link
                href="/marketing/content"
                className="inline-block px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1F1F1F] text-[#C8F55A] hover:bg-[#262626]"
              >
                + Schedule Content
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data.upcomingScheduled.map((item) => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl bg-[#0A0A0A] border border-[#262626] space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#1A1A1A] text-[#C8F55A] border border-[#2A2A2A]">
                      {item.channel}
                    </span>
                    <span className="text-xs text-[#737373] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(item.scheduledFor).toLocaleDateString()} {new Date(item.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white truncate">{item.title}</p>
                  <p className="text-xs text-[#737373] truncate">
                    Campaign: {item.campaign.name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Marketing Intelligence Section */}
      <div className="rounded-2xl bg-gradient-to-br from-[#141414] to-[#1A1A1A] border border-[#2A2A2A] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#2A2A2A] pb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C8F55A]/10 border border-[#C8F55A]/30 flex items-center justify-center text-[#C8F55A]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Gemini AI Marketing Insights
              </h2>
              <p className="text-xs text-[#A3A3A3]">
                Automated intelligence grounded in verified EventSlot database conversions and channel telemetry.
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchAiInsights(range)}
            disabled={loadingAi}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#1F1F1F] hover:bg-[#2A2A2A] text-[#C8F55A] border border-[#333] transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAi ? "animate-spin" : ""}`} />
            {loadingAi ? "Analyzing Telemetry..." : "Regenerate Analysis"}
          </button>
        </div>

        {loadingAi ? (
          <div className="p-8 text-center text-xs text-[#737373] animate-pulse">
            Gemini is analyzing channel traffic, signup ratios, and campaign trends...
          </div>
        ) : !aiInsights ? (
          <div className="p-8 text-center text-xs text-[#737373]">
            Click Regenerate Analysis to generate an executive marketing intelligence summary.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-[#0A0A0A]/60 border border-[#2A2A2A]">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#C8F55A] mb-1">
                Executive Synthesis
              </p>
              <p className="text-sm text-neutral-200 leading-relaxed">{aiInsights.summary}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-[#0A0A0A]/40 border border-[#262626] space-y-2">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wide">
                  ✓ What Performed Well
                </p>
                <ul className="space-y-1.5 text-xs text-[#A3A3A3]">
                  {aiInsights.whatPerformedWell.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-[#0A0A0A]/40 border border-[#262626] space-y-2">
                <p className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                  ⚠ What Underperformed / Gaps
                </p>
                <ul className="space-y-1.5 text-xs text-[#A3A3A3]">
                  {aiInsights.whatUnderperformed.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-[#0A0A0A]/40 border border-[#262626] space-y-2">
                <p className="text-xs font-bold text-[#C8F55A] uppercase tracking-wide">
                  🚀 Recommended Experiments
                </p>
                <ul className="space-y-1.5 text-xs text-[#A3A3A3]">
                  {aiInsights.recommendations.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-[#C8F55A] font-bold">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
