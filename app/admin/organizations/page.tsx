"use client"

import React, { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import {
  Building2,
  ShieldCheck,
  ShieldAlert,
  Users,
  Calendar,
  UserPlus,
  ArrowRight,
  ExternalLink,
  Loader2,
  Plus,
  Check,
  RefreshCw,
  Search,
} from "lucide-react"

interface AdminOrgItem {
  id: string
  name: string
  handle: string
  description?: string | null
  logo?: string | null
  category?: string | null
  publicationStatus: "DRAFT" | "PUBLISHED" | "SUSPENDED" | "ARCHIVED"
  verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED" | "REVOKED"
  createdAt: string
  memberCount: number
  eventCount: number
  followerCount: number
  owner: {
    id: string
    name: string | null
    email: string | null
    username: string | null
  } | null
}

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<AdminOrgItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showProvisionModal, setShowProvisionModal] = useState(false)
  const [showMigrateModal, setShowMigrateModal] = useState<AdminOrgItem | null>(null)

  // Provisioning form state
  const [provName, setProvName] = useState("")
  const [provHandle, setProvHandle] = useState("")
  const [provDesc, setProvDesc] = useState("")
  const [provCategory, setProvCategory] = useState("COMMUNITY")
  const [provOwnerEmail, setProvOwnerEmail] = useState("")
  const [provVerified, setProvVerified] = useState(true)
  const [provPublished, setProvPublished] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  // Migration form state
  const [migSource, setMigSource] = useState("")
  const [migrating, setMigrating] = useState(false)
  const [migResult, setMigResult] = useState<string | null>(null)

  const loadOrganizations = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/organizations")
      const data = await res.json()
      if (data.success) {
        setOrganizations(data.organizations || [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrganizations()
  }, [loadOrganizations])

  async function handleProvision(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)

    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: provName,
          handle: provHandle || provName,
          description: provDesc,
          category: provCategory,
          ownerEmail: provOwnerEmail,
          verificationStatus: provVerified ? "VERIFIED" : "UNVERIFIED",
          publicationStatus: provPublished ? "PUBLISHED" : "DRAFT",
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setFormError(data.error || "Failed to provision organization")
        return
      }

      setFeedback(`Successfully provisioned organization "${data.organization.name}" (@${data.organization.handle})!`)
      setShowProvisionModal(false)
      setProvName("")
      setProvHandle("")
      setProvDesc("")
      setProvOwnerEmail("")
      await loadOrganizations()
    } catch {
      setFormError("An unexpected error occurred during provisioning.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleMigrateFollowers(e: React.FormEvent) {
    e.preventDefault()
    if (!showMigrateModal) return
    setMigrating(true)
    setMigResult(null)

    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(showMigrateModal.handle)}/migrate-followers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUsername: migSource.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setMigResult(data.error || "Migration failed")
        return
      }

      setMigResult(`✓ Migrated ${data.migratedCount} followers to ${showMigrateModal.name}!`)
      await loadOrganizations()
    } catch {
      setMigResult("An error occurred during follower migration.")
    } finally {
      setMigrating(false)
    }
  }

  const filteredOrgs = organizations.filter(
    (o) =>
      o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (o.owner?.email && o.owner.email.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Organization Management & Concierge Provisioning
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Oversee platform organizations, provision verified accounts on behalf of clients, and migrate organizer audiences.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadOrganizations}
            className="p-2.5 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            title="Refresh organizations"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowProvisionModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm bg-[var(--accent)] text-black hover:opacity-90 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Provision Organization
          </button>
        </div>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-sm flex items-center justify-between">
          <span>{feedback}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-xs font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Stats Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search organizations by name, handle, or owner email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="text-xs text-[var(--text-muted)] self-center">
          Showing {filteredOrgs.length} of {organizations.length} organizations
        </div>
      </div>

      {/* Organizations Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Organization</th>
                <th className="py-3 px-4">Handle</th>
                <th className="py-3 px-4">Owner</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Verification</th>
                <th className="py-3 px-4 text-center">Audience</th>
                <th className="py-3 px-4 text-center">Events</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[var(--accent)]" />
                    Loading organizations...
                  </td>
                </tr>
              ) : filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--text-muted)]">
                    No organizations match your search query.
                  </td>
                </tr>
              ) : (
                filteredOrgs.map((org) => (
                  <tr key={org.id} className="hover:bg-[var(--surface-2)]/50 transition">
                    <td className="py-3 px-4 font-semibold text-[var(--text-primary)]">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-[var(--surface-2)] flex items-center justify-center text-[var(--accent)] shrink-0 border border-[var(--border)]">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <span className="truncate max-w-[180px]">{org.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary)] font-mono text-xs">
                      @{org.handle}
                    </td>
                    <td className="py-3 px-4 text-xs text-[var(--text-secondary)]">
                      {org.owner ? (
                        <div>
                          <div className="font-semibold text-[var(--text-primary)]">{org.owner.name || "Unnamed"}</div>
                          <div className="text-[var(--text-muted)] truncate max-w-[150px]">{org.owner.email}</div>
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] italic">Unassigned</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          org.publicationStatus === "PUBLISHED"
                            ? "bg-green-500/15 text-green-400 border border-green-500/30"
                            : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        }`}
                      >
                        {org.publicationStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          org.verificationStatus === "VERIFIED"
                            ? "bg-[var(--accent)]/15 text-[var(--accent)] border border-[var(--accent)]/30"
                            : "bg-gray-500/15 text-gray-400 border border-gray-500/30"
                        }`}
                      >
                        {org.verificationStatus === "VERIFIED" ? (
                          <ShieldCheck className="w-3 h-3" />
                        ) : (
                          <ShieldAlert className="w-3 h-3" />
                        )}
                        {org.verificationStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-[var(--text-primary)]">
                      {org.followerCount}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-[var(--text-primary)]">
                      {org.eventCount}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowMigrateModal(org)
                            setMigSource(org.owner?.username || org.owner?.email || "")
                            setMigResult(null)
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-[var(--border)] hover:border-[var(--accent)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                          title="Migrate followers from organizer to organization"
                        >
                          Migrate Followers
                        </button>
                        <Link
                          href={`/org/${org.handle}`}
                          target="_blank"
                          className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
                          title="View public profile"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provisioning Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--accent)]/15 text-[var(--accent)] flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Concierge Organization Provisioning</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowProvisionModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Create an organization workspace on behalf of a partner or client (such as Benihana Lubengo). They will be assigned as full Owner when they sign in.
            </p>

            {formError && (
              <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleProvision} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Benihana Lubengo"
                  value={provName}
                  onChange={(e) => {
                    setProvName(e.target.value)
                    if (!provHandle) {
                      setProvHandle(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"))
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Unique Handle (@handle) *
                </label>
                <div className="flex items-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2">
                  <span className="text-[var(--text-muted)] text-sm mr-1">@</span>
                  <input
                    type="text"
                    required
                    placeholder="benihana"
                    value={provHandle}
                    onChange={(e) => setProvHandle(e.target.value)}
                    className="w-full bg-transparent text-sm text-[var(--text-primary)] focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Assign Owner (User Email or Username) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ben@example.com or ben"
                  value={provOwnerEmail}
                  onChange={(e) => setProvOwnerEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
                <span className="text-[11px] text-[var(--text-muted)] block mt-1">
                  This user will immediately see the organization in their dashboard workspace dropdown.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Description (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Short description of the organization..."
                  value={provDesc}
                  onChange={(e) => setProvDesc(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={provVerified}
                    onChange={(e) => setProvVerified(e.target.checked)}
                    className="rounded border-[var(--border)] text-[var(--accent)]"
                  />
                  <span>Grant Verified Organization Badge</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={provPublished}
                    onChange={(e) => setProvPublished(e.target.checked)}
                    className="rounded border-[var(--border)] text-[var(--accent)]"
                  />
                  <span>Publish Profile Immediately</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowProvisionModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-[var(--accent)] text-black hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Provisioning..." : "Provision Organization"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Follower Migration Modal */}
      {showMigrateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Migrate Followers to {showMigrateModal.name}
              </h3>
              <button
                type="button"
                onClick={() => setShowMigrateModal(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Copy all existing followers of an organizer account (e.g. Ben) into this new organization workspace so they automatically receive new organization event alerts.
            </p>

            {migResult && (
              <div className={`p-3 rounded-xl border text-xs font-semibold ${
                migResult.startsWith("✓")
                  ? "border-green-500/30 bg-green-500/10 text-green-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}>
                {migResult}
              </div>
            )}

            <form onSubmit={handleMigrateFollowers} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                  Source Organizer (Username or Email)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ben or ben@example.com"
                  value={migSource}
                  onChange={(e) => setMigSource(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowMigrateModal(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border border-[var(--border)] text-[var(--text-secondary)]"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={migrating}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-[var(--accent)] text-black hover:opacity-90 disabled:opacity-50"
                >
                  {migrating ? "Migrating..." : "Run Migration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
