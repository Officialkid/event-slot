"use client"

import { useState, useEffect } from "react"
import {
  ShieldAlert,
  UserCheck,
  UserX,
  Clock,
  Plus,
  RefreshCw,
  AlertCircle,
  Calendar,
  Lock,
  ChevronRight,
  ShieldCheck,
  Check,
  Link as LinkIcon,
  Copy,
  Mail,
  UserPlus,
} from "lucide-react"

interface ReviewerAssignment {
  id: string
  role: "HIRING_MANAGER" | "REVIEWER" | "HR_CONSULTANT"
  expiresAt: string
  revokedAt: string | null
  revocationReason: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
  }
  vacancy: {
    id: string
    title: string
    department: string
  } | null
  assignedBy: {
    name: string | null
    email: string
  }
  revokedBy: {
    name: string | null
    email: string
  } | null
}

interface ReviewerInvitation {
  id: string
  email: string
  role: "HIRING_MANAGER" | "REVIEWER" | "HR_CONSULTANT"
  expiresAt: string
  acceptedAt: string | null
  revokedAt: string | null
  revocationReason: string | null
  createdAt: string
  vacancy: {
    id: string
    title: string
    department: string
  } | null
  invitedBy: {
    name: string | null
    email: string
  }
  acceptedBy: {
    name: string | null
    email: string
  } | null
}

interface VacancyOption {
  id: string
  title: string
  department: string
}

export function ReviewersManagement() {
  const [assignments, setAssignments] = useState<ReviewerAssignment[]>([])
  const [invitations, setInvitations] = useState<ReviewerInvitation[]>([])
  const [vacancies, setVacancies] = useState<VacancyOption[]>([])
  const [filterTab, setFilterTab] = useState<"active" | "invitations" | "expired" | "revoked" | "all">("active")
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Modal / Drawer state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false)
  const [assignType, setAssignType] = useState<"existing" | "guest">("existing")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"HIRING_MANAGER" | "REVIEWER" | "HR_CONSULTANT">("REVIEWER")
  const [expiryDays, setExpiryDays] = useState(14)
  const [selectedVacancyId, setSelectedVacancyId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Generated Link state
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const [resAssignments, resInvitations, resVacancies] = await Promise.all([
        fetch(`/api/admin/recruitment/reviewers?status=${filterTab === "invitations" ? "all" : filterTab}`),
        fetch("/api/admin/recruitment/reviewers/invitations"),
        fetch("/api/admin/recruitment/vacancies"),
      ])

      const dataAssignments = await resAssignments.json()
      if (resAssignments.ok) {
        setAssignments(dataAssignments)
      }

      const dataInvitations = await resInvitations.json()
      if (resInvitations.ok) {
        setInvitations(dataInvitations)
      }

      if (resVacancies.ok) {
        const dataVac = await resVacancies.json()
        setVacancies(dataVac)
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [filterTab])

  const handleCreateAssignmentOrInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    setGeneratedInviteUrl(null)

    try {
      const expiryDate = new Date()
      expiryDate.setDate(expiryDate.getDate() + expiryDays)

      if (assignType === "guest") {
        // Invite External Guest (Category B)
        const res = await fetch("/api/admin/recruitment/reviewers/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            role,
            expiresAt: expiryDate.toISOString(),
            vacancyId: selectedVacancyId || undefined,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to create reviewer invitation")

        setGeneratedInviteUrl(data.inviteUrl)
        setSuccessMessage(`Invitation generated for external guest ${email}. Copy the single-use invitation link below.`)
        await loadData()
      } else {
        // Assign Existing EventSlot User (Category A)
        const res = await fetch("/api/admin/recruitment/reviewers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            role,
            expiresAt: expiryDate.toISOString(),
            vacancyId: selectedVacancyId || undefined,
          }),
        })

        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to assign reviewer")

        setSuccessMessage(`Temporary reviewer access granted to ${email}.`)
        setIsAssignModalOpen(false)
        setEmail("")
        await loadData()
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to assign reviewer")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCopyLink = async () => {
    if (!generatedInviteUrl) return
    try {
      await navigator.clipboard.writeText(generatedInviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // noop
    }
  }

  const handleRevokeAssignment = async (id: string, userEmail: string) => {
    const reason = prompt(`Enter reason for revoking access for ${userEmail}:`, "Administrative decision")
    if (reason === null) return

    try {
      const res = await fetch(`/api/admin/recruitment/reviewers/${id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to revoke access")
      }

      setSuccessMessage(`Access revoked for ${userEmail}.`)
      await loadData()
    } catch (err: any) {
      alert(err.message || "Failed to revoke")
    }
  }

  const handleRevokeInvitation = async (id: string, inviteEmail: string) => {
    const reason = prompt(`Enter reason for revoking invitation for ${inviteEmail}:`, "Administrative cancellation")
    if (reason === null) return

    try {
      const res = await fetch(`/api/admin/recruitment/reviewers/invitations/${id}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to revoke invitation")
      }

      setSuccessMessage(`Invitation revoked for ${inviteEmail}.`)
      await loadData()
    } catch (err: any) {
      alert(err.message || "Failed to revoke invitation")
    }
  }

  const handleExtendAssignment = async (id: string, currentExpiresAt: string, userEmail: string) => {
    try {
      const newExpiry = new Date(currentExpiresAt)
      newExpiry.setDate(newExpiry.getDate() + 7)

      const res = await fetch(`/api/admin/recruitment/reviewers/${id}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newExpiresAt: newExpiry.toISOString(),
          reason: "Administrator 7-day extension",
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to extend access")
      }

      setSuccessMessage(`Extended access for ${userEmail} by 7 days.`)
      await loadData()
    } catch (err: any) {
      alert(err.message || "Failed to extend")
    }
  }

  const formatNairobi = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("en-KE", {
        timeZone: "Africa/Nairobi",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-[#0A0A0A]">
            Reviewer Access &amp; Guest Governance
          </h2>
          <p className="mt-1 text-xs text-[#6B7280]">
            Manage recruitment evaluation privileges for existing team members (Category A) or invite external guests (Category B) with single-use, time-bounded tokens.
          </p>
        </div>

        <button
          onClick={() => {
            setIsAssignModalOpen(true)
            setGeneratedInviteUrl(null)
          }}
          className="inline-flex items-center gap-2 rounded-full bg-[#0A0A0A] px-5 py-2.5 text-xs font-bold text-[#C8F55A] hover:bg-[#1A1A1A] transition shadow-xs shrink-0"
        >
          <Plus className="h-4 w-4 text-[#C8F55A]" />
          <span>Grant / Invite Reviewer</span>
        </button>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800">
          <Check className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Assign / Invite Modal Form */}
      {isAssignModalOpen && (
        <div className="rounded-2xl border-2 border-[#15803D] bg-white p-6 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#15803D]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#0A0A0A]">
                Recruitment Reviewer Setup
              </h3>
            </div>
            <button
              onClick={() => {
                setIsAssignModalOpen(false)
                setGeneratedInviteUrl(null)
              }}
              className="text-xs font-semibold text-[#6B7280] hover:text-[#0A0A0A]"
            >
              Close
            </button>
          </div>

          {/* Category Toggle */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#F3F4F6] rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setAssignType("existing")
                setGeneratedInviteUrl(null)
              }}
              className={`py-2 rounded-lg transition ${
                assignType === "existing"
                  ? "bg-white text-[#0A0A0A] shadow-xs"
                  : "text-[#6B7280] hover:text-[#0A0A0A]"
              }`}
            >
              Existing User (Category A)
            </button>
            <button
              type="button"
              onClick={() => {
                setAssignType("guest")
                setGeneratedInviteUrl(null)
              }}
              className={`py-2 rounded-lg transition ${
                assignType === "guest"
                  ? "bg-white text-[#0A0A0A] shadow-xs"
                  : "text-[#6B7280] hover:text-[#0A0A0A]"
              }`}
            >
              External Guest (Category B)
            </button>
          </div>

          {/* Generated Link Display (if guest invite created) */}
          {generatedInviteUrl && (
            <div className="rounded-xl border-2 border-[#C8F55A] bg-[#0A0A0A] p-4 text-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#C8F55A]">
                  Approved Single-Use Invitation Link
                </span>
                <span className="text-[10px] text-[#9CA3AF]">Expires in {expiryDays} days</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#1E1E1E] font-mono text-xs text-[#E5E7EB] break-all border border-[#333]">
                {generatedInviteUrl}
              </div>
              <div className="flex items-center justify-between gap-2 pt-1">
                <p className="text-[11px] text-[#9CA3AF]">
                  Manually share this secure link with the external reviewer. They will be guided to authenticate and claim their workspace.
                </p>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#C8F55A] px-3.5 py-1.5 text-xs font-bold text-[#0A0A0A] hover:bg-[#b8e040] transition shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {!generatedInviteUrl && (
            <form onSubmit={handleCreateAssignmentOrInvite} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    {assignType === "existing" ? "User Account Email" : "Guest Email Address"}
                  </label>
                  <input
                    type="email"
                    required
                    placeholder={assignType === "existing" ? "existing-user@example.com" : "guest-reviewer@example.com"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-[#D1D5DB] px-3.5 py-2.5 text-xs text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                  />
                  <span className="mt-1 block text-[11px] text-[#6B7280]">
                    {assignType === "existing"
                      ? "User must already have an active EventSlot account."
                      : "A secure invitation link will be generated for this recipient."}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Assigned Reviewer Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full rounded-xl border border-[#D1D5DB] bg-white px-3.5 py-2.5 text-xs text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                  >
                    <option value="REVIEWER">Reviewer (Dossier review &amp; internal notes)</option>
                    <option value="HIRING_MANAGER">Hiring Manager (Stage transitions &amp; decisions)</option>
                    <option value="HR_CONSULTANT">HR Consultant (Dossier evaluation)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Vacancy Scope
                  </label>
                  <select
                    value={selectedVacancyId}
                    onChange={(e) => setSelectedVacancyId(e.target.value)}
                    className="w-full rounded-xl border border-[#D1D5DB] bg-white px-3.5 py-2.5 text-xs text-[#0A0A0A] focus:border-[#15803D] focus:outline-none"
                  >
                    <option value="">All Recruitment Vacancies</option>
                    {vacancies.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} ({v.department})
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[11px] text-[#6B7280]">
                    Limit reviewer access strictly to candidate dossiers for this role.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                    Access Duration (Mandatory Expiration)
                  </label>
                  <div className="flex gap-2">
                    {[7, 14, 30].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setExpiryDays(days)}
                        className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                          expiryDays === days
                            ? "border-[#15803D] bg-[#DCFCE7] text-[#15803D]"
                            : "border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
                        }`}
                      >
                        {days} Days
                      </button>
                    ))}
                  </div>
                  <span className="mt-1 block text-[11px] text-[#6B7280]">
                    Access automatically ceases on expiration with no manual cleanup required.
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="rounded-xl border border-[#D1D5DB] px-4 py-2 text-xs font-semibold text-[#6B7280] hover:bg-[#F9FAFB]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-[#0A0A0A] px-5 py-2 text-xs font-bold text-[#C8F55A] hover:bg-[#1A1A1A] transition shadow-xs disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Processing..."
                    : assignType === "existing"
                    ? "Grant Reviewer Access"
                    : "Generate Invitation Link"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-[#E5E7EB] pb-2 overflow-x-auto">
        {(["active", "invitations", "expired", "revoked", "all"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterTab(tab)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition shrink-0 ${
              filterTab === tab
                ? "bg-[#0A0A0A] text-[#C8F55A]"
                : "text-[#6B7280] hover:bg-[#F3F4F6]"
            }`}
          >
            {tab === "invitations" ? `Pending Invitations (${invitations.filter((i) => !i.acceptedAt && !i.revokedAt).length})` : tab}
          </button>
        ))}
      </div>

      {/* Invitations Table Tab View */}
      {filterTab === "invitations" ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-xs overflow-hidden">
          {invitations.length === 0 && !isLoading ? (
            <div className="p-12 text-center text-xs text-[#6B7280]">
              No guest invitations found. Use &quot;Grant / Invite Reviewer&quot; to invite external guests.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#374151]">
                <thead className="bg-[#FAFAFA] border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                  <tr>
                    <th className="px-5 py-3.5">Guest Recipient</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Scope</th>
                    <th className="px-5 py-3.5">Expires</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {invitations.map((inv) => {
                    const now = new Date()
                    const isRevoked = !!inv.revokedAt
                    const isAccepted = !!inv.acceptedAt
                    const isExpired = !isRevoked && !isAccepted && new Date(inv.expiresAt) <= now
                    const isPending = !isRevoked && !isAccepted && !isExpired

                    return (
                      <tr key={inv.id} className="hover:bg-[#F9FAFB] transition">
                        <td className="px-5 py-4">
                          <div className="font-bold text-[#0A0A0A] flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-[#15803D]" />
                            <span>{inv.email}</span>
                          </div>
                          <div className="text-[11px] text-[#6B7280] mt-0.5">
                            Invited by {inv.invitedBy?.name || inv.invitedBy?.email}
                          </div>
                        </td>

                        <td className="px-5 py-4 font-semibold text-[#0A0A0A]">
                          {inv.role}
                        </td>

                        <td className="px-5 py-4">
                          {inv.vacancy ? (
                            <span className="font-medium text-[#0A0A0A]">{inv.vacancy.title}</span>
                          ) : (
                            <span className="rounded bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#4B5563]">
                              All Vacancies
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap text-[#374151]">
                          {formatNairobi(inv.expiresAt)}
                        </td>

                        <td className="px-5 py-4">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Pending Claim
                            </span>
                          )}
                          {isAccepted && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                              Accepted by {inv.acceptedBy?.name || inv.acceptedBy?.email}
                            </span>
                          )}
                          {isExpired && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                              Expired
                            </span>
                          )}
                          {isRevoked && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[11px] font-bold text-red-800">
                              Revoked
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          {isPending && (
                            <button
                              onClick={() => handleRevokeInvitation(inv.id, inv.email)}
                              className="rounded border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition shadow-2xs"
                            >
                              Revoke Invite
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Assignments Table View */
        <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-xs overflow-hidden">
          {assignments.length === 0 && !isLoading ? (
            <div className="p-12 text-center text-xs text-[#6B7280]">
              No reviewer assignments found in this status category.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#374151]">
                <thead className="bg-[#FAFAFA] border-b border-[#E5E7EB] text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
                  <tr>
                    <th className="px-5 py-3.5">Reviewer</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Scope</th>
                    <th className="px-5 py-3.5">Expires (Nairobi)</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {assignments.map((item) => {
                    const now = new Date()
                    const isRevoked = !!item.revokedAt
                    const isExpired = !isRevoked && new Date(item.expiresAt) <= now
                    const isActive = !isRevoked && !isExpired

                    return (
                      <tr key={item.id} className="hover:bg-[#F9FAFB] transition">
                        <td className="px-5 py-4">
                          <div className="font-bold text-[#0A0A0A]">
                            {item.user?.name || "EventSlot User"}
                          </div>
                          <div className="text-[#6B7280]">{item.user?.email}</div>
                        </td>

                        <td className="px-5 py-4 font-semibold text-[#0A0A0A]">
                          {item.role}
                        </td>

                        <td className="px-5 py-4">
                          {item.vacancy ? (
                            <div>
                              <span className="font-medium text-[#0A0A0A]">
                                {item.vacancy.title}
                              </span>
                              <div className="text-[11px] text-[#6B7280]">
                                {item.vacancy.department}
                              </div>
                            </div>
                          ) : (
                            <span className="rounded bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#4B5563]">
                              All Vacancies
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-[#374151]">
                            <Clock className="h-3.5 w-3.5 text-[#15803D]" />
                            <span>{formatNairobi(item.expiresAt)}</span>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          {isActive && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          )}
                          {isExpired && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                              Expired
                            </span>
                          )}
                          {isRevoked && (
                            <div>
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[11px] font-bold text-red-800">
                                Revoked
                              </span>
                              {item.revocationReason && (
                                <div className="text-[10px] text-[#6B7280] mt-0.5">
                                  {item.revocationReason}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right space-x-2">
                          {isActive && (
                            <>
                              <button
                                onClick={() => handleExtendAssignment(item.id, item.expiresAt, item.user.email)}
                                className="rounded border border-[#D1D5DB] bg-white px-2 py-1 text-[11px] font-semibold text-[#374151] hover:border-[#15803D] transition shadow-2xs"
                              >
                                +7 Days
                              </button>
                              <button
                                onClick={() => handleRevokeAssignment(item.id, item.user.email)}
                                className="rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 transition shadow-2xs"
                              >
                                Revoke
                              </button>
                            </>
                          )}
                          {isExpired && (
                            <button
                              onClick={() => handleExtendAssignment(item.id, new Date().toISOString(), item.user.email)}
                              className="rounded border border-[#D1D5DB] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#15803D] hover:bg-[#F0FDF4] transition shadow-2xs"
                            >
                              Reactivate (+7d)
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
