"use client"

import React from 'react'
import { FollowButton } from '@/components/following/FollowButton'

interface PostRegistrationFollowCardProps {
  organiserName: string
  organiserUsername: string
  className?: string
}

export function PostRegistrationFollowCard({
  organiserName,
  organiserUsername,
  className = '',
}: PostRegistrationFollowCardProps) {
  if (!organiserUsername) return null

  return (
    <div
      className={`rounded-[16px] p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn ${className}`}
      style={{
        background: 'color-mix(in srgb, var(--accent) 8%, var(--surface))',
        border: '1px solid color-mix(in srgb, var(--accent) 24%, transparent)',
      }}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-base">🔔</span>
          <p className="text-[0.92rem] font-bold" style={{ color: 'var(--text-primary)', margin: 0 }}>
            Never miss another event by {organiserName}
          </p>
        </div>
        <p className="text-[0.8rem] leading-relaxed" style={{ color: 'var(--text-secondary)', margin: 0 }}>
          Follow to get notified about upcoming workshops, meetups, and early-bird tickets.
        </p>
      </div>

      <div className="shrink-0 w-full sm:w-auto flex justify-end">
        <FollowButton
          organiserUsername={organiserUsername}
          organiserName={organiserName}
          size="md"
        />
      </div>
    </div>
  )
}
