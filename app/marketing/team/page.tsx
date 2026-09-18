"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Users, Shield, UserPlus, ExternalLink, RefreshCw } from "lucide-react"

interface MarketingMember {
  id: string
  email: string
  name: string | null
  role: string
  status: string
  joinedAt: string | null
  lastActiveAt: string | null
}

const ROLE_BADGES: Record<string, { label: string; color: string }> = {
  MARKETING_ADMIN: { label: "Marketing Admin", color: "bg-[#C8F55A]/20 text-[#C8F55A] border-[#C8F55A]/40" },
  MARKETING_MEMBER: { label: "Marketing Member", color: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
  CONTENT_MANAGER: { label: "Content Manager", color: "bg-purple-500/20 text-purple-400 border-purple-500/40" },
  ANALYST: { label: "Analyst", color: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
}

export default function MarketingTeamPage() {
  const [members, setMembers] = useState<MarketingMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTeam = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/marketing-team", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load team")
      const data = await res.json()
      setMembers(data.members || [])
    } catch {
      setMembers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeam()
  }, [])

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#262626] pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <Users className="w-6 h-6 text-[#C8F55A]" />
            Marketing Operations Team
          </h1>
          <p className="text-sm text-[#A3A3A3] mt-1">
            Directory of active marketing staff and assigned workspace role permissions.
          </p>
        </div>

        <Link
          href="/admin/teams"
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#1F1F1F] hover:bg-[#2A2A2A] text-white border border-[#333] transition"
        >
          <ExternalLink className="w-4 h-4 text-[#C8F55A]" />
          Manage via Super Admin
        </Link>
      </div>

      {/* Role Descriptions Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { role: "MARKETING_ADMIN", title: "Marketing Admin", desc: "Full hub command, campaigns, team, and publishing" },
          { role: "MARKETING_MEMBER", title: "Marketing Member", desc: "Campaigns & multi-channel drafting, link tracking" },
          { role: "CONTENT_MANAGER", title: "Content Manager", desc: "Channel-specific composers, content calendar" },
          { role: "ANALYST", title: "Analyst", desc: "Telemetry dashboards, performance exports & reports" },
        ].map((r) => {
          const badge = ROLE_BADGES[r.role]
          return (
            <div key={r.role} className="p-4 rounded-xl bg-[#141414] border border-[#262626] space-y-1">
              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${badge.color}`}>
                {badge.label}
              </span>
              <p className="text-xs text-[#A3A3A3] mt-1.5 leading-relaxed">{r.desc}</p>
            </div>
          )
        })}
      </div>

      {/* Roster Table */}
      <div className="rounded-2xl bg-[#141414] border border-[#262626] overflow-hidden">
        <div className="p-4 border-b border-[#262626] flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Active Roster ({members.length})</h2>
          <button onClick={fetchTeam} className="p-1.5 text-[#737373] hover:text-white transition">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-[#737373]">Loading team roster...</div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#737373]">
            No team members listed. Manage team memberships via Super Admin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0A0A0A] text-[#737373] text-xs uppercase border-b border-[#262626]">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Member</th>
                  <th className="py-3.5 px-4 font-semibold">Role</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Joined / Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626]">
                {members.map((m) => {
                  const badge = ROLE_BADGES[m.role] || ROLE_BADGES.MARKETING_MEMBER
                  return (
                    <tr key={m.id} className="hover:bg-[#1A1A1A]/50 transition">
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-white">{m.name || "Team Member"}</p>
                        <p className="text-xs text-[#737373]">{m.email}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="text-xs font-mono font-medium text-emerald-400">
                          {m.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#737373] text-right font-mono">
                        {m.lastActiveAt
                          ? `Active ${new Date(m.lastActiveAt).toLocaleDateString()}`
                          : `Invited ${new Date(m.joinedAt || Date.now()).toLocaleDateString()}`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
