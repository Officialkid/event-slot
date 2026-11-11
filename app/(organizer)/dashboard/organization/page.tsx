'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Building2,
  Users,
  Calendar,
  Settings,
  BarChart3,
  Shield,
  ShieldCheck,
  Plus,
  Mail,
  Link as LinkIcon,
  Check,
  Copy,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { copyTextToClipboard } from '@/lib/browserClipboard'

type TabKey = 'events' | 'team' | 'settings' | 'analytics' | 'finance'

interface OrgSummary {
  id: string
  name: string
  handle: string
  description?: string | null
  logo?: string | null
  category?: string | null
  website?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  contactWhatsapp?: string | null
  publicationStatus: 'DRAFT' | 'PUBLISHED' | 'SUSPENDED' | 'ARCHIVED'
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REVOKED'
  userRole: 'OWNER' | 'ADMIN' | 'EVENT_MANAGER'
  memberCount: number
  eventCount: number
  followerCount: number
}

interface OrgMember {
  id: string
  userId: string
  role: 'OWNER' | 'ADMIN' | 'EVENT_MANAGER'
  status: string
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string | null
    username: string | null
    image: string | null
  }
}

interface OrgEvent {
  id: string
  title: string
  slug: string
  status: string
  visibility: string
  eventDate: string | null
  capacity: number | null
  confirmedCount: number
  waitlistCount: number
  creatorName: string
}

interface OrgAnalyticsMetrics {
  totalEvents: number
  activeEvents: number
  totalRegistrations: number
  totalWaitlist: number
  totalCheckins: number
  followerCount: number
}

export default function OrganizationDashboardPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<TabKey>('events')
  const [loading, setLoading] = useState(true)
  const [myOrgs, setMyOrgs] = useState<Array<{ id: string; name: string; handle: string; role: string }>>([])
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null)
  const [org, setOrg] = useState<OrgSummary | null>(null)

  // Creation State (for users with no org)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createHandle, setCreateHandle] = useState('')
  const [createDesc, setCreateDesc] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // Events State
  const [events, setEvents] = useState<OrgEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  // Team State
  const [members, setMembers] = useState<OrgMember[]>([])
  const [invites, setInvites] = useState<any[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'EVENT_MANAGER'>('EVENT_MANAGER')
  const [inviting, setInviting] = useState(false)
  const [generatedLink, setGeneratedLink] = useState<string | null>(null)
  const [copiedLink, setCopiedLink] = useState(false)
  const [teamMessage, setTeamMessage] = useState<{ text: string; error?: boolean } | null>(null)

  // Settings State
  const [settingsName, setSettingsName] = useState('')
  const [settingsDesc, setSettingsDesc] = useState('')
  const [settingsWebsite, setSettingsWebsite] = useState('')
  const [settingsEmail, setSettingsEmail] = useState('')
  const [settingsPhone, setSettingsPhone] = useState('')
  const [settingsWhatsapp, setSettingsWhatsapp] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsFeedback, setSettingsFeedback] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [verifying, setVerifying] = useState(false)

  // Analytics State
  const [analytics, setAnalytics] = useState<OrgAnalyticsMetrics | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  // Finance State
  const [financeProfile, setFinanceProfile] = useState<any>(null)
  const [financeLoading, setFinanceLoading] = useState(false)

  // Load user organizations
  const loadWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/me/workspaces')
      const data = await res.json()
      if (data.success) {
        const orgs = (data.organizations || []).filter((o: any) => o.isOrganization)
        setMyOrgs(orgs)
        if (orgs.length > 0 && !selectedHandle) {
          setSelectedHandle(orgs[0].handle)
        }
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedHandle])

  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  // Load details for selected organization
  const loadOrgDetails = useCallback(async (handle: string) => {
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(handle)}`)
      const data = await res.json()
      if (data.success && data.organization) {
        setOrg(data.organization)
        setSettingsName(data.organization.name)
        setSettingsDesc(data.organization.description || '')
        setSettingsWebsite(data.organization.website || '')
        setSettingsEmail(data.organization.contactEmail || '')
        setSettingsPhone(data.organization.contactPhone || '')
        setSettingsWhatsapp(data.organization.contactWhatsapp || '')
      }
    } catch (err) {
      console.error('Failed to load org details:', err)
    }
  }, [])

  useEffect(() => {
    if (selectedHandle) {
      loadOrgDetails(selectedHandle)
    }
  }, [selectedHandle, loadOrgDetails])

  // Load tab-specific data
  useEffect(() => {
    if (!selectedHandle) return

    if (activeTab === 'events') {
      setEventsLoading(true)
      fetch(`/api/organizations/${encodeURIComponent(selectedHandle)}/events`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setEvents(data.events || [])
        })
        .finally(() => setEventsLoading(false))
    }

    if (activeTab === 'team') {
      setTeamLoading(true)
      fetch(`/api/organizations/${encodeURIComponent(selectedHandle)}/members`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            setMembers(data.members || [])
            setInvites(data.invitations || [])
          }
        })
        .finally(() => setTeamLoading(false))
    }

    if (activeTab === 'analytics') {
      setAnalyticsLoading(true)
      fetch(`/api/organizations/${encodeURIComponent(selectedHandle)}/analytics`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setAnalytics(data.metrics)
        })
        .finally(() => setAnalyticsLoading(false))
    }

    if (activeTab === 'finance') {
      setFinanceLoading(true)
      fetch(`/api/organizations/${encodeURIComponent(selectedHandle)}/finance`)
        .then((r) => r.json())
        .then((data) => {
          if (data.success) setFinanceProfile(data.financeProfile)
        })
        .finally(() => setFinanceLoading(false))
    }
  }, [selectedHandle, activeTab])

  // Handle Organization Creation
  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setCreating(true)

    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName,
          handle: createHandle || createName,
          description: createDesc,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setCreateError(data.error || 'Failed to create organization')
        return
      }

      setShowCreateModal(false)
      setCreateName('')
      setCreateHandle('')
      setCreateDesc('')
      setSelectedHandle(data.organization.handle)
      await loadWorkspaces()
    } catch {
      setCreateError('An unexpected error occurred. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  // Handle Team Invites
  async function handleSendInvite(type: 'EMAIL' | 'LINK') {
    if (!selectedHandle) return
    setInviting(true)
    setTeamMessage(null)

    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(selectedHandle)}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          email: type === 'EMAIL' ? inviteEmail : undefined,
          role: inviteRole,
          expiresInDays: 7,
          maxUses: type === 'LINK' ? 10 : 1,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setTeamMessage({ text: data.error || 'Failed to create invitation', error: true })
        return
      }

      if (type === 'LINK') {
        setGeneratedLink(data.invitation.inviteUrl)
        setTeamMessage({ text: 'Invite link created successfully!' })
      } else {
        setInviteEmail('')
        setTeamMessage({ text: `Invitation sent to ${inviteEmail}!` })
      }

      // Refresh team list
      const membersRes = await fetch(`/api/organizations/${encodeURIComponent(selectedHandle)}/members`)
      const membersData = await membersRes.json()
      if (membersData.success) {
        setMembers(membersData.members || [])
        setInvites(membersData.invitations || [])
      }
    } catch {
      setTeamMessage({ text: 'An unexpected error occurred.', error: true })
    } finally {
      setInviting(false)
    }
  }

  // Handle Member Removal
  async function handleRemoveMember(memberId: string) {
    if (!selectedHandle || !confirm('Are you sure you want to remove this member?')) return

    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(selectedHandle)}/members/${encodeURIComponent(memberId)}`,
        { method: 'DELETE' }
      )
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(data.error || 'Failed to remove member')
        return
      }

      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } catch {
      alert('Error removing member.')
    }
  }

  // Handle Settings Save
  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedHandle) return
    setSavingSettings(true)
    setSettingsFeedback(null)

    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(selectedHandle)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settingsName,
          description: settingsDesc,
          website: settingsWebsite,
          contactEmail: settingsEmail,
          contactPhone: settingsPhone,
          contactWhatsapp: settingsWhatsapp,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setSettingsFeedback(data.error || 'Failed to save settings.')
        return
      }

      setSettingsFeedback('Organization settings saved successfully!')
      loadOrgDetails(selectedHandle)
    } catch {
      setSettingsFeedback('An unexpected error occurred while saving.')
    } finally {
      setSavingSettings(false)
    }
  }

  // Handle Publication Toggle
  async function handleTogglePublish() {
    if (!selectedHandle || !org) return
    setPublishing(true)
    const nextAction = org.publicationStatus === 'PUBLISHED' ? 'unpublish' : 'publish'

    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(selectedHandle)}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: nextAction }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setOrg((prev) => prev ? { ...prev, publicationStatus: data.publicationStatus } : null)
      } else {
        alert(data.error || 'Failed to update publication status')
      }
    } finally {
      setPublishing(false)
    }
  }

  // Handle Verification Request
  async function handleRequestVerification() {
    if (!selectedHandle) return
    setVerifying(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(selectedHandle)}/verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence: { requestedByEmail: session?.user?.email } }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setOrg((prev) => prev ? { ...prev, verificationStatus: 'PENDING' } : null)
        alert('Verification request submitted successfully. Our team will review your organization.')
      } else {
        alert(data.error || 'Failed to request verification')
      }
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
      </div>
    )
  }

  // No organizations yet state
  if (myOrgs.length === 0 && !showCreateModal) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div
          className="rounded-3xl p-8 sm:p-12 border shadow-lg"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface-2)] mx-auto flex items-center justify-center text-[var(--accent)] mb-5 shadow-sm">
            <Building2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-3">
            Scale with Organization Workspaces
          </h1>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-lg mx-auto mb-8">
            Create an organization workspace to invite team members, publish events under your society or company brand, track cross-event analytics, and build durable audience followings.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm bg-[var(--accent)] text-black hover:opacity-95 transition shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your Organization</span>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 space-y-6">
      {/* Workspace Switcher / Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--surface-2)] border flex items-center justify-center text-[var(--accent)] font-bold text-lg shadow-sm">
            {org?.name ? org.name[0].toUpperCase() : <Building2 className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {org?.name || 'Organization Workspace'}
              </h1>
              {org?.verificationStatus === 'VERIFIED' && (
                <span title="Verified Organization">
                  <ShieldCheck className="w-4 h-4 text-[var(--accent)]" />
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              @{org?.handle} • Role: <strong className="text-[var(--text-secondary)]">{org?.userRole}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Org Selector if multiple orgs */}
          {myOrgs.length > 1 && (
            <select
              value={selectedHandle || ''}
              onChange={(e) => setSelectedHandle(e.target.value)}
              className="py-2 px-3 rounded-lg text-xs font-semibold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-primary)]"
            >
              {myOrgs.map((o) => (
                <option key={o.id} value={o.handle}>
                  {o.name} (@{o.handle})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="py-2 px-3 rounded-lg text-xs font-semibold bg-[var(--surface-2)] hover:bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--text-primary)] flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Org</span>
          </button>

          {org?.publicationStatus === 'PUBLISHED' && (
            <Link
              href={`/org/${org.handle}`}
              target="_blank"
              className="py-2 px-3 rounded-lg text-xs font-semibold bg-[var(--accent)] text-black flex items-center gap-1.5 transition shadow-sm hover:opacity-95"
            >
              <span>Public Profile</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] overflow-x-auto pb-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('events')}
          className={`py-2 px-4 rounded-lg flex items-center gap-2 transition ${
            activeTab === 'events'
              ? 'bg-[var(--surface-2)] text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Events ({org?.eventCount ?? 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('team')}
          className={`py-2 px-4 rounded-lg flex items-center gap-2 transition ${
            activeTab === 'team'
              ? 'bg-[var(--surface-2)] text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team ({org?.memberCount ?? 1})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`py-2 px-4 rounded-lg flex items-center gap-2 transition ${
            activeTab === 'analytics'
              ? 'bg-[var(--surface-2)] text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Analytics</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`py-2 px-4 rounded-lg flex items-center gap-2 transition ${
            activeTab === 'settings'
              ? 'bg-[var(--surface-2)] text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Profile & Settings</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('finance')}
          className={`py-2 px-4 rounded-lg flex items-center gap-2 transition ${
            activeTab === 'finance'
              ? 'bg-[var(--surface-2)] text-[var(--accent)]'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Financial Governance</span>
        </button>
      </div>

      {/* Tab 1: Events */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[var(--text-primary)]">Organization Events</h2>
            <Link
              href={`/create?org=${org?.handle}`}
              className="py-2 px-4 rounded-xl text-xs font-bold bg-[var(--accent)] text-black hover:opacity-95 transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Event for {org?.name}</span>
            </Link>
          </div>

          {eventsLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--accent)]" />
            </div>
          ) : events.length === 0 ? (
            <div
              className="p-10 rounded-2xl border text-center"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <Calendar className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
              <p className="text-sm font-semibold">No events created under this organization yet.</p>
              <p className="text-xs text-[var(--text-muted)] mt-1 mb-5">
                Events created here belong to {org?.name} and follow the organization identity.
              </p>
              <Link
                href={`/create?org=${org?.handle}`}
                className="inline-flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold bg-[var(--accent)] text-black hover:opacity-95"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Organization Event</span>
              </Link>
            </div>
          ) : (
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <table className="w-full text-left text-xs">
                <thead
                  className="border-b font-semibold text-[var(--text-muted)]"
                  style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}
                >
                  <tr>
                    <th className="py-3 px-4">Event Title</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Created By</th>
                    <th className="py-3 px-4">Registrations</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {events.map((ev) => (
                    <tr key={ev.id} className="hover:bg-[var(--surface-muted)] transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-[var(--text-primary)]">
                        <Link href={`/${ev.slug}`} target="_blank" className="hover:underline flex items-center gap-1.5">
                          <span>{ev.title}</span>
                          <ExternalLink className="w-3 h-3 text-[var(--text-muted)]" />
                        </Link>
                      </td>
                      <td className="py-3.5 px-4 text-[var(--text-secondary)]">
                        {ev.eventDate
                          ? new Date(ev.eventDate).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : 'TBA'}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--text-muted)]">
                        {ev.creatorName}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[var(--text-primary)]">
                        {ev.confirmedCount} {ev.capacity ? `/ ${ev.capacity}` : ''}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400">
                          {ev.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/dashboard/${ev.slug}`}
                          className="font-bold text-[var(--accent)] hover:underline"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Team Members & Invitations */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Invite Box */}
          <div
            className="rounded-2xl p-6 border space-y-4"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h3 className="font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
              <Mail className="w-4 h-4 text-[var(--accent)]" />
              <span>Invite New Collaborators</span>
            </h3>

            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                placeholder="colleague@organization.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 py-2.5 px-3.5 rounded-xl border text-xs bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--border)] focus:outline-none focus:border-[var(--accent)]"
              />

              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as any)}
                className="py-2.5 px-3 rounded-xl border text-xs bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--border)] font-semibold"
              >
                <option value="EVENT_MANAGER">Role: Event Manager</option>
                <option value="ADMIN">Role: Admin</option>
              </select>

              <button
                type="button"
                disabled={inviting || !inviteEmail}
                onClick={() => handleSendInvite('EMAIL')}
                className="py-2.5 px-4 rounded-xl font-bold text-xs bg-[var(--accent)] text-black hover:opacity-95 transition disabled:opacity-50 shrink-0"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Email Invite'}
              </button>

              <button
                type="button"
                disabled={inviting}
                onClick={() => handleSendInvite('LINK')}
                className="py-2.5 px-4 rounded-xl font-bold text-xs bg-[var(--surface-2)] hover:bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border)] transition shrink-0 flex items-center gap-1.5"
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Create Invite Link</span>
              </button>
            </div>

            {teamMessage && (
              <p className={`text-xs font-semibold ${teamMessage.error ? 'text-red-400' : 'text-emerald-400'}`}>
                {teamMessage.text}
              </p>
            )}

            {generatedLink && (
              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-mono text-[var(--text-muted)]">{generatedLink}</span>
                <button
                  type="button"
                  onClick={() => {
                    copyTextToClipboard(generatedLink)
                    setCopiedLink(true)
                    setTimeout(() => setCopiedLink(false), 2000)
                  }}
                  className="py-1 px-3 rounded-lg bg-[var(--accent)] text-black font-bold text-[11px] shrink-0 flex items-center gap-1"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Members List */}
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="p-4 border-b border-[var(--border)] font-bold text-sm">
              Active Members ({members.length})
            </div>
            <div className="divide-y divide-[var(--border)]">
              {members.map((m) => (
                <div key={m.id} className="p-4 flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[var(--surface-2)] border flex items-center justify-center font-bold text-[var(--accent)]">
                      {m.user.name ? m.user.name[0].toUpperCase() : 'U'}
                    </div>
                    <div>
                      <p className="font-bold text-[var(--text-primary)]">
                        {m.user.name || m.user.username || 'Team Member'}
                      </p>
                      <p className="text-[var(--text-muted)]">{m.user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]">
                      {m.role.replace('_', ' ')}
                    </span>
                    {m.role !== 'OWNER' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.id)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Analytics */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {analyticsLoading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--accent)]" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              <div
                className="p-5 rounded-2xl border text-center"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <p className="text-xs text-[var(--text-muted)] font-semibold">Total Events</p>
                <p className="text-2xl font-extrabold mt-1 text-[var(--text-primary)]">
                  {analytics?.totalEvents ?? 0}
                </p>
              </div>

              <div
                className="p-5 rounded-2xl border text-center"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <p className="text-xs text-[var(--text-muted)] font-semibold">Active Events</p>
                <p className="text-2xl font-extrabold mt-1 text-emerald-400">
                  {analytics?.activeEvents ?? 0}
                </p>
              </div>

              <div
                className="p-5 rounded-2xl border text-center"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <p className="text-xs text-[var(--text-muted)] font-semibold">Total Attendees</p>
                <p className="text-2xl font-extrabold mt-1 text-[var(--accent)]">
                  {analytics?.totalRegistrations ?? 0}
                </p>
              </div>

              <div
                className="p-5 rounded-2xl border text-center"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <p className="text-xs text-[var(--text-muted)] font-semibold">Total Check-Ins</p>
                <p className="text-2xl font-extrabold mt-1 text-[var(--text-primary)]">
                  {analytics?.totalCheckins ?? 0}
                </p>
              </div>

              <div
                className="p-5 rounded-2xl border text-center"
                style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <p className="text-xs text-[var(--text-muted)] font-semibold">Org Followers</p>
                <p className="text-2xl font-extrabold mt-1 text-sky-400">
                  {analytics?.followerCount ?? 0}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Settings & Profile */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6 max-w-2xl">
          <div
            className="rounded-2xl p-6 border space-y-4"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div>
                <h3 className="font-bold text-sm">Public Organization Profile</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Status: <strong>{org?.publicationStatus}</strong>
                </p>
              </div>
              <button
                type="button"
                disabled={publishing}
                onClick={handleTogglePublish}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition shadow-sm ${
                  org?.publicationStatus === 'PUBLISHED'
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                    : 'bg-emerald-500 text-black hover:opacity-95'
                }`}
              >
                {publishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : org?.publicationStatus === 'PUBLISHED' ? (
                  'Unpublish Profile'
                ) : (
                  'Publish Profile'
                )}
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                Display Name
              </label>
              <input
                type="text"
                value={settingsName}
                onChange={(e) => setSettingsName(e.target.value)}
                className="w-full py-2.5 px-3.5 rounded-xl border text-xs bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--border)]"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                About / Description
              </label>
              <textarea
                rows={3}
                value={settingsDesc}
                onChange={(e) => setSettingsDesc(e.target.value)}
                className="w-full py-2.5 px-3.5 rounded-xl border text-xs bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--border)]"
                placeholder="What does your organization do?"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Website
                </label>
                <input
                  type="text"
                  placeholder="https://ispeaksociety.com"
                  value={settingsWebsite}
                  onChange={(e) => setSettingsWebsite(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border text-xs bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--border)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Office Email
                </label>
                <input
                  type="email"
                  placeholder="hello@ispeaksociety.com"
                  value={settingsEmail}
                  onChange={(e) => setSettingsEmail(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border text-xs bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--border)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Office Phone
                </label>
                <input
                  type="text"
                  placeholder="+254 700 000 000"
                  value={settingsPhone}
                  onChange={(e) => setSettingsPhone(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border text-xs bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--border)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  WhatsApp Support
                </label>
                <input
                  type="text"
                  placeholder="254700000000"
                  value={settingsWhatsapp}
                  onChange={(e) => setSettingsWhatsapp(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border text-xs bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--border)]"
                />
              </div>
            </div>

            {settingsFeedback && (
              <p className="text-xs font-semibold text-emerald-400">{settingsFeedback}</p>
            )}

            <div className="pt-2 flex items-center justify-between">
              <button
                type="submit"
                disabled={savingSettings}
                className="py-2.5 px-6 rounded-xl font-bold text-xs bg-[var(--accent)] text-black hover:opacity-95 transition disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Changes'}
              </button>

              {org?.verificationStatus === 'UNVERIFIED' && (
                <button
                  type="button"
                  disabled={verifying}
                  onClick={handleRequestVerification}
                  className="py-2 px-3.5 rounded-xl text-xs font-semibold bg-[var(--surface-2)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] border border-[var(--border)] transition flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Request Verification Badge</span>
                </button>
              )}
            </div>
          </div>
        </form>
      )}

      {/* Tab 5: Financial Governance */}
      {activeTab === 'finance' && (
        <div className="max-w-2xl space-y-6">
          <div
            className="rounded-2xl p-6 border space-y-4"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Organization Financial Governance</h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Separation of event operations and company payout destinations.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Status:</span>
                <span className="font-bold uppercase tracking-wider text-amber-400">
                  {financeProfile?.status || 'UNCONFIGURED'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)]">Automated Payouts:</span>
                <span className="font-bold text-red-400">DISABLED (Gated)</span>
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {financeProfile?.notice ||
                'Organization payouts and automated settlements require verified payment provider account linkage and compliance review. Payout execution remains disabled until provider onboarding is approved.'}
            </p>
          </div>
        </div>
      )}

      {/* Create Org Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div
            className="max-w-md w-full rounded-2xl p-6 sm:p-8 border shadow-2xl relative"
            style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <h3 className="text-lg font-bold mb-1">Create Organization Workspace</h3>
            <p className="text-xs text-[var(--text-muted)] mb-5">
              Choose a public name and unique handle for your organization or movement.
            </p>

            <form onSubmit={handleCreateOrg} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Organization Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. I Speak Society"
                  value={createName}
                  onChange={(e) => {
                    setCreateName(e.target.value)
                    if (!createHandle) {
                      setCreateHandle(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, '-')
                          .replace(/-+/g, '-')
                      )
                    }
                  }}
                  className="w-full py-2.5 px-3.5 rounded-xl border text-xs bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--border)]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Unique Handle *
                </label>
                <div className="flex items-center rounded-xl border bg-[var(--surface-2)] border-[var(--border)] px-3 py-1">
                  <span className="text-xs text-[var(--text-muted)]">eventsslot.com/org/</span>
                  <input
                    type="text"
                    placeholder="ispeaksociety"
                    value={createHandle}
                    onChange={(e) => setCreateHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    className="flex-1 py-1.5 px-1 bg-transparent text-xs text-[var(--text-primary)] focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
                  Short Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Briefly describe what your organization does..."
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  className="w-full py-2 px-3 rounded-xl border text-xs bg-[var(--surface-2)] text-[var(--text-primary)] border-[var(--border)]"
                />
              </div>

              {createError && (
                <p className="text-xs font-semibold text-red-400">{createError}</p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="py-2.5 px-4 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !createName}
                  className="py-2.5 px-5 rounded-xl font-bold text-xs bg-[var(--accent)] text-black hover:opacity-95 transition disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
