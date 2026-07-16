'use client'

import { useState, useEffect } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'

export default function SignUpPage() {
  const { status } = useSession()
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpRequired, setOtpRequired] = useState(false)
  const [otpHint, setOtpHint] = useState('')
  const [resendingOtp, setResendingOtp] = useState(false)

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/dashboard')
    }
  }, [status, router])

  if (status === 'loading' || status === 'authenticated') {
    return null
  }

  async function continueWithCredentials(nextOtp?: string) {
    const result = await signIn('credentials', {
      email: email.trim(),
      password,
      otp: nextOtp ?? '',
      callbackUrl: '/my-events',
      redirect: false,
    })

    if (result?.error === 'OTP_REQUIRED') {
      setOtpRequired(true)
      setOtpHint('We sent a 6-digit code to your email. Enter it below to finish creating your account.')
      return { ok: false }
    }

    if (result?.error === 'INVALID_OTP') {
      setError('That verification code is invalid or expired. Request a new code and try again.')
      return { ok: false }
    }

    if (result?.error === 'OTP_RATE_LIMIT') {
      setError('Too many code requests were made recently. Please wait 10 minutes and try again.')
      return { ok: false }
    }

    if (result?.error) {
      setError('Account created, but sign-in could not be completed right now. Please try again in a moment.')
      return { ok: false }
    }

    if (result?.url) {
      window.location.href = result.url
      return { ok: true }
    }

    setError('Account created, but sign-in could not be completed right now. Please try again in a moment.')
    return { ok: false }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (!otpRequired) {
        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, privacyAccepted }),
        })
        const data = await res.json()
        if (!res.ok) {
          const errorMessages: Record<string, string> = {
            USE_GOOGLE_AUTH:
              'This email is already linked to Google Sign-In. Continue with Google, or use Forgot password to set a password for this account.',
            EMAIL_EXISTS: 'An account with this email already exists. Please sign in or reset your password.',
            MISSING_FIELDS: 'Name, email, and password are required.',
            WEAK_PASSWORD: 'Password must be at least 8 characters.',
            PRIVACY_NOT_ACCEPTED: 'You must accept the Privacy Policy to create an account.',
          }
          setError(errorMessages[data?.code] ?? data?.error ?? 'Something went wrong.')
          return
        }
      }

      await continueWithCredentials(otpRequired ? otp : '')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    if (resendingOtp || !otpRequired) return
    setError('')
    setResendingOtp(true)
    try {
      await continueWithCredentials('')
    } finally {
      setResendingOtp(false)
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
      {/* Card */}
      <div
        style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: 16,
          padding: '2rem',
        }}
      >
        {/* Heading */}
        <h1
          style={{
            fontFamily: 'var(--font-instrument-serif)',
            fontSize: '1.8rem',
            color: 'var(--text-primary)',
            margin: '0 0 0.375rem',
            fontWeight: 400,
          }}
        >
          Create your account
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-dm-sans)',
            fontWeight: 300,
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            margin: '0 0 1.75rem',
          }}
        >
          Start managing events in minutes.
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
            background: 'var(--surface-muted)',
            color: '#0A0A0A',
            border: '0.5px solid var(--border)',
            borderRadius: 100,
            padding: '0.75rem 1rem',
            fontSize: '0.9rem',
            fontWeight: 500,
            fontFamily: 'var(--font-dm-sans)',
            cursor: 'pointer',
          }}
        >
          {/* Google G SVG */}
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
          <div style={{ flex: 1, borderTop: '0.5px solid var(--border)' }} />
          <span
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-dm-sans)',
            }}
          >
            or
          </span>
          <div style={{ flex: 1, borderTop: '0.5px solid var(--border)' }} />
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <input
            type="text"
            placeholder="Name"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            style={inputStyle}
          />
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ ...inputStyle, paddingRight: '3rem' }}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword(value => !value)}
              style={passwordToggleStyle}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {otpRequired && (
            <>
              <input
                type="text"
                placeholder="6-digit verification code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={inputStyle}
              />
              {otpHint && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', margin: '-0.25rem 0 0' }}>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0, fontFamily: 'var(--font-dm-sans)', lineHeight: 1.5 }}>
                    {otpHint}
                  </p>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendingOtp || loading}
                    style={{
                      border: '0.5px solid rgba(200,245,90,0.35)',
                      borderRadius: 999,
                      background: 'transparent',
                      color: '#C8F55A',
                      padding: '0.45rem 0.8rem',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-dm-sans)',
                      cursor: resendingOtp || loading ? 'not-allowed' : 'pointer',
                      opacity: resendingOtp || loading ? 0.6 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {resendingOtp ? 'Sending...' : 'Resend code'}
                  </button>
                </div>
              )}
            </>
          )}

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

          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'flex-start',
              padding: '0.85rem',
              background: 'var(--surface-muted)',
              border: '0.5px solid var(--border)',
              borderRadius: 12,
              marginTop: '0.25rem',
            }}
          >
            <input
              type="checkbox"
              id="privacy"
              checked={privacyAccepted}
              onChange={e => setPrivacyAccepted(e.target.checked)}
              required
              style={{
                marginTop: 2,
                width: 16,
                height: 16,
                accentColor: '#C8F55A',
                cursor: 'pointer',
              }}
            />
            <label
              htmlFor="privacy"
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                fontFamily: 'var(--font-dm-sans)',
                cursor: 'pointer',
              }}
            >
              I have read and agree to the EventSlot{' '}
              <Link
                href="/privacy"
                target="_blank"
                style={{ color: '#C8F55A', textDecoration: 'underline', fontWeight: 500 }}
              >
                Privacy Policy
              </Link>
              . I understand my data will be used as described and I agree to receive platform and marketing emails from EventSlot. I can unsubscribe at any time.
            </label>
          </div>

          <button
            type="submit"
            disabled={!privacyAccepted || loading}
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
              cursor: !privacyAccepted || loading ? 'not-allowed' : 'pointer',
              opacity: !privacyAccepted || loading ? 0.4 : 1,
              marginTop: '0.25rem',
            }}
          >
            {loading ? (otpRequired ? 'Verifying...' : 'Creating account...') : otpRequired ? 'Verify code and continue' : 'Create account'}
          </button>
        </form>

        {/* Footer */}
        <p
          style={{
            fontSize: '0.82rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: '1.5rem',
            fontFamily: 'var(--font-dm-sans)',
          }}
        >
          Already have an account?{' '}
          <Link
            href="/signin"
            style={{ color: 'var(--text-secondary)', textDecoration: 'underline' }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface-muted)',
  border: '0.5px solid var(--border)',
  borderRadius: 8,
  padding: '0.75rem 0.875rem',
  fontSize: '0.875rem',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-dm-sans)',
  outline: 'none',
  boxSizing: 'border-box',
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
  color: 'var(--text-muted)',
  cursor: 'pointer',
}
