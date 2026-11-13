'use client'

import React, { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import Link from 'next/link'
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  ArrowRight,
  Shield,
  UserCheck,
} from 'lucide-react'

interface InvitePageProps {
  params: Promise<{ token: string }>
}

interface InvitationData {
  id: string
  type: 'EMAIL' | 'LINK'
  role: 'OWNER' | 'ADMIN' | 'EVENT_MANAGER'
  email?: string | null
  organization: {
    id: string
    name: string
    handle: string
    logo?: string | null
    description?: string | null
  }
  inviterName: string
  expiresAt: string
}

export default function InviteAcceptancePage(props: InvitePageProps) {
  const params = use(props.params)
  const token = params.token
  const router = useRouter()
  const { data: session, status: authStatus } = useSession()

  const [invitation, setInvitation] = useState<InvitationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [acceptedSuccess, setAcceptedSuccess] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadInvitation() {
      try {
        const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`)
        const data = await res.json()

        if (cancelled) return

        if (!res.ok || !data.success) {
          setError(data.error || 'Invalid or expired invitation link.')
          setErrorCode(data.code || 'NOT_FOUND')
          return
        }

        setInvitation(data.invitation)
      } catch {
        if (!cancelled) {
          setError('Failed to load invitation. Please verify your connection.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadInvitation()
    return () => {
      cancelled = true
    }
  }, [token])

  async function handleAccept() {
    setAccepting(true)
    setError(null)

    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to accept invitation.')
        setErrorCode(data.code || 'ACCEPT_FAILED')
        return
      }

      setAcceptedSuccess(data.message || 'Invitation accepted successfully!')
      setTimeout(() => {
        router.push('/dashboard/organization')
      }, 1500)
    } catch {
      setError('An unexpected error occurred while accepting. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  const roleLabels: Record<string, string> = {
    OWNER: 'Organization Owner',
    ADMIN: 'Team Administrator',
    EVENT_MANAGER: 'Event Manager',
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-page)] text-[var(--text-primary)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
          <p className="text-sm text-[var(--text-muted)]">Verifying invitation...</p>
        </div>
      </div>
    )
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-page)] text-[var(--text-primary)]">
        <div
          className="max-w-md w-full rounded-2xl p-8 border text-center shadow-lg"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="w-14 h-14 rounded-full bg-red-500/10 text-red-400 mx-auto flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold mb-2">Invitation Unavailable</h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-[var(--surface-2)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition"
          >
            Return to EventSlot
          </Link>
        </div>
      </div>
    )
  }

  if (acceptedSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-page)] text-[var(--text-primary)]">
        <div
          className="max-w-md w-full rounded-2xl p-8 border text-center shadow-lg animate-in fade-in zoom-in duration-300"
          style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 text-emerald-400 mx-auto flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold mb-2">Welcome to the Team!</h1>
          <p className="text-sm text-[var(--text-muted)] mb-6">{acceptedSuccess}</p>
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--accent)] font-semibold">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Redirecting to your organization workspace...</span>
          </div>
        </div>
      </div>
    )
  }

  const roleTitle = invitation ? roleLabels[invitation.role] || invitation.role : 'Member'

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-page)] text-[var(--text-primary)]">
      <div
        className="max-w-md w-full rounded-2xl p-7 sm:p-9 border shadow-xl relative"
        style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        {/* Header Icon & Brand */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[var(--surface-2)] border mx-auto flex items-center justify-center mb-3.5 shadow-sm overflow-hidden">
            {invitation?.organization.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={invitation.organization.logo}
                alt={invitation.organization.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Building2 className="w-8 h-8 text-[var(--accent)]" />
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Join {invitation?.organization.name}
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            <strong>{invitation?.inviterName}</strong> invited you to collaborate as an{' '}
            <span className="text-[var(--accent)] font-semibold">{roleTitle}</span>.
          </p>
        </div>

        {/* Role & Permissions Card */}
        <div
          className="rounded-xl p-4 border mb-6 text-xs"
          style={{ backgroundColor: 'var(--surface-2)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2 font-bold text-sm text-[var(--text-primary)] mb-2">
            <Shield className="w-4 h-4 text-[var(--accent)]" />
            <span>Assigned Role: {roleTitle}</span>
          </div>
          <ul className="space-y-1.5 text-[var(--text-secondary)] pl-6 list-disc">
            <li>Manage and collaborate on organization events</li>
            <li>Coordinate operational check-ins and registrations</li>
            <li>Maintain durable audience following under the organization brand</li>
          </ul>
        </div>

        {/* Expiry Badge */}
        {invitation?.expiresAt && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)] mb-6">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Expires on{' '}
              {new Date(invitation.expiresAt).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
        )}

        {/* Error Feedback */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{error}</p>
              {errorCode === 'EMAIL_MISMATCH' && session?.user?.email && (
                <p className="mt-1 opacity-90">
                  Currently signed in as: <strong>{session.user.email}</strong>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {authStatus === 'unauthenticated' ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => signIn(undefined, { callbackUrl: `/invite/${token}` })}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-[var(--accent)] text-black hover:opacity-95 transition flex items-center justify-center gap-2 shadow-md"
            >
              <UserCheck className="w-4 h-4" />
              <span>Sign In / Sign Up to Join</span>
            </button>
            <p className="text-[11px] text-center text-[var(--text-muted)]">
              You will be redirected back here automatically once signed in.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              disabled={accepting}
              onClick={handleAccept}
              className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-[var(--accent)] text-black hover:opacity-95 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
            >
              {accepting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Joining {invitation?.organization.name}...</span>
                </>
              ) : (
                <>
                  <span>Accept Invitation & Join Team</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <p className="text-[11px] text-center text-[var(--text-muted)]">
              Signed in as <strong>{session?.user?.email}</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
