'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'

function SignInForm() {
  const searchParams = useSearchParams()
  const didReset = searchParams.get('reset') === 'success'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn('credentials', {
      email,
      password,
      callbackUrl: '/my-events',
      redirect: false,
    })
    if (result?.error) {
      setError('Invalid email or password')
      setLoading(false)
    } else if (result?.url) {
      window.location.href = result.url
    }
  }

  return (
    <div
      style={{
        maxWidth: 440,
        margin: '0 auto',
        padding: '4rem 1.5rem',
      }}
    >
      {/* PWA Splash Header — visible only in standalone (installed) mode */}
      <style>{`
        .pwa-header { display: none; }
        @media (display-mode: standalone) { .pwa-header { display: flex; } }
      `}</style>
      <div
        className="pwa-header"
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <Image src="/assets/logo.png" alt="EventSlot" width={160} height={48} style={{ height: 48, width: 'auto' }} />
        <p
          style={{
            fontFamily: 'var(--font-dm-sans)',
            fontWeight: 300,
            fontSize: '0.82rem',
            color: 'rgba(240,237,230,0.4)',
            margin: '0.5rem 0 0',
            textAlign: 'center',
          }}
        >
          Your events, under control.
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          background: '#141414',
          border: '0.5px solid rgba(240,237,230,0.08)',
          borderRadius: 16,
          padding: '2rem',
        }}
      >
        {didReset && (
          <div
            style={{
              background: 'rgba(200,245,90,0.08)',
              border: '0.5px solid rgba(200,245,90,0.3)',
              borderRadius: 10,
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              fontSize: '0.85rem',
              color: '#C8F55A',
              fontFamily: 'var(--font-dm-sans)',
            }}
          >
            Password updated. Sign in below.
          </div>
        )}

        {/* Heading */}
        <h1
          style={{
            fontFamily: 'var(--font-instrument-serif)',
            fontSize: '1.8rem',
            color: '#F0EDE6',
            margin: '0 0 0.375rem',
            fontWeight: 400,
          }}
        >
          Welcome back
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-dm-sans)',
            fontWeight: 300,
            fontSize: '0.9rem',
            color: 'rgba(240,237,230,0.5)',
            margin: '0 0 1.75rem',
          }}
        >
          Sign in to manage your events.
        </p>

        {/* Google Button */}
        <button
          type="button"
          onClick={() => signIn('google', { callbackUrl: '/my-events' })}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.625rem',
            background: '#F0EDE6',
            color: '#0A0A0A',
            border: 'none',
            borderRadius: 100,
            padding: '0.75rem 1rem',
            fontSize: '0.9rem',
            fontWeight: 500,
            fontFamily: 'var(--font-dm-sans)',
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.20456C17.64 8.56637 17.5827 7.95274 17.4764 7.36365H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8196H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20456Z" fill="#4285F4"/>
            <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5613C11.2418 14.1013 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8372 3.96409 10.71H0.957275V13.0418C2.43818 15.9831 5.48182 18 9 18Z" fill="#34A853"/>
            <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59319 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95819H0.957275C0.347727 6.17319 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
            <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            margin: '1.5rem 0',
          }}
        >
          <div style={{ flex: 1, borderTop: '0.5px solid rgba(240,237,230,0.1)' }} />
          <span
            style={{
              fontSize: '0.75rem',
              color: 'rgba(240,237,230,0.3)',
              fontFamily: 'var(--font-dm-sans)',
            }}
          >
            or
          </span>
          <div style={{ flex: 1, borderTop: '0.5px solid rgba(240,237,230,0.1)' }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={inputStyle}
          />
          <div style={{ textAlign: 'right', marginTop: '-0.25rem' }}>
            <Link
              href="/forgot-password"
              style={{
                fontSize: '0.78rem',
                color: 'rgba(240,237,230,0.35)',
                textDecoration: 'none',
                fontFamily: 'var(--font-dm-sans)',
              }}
            >
              Forgot password?
            </Link>
          </div>

          {error && (
            <p
              style={{
                fontSize: '0.82rem',
                color: '#FF6B6B',
                margin: '0',
                fontFamily: 'var(--font-dm-sans)',
              }}
            >
              {error}
            </p>
          )}

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
              marginTop: '0.25rem',
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {/* Footer */}
        <p
          style={{
            fontSize: '0.82rem',
            color: 'rgba(240,237,230,0.4)',
            textAlign: 'center',
            marginTop: '1.5rem',
            fontFamily: 'var(--font-dm-sans)',
          }}
        >
          Don&apos;t have an account?{' '}
          <Link
            href="/signup"
            style={{ color: 'rgba(240,237,230,0.7)', textDecoration: 'underline' }}
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: '#0A0A0A',
  border: '0.5px solid rgba(240,237,230,0.12)',
  borderRadius: 8,
  padding: '0.75rem 0.875rem',
  fontSize: '0.875rem',
  color: '#F0EDE6',
  fontFamily: 'var(--font-dm-sans)',
  outline: 'none',
  boxSizing: 'border-box',
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
