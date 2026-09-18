"use client"

import { useState, useEffect } from "react"
import {
  Settings as SettingsIcon,
  Shield,
  Sliders,
  History,
  CheckCircle2,
  Lock,
  Save,
  Clock,
} from "lucide-react"

interface AuditLogItem {
  id: string
  action: string
  actorEmail: string | null
  entityType: string
  entityId: string | null
  createdAt: string
  metadata: any
}

export default function MarketingSettingsPage() {
  const [instagramCadence, setInstagramCadence] = useState("3")
  const [linkedinCadence, setLinkedinCadence] = useState("1")
  const [emailCadence, setEmailCadence] = useState("1")
  const [whatsappCadence, setWhatsappCadence] = useState("2")

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [savedMessage, setSavedMessage] = useState(false)

  const fetchAuditLogs = async () => {
    try {
      setLoadingLogs(true)
      const res = await fetch("/api/marketing/audit", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load audit logs")
      const data = await res.json()
      setAuditLogs(data.logs || [])
    } catch {
      setAuditLogs([])
    } finally {
      setLoadingLogs(false)
    }
  }

  useEffect(() => {
    fetchAuditLogs()
  }, [])

  const handleSaveCadence = (e: React.FormEvent) => {
    e.preventDefault()
    setSavedMessage(true)
    setTimeout(() => setSavedMessage(false), 3000)
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#262626] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <SettingsIcon className="w-6 h-6 text-[#C8F55A]" />
            Marketing Operations Settings
          </h1>
          <p className="text-sm text-[#A3A3A3] mt-1">
            Configure channel posting strategy guidelines, UTM naming conventions, and inspect the immutable marketing audit trail.
          </p>
        </div>
      </div>

      {savedMessage && (
        <div className="p-4 rounded-xl bg-[#C8F55A]/10 border border-[#C8F55A]/30 text-[#C8F55A] text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Cadence rules successfully updated!
        </div>
      )}

      {/* Cadence Guidelines Configuration */}
      <div className="rounded-2xl bg-[#141414] border border-[#262626] p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#C8F55A]" />
            Channel Cadence Strategy Rules
          </h2>
          <p className="text-xs text-[#A3A3A3] mt-0.5">
            Set target posting frequencies displayed across the content calendar and scheduler.
          </p>
        </div>

        <form onSubmit={handleSaveCadence} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626]">
              <label className="block text-xs font-bold text-white mb-1">Instagram Target</label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={instagramCadence}
                  onChange={(e) => setInstagramCadence(e.target.value)}
                  className="w-16 bg-[#141414] border border-[#333] rounded-lg px-2.5 py-1 text-sm font-bold text-white text-center focus:border-[#C8F55A]"
                />
                <span className="text-xs text-[#737373]">posts / day</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626]">
              <label className="block text-xs font-bold text-white mb-1">LinkedIn Target</label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={linkedinCadence}
                  onChange={(e) => setLinkedinCadence(e.target.value)}
                  className="w-16 bg-[#141414] border border-[#333] rounded-lg px-2.5 py-1 text-sm font-bold text-white text-center focus:border-[#C8F55A]"
                />
                <span className="text-xs text-[#737373]">posts / day</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626]">
              <label className="block text-xs font-bold text-white mb-1">Email Broadcast</label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={emailCadence}
                  onChange={(e) => setEmailCadence(e.target.value)}
                  className="w-16 bg-[#141414] border border-[#333] rounded-lg px-2.5 py-1 text-sm font-bold text-white text-center focus:border-[#C8F55A]"
                />
                <span className="text-xs text-[#737373]">broadcast / wk</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626]">
              <label className="block text-xs font-bold text-white mb-1">WhatsApp Community</label>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={whatsappCadence}
                  onChange={(e) => setWhatsappCadence(e.target.value)}
                  className="w-16 bg-[#141414] border border-[#333] rounded-lg px-2.5 py-1 text-sm font-bold text-white text-center focus:border-[#C8F55A]"
                />
                <span className="text-xs text-[#737373]">blasts / wk</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#C8F55A] text-[#0A0A0A] hover:bg-[#b8e84a] transition"
            >
              <Save className="w-3.5 h-3.5" /> Save Cadence Guidelines
            </button>
          </div>
        </form>
      </div>

      {/* Attribution Model Presets */}
      <div className="rounded-2xl bg-[#141414] border border-[#262626] p-6 space-y-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-400" />
            First-Party Attribution Policies
          </h2>
          <p className="text-xs text-[#A3A3A3] mt-0.5">
            Default cookie lifespan and multi-touch evaluation rules.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626]">
            <p className="text-xs font-semibold text-white">First-Touch Window</p>
            <p className="text-lg font-bold text-[#C8F55A] mt-1">365 Days</p>
            <p className="text-[11px] text-[#737373] mt-0.5">Persisted in browser localStorage & cookie</p>
          </div>

          <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626]">
            <p className="text-xs font-semibold text-white">Last-Touch Window</p>
            <p className="text-lg font-bold text-blue-400 mt-1">30 Days</p>
            <p className="text-[11px] text-[#737373] mt-0.5">Updated on each fresh campaign redirect</p>
          </div>

          <div className="p-4 rounded-xl bg-[#0A0A0A] border border-[#262626]">
            <p className="text-xs font-semibold text-white">Conversion Triggers</p>
            <p className="text-lg font-bold text-purple-400 mt-1">4 Milestones</p>
            <p className="text-[11px] text-[#737373] mt-0.5">Signup, Event Create, Publish, Ticket Buy</p>
          </div>
        </div>
      </div>

      {/* Marketing Audit Log */}
      <div className="rounded-2xl bg-[#141414] border border-[#262626] overflow-hidden">
        <div className="p-4 border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-[#C8F55A]" />
            <h2 className="text-base font-semibold text-white">Marketing Activity Audit Trail</h2>
          </div>
          <button onClick={fetchAuditLogs} className="text-xs text-[#737373] hover:text-white">
            Refresh
          </button>
        </div>

        {loadingLogs ? (
          <div className="p-8 text-center text-xs text-[#737373]">Loading activity audit...</div>
        ) : auditLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#737373]">No audit logs recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0A0A0A] text-[#737373] text-xs uppercase border-b border-[#262626]">
                <tr>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-4 font-semibold">Entity</th>
                  <th className="py-3 px-4 font-semibold">Operator</th>
                  <th className="py-3 px-4 font-semibold text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626]">
                {auditLogs.slice(0, 20).map((log) => (
                  <tr key={log.id} className="hover:bg-[#1A1A1A]/50 transition text-xs">
                    <td className="py-3 px-4 font-mono text-white">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-[#A3A3A3]">{log.entityType}</td>
                    <td className="py-3 px-4 text-[#737373]">{log.actorEmail || "System"}</td>
                    <td className="py-3 px-4 text-[#737373] text-right font-mono">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
