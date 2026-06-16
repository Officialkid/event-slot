'use client'

import { Suspense, useEffect, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff, Check } from 'lucide-react'

function SignInForm() {
  const { status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const didReset = searchParams.get('reset') === 'success'
  const authError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [rememberMeReady, setRememberMeReady] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpRequired, setOtpRequired] = useState(false)
  const [otpHint, setOtpHint] = useState('')

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard')
    }
  }, [status, router])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('eventslot.rememberMe')
      if (stored !== null) setRememberMe(stored === '1')
    } catch {
      // Ignore storage issues in private mode.
    }
    setRememberMeReady(true)
  }, [])

  useEffect(() => {
    if (!rememberMeReady) return
    try {
      window.localStorage.setItem('eventslot.rememberMe', rememberMe ? '1' : '0')
    } catch {
      // Ignore storage issues in private mode.
    }
  }, [rememberMe, rememberMeReady])

  async function handleGoogleSignIn() {
    setError('')
    setLoading(true)
    try {
      await signIn('google', { callbackUrl: '/my-events' })
    } catch {
      setError('Google sign-in failed. Please try again.')
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        otp: otpRequired ? otp : '',
        rememberMe: rememberMe ? 'true' : 'false',
        callbackUrl: '/my-events',
        redirect: false,
      })

      if (result?.error === 'OTP_REQUIRED') {
        setOtpRequired(true)
        setOtpHint('We sent a 6-digit code to your email. Enter it below to finish signing in.')
        setError('')
        return
      }

      if (result?.error === 'OTP_RATE_LIMIT') {
        setError('Too many code requests. Please wait a few minutes and try again.')
        return
      }

      if (result?.status === 429) {
        setError('Too many login attempts. Please wait 10 minutes before trying again.')
        return
      }

      if (result?.error) {
        setError(otpRequired ? 'Invalid verification code. Please try again.' : 'Invalid email or password')
        return
      }

      router.push(result?.url || '/my-events')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 440, margin: '0 auto', padding: '4rem 1.5rem' }}>
      <style>{`
        .pwa-header { display: none; }
        @media (display-mode: standalone) { .pwa-header { display: flex; } }
      `}</style>

      <div className="pwa-header" style={{ flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
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

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
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
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.20456C17.64 8.56637 17.5827 7.95274 17.4764 7.36365H9V10.845H13.8436C13.635 11.97 13.0009 12.9232 12.0477 13.5614V15.8196H14.9564C16.6582 14.2527 17.64 11.9455 17.64 9.20456Z" fill="#4285F4"/>
            <path d="M9 18C11.43 18 13.4673 17.1941 14.9564 15.8195L12.0477 13.5613C11.2418 14.1013 10.2109 14.4204 9 14.4204C6.65591 14.4204 4.67182 12.8372 3.96409 10.71H0.957275V13.0418C2.43818 15.9831 5.48182 18 9 18Z" fill="#34A853"/>
            <path d="M3.96409 10.71C3.78409 10.17 3.68182 9.59319 3.68182 9C3.68182 8.40682 3.78409 7.83 3.96409 7.29V4.95819H0.957275C0.347727 6.17319 0 7.54773 0 9C0 10.4523 0.347727 11.8268 0.957275 13.0418L3.96409 10.71Z" fill="#FBBC05"/>
            <path d="M9 3.57955C10.3214 3.57955 11.5077 4.03364 12.4405 4.92545L15.0218 2.34409C13.4632 0.891818 11.4259 0 9 0C5.48182 0 2.43818 2.01682 0.957275 4.95818L3.96409 7.29C4.67182 5.16273 6.65591 3.57955 9 3.57955Z" fill="#EA4335"/>
          </svg>
          {loading ? 'Preparing Google sign-in…' : 'Continue with Google'}
        </button>

        {authError && (
          <p style={{ fontSize: '0.8rem', color: '#FF6B6B', margin: '0.75rem 0 0', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.5 }}>
            Sign-in session expired. Please tap Google again to continue.
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1.5rem 0' }}>
          <div style={{ flex: 1, borderTop: '0.5px solid rgba(240,237,230,0.1)' }} />
          <span style={{ fontSize: '0.75rem', color: 'rgba(240,237,230,0.3)', fontFamily: 'var(--font-dm-sans)' }}>or</span>
          <div style={{ flex: 1, borderTop: '0.5px solid rgba(240,237,230,0.1)' }} />
        </div>

        <p style={{ fontSize: '0.78rem', lineHeight: 1.5, color: 'rgba(240,237,230,0.42)', fontFamily: 'var(--font-dm-sans)', margin: '-0.25rem 0 1rem' }}>
          If this email was created with Google sign-in, use the Google button above. If you later set a password, you can sign in below.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <label style={fieldLabelStyle} htmlFor="signin-email">
            Email address
          </label>
          <input
            id="signin-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <label style={fieldLabelStyle} htmlFor="signin-password">
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="signin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...inputStyle, paddingRight: '3rem' }}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((value) => !value)}
              style={passwordToggleStyle}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {otpRequired && (
            <>
              <label style={fieldLabelStyle} htmlFor="signin-otp">
                Verification code
              </label>
              <input
                id="signin-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={inputStyle}
              />
              {otpHint && (
                <p style={{ fontSize: '0.78rem', color: 'rgba(240,237,230,0.45)', margin: '-0.25rem 0 0', fontFamily: 'var(--font-dm-sans)', lineHeight: 1.5 }}>
                  {otpHint}
                </p>
              )}
            </>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)', fontSize: '0.82rem', color: 'rgba(240,237,230,0.68)' }}>
              <span style={{ position: 'relative', display: 'inline-flex', width: 18, height: 18 }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={checkboxStyle}
                />
                <span style={rememberBoxStyle}>
                  {rememberMe && <Check size={12} strokeWidth={3} />}
                </span>
              </span>
              Remember me
            </label>

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
            <p style={{ fontSize: '0.82rem', color: '#FF6B6B', margin: '0', fontFamily: 'var(--font-dm-sans)' }}>
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
          <Link href="/signup" style={{ color: 'rgba(240,237,230,0.7)', textDecoration: 'underline' }}>
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

const fieldLabelStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  color: 'rgba(240,237,230,0.58)',
  fontFamily: 'var(--font-dm-sans)',
  marginBottom: '-0.35rem',
}

const passwordToggleStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  right: '0.75rem',
  transform: 'translateY(-50%)',
  width: 32,
  height: 32,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  borderRadius: 8,
  background: 'transparent',
  color: 'rgba(240,237,230,0.5)',
  cursor: 'pointer',
}

const checkboxStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  margin: 0,
  opacity: 0,
  cursor: 'pointer',
}

const rememberBoxStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: 5,
  border: '0.5px solid rgba(240,237,230,0.18)',
  background: 'rgba(10,10,10,0.92)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#C8F55A',
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
