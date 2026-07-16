'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push('/signin?reset=success')
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
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
          Choose a new password
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
          Enter and confirm your new password below.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <input
            type="password"
            placeholder="New password"
            required
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            required
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            style={inputStyle}
          />

          {error && (
            <p style={{ fontSize: '0.82rem', color: '#FF6B6B', margin: 0, fontFamily: 'var(--font-dm-sans)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !token}
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
              cursor: (loading || !token) ? 'not-allowed' : 'pointer',
              opacity: (loading || !token) ? 0.7 : 1,
            }}
          >
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
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
