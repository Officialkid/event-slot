"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  Plug,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ShieldCheck,
  ExternalLink,
  RefreshCw,
  Lock,
  Mail,
  MessageSquare,
  X,
  Info,
  Sliders,
  Copy,
  Check,
} from "lucide-react"
import type { IntegrationSummary, ExtendedIntegrationStatus } from "@/lib/marketing/integrations/types"

function InstagramIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

function LinkedInIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  )
}

const STATUS_CONFIG: Record<
  ExtendedIntegrationStatus,
  { label: string; color: string; dot: string; icon: React.ComponentType<{ className?: string }> }
> = {
  CONNECTED: {
    label: "Connected",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    dot: "bg-emerald-400",
    icon: CheckCircle2,
  },
  NOT_CONNECTED: {
    label: "Not Connected",
    color: "bg-neutral-800/80 text-neutral-400 border-neutral-700",
    dot: "bg-neutral-500",
    icon: Clock,
  },
  CONNECTING: {
    label: "Connecting...",
    color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    dot: "bg-cyan-400 animate-pulse",
    icon: RefreshCw,
  },
  CONNECTION_EXPIRED: {
    label: "Token Expired",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    dot: "bg-amber-400",
    icon: AlertTriangle,
  },
  PERMISSION_REQUIRED: {
    label: "Permission Required",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    dot: "bg-amber-400",
    icon: AlertTriangle,
  },
  ERROR: {
    label: "Error",
    color: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    dot: "bg-rose-400",
    icon: XCircle,
  },
  DISCONNECTED: {
    label: "Disconnected",
    color: "bg-neutral-800 text-neutral-400 border-neutral-700",
    dot: "bg-neutral-500",
    icon: Clock,
  },
  MANUAL: {
    label: "Manual",
    color: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    dot: "bg-purple-400",
    icon: Sliders,
  },
}

export default function MarketingIntegrationsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [isMarketingAdmin, setIsMarketingAdmin] = useState(false)
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null)

  // Modals state
  const [disconnectModalPlatform, setDisconnectModalPlatform] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [manageModalItem, setManageModalItem] = useState<IntegrationSummary | null>(null)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)
  const [copiedText, setCopiedText] = useState(false)

  // URL Feedback banners
  const [alertSuccess, setAlertSuccess] = useState<string | null>(null)
  const [alertError, setAlertError] = useState<string | null>(null)

  const fetchIntegrations = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/marketing/integrations", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load integrations")
      const data = await res.json()
      setIntegrations(data.integrations || [])
      setIsMarketingAdmin(data.isMarketingAdmin ?? false)
    } catch (err) {
      console.error(err)
      setAlertError("Failed to fetch current integration statuses.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIntegrations()

    // Handle OAuth redirection query params
    const connectedParam = searchParams.get("connected")
    const platformParam = searchParams.get("platform")
    const errorParam = searchParams.get("error")

    if (connectedParam === "true" && platformParam) {
      setAlertSuccess(`Successfully connected ${platformParam.toUpperCase()} to EventSlot Marketing Hub!`)
    } else if (errorParam) {
      setAlertError(decodeURIComponent(errorParam))
    }
  }, [searchParams])

  const handleStartOAuth = (platform: string) => {
    if (!isMarketingAdmin) return
    setConnectingPlatform(platform)
    const normalized = platform.toLowerCase()
    // Open official OAuth initiation route
    window.location.href = `/api/marketing/integrations/${normalized}/oauth`
  }

  const handleConfirmDisconnect = async () => {
    if (!disconnectModalPlatform) return
    try {
      setDisconnecting(true)
      const res = await fetch(`/api/marketing/integrations/${disconnectModalPlatform.toLowerCase()}/disconnect`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to disconnect account")

      setAlertSuccess(`${disconnectModalPlatform} has been disconnected.`)
      setDisconnectModalPlatform(null)
      await fetchIntegrations()
    } catch (err: any) {
      setAlertError(err.message || "Failed to disconnect.")
    } finally {
      setDisconnecting(false)
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "INSTAGRAM":
        return <InstagramIcon className="w-6 h-6 text-[#E1306C]" />
      case "LINKEDIN":
        return <LinkedInIcon className="w-6 h-6 text-[#0A66C2]" />
      case "EMAIL":
        return <Mail className="w-6 h-6 text-[#C8F55A]" />
      case "WHATSAPP":
        return <MessageSquare className="w-6 h-6 text-[#25D366]" />
      default:
        return <Plug className="w-6 h-6 text-white" />
    }
  }

  const copyWhatsAppSample = () => {
    const text = `🎟️ *EventSlot Live Launch*\n\n📅 *Date:* Saturday, 26th September\n📍 *Location:* Nairobi Tech Park\n\nSecure your ticket here:\n👉 https://eventsslot.com/l/launch-pass\n\n_Shared via EventSlot Official Channel_`
    navigator.clipboard.writeText(text)
    setCopiedText(true)
    setTimeout(() => setCopiedText(false), 2500)
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#262626] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5" style={{ color: "#FFFFFF" }}>
            <Plug className="w-6 h-6 text-[#C8F55A]" />
            Marketing Integrations & Channels
          </h1>
          <p className="text-sm text-[#A3A3A3] mt-1">
            Connect EventSlot&apos;s official business channels to the Marketing Hub via official OAuth 2.0 authorization.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchIntegrations()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#141414] hover:bg-[#1F1F1F] text-[#D4D4D4] border border-[#262626] transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Status
          </button>
        </div>
      </div>

      {/* Security & Authentication Assurance Banner */}
      <div className="rounded-2xl border border-[#262626] bg-[#0E0E0E] p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="p-2 rounded-xl bg-[#C8F55A]/10 text-[#C8F55A] mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white" style={{ color: "#FFFFFF" }}>
              Enterprise OAuth 2.0 Token Isolation
            </h4>
            <p className="text-xs text-[#A3A3A3] mt-0.5 max-w-3xl leading-relaxed">
              EventSlot connects to official platform developer APIs without collecting passwords. Sensitive authorization tokens are encrypted server-side with AES-256-CBC and are never exposed in frontend code or client storage.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono font-medium px-3 py-1.5 rounded-lg bg-[#141414] border border-[#262626] text-[#A3A3A3]">
          <Lock className="w-3.5 h-3.5 text-[#C8F55A]" />
          Zero Passwords Stored
        </div>
      </div>

      {/* Success Notification Banner */}
      {alertSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{alertSuccess}</span>
          </div>
          <button onClick={() => setAlertSuccess(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {alertError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{alertError}</span>
          </div>
          <button onClick={() => setAlertError(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4 Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {integrations.map((item) => {
          const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.NOT_CONNECTED
          const StatusIcon = statusConfig.icon
          const isConnected = item.status === "CONNECTED"

          return (
            <div
              key={item.platform}
              className="flex flex-col justify-between rounded-2xl border border-[#262626] bg-[#0A0A0A] p-6 shadow-xl relative overflow-hidden group hover:border-[#333333] transition"
            >
              {/* Card Top */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#141414] border border-[#262626]">
                      {getPlatformIcon(item.platform)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white tracking-tight" style={{ color: "#FFFFFF" }}>
                        {item.title}
                      </h3>
                      <span className="text-xs text-[#737373] font-medium">
                        {item.platform === "INSTAGRAM" && "Official Meta Graph API"}
                        {item.platform === "LINKEDIN" && "Official LinkedIn OAuth 2.0"}
                        {item.platform === "EMAIL" && "hello@eventsslot.com"}
                        {item.platform === "WHATSAPP" && "Community Announcements"}
                      </span>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.color}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                    <span>{statusConfig.label}</span>
                  </div>
                </div>

                <p className="text-xs text-[#A3A3A3] leading-relaxed mb-5">
                  {item.description}
                </p>

                {/* Connected Account Information Details (Prompt Section 10) */}
                {isConnected && item.metadata && (
                  <div className="rounded-xl border border-[#1F1F1F] bg-[#111111] p-4 mb-5 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#737373]">Account:</span>
                      <span className="font-semibold text-white font-mono" style={{ color: "#FFFFFF" }}>
                        {item.metadata.accountUsername || item.metadata.accountName || "EventSlot"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#737373]">Account Type:</span>
                      <span className="text-[#D4D4D4] font-medium">
                        {item.metadata.accountType === "BUSINESS" && "Professional / Business"}
                        {item.metadata.accountType === "COMPANY_PAGE" && "Company Page"}
                        {item.metadata.accountType === "BROADCAST_ENGINE" && "System Broadcast Engine"}
                        {item.metadata.accountType === "MANUAL_COMMUNITY" && "Community Channel"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[#737373]">Connected By:</span>
                      <span className="text-[#D4D4D4]">
                        {item.metadata.connectedBy?.name || "Marketing Admin"}
                      </span>
                    </div>

                    {item.metadata.connectedAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-[#737373]">Connected Date:</span>
                        <span className="text-[#A3A3A3]">
                          {new Date(item.metadata.connectedAt).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    )}

                    {/* Verified Permissions List */}
                    <div className="pt-2 border-t border-[#1F1F1F]">
                      <span className="text-[11px] text-[#737373] block mb-1.5 font-medium">
                        Verified Permissions Granted:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {item.metadata.grantedScopes.slice(0, 4).map((scope, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#171717] border border-[#262626] text-[10px] text-[#C8F55A]"
                          >
                            <Check className="w-2.5 h-2.5" />
                            {scope}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-[#1F1F1F] flex items-center justify-between gap-3">
                {/* 1. Email Action */}
                {item.platform === "EMAIL" && (
                  <button
                    onClick={() => setEmailModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#141414] hover:bg-[#1F1F1F] text-[#C8F55A] border border-[#262626] transition flex items-center justify-center gap-2"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Configure
                  </button>
                )}

                {/* 2. WhatsApp Action */}
                {item.platform === "WHATSAPP" && (
                  <button
                    onClick={() => setWhatsappModalOpen(true)}
                    className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#141414] hover:bg-[#1F1F1F] text-[#25D366] border border-[#262626] transition flex items-center justify-center gap-2"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    Configure
                  </button>
                )}

                {/* 3. Instagram & LinkedIn Actions */}
                {(item.platform === "INSTAGRAM" || item.platform === "LINKEDIN") && (
                  <>
                    {!isConnected ? (
                      <button
                        onClick={() => handleStartOAuth(item.platform)}
                        disabled={!isMarketingAdmin || connectingPlatform === item.platform}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                          isMarketingAdmin
                            ? "bg-[#C8F55A] text-black hover:bg-[#d6f77b]"
                            : "bg-[#1F1F1F] text-[#737373] cursor-not-allowed"
                        }`}
                        title={!isMarketingAdmin ? "Requires Marketing Admin role" : ""}
                      >
                        {connectingPlatform === item.platform ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : !isMarketingAdmin ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <Plug className="w-3.5 h-3.5" />
                        )}
                        Connect {item.title}
                      </button>
                    ) : (
                      <div className="flex items-center gap-2.5 w-full">
                        <button
                          onClick={() => setManageModalItem(item)}
                          className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-[#141414] hover:bg-[#1F1F1F] text-white border border-[#262626] transition"
                        >
                          Manage
                        </button>
                        <button
                          onClick={() => setDisconnectModalPlatform(item.platform)}
                          disabled={!isMarketingAdmin}
                          className={`py-2 px-3 rounded-xl text-xs font-semibold transition border ${
                            isMarketingAdmin
                              ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30"
                              : "bg-[#141414] text-[#737373] border-[#262626] cursor-not-allowed"
                          }`}
                        >
                          Disconnect
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Disconnect Confirmation Modal (Prompt Section 14) */}
      {disconnectModalPlatform && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#262626] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2" style={{ color: "#FFFFFF" }}>
                <AlertTriangle className="w-5 h-5 text-rose-400" />
                Disconnect {disconnectModalPlatform}?
              </h3>
              <button
                onClick={() => setDisconnectModalPlatform(null)}
                className="text-[#737373] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#A3A3A3] leading-relaxed">
              Are you sure you want to disconnect {disconnectModalPlatform} from EventSlot Marketing Hub? Disconnecting will revoke stored credentials and stop future Marketing Hub communications with that account.
            </p>

            <div className="p-3 rounded-xl bg-[#171717] border border-[#262626] text-[11px] text-[#A3A3A3]">
              🛡️ <span className="font-semibold text-white">Historical Data Guarantee:</span> All historical campaigns, past publication logs, and analytics will remain permanently preserved.
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setDisconnectModalPlatform(null)}
                disabled={disconnecting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A3A3A3] hover:text-white hover:bg-[#1A1A1A] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {disconnecting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                Confirm Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Modal for Connected Social Channels */}
      {manageModalItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#262626] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2" style={{ color: "#FFFFFF" }}>
                {getPlatformIcon(manageModalItem.platform)}
                {manageModalItem.title} Connection Details
              </h3>
              <button
                onClick={() => setManageModalItem(null)}
                className="text-[#737373] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-[#171717] border border-[#262626] space-y-2">
                <div className="flex justify-between">
                  <span className="text-[#737373]">Account Handle:</span>
                  <span className="font-semibold text-white" style={{ color: "#FFFFFF" }}>
                    {manageModalItem.metadata?.accountUsername || "@eventslot"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#737373]">Platform ID:</span>
                  <span className="font-mono text-[#A3A3A3]">
                    {manageModalItem.metadata?.accountIdentifier || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#737373]">Token Status:</span>
                  <span className="text-emerald-400 font-medium">Active (AES-256 Encrypted)</span>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider block mb-1.5">
                  Available Platform Scopes
                </span>
                <div className="space-y-1">
                  {manageModalItem.availableScopes.map((scope, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-[#141414] border border-[#1F1F1F] text-[11px]"
                    >
                      <span className="font-mono text-white" style={{ color: "#FFFFFF" }}>{scope}</span>
                      <span className="text-[#C8F55A] font-semibold">Granted</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setManageModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1F1F1F] text-white hover:bg-[#2A2A2A] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Broadcast Engine Configuration Modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#262626] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2" style={{ color: "#FFFFFF" }}>
                <Mail className="w-5 h-5 text-[#C8F55A]" />
                EventSlot Broadcast Engine
              </h3>
              <button
                onClick={() => setEmailModalOpen(false)}
                className="text-[#737373] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[#C8F55A]/10 border border-[#C8F55A]/30 text-xs text-[#C8F55A] leading-relaxed">
              ✓ <strong>Existing Engine Preserved:</strong> The Marketing Hub uses the existing, production-proven EventSlot email engine with persistent SMTP pooling and Resend automatic failover. No changes were made to sending logic.
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between p-2.5 rounded-xl bg-[#171717] border border-[#262626]">
                <span className="text-[#737373]">Sender Address:</span>
                <span className="font-mono font-semibold text-white" style={{ color: "#FFFFFF" }}>
                  EventSlot &lt;hello@eventsslot.com&gt;
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-[#171717] border border-[#262626]">
                <span className="text-[#737373]">Primary Transport:</span>
                <span className="text-[#D4D4D4]">Nodemailer SMTP Connection Pool (5 persistent workers)</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-[#171717] border border-[#262626]">
                <span className="text-[#737373]">Failover Redundancy:</span>
                <span className="text-emerald-400">Resend API Automatic Standby</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-[#171717] border border-[#262626]">
                <span className="text-[#737373]">Pacing &amp; Throttling:</span>
                <span className="text-[#D4D4D4]">550ms delay between dispatches (~1.8 req/sec)</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setEmailModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1F1F1F] text-white hover:bg-[#2A2A2A] transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Manual Publishing Configuration Modal */}
      {whatsappModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111111] border border-[#262626] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2" style={{ color: "#FFFFFF" }}>
                <MessageSquare className="w-5 h-5 text-[#25D366]" />
                WhatsApp Manual Publishing Workflow
              </h3>
              <button
                onClick={() => setWhatsappModalOpen(false)}
                className="text-[#737373] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#A3A3A3] leading-relaxed">
              EventSlot adheres to strict platform compliance. Rather than using unofficial scraping or bots, marketing staff use this formatted template to broadcast announcements to community groups.
            </p>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#737373]">Copy-Paste Announcement Format:</span>
                <button
                  onClick={copyWhatsAppSample}
                  className="text-[11px] text-[#25D366] hover:underline flex items-center gap-1 font-semibold"
                >
                  {copiedText ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copiedText ? "Copied!" : "Copy Template"}
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-[#080808] border border-[#1F1F1F] text-[11px] text-[#D4D4D4] font-mono whitespace-pre-wrap leading-relaxed">
                {`🎟️ *EventSlot Live Launch*\n\n📅 *Date:* Saturday, 26th September\n📍 *Location:* Nairobi Tech Park\n\nSecure your ticket here:\n👉 https://eventsslot.com/l/launch-pass\n\n_Shared via EventSlot Official Channel_`}
              </pre>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setWhatsappModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#1F1F1F] text-white hover:bg-[#2A2A2A] transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
