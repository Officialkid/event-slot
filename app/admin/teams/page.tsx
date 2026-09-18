"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Users, UserPlus, Shield, CheckCircle, Clock, Ban, ExternalLink, RefreshCw } from "lucide-react"

interface MarketingMember {
  id: string
  email: string
  name: string | null
  role: "MARKETING_ADMIN" | "MARKETING_MEMBER" | "CONTENT_MANAGER" | "ANALYST"
  status: "ACTIVE" | "INACTIVE" | "INVITED" | "REVOKED"
  joinedAt: string | null
  lastActiveAt: string | null
  createdAt: string
  user?: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  } | null
}

const ROLE_LABELS: Record<string, { label: string; desc: string; color: string }> = {
  MARKETING_ADMIN: {
    label: "Marketing Admin",
    desc: "Full marketing access, team management, campaigns, integrations, broadcasts & reports",
    color: "bg-[#C8F55A]/20 text-[#C8F55A] border-[#C8F55A]/40",
  },
  MARKETING_MEMBER: {
    label: "Marketing Member",
    desc: "Create campaigns & content, draft schedules, view analytics, generate links",
    color: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  },
  CONTENT_MANAGER: {
    label: "Content Manager",
    desc: "Create & edit multi-channel content, manage calendar, view content metrics",
    color: "bg-purple-500/20 text-purple-400 border-purple-500/40",
  },
  ANALYST: {
    label: "Analyst",
    desc: "Read-only analytics dashboards, campaign & channel reporting, exports",
    color: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  },
}

export default function SuperAdminTeamsPage() {
  const [members, setMembers] = useState<MarketingMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteName, setInviteName] = useState("")
  const [inviteRole, setInviteRole] = useState<"MARKETING_ADMIN" | "MARKETING_MEMBER" | "CONTENT_MANAGER" | "ANALYST">("MARKETING_MEMBER")
  const [submitting, setSubmitting] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const fetchMembers = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch("/api/admin/marketing-team", { cache: "no-store" })
      if (!res.ok) {
        throw new Error("Failed to fetch marketing team")
      }
      const data = await res.json()
      setMembers(data.members || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading team")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMembers()
  }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return

    try {
      setSubmitting(true)
      const res = await fetch("/api/admin/marketing-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim(),
          role: inviteRole,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to invite member")
      }

      setActionMessage(`Successfully added ${inviteEmail} to the Marketing Team!`)
      setShowInviteModal(false)
      setInviteEmail("")
      setInviteName("")
      fetchMembers()
      setTimeout(() => setActionMessage(null), 4000)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to invite")
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateStatus = async (id: string, newStatus: "ACTIVE" | "INACTIVE" | "REVOKED") => {
    try {
      const res = await fetch(`/api/admin/marketing-team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Failed to update status")
      fetchMembers()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Update failed")
    }
  }

  const handleUpdateRole = async (id: string, newRole: string) => {
    try {
      const res = await fetch(`/api/admin/marketing-team/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) throw new Error("Failed to update role")
      fetchMembers()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Role update failed")
    }
  }

  const handleRevoke = async (id: string, email: string) => {
    if (!confirm(`Are you sure you want to revoke marketing access for ${email}?`)) return
    try {
      const res = await fetch(`/api/admin/marketing-team/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to revoke access")
      fetchMembers()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Revocation failed")
    }
  }

  const activeCount = members.filter((m) => m.status === "ACTIVE").length
  const adminCount = members.filter((m) => m.role === "MARKETING_ADMIN" && m.status === "ACTIVE").length
  const invitedCount = members.filter((m) => m.status === "INVITED").length

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#262626] pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-[#C8F55A]" />
              Marketing Team & RBAC
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#1F1F1F] text-[#C8F55A] border border-[#2A2A2A]">
              Super Admin Control
            </span>
          </div>
          <p className="mt-1 text-sm text-[#A3A3A3]">
            Manage marketing staff, assign roles, and grant permissions to the separate Marketing Hub workspace without giving Super Admin access.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/marketing"
            target="_blank"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium bg-[#1A1A1A] hover:bg-[#262626] text-white border border-[#333] transition"
          >
            <ExternalLink className="w-4 h-4 text-[#C8F55A]" />
            Launch Marketing Hub
          </Link>
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[#C8F55A] hover:bg-[#b8e84a] text-[#0A0A0A] transition"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
        </div>
      </div>

      {actionMessage && (
        <div className="p-4 rounded-xl bg-[#C8F55A]/10 border border-[#C8F55A]/30 text-[#C8F55A] text-sm flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-xs hover:underline">Dismiss</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#141414] border border-[#262626]">
          <p className="text-xs text-[#737373] uppercase font-semibold">Total Members</p>
          <p className="text-2xl font-bold text-white mt-1">{members.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-[#141414] border border-[#262626]">
          <p className="text-xs text-[#737373] uppercase font-semibold">Active Members</p>
          <p className="text-2xl font-bold text-[#C8F55A] mt-1">{activeCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-[#141414] border border-[#262626]">
          <p className="text-xs text-[#737373] uppercase font-semibold">Marketing Admins</p>
          <p className="text-2xl font-bold text-white mt-1">{adminCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-[#141414] border border-[#262626]">
          <p className="text-xs text-[#737373] uppercase font-semibold">Pending Invites</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{invitedCount}</p>
        </div>
      </div>

      {/* Members Table */}
      <div className="rounded-2xl bg-[#141414] border border-[#262626] overflow-hidden">
        <div className="p-4 border-b border-[#262626] flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">Team Members & Assigned Roles</h2>
          <button
            onClick={fetchMembers}
            className="p-1.5 rounded-lg text-[#737373] hover:text-white hover:bg-[#1F1F1F] transition"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-[#737373]">Loading team directory...</div>
        ) : error ? (
          <div className="p-12 text-center text-rose-400">{error}</div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-[#737373]">
            No marketing team members invited yet. Click <strong>Invite Member</strong> to add your first marketer.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0A0A0A] text-[#737373] text-xs uppercase border-b border-[#262626]">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Employee</th>
                  <th className="py-3.5 px-4 font-semibold">Marketing Role</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Joined / Last Active</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626]">
                {members.map((member) => {
                  const roleConfig = ROLE_PERMISSIONS_CONFIG(member.role)
                  return (
                    <tr key={member.id} className="hover:bg-[#1A1A1A]/50 transition">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#262626] flex items-center justify-center font-bold text-white text-xs border border-[#333]">
                            {member.name ? member.name.charAt(0).toUpperCase() : member.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-white">{member.name || "Unnamed Employee"}</p>
                            <p className="text-xs text-[#737373]">{member.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4">
                        <select
                          value={member.role}
                          onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                          className="bg-[#0A0A0A] border border-[#333] text-xs rounded-lg px-2.5 py-1.5 text-white focus:border-[#C8F55A] focus:outline-none"
                        >
                          <option value="MARKETING_ADMIN">Marketing Admin</option>
                          <option value="MARKETING_MEMBER">Marketing Member</option>
                          <option value="CONTENT_MANAGER">Content Manager</option>
                          <option value="ANALYST">Analyst</option>
                        </select>
                      </td>

                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            member.status === "ACTIVE"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : member.status === "INVITED"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : member.status === "INACTIVE"
                              ? "bg-neutral-500/10 text-neutral-400 border-neutral-500/30"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                          }`}
                        >
                          {member.status === "ACTIVE" && <CheckCircle className="w-3 h-3" />}
                          {member.status === "INVITED" && <Clock className="w-3 h-3" />}
                          {member.status === "REVOKED" && <Ban className="w-3 h-3" />}
                          {member.status}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-xs text-[#737373]">
                        {member.lastActiveAt
                          ? `Active ${new Date(member.lastActiveAt).toLocaleDateString()}`
                          : member.joinedAt
                          ? `Joined ${new Date(member.joinedAt).toLocaleDateString()}`
                          : `Invited ${new Date(member.createdAt).toLocaleDateString()}`}
                      </td>

                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {member.status === "ACTIVE" ? (
                            <button
                              onClick={() => handleUpdateStatus(member.id, "INACTIVE")}
                              className="text-xs text-neutral-400 hover:text-white px-2.5 py-1 rounded bg-[#1F1F1F] border border-[#333] transition"
                            >
                              Deactivate
                            </button>
                          ) : member.status === "INACTIVE" ? (
                            <button
                              onClick={() => handleUpdateStatus(member.id, "ACTIVE")}
                              className="text-xs text-[#C8F55A] hover:bg-[#C8F55A]/20 px-2.5 py-1 rounded bg-[#1F1F1F] border border-[#333] transition"
                            >
                              Activate
                            </button>
                          ) : null}

                          {member.status !== "REVOKED" && (
                            <button
                              onClick={() => handleRevoke(member.id, member.email)}
                              className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded hover:bg-rose-500/10 transition"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#C8F55A]" />
                Invite Marketing Team Member
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-neutral-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="marketer@eventsslot.com or personal email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#C8F55A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="w-full bg-[#0A0A0A] border border-[#262626] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#C8F55A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A3A3A3] mb-1.5">
                  Assigned Marketing Role *
                </label>
                <div className="space-y-2">
                  {(["MARKETING_ADMIN", "MARKETING_MEMBER", "CONTENT_MANAGER", "ANALYST"] as const).map(
                    (roleKey) => {
                      const info = ROLE_LABELS[roleKey]
                      const isSelected = inviteRole === roleKey
                      return (
                        <label
                          key={roleKey}
                          onClick={() => setInviteRole(roleKey)}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? "border-[#C8F55A] bg-[#C8F55A]/5"
                              : "border-[#262626] bg-[#0A0A0A] hover:border-[#333]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="role"
                            checked={isSelected}
                            onChange={() => setInviteRole(roleKey)}
                            className="mt-1 accent-[#C8F55A]"
                          />
                          <div>
                            <p className="text-sm font-semibold text-white">{info.label}</p>
                            <p className="text-xs text-[#737373] mt-0.5">{info.desc}</p>
                          </div>
                        </label>
                      )
                    }
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-400 hover:text-white bg-[#1F1F1F] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#C8F55A] text-[#0A0A0A] hover:bg-[#b8e84a] transition disabled:opacity-50"
                >
                  {submitting ? "Inviting..." : "Send Invite"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function ROLE_PERMISSIONS_CONFIG(role: string) {
  return ROLE_LABELS[role] || ROLE_LABELS.MARKETING_MEMBER
}
