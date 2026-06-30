'use client'

import { useRouter } from 'next/navigation'

type ReportDownloadModalProps = {
  currentBalance?: number | null
  onClose: () => void
}

export default function ReportDownloadModal({
  currentBalance,
  onClose,
}: ReportDownloadModalProps) {
  const router = useRouter()

  const goToBilling = () => {
    onClose()
    router.push('/dashboard/billing#report-downloads')
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
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          background: '#141414',
          border: '0.5px solid rgba(240,237,230,0.1)',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '460px',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
          <div>
            <p style={{ fontSize: '0.7rem', color: '#C8F55A', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 0.35rem' }}>
              Report Download
            </p>
            <h2 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.4rem', color: '#F0EDE6', margin: 0 }}>
              More report downloads needed
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

        <p style={{ fontSize: '0.85rem', color: 'rgba(240,237,230,0.55)', marginBottom: '1rem', lineHeight: '1.65' }}>
          Downloading the full Word report uses <strong style={{ color: '#F0EDE6' }}>1 paid download slot</strong>.
          The preview stays free, but the file download needs enough report downloads on the organiser account.
        </p>

        {typeof currentBalance === 'number' && (
          <div
            style={{
              background: 'rgba(240,237,230,0.04)',
              border: '0.5px solid rgba(240,237,230,0.1)',
              borderRadius: '10px',
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
            }}
            >
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(240,237,230,0.72)' }}>
              Current balance: <strong style={{ color: '#F0EDE6' }}>{currentBalance}</strong> report download{currentBalance === 1 ? '' : 's'}
            </p>
          </div>
        )}

        <div
          style={{
            background: 'rgba(200,245,90,0.06)',
            border: '0.5px solid rgba(200,245,90,0.2)',
            borderRadius: '10px',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#C8F55A', lineHeight: '1.6' }}>
            Standard and higher plans can use AI insights in the analytics area. Super admins use everything for free.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          <button
            onClick={goToBilling}
            style={{
              flex: 1,
              minWidth: 180,
              background: '#C8F55A',
              color: '#0A0A0A',
              border: 'none',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              fontFamily: 'var(--font-dm-sans)',
              cursor: 'pointer',
            }}
          >
            Buy report downloads
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              minWidth: 140,
              background: 'transparent',
              border: '0.5px solid rgba(240,237,230,0.12)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              color: 'rgba(240,237,230,0.55)',
              fontSize: '0.82rem',
              fontFamily: 'var(--font-dm-sans)',
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
