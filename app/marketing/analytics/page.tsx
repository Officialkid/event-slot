"use client"

import { useState, useEffect } from "react"
import {
  BarChart3,
  TrendingUp,
  Layers,
  Users,
  Eye,
  MousePointerClick,
  Calendar,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
} from "lucide-react"

interface AnalyticsData {
  range: string
  kpis: {
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
}

export default function MarketingAnalyticsPage() {
  const [range, setRange] = useState("last_30_days")
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAnalytics = async (selectedRange: string) => {
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

  useEffect(() => {
    fetchAnalytics(range)
  }, [range])

  const visits = data?.kpis.websiteVisits || 1
  const signups = data?.kpis.signups || 0
  const events = data?.kpis.eventsCreated || 0

  const signupPct = Math.min(100, Math.round((signups / visits) * 100))
  const eventPct = Math.min(100, Math.round((events / Math.max(1, signups)) * 100))

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#262626] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <BarChart3 className="w-6 h-6 text-[#C8F55A]" />
            Marketing Analytics & Conversion Funnels
          </h1>
          <p className="text-sm text-[#A3A3A3] mt-1">
            End-to-end attribution telemetry tracing visitors from campaign touches to event publication.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="bg-[#141414] border border-[#262626] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#C8F55A]"
          >
            <option value="today">Today</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="this_month">This Month</option>
          </select>
          <button
            onClick={() => fetchAnalytics(range)}
            className="p-2 rounded-xl bg-[#141414] border border-[#262626] text-[#737373] hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Funnel Progress Section */}
      <div className="rounded-2xl bg-[#141414] border border-[#262626] p-6 space-y-5">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#C8F55A]" />
          Marketing Activation Funnel
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626] space-y-1">
            <span className="text-xs text-[#737373] uppercase font-semibold">1. Link Clicks</span>
            <p className="text-2xl font-bold text-white mt-1">{data?.kpis.totalTrackingClicks || 0}</p>
            <p className="text-[11px] text-[#737373]">From all /l/[code] links</p>
          </div>

          <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626] space-y-1">
            <span className="text-xs text-[#737373] uppercase font-semibold">2. Tracked Visits</span>
            <p className="text-2xl font-bold text-white mt-1">{data?.kpis.websiteVisits || 0}</p>
            <p className="text-[11px] text-[#737373]">
              {data?.kpis.trackedVisitors || 0} unique footprints
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626] space-y-1">
            <span className="text-xs text-[#737373] uppercase font-semibold">3. User Signups</span>
            <p className="text-2xl font-bold text-[#C8F55A] mt-1">{data?.kpis.signups || 0}</p>
            <p className="text-[11px] text-[#737373]">{data?.kpis.conversionRate} visit-to-signup</p>
          </div>

          <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626] space-y-1">
            <span className="text-xs text-[#737373] uppercase font-semibold">4. Events Created</span>
            <p className="text-2xl font-bold text-blue-400 mt-1">{data?.kpis.eventsCreated || 0}</p>
            <p className="text-[11px] text-[#737373]">
              {data?.kpis.eventsPublished || 0} live active events
            </p>
          </div>
        </div>

        {/* Funnel visual bars */}
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[#A3A3A3]">
              <span>Visit to Signup Rate</span>
              <span className="font-mono text-[#C8F55A]">{signupPct}%</span>
            </div>
            <div className="h-2 w-full bg-[#0A0A0A] rounded-full overflow-hidden border border-[#262626]">
              <div
                className="h-full bg-[#C8F55A] rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, signupPct)}%` }}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-[#A3A3A3]">
              <span>Signup to Event Creation Rate</span>
              <span className="font-mono text-blue-400">{eventPct}%</span>
            </div>
            <div className="h-2 w-full bg-[#0A0A0A] rounded-full overflow-hidden border border-[#262626]">
              <div
                className="h-full bg-blue-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, eventPct)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Channel Performance Breakdown */}
      <div className="rounded-2xl bg-[#141414] border border-[#262626] overflow-hidden">
        <div className="p-4 border-b border-[#262626]">
          <h2 className="text-base font-semibold text-white">Channel Conversion Telemetry</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#0A0A0A] text-[#737373] text-xs uppercase border-b border-[#262626]">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Channel</th>
                <th className="py-3.5 px-4 font-semibold text-right">Visits</th>
                <th className="py-3.5 px-4 font-semibold text-right">Clicks</th>
                <th className="py-3.5 px-4 font-semibold text-right">Signups</th>
                <th className="py-3.5 px-4 font-semibold text-right">Events Created</th>
                <th className="py-3.5 px-4 font-semibold text-right">Conversion %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {Object.entries(data?.channelPerformance || {}).map(([ch, stats]) => {
                const rate = stats.visits > 0 ? ((stats.signups / stats.visits) * 100).toFixed(1) : "0.0"
                return (
                  <tr key={ch} className="hover:bg-[#1A1A1A]/50 transition">
                    <td className="py-3.5 px-4 font-medium text-white capitalize">{ch}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-[#A3A3A3]">{stats.visits}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-[#A3A3A3]">{stats.clicks}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-[#C8F55A]">{stats.signups}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-blue-400">{stats.events}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-white">{rate}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
