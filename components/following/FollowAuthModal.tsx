"use client"

import React, { useEffect } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'

interface FollowAuthModalProps {
  isOpen: boolean
  onClose: () => void
  organiserName: string
  organiserUsername: string
}

export function FollowAuthModal({
  isOpen,
  onClose,
  organiserName,
  organiserUsername,
}: FollowAuthModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const buildAutoFollowPath = () => {
    if (typeof window === 'undefined') {
      return `/${organiserUsername}?autoFollow=${encodeURIComponent(organiserUsername)}`
    }
    const url = new URL(window.location.href)
    url.searchParams.set('autoFollow', organiserUsername)
    return `${url.pathname}${url.search}`
  }

  const returnCallbackPath = buildAutoFollowPath()
  const signupHref = `/signup?callbackUrl=${encodeURIComponent(returnCallbackPath)}`
  const signinHref = `/signin?callbackUrl=${encodeURIComponent(returnCallbackPath)}`

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="follow-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-[440px] rounded-[20px] p-6 sm:p-7 text-center shadow-2xl animate-fadeIn"
        style={{
          background: 'var(--surface, #141414)',
          border: '1px solid color-mix(in srgb, var(--text-primary) 14%, transparent)',
        }}
      >
        {/* Close icon button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 rounded-full p-2 text-xs transition"
          style={{ color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          ✕
        </button>

        {/* Icon */}
        <div
          className="mx-auto mb-4 flex items-center justify-center rounded-full text-2xl"
          style={{
            background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
            border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            color: 'var(--accent)',
            width: 52,
            height: 52,
          }}
        >
          🔔
        </div>

        {/* Header */}
        <h3
          id="follow-modal-title"
          className="text-[1.25rem] font-bold"
          style={{ color: 'var(--text-primary)', margin: '0 0 0.5rem' }}
        >
          Sign up to follow {organiserName}
        </h3>
        <p
          className="text-[0.86rem] leading-relaxed"
          style={{ color: 'var(--text-secondary)', margin: '0 0 1.4rem' }}
        >
          Create a free EventSlot account or sign in to follow <strong>{organiserName}</strong>. Once signed in, you&apos;ll be brought right back here and automatically subscribed to new event alerts!
        </p>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          {/* Primary CTA: Create Free Account */}
          <Link
            href={signupHref}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] py-3 text-[0.9rem] font-bold no-underline transition hover:opacity-90 active:scale-[0.99]"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-contrast, #0A0A0A)',
            }}
          >
            <span>Create Free Account to Follow</span>
          </Link>

          {/* 1-Click Google Sign-Up / Sign-In */}
          <button
            type="button"
            onClick={() => signIn('google', { callbackUrl: returnCallbackPath })}
            className="flex w-full items-center justify-center gap-2.5 rounded-[12px] border py-2.5 text-[0.88rem] font-semibold transition hover:opacity-90 active:scale-[0.99]"
            style={{
              background: '#FFFFFF',
              color: '#0A0A0A',
              borderColor: 'var(--border)',
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.27 21.43 7.34 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.27 2.57 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98Z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          {/* Secondary: Already have an account? Sign in */}
          <div className="pt-1.5">
            <Link
              href={signinHref}
              className="inline-flex items-center justify-center text-[0.83rem] font-semibold no-underline hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              Already have an account? Sign in
            </Link>
          </div>
        </div>

        {/* Dismiss / Continue as guest */}
        <div
          className="mt-4 border-t pt-3.5"
          style={{ borderColor: 'color-mix(in srgb, var(--text-primary) 10%, transparent)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="text-[0.8rem] font-medium transition hover:underline"
            style={{ color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            Not right now
          </button>
        </div>
      </div>
    </div>
  )
}
