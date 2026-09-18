"use client"

import { useState, useEffect } from "react"
import {
  Plug,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
} from "lucide-react"

interface IntegrationItem {
  id: string
  platform: "INSTAGRAM" | "LINKEDIN" | "WHATSAPP_BUSINESS" | "TWITTER_X"
  accountName: string | null
  accountIdentifier: string | null
  status: "NOT_CONNECTED" | "CONNECTED" | "CONNECTION_EXPIRED" | "PERMISSION_REQUIRED" | "ERROR"
  lastSyncAt: string | null
  errorMessage: string | null
  updatedAt: string | null
}

const PLATFORM_DETAILS: Record<
  string,
  { name: string; desc: string; iconColor: string; docsUrl: string; stage: string }
> = {
  INSTAGRAM: {
    name: "Instagram Professional",
    desc: "Direct publishing to Instagram Business or Creator accounts via Meta Graph API.",
    iconColor: "text-[#E1306C]",
    docsUrl: "https://developers.facebook.com/docs/instagram-api",
    stage: "Meta Graph API v20",
  },
  LINKEDIN: {
    name: "LinkedIn Organization Page",
    desc: "Publish company updates, carousel documents, and track engagement via LinkedIn Community Management API.",
    iconColor: "text-[#0A66C2]",
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/",
    stage: "LinkedIn OAuth 2.0",
  },
  WHATSAPP_BUSINESS: {
    name: "WhatsApp Business Platform",
    desc: "Official Meta Cloud API integration for template-based customer alerts and broadcasts.",
    iconColor: "text-[#25D366]",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api",
    stage: "Planned Meta Cloud API",
  },
  TWITTER_X: {
    name: "Twitter / X API",
    desc: "Automated tweet threads and broadcast announcements via X API v2.",
    iconColor: "text-white",
    docsUrl: "https://developer.x.com",
    stage: "X API v2",
  },
}

const STATUS_PILLS: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  CONNECTED: { label: "Connected", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  NOT_CONNECTED: { label: "Not Connected", color: "bg-neutral-800 text-neutral-400 border-neutral-700", icon: Clock },
  CONNECTION_EXPIRED: { label: "Token Expired", color: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: AlertTriangle },
  PERMISSION_REQUIRED: { label: "Permission Required", color: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: AlertTriangle },
  ERROR: { label: "Connection Error", color: "bg-rose-500/10 text-rose-400 border-rose-500/30", icon: XCircle },
}

export default function MarketingIntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchIntegrations = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/marketing/integrations", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load integrations")
      const data = await res.json()
      setIntegrations(data.integrations || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIntegrations()
  }, [])

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#262626] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Plug className="w-6 h-6 text-[#C8F55A]" />
            Official Social Platform Integrations
          </h1>
          <p className="text-sm text-[#A3A3A3] mt-1">
            Connect verified platform APIs for automated publishing. Tokens are encrypted at rest and never exposed in the UI.
          </p>
        </div>

        <button
          onClick={fetchIntegrations}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-[#141414] hover:bg-[#1F1F1F] text-white border border-[#333] transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh Status
        </button>
      </div>

      {/* Security Architecture Notice */}
      <div className="p-4 rounded-xl bg-[#141414] border border-[#262626] flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#C8F55A] shrink-0 mt-0.5" />
        <div className="text-xs text-[#A3A3A3] leading-relaxed">
          <strong className="text-white">Strict Security Standard:</strong> EventSlot never fabricates API connections. Where official credentials or OAuth approval are pending, platforms remain clearly marked as <em>Not Connected</em>. For V1 manual channels like personal WhatsApp groups, use the 1-click clipboard workflow in the Content Studio.
        </div>
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {integrations.map((item) => {
          const info = PLATFORM_DETAILS[item.platform] || {
            name: item.platform,
            desc: "Official API connection",
            iconColor: "text-white",
            docsUrl: "#",
            stage: "V1",
          }
          const statusConfig = STATUS_PILLS[item.status] || STATUS_PILLS.NOT_CONNECTED
          const StatusIcon = statusConfig.icon

          return (
            <div
              key={item.platform}
              className="rounded-2xl bg-[#141414] border border-[#262626] p-6 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-[#737373] uppercase tracking-wider">
                    {info.stage}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusConfig.color}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {statusConfig.label}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span className={info.iconColor}>●</span>
                    {info.name}
                  </h3>
                  <p className="text-xs text-[#A3A3A3] mt-1 leading-relaxed">{info.desc}</p>
                </div>

                {item.accountName && (
                  <div className="p-2.5 rounded-xl bg-[#0A0A0A] border border-[#262626] text-xs">
                    <span className="text-[#737373]">Account: </span>
                    <span className="font-semibold text-white">{item.accountName}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#1F1F1F] flex items-center justify-between">
                <a
                  href={info.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#737373] hover:text-[#C8F55A] flex items-center gap-1 transition"
                >
                  API Docs <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  onClick={() => alert(`To connect ${info.name}, provide client credentials in environment settings or request Super Admin configuration.`)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#1F1F1F] hover:bg-[#2A2A2A] text-white border border-[#333] transition"
                >
                  {item.status === "CONNECTED" ? "Manage Connection" : "Connect Platform"}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
