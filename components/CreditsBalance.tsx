'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Props {
  /** Optional initial value — if provided, no fetch is made (e.g. SSR passes it). */
  initialBalance?: number
  /** Show as a compact single-line pill (default) or a slightly larger "card" variant */
  variant?: 'pill' | 'card'
}

export default function CreditsBalance({ initialBalance, variant = 'pill' }: Props) {
  const [balance, setBalance] = useState<number | null>(initialBalance ?? null)

  useEffect(() => {
    if (initialBalance !== undefined) return // already have a value
    fetch('/api/user/credits')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && typeof d.balance === 'number') setBalance(d.balance) })
      .catch(() => {})
  }, [initialBalance])

  const hasBalance = balance !== null && balance > 0

  if (variant === 'card') {
    return (
      <Link
        href="/dashboard/billing#credits"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.6rem 0.875rem',
          borderRadius: 10,
          background: hasBalance ? 'rgba(200,245,90,0.06)' : 'rgba(240,237,230,0.03)',
          border: `0.5px solid ${hasBalance ? 'rgba(200,245,90,0.15)' : 'rgba(240,237,230,0.08)'}`,
          textDecoration: 'none',
          transition: 'background 0.15s',
        }}
      >
        <LightningIcon size={14} color={hasBalance ? '#C8F55A' : 'rgba(240,237,230,0.3)'} />
        <span
          style={{
            fontFamily: 'var(--font-dm-sans)',
            fontSize: '0.82rem',
            fontWeight: 500,
            color: hasBalance ? '#C8F55A' : 'rgba(240,237,230,0.35)',
            lineHeight: 1,
          }}
        >
          {balance === null ? '…' : balance} {balance === 1 ? 'point' : 'points'}
        </span>
      </Link>
    )
  }

  // Default: pill
  return (
    <Link
      href="/dashboard/billing#credits"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.2rem 0.55rem',
        borderRadius: 100,
        background: hasBalance ? 'rgba(200,245,90,0.08)' : 'rgba(240,237,230,0.04)',
        border: `0.5px solid ${hasBalance ? 'rgba(200,245,90,0.15)' : 'rgba(240,237,230,0.08)'}`,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        transition: 'background 0.15s',
      }}
    >
      <LightningIcon size={12} color={hasBalance ? '#C8F55A' : 'rgba(240,237,230,0.3)'} />
      <span
        style={{
          fontFamily: 'var(--font-dm-sans)',
          fontSize: '0.72rem',
          fontWeight: 500,
          color: hasBalance ? '#C8F55A' : 'rgba(240,237,230,0.35)',
          lineHeight: 1,
        }}
      >
        {balance === null ? '…' : balance} {balance === 1 ? 'point' : 'points'}
      </span>
    </Link>
  )
}

function LightningIcon({ size = 12, color = '#C8F55A' }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M7 1L2.5 6.5H6L5 11L9.5 5.5H6L7 1Z"
        fill={color}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
