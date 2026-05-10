'use client'

import { differenceInDays } from 'date-fns'
import Link from 'next/link'

export function EventExpiryBanner({
  expiresAt,
  plan,
}: {
  expiresAt: Date | null | undefined
  plan: string | undefined
}) {
  if (!expiresAt || plan !== 'free') return null

  const daysLeft = differenceInDays(expiresAt, new Date())

  // Only show when 7 days or less remaining
  if (daysLeft > 7) return null

  const isUrgent = daysLeft <= 3

  return (
    <div
      className={`rounded-lg p-4 mb-4 border flex items-start gap-3 ${
        isUrgent
          ? 'bg-red-950/40 border-red-700 text-red-200'
          : 'bg-yellow-900/30 border-yellow-700 text-yellow-200'
      }`}
    >
      <div className="flex-shrink-0 mt-0.5">
        <svg
          className="w-5 h-5"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div className="flex-1">
        <h3 className="font-semibold">
          {isUrgent ? '🚨 Urgent: ' : '⚠️ '}Your event data will be deleted in{' '}
          {daysLeft} day{daysLeft !== 1 ? 's' : ''}
        </h3>
        <p className={`text-sm mt-1 ${isUrgent ? 'text-red-100/70' : 'text-yellow-100/70'}`}>
          Upgrade to Pro to keep your registrations, attendee data, and analytics
          permanently.
        </p>
        <div className="mt-3 flex gap-2">
          <Link
            href="/upgrade"
            className="inline-block bg-[#C8F55A] text-black text-sm font-bold px-4 py-2 rounded hover:bg-[#d4ff6a] transition-colors"
          >
            Upgrade to Pro →
          </Link>
          <a
            href="https://www.eventsslot.com"
            className={`inline-block text-sm font-semibold px-4 py-2 rounded border transition-colors ${
              isUrgent
                ? 'border-red-600 hover:bg-red-900/20'
                : 'border-yellow-600 hover:bg-yellow-900/20'
            }`}
          >
            Learn more
          </a>
        </div>
      </div>
    </div>
  )
}
