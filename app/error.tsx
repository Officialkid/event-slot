'use client'

import Link from 'next/link'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '6rem 1.5rem',
        textAlign: 'center',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-instrument-serif)',
          fontSize: '1.6rem',
          fontWeight: 400,
          color: 'var(--text-primary)',
          margin: '0 0 0.75rem',
        }}
      >
        Something went wrong
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-dm-sans)',
          fontWeight: 300,
          fontSize: '0.9rem',
          color: 'var(--text-secondary)',
          margin: '0 0 2.5rem',
          lineHeight: 1.6,
        }}
      >
        An unexpected error occurred. Please try again.
      </p>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={reset}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: '#C8F55A',
            color: '#0A0A0A',
            border: 'none',
            borderRadius: 100,
            padding: '0.72rem 1.4rem',
            fontSize: '0.9rem',
            fontWeight: 500,
            fontFamily: 'var(--font-dm-sans)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Try again
        </button>
        <Link
          href="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'transparent',
            color: 'var(--text-primary)',
            border: '0.5px solid var(--border)',
            borderRadius: 100,
            padding: '0.72rem 1.4rem',
            fontSize: '0.9rem',
            fontWeight: 400,
            fontFamily: 'var(--font-dm-sans)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Back to home
        </Link>
      </div>
    </div>
  )
}
