'use client'

import { useState } from 'react'

const TOUR_SECTIONS = [
  { id: 'dashboard', label: 'Dashboard overview', desc: 'Stats, activity, quick actions' },
  { id: 'create', label: 'Creating an event', desc: 'Form, questions, settings' },
  { id: 'registration', label: 'Registration page', desc: 'What attendees see' },
  { id: 'dashboard_event', label: 'Managing an event', desc: 'Confirmed, waitlist, capacity' },
  { id: 'community', label: 'Invite & earn', desc: 'Share referral link and earn tokens' },
  { id: 'analytics', label: 'Analytics & AI insights', desc: 'Charts, insight cards, Q&A' },
  { id: 'report', label: 'Generating a report', desc: 'AI report and download' },
  { id: 'team', label: 'Team members', desc: 'Inviting collaborators' },
]

interface Props {
  onClose: () => void
  onStart: (sections: string[]) => void
}

export default function OnboardingTourSelector({ onClose, onStart }: Props) {
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')

  const toggle = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]))
    setError('')
  }

  const selectAll = () => setSelected(TOUR_SECTIONS.map(section => section.id))
  const clearAll = () => setSelected([])

  const start = () => {
    if (selected.length === 0) {
      setError('Please select at least one section to tour.')
      return
    }

    onStart(selected)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '0.5px solid var(--border)',
          borderRadius: '16px',
          padding: '2rem',
          maxWidth: '480px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
          <div>
            <p style={{ fontSize: '0.7rem', color: '#C8F55A', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>
              Product Tour
            </p>
            <h2 style={{ fontFamily: 'Instrument Serif', fontSize: '1.4rem', color: 'var(--text-primary)', margin: 0 }}>
              What would you like to explore?
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>
            x
          </button>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Select one or more sections. You can run the tour for just the parts you need.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <button onClick={selectAll} style={{ fontSize: '0.78rem', color: '#C8F55A', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Select all
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>|</span>
          <button onClick={clearAll} style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Clear
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
          {TOUR_SECTIONS.map(section => {
            const isSelected = selected.includes(section.id)

            return (
              <button
                key={section.id}
                onClick={() => toggle(section.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  background: isSelected ? 'var(--accent-dim)' : 'var(--surface-muted)',
                  border: isSelected ? '1px solid rgba(200,245,90,0.3)' : '0.5px solid var(--border)',
                  borderRadius: '10px',
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    flexShrink: 0,
                    background: isSelected ? '#C8F55A' : 'transparent',
                    border: isSelected ? 'none' : '1.5px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {isSelected && <span style={{ color: '#0A0A0A', fontSize: '0.7rem', fontWeight: 700 }}>x</span>}
                </div>
                <div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, fontWeight: isSelected ? 500 : 400 }}>{section.label}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>{section.desc}</p>
                </div>
              </button>
            )
          })}
        </div>

        {error && <p style={{ fontSize: '0.8rem', color: '#FF6B6B', marginBottom: '0.75rem' }}>{error}</p>}

        <button
          onClick={start}
          style={{
            background: '#C8F55A',
            color: '#0A0A0A',
            border: 'none',
            borderRadius: '100px',
            padding: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Start tour
          {selected.length > 0 && ` (${selected.length} section${selected.length !== 1 ? 's' : ''})`}
        </button>
      </div>
    </div>
  )
}
