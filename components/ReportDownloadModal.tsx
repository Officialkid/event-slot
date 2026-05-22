'use client'

import { useState } from 'react'

export default function ReportDownloadModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleJoinWaitlist = async () => {
    if (!email) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, feature: 'Report Download' }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong.')
      } else {
        setSubmitted(true)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          background: '#141414',
          border: '0.5px solid rgba(240,237,230,0.1)',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '440px',
          width: '100%',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
              <p style={{ fontSize: '0.7rem', color: '#C8F55A', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
                Download Report
              </p>
              <span
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  background: 'rgba(200,245,90,0.12)',
                  color: '#C8F55A',
                  border: '0.5px solid rgba(200,245,90,0.3)',
                  borderRadius: '100px',
                  padding: '0.15rem 0.5rem',
                }}
              >
                Coming Soon
              </span>
            </div>
            <h2 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.4rem', color: '#F0EDE6', margin: 0 }}>
              Payment integration
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(240,237,230,0.4)', fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem' }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'rgba(240,237,230,0.5)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
          We&apos;re working on a seamless token-based payment system for report downloads.
          Join the waitlist and we&apos;ll notify you the moment it goes live.
        </p>

        {!submitted ? (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: error ? '0.5rem' : '1rem' }}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoinWaitlist()}
                style={{
                  flex: 1,
                  background: 'rgba(240,237,230,0.04)',
                  border: '0.5px solid rgba(240,237,230,0.15)',
                  borderRadius: '8px',
                  padding: '0.65rem 0.9rem',
                  color: '#F0EDE6',
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-dm-sans)',
                  outline: 'none',
                }}
              />
              <button
                onClick={handleJoinWaitlist}
                disabled={loading || !email}
                style={{
                  background: email && !loading ? '#C8F55A' : 'rgba(200,245,90,0.25)',
                  color: '#0A0A0A',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.65rem 1.1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-dm-sans)',
                  cursor: email && !loading ? 'pointer' : 'not-allowed',
                  whiteSpace: 'nowrap',
                }}
              >
                {loading ? 'Saving…' : 'Notify me'}
              </button>
            </div>
            {error && (
              <p style={{ fontSize: '0.75rem', color: '#f87171', margin: '0 0 1rem' }}>{error}</p>
            )}
          </>
        ) : (
          <div
            style={{
              background: 'rgba(200,245,90,0.07)',
              border: '0.5px solid rgba(200,245,90,0.25)',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
            }}
          >
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#C8F55A', fontFamily: 'var(--font-dm-sans)' }}>
              ✓ You&apos;re on the list! We&apos;ll email <strong>{email}</strong> when it goes live.
            </p>
          </div>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: 'none',
            border: '0.5px solid rgba(240,237,230,0.1)',
            borderRadius: '8px',
            padding: '0.65rem',
            color: 'rgba(240,237,230,0.4)',
            fontSize: '0.82rem',
            fontFamily: 'var(--font-dm-sans)',
            cursor: 'pointer',
          }}
        >
          Close
        </button>
      </div>
    </div>
  )
}


  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          background: '#141414',
          border: '0.5px solid rgba(240,237,230,0.1)',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '440px',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <p style={{ fontSize: '0.7rem', color: '#C8F55A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              Download Report
            </p>
            <h2 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.4rem', color: '#F0EDE6', margin: 0 }}>
              Get your Word document
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(240,237,230,0.4)', fontSize: '1.2rem', cursor: 'pointer', padding: '0.25rem' }}>x</button>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'rgba(240,237,230,0.5)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
          Your AI report is ready. Choose a download option to save it as a Word document.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
          {BUNDLES.map((b) => (
            <button
              key={b.key}
              onClick={() => purchase(b.key)}
              disabled={loading !== null}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: b.highlight ? 'rgba(200,245,90,0.08)' : 'rgba(240,237,230,0.03)',
                border: b.highlight ? '1.5px solid rgba(200,245,90,0.4)' : '0.5px solid rgba(240,237,230,0.1)',
                borderRadius: '10px',
                padding: '0.85rem 1.1rem',
                cursor: loading !== null ? 'not-allowed' : 'pointer',
                opacity: loading !== null && loading !== b.key ? 0.5 : 1,
                width: '100%',
              }}
            >
              <span style={{ fontSize: '0.9rem', color: '#F0EDE6', fontFamily: 'var(--font-dm-sans)' }}>
                {loading === b.key ? 'Redirecting to payment...' : b.label}
                {b.highlight && (
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.65rem', background: '#C8F55A', color: '#0A0A0A', borderRadius: '100px', padding: '0.15rem 0.5rem', fontWeight: 600 }}>
                    BEST VALUE
                  </span>
                )}
              </span>
              <span style={{ fontSize: '0.95rem', color: '#C8F55A', fontWeight: 600, fontFamily: 'var(--font-dm-sans)' }}>
                {b.price}
              </span>
            </button>
          ))}
        </div>

        <p style={{ fontSize: '0.72rem', color: 'rgba(240,237,230,0.25)', textAlign: 'center' }}>
          Secure payment via Paystack · M-Pesa, Visa, Mastercard accepted
        </p>
      </div>
    </div>
  )
}
