'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
    } catch {
      // Silently ignore — we never reveal if the email exists
    } finally {
      setLoading(false)
      setSubmitted(true)
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <div
        style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 16,
          padding: '2rem',
        }}
      >
        <Link
          href="/signin"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.78rem',
            color: 'var(--text-muted)',
            textDecoration: 'none',
            marginBottom: '1.5rem',
            fontFamily: 'var(--font-dm-sans)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2L4 6l4 4" />
          </svg>
          Back to sign in
        </Link>

        <h1
          style={{
            fontFamily: 'var(--font-instrument-serif)',
            fontSize: '1.5rem',
            fontWeight: 400,
            color: 'var(--text-primary)',
            margin: '0 0 0.375rem',
          }}
        >
          Reset your password
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-dm-sans)',
            fontWeight: 300,
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
            margin: '0 0 1.75rem',
          }}
        >
          Enter your email and we will send you a reset link.
        </p>

        {submitted ? (
          <div
            style={{
              background: 'rgba(200,245,90,0.07)',
              border: '0.5px solid rgba(200,245,90,0.25)',
              borderRadius: 10,
              padding: '1rem 1.25rem',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: '0.875rem',
              color: 'var(--accent)',
              lineHeight: 1.5,
            }}
          >
            If that email is registered, a reset link has been sent.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: '#C8F55A',
                color: '#0A0A0A',
                border: 'none',
                borderRadius: 100,
                padding: '0.75rem 1rem',
                fontSize: '0.9rem',
                fontWeight: 500,
                fontFamily: 'var(--font-dm-sans)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '0.5px solid var(--border)',
  borderRadius: 8,
  padding: '0.75rem 0.875rem',
  fontSize: '0.875rem',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-dm-sans)',
  outline: 'none',
  boxSizing: 'border-box',
}
