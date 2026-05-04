'use client'

import { useState } from 'react'

const BUNDLES = [
  { key: 'single', label: '1 download', price: 'KSh 100', highlight: false },
  { key: 'bundle3', label: '3 downloads', price: 'KSh 300', highlight: true },
  { key: 'bundle6', label: '6 downloads', price: 'KSh 500', highlight: false },
  { key: 'bundle15', label: '15 downloads', price: 'KSh 1,000', highlight: false },
]

export default function ReportDownloadModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState<string | null>(null)

  const purchase = async (bundleKey: string) => {
    setLoading(bundleKey)
    const res = await fetch('/api/report-downloads/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bundleKey }),
    })
    const data = await res.json()
    if (data.url) {
      window.location.assign(data.url)
    } else {
      setLoading(null)
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
