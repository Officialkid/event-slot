"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { FollowAuthModal } from './FollowAuthModal'

interface FollowButtonProps {
  organiserUsername: string
  organiserName: string
  initialFollowerCount?: number
  initialIsFollowing?: boolean
  showFollowerCountPublicly?: boolean
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

export function FollowButton({
  organiserUsername,
  organiserName,
  initialFollowerCount,
  initialIsFollowing,
  showFollowerCountPublicly = true,
  className = '',
  size = 'md',
}: FollowButtonProps) {
  const { data: session, status } = useSession()
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing ?? false)
  const [notifyNewEvents, setNotifyNewEvents] = useState(true)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount ?? 0)
  const [showCount, setShowCount] = useState(showFollowerCountPublicly)
  const [isSelf, setIsSelf] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notifLoading, setNotifLoading] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null)

  const showToast = useCallback((msg: string) => {
    setStatusFeedback(msg)
    setTimeout(() => {
      setStatusFeedback((prev) => (prev === msg ? null : prev))
    }, 3500)
  }, [])

  const executeFollowRequest = useCallback(
    async (nextFollowing: boolean, nextNotify = true): Promise<boolean> => {
      const res = await fetch(`/api/organizers/${encodeURIComponent(organiserUsername)}/follow`, {
        method: nextFollowing ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notifyNewEvents: nextNotify,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        if (data.code === 'AUTH_REQUIRED') {
          setShowAuthModal(true)
        }
        return false
      }

      setIsFollowing(Boolean(data.isFollowing))
      if (typeof data.notifyNewEvents === 'boolean') {
        setNotifyNewEvents(data.notifyNewEvents)
      }
      if (typeof data.followerCount === 'number') {
        setFollowerCount(data.followerCount)
      }
      return true
    },
    [organiserUsername]
  )

  // Fetch live follow status and handle ?autoFollow=<organiserUsername> return from Sign Up / Sign In
  useEffect(() => {
    let cancelled = false
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/organizers/${encodeURIComponent(organiserUsername)}/follow`, {
          cache: 'no-store',
        })
        const data = await res.json()
        if (!res.ok || cancelled) return

        setIsFollowing(Boolean(data.isFollowing))
        if (typeof data.notifyNewEvents === 'boolean') {
          setNotifyNewEvents(data.notifyNewEvents)
        }
        setFollowerCount(data.followerCount ?? 0)
        if (typeof data.showFollowerCountPublicly === 'boolean') {
          setShowCount(data.showFollowerCountPublicly)
        }
        setIsSelf(Boolean(data.isSelf))

        // Check if returning from Sign-Up / Sign-In with ?autoFollow=<organiserUsername>
        if (typeof window !== 'undefined' && !data.isSelf && !data.isFollowing) {
          const params = new URLSearchParams(window.location.search)
          const autoFollowTarget = params.get('autoFollow')
          if (
            autoFollowTarget &&
            autoFollowTarget.toLowerCase() === organiserUsername.toLowerCase() &&
            session?.user?.id
          ) {
            // Clean URL param so it doesn't re-trigger on refresh
            const cleanUrl = new URL(window.location.href)
            cleanUrl.searchParams.delete('autoFollow')
            window.history.replaceState({}, '', cleanUrl.toString())

            const ok = await executeFollowRequest(true, true)
            if (ok && !cancelled) {
              showToast(`Following ${organiserName} · Email alerts on`)
            }
          }
        }
      } catch {
        // Silent failure on background fetch
      }
    }

    if (organiserUsername) {
      void fetchStatus()
    }

    return () => {
      cancelled = true
    }
  }, [organiserUsername, organiserName, session?.user?.id, executeFollowRequest, showToast])

  // Organiser cannot follow themselves; render host badge so they know following is enabled
  if (isSelf) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.74rem] font-medium border"
        style={{
          borderColor: 'color-mix(in srgb, var(--accent) 30%, transparent)',
          background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
          color: 'var(--accent)',
          fontFamily: 'var(--font-dm-sans)',
        }}
        title="You are the organizer of this event"
      >
        <span>👤</span> You (Organizer)
      </span>
    )
  }

  const isAuthenticated = Boolean(status === 'authenticated' && session?.user?.id)

  const handleToggleFollow = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true)
      return
    }

    const previousFollowing = isFollowing
    const previousCount = followerCount
    const nextFollowing = !isFollowing
    const nextCount = nextFollowing ? followerCount + 1 : Math.max(0, followerCount - 1)

    // Optimistic UI update
    setIsFollowing(nextFollowing)
    if (nextFollowing) setNotifyNewEvents(true)
    setFollowerCount(nextCount)
    setLoading(true)

    try {
      const ok = await executeFollowRequest(nextFollowing, true)
      if (!ok) {
        setIsFollowing(previousFollowing)
        setFollowerCount(previousCount)
      } else if (nextFollowing) {
        showToast('Following · Email alerts enabled')
      }
    } catch {
      setIsFollowing(previousFollowing)
      setFollowerCount(previousCount)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleNotifications = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true)
      return
    }

    if (!isFollowing) {
      await handleToggleFollow()
      return
    }

    const previousNotify = notifyNewEvents
    const nextNotify = !notifyNewEvents
    setNotifyNewEvents(nextNotify)
    setNotifLoading(true)

    try {
      const ok = await executeFollowRequest(true, nextNotify)
      if (!ok) {
        setNotifyNewEvents(previousNotify)
      } else {
        showToast(nextNotify ? '🔔 Email notifications enabled' : '🔕 Email notifications muted')
      }
    } catch {
      setNotifyNewEvents(previousNotify)
    } finally {
      setNotifLoading(false)
    }
  }

  const isSmall = size === 'sm'
  const isLarge = size === 'lg'

  return (
    <>
      <div className={`inline-flex flex-wrap items-center gap-1.5 sm:gap-2 ${className}`}>
        {/* 1. Follow / Following Button */}
        <button
          type="button"
          onClick={handleToggleFollow}
          disabled={loading}
          aria-pressed={isFollowing}
          aria-label={isFollowing ? `Unfollow ${organiserName}` : `Follow ${organiserName}`}
          className={`inline-flex items-center justify-center gap-1.5 font-semibold transition active:scale-[0.98] ${
            isSmall
              ? 'rounded-full px-3 py-1 text-[0.76rem]'
              : isLarge
              ? 'rounded-full px-5 py-2 text-[0.92rem]'
              : 'rounded-full px-3.5 py-1.5 text-[0.82rem]'
          }`}
          style={{
            background: isFollowing
              ? 'color-mix(in srgb, var(--accent) 14%, var(--surface))'
              : 'var(--accent)',
            color: isFollowing
              ? 'var(--accent)'
              : 'var(--accent-contrast, #0A0A0A)',
            border: isFollowing
              ? '1px solid color-mix(in srgb, var(--accent) 35%, transparent)'
              : '1px solid transparent',
            cursor: 'pointer',
            boxShadow: isFollowing ? 'none' : '0 2px 8px rgba(0,0,0,0.12)',
            fontFamily: 'var(--font-dm-sans)',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? (
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : isFollowing ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Followed</span>
            </>
          ) : (
            <>
              <span className="font-bold text-[0.95em] leading-none">+</span>
              <span>Follow</span>
            </>
          )}
        </button>

        {/* 2. Notification Bell Toggle Button */}
        <button
          type="button"
          onClick={handleToggleNotifications}
          disabled={notifLoading || loading}
          aria-pressed={isFollowing && notifyNewEvents}
          title={
            isFollowing
              ? notifyNewEvents
                ? `Email notifications ON for ${organiserName} (click to mute)`
                : `Email notifications OFF for ${organiserName} (click to turn on)`
              : `Get email notifications when ${organiserName} publishes new events`
          }
          className={`inline-flex items-center justify-center gap-1 font-medium transition active:scale-[0.98] ${
            isSmall
              ? 'rounded-full px-2.5 py-1 text-[0.74rem]'
              : isLarge
              ? 'rounded-full px-3.5 py-2 text-[0.86rem]'
              : 'rounded-full px-3 py-1.5 text-[0.78rem]'
          }`}
          style={{
            background:
              isFollowing && notifyNewEvents
                ? 'color-mix(in srgb, var(--accent) 14%, var(--surface))'
                : 'color-mix(in srgb, var(--surface) 92%, transparent)',
            color:
              isFollowing && notifyNewEvents
                ? 'var(--text-primary)'
                : 'var(--text-secondary)',
            border:
              isFollowing && notifyNewEvents
                ? '1px solid color-mix(in srgb, var(--accent) 35%, transparent)'
                : '1px solid var(--border)',
            cursor: 'pointer',
            fontFamily: 'var(--font-dm-sans)',
            opacity: notifLoading ? 0.7 : 1,
          }}
        >
          <span className="leading-none">
            {isFollowing ? (notifyNewEvents ? '🔔' : '🔕') : '🔔'}
          </span>
          <span className="hidden xs:inline sm:inline">
            {isFollowing ? (notifyNewEvents ? 'Alerts On' : 'Muted') : 'Notify Me'}
          </span>
        </button>

        {showCount && followerCount > 0 && (
          <span
            className="text-[0.74rem] font-medium"
            style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)' }}
          >
            {followerCount} {followerCount === 1 ? 'follower' : 'followers'}
          </span>
        )}

        {statusFeedback && (
          <span
            className="text-[0.72rem] font-semibold animate-fadeIn"
            style={{ color: 'var(--accent)', fontFamily: 'var(--font-dm-sans)' }}
          >
            {statusFeedback}
          </span>
        )}
      </div>

      <FollowAuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        organiserName={organiserName}
        organiserUsername={organiserUsername}
      />
    </>
  )
}
