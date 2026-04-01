'use client'

import { useState } from 'react'

interface Props {
  registrationId: string
}

const STAR_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent']

export default function FeedbackForm({ registrationId }: Props) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [enjoyed, setEnjoyed] = useState('')
  const [improve, setImprove] = useState('')
  const [complaint, setComplaint] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) { setError('Please select a rating.'); return }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registrationId, rating, enjoyed: enjoyed.trim() || null, improve: improve.trim() || null, complaint: complaint.trim() || null }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Something went wrong. Please try again.')
        return
      }
      setSubmitted(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ background: '#141414', border: '0.5px solid rgba(200,245,90,0.2)', borderRadius: 14, padding: '2.5rem', textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(200,245,90,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#C8F55A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10l4 4 8-8" />
          </svg>
        </div>
        <h2 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.4rem', fontWeight: 400, color: '#F0EDE6', margin: '0 0 0.625rem' }}>
          Thanks for your feedback!
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'rgba(240,237,230,0.45)', fontFamily: 'var(--font-dm-sans)', margin: 0 }}>
          Your response has been recorded and will help the organiser improve future events.
        </p>
      </div>
    )
  }

  const activeRating = hover || rating

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Rating */}
      <div style={{ background: '#141414', border: '0.5px solid rgba(240,237,230,0.08)', borderRadius: 14, padding: '1.75rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(240,237,230,0.35)', fontFamily: 'var(--font-dm-sans)', marginBottom: '1.25rem' }}>
          Overall rating <span style={{ color: '#FF6B6B' }}>*</span>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', justifyContent: 'center', marginBottom: '0.75rem' }}>
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                fontSize: '2rem',
                lineHeight: 1,
                color: star <= activeRating ? '#C8F55A' : 'rgba(240,237,230,0.15)',
                transition: 'color 0.1s',
              }}
              aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
            >
              ★
            </button>
          ))}
        </div>
        {activeRating > 0 && (
          <div style={{ textAlign: 'center', fontSize: '0.82rem', color: activeRating === rating ? '#C8F55A' : 'rgba(240,237,230,0.4)', fontFamily: 'var(--font-dm-sans)' }}>
            {STAR_LABELS[activeRating]}
          </div>
        )}
      </div>

      {/* Open-ended questions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {[
          { id: 'enjoyed', label: 'What did you enjoy most?', value: enjoyed, setter: setEnjoyed, placeholder: 'The speakers, the venue, the networking…' },
          { id: 'improve', label: 'What could be improved?', value: improve, setter: setImprove, placeholder: 'Timing, content, organisation…' },
          { id: 'complaint', label: 'Any complaints or concerns?', value: complaint, setter: setComplaint, placeholder: 'Anything we should know about…' },
        ].map(field => (
          <div key={field.id}>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 500, color: 'rgba(240,237,230,0.55)', fontFamily: 'var(--font-dm-sans)', marginBottom: '0.4rem' }}>
              {field.label}
              <span style={{ color: 'rgba(240,237,230,0.25)', fontWeight: 400, marginLeft: 4 }}>(optional)</span>
            </label>
            <textarea
              value={field.value}
              onChange={e => field.setter(e.target.value)}
              placeholder={field.placeholder}
              rows={3}
              maxLength={1000}
              style={{
                width: '100%',
                background: '#141414',
                border: '0.5px solid rgba(240,237,230,0.1)',
                borderRadius: 8,
                padding: '0.75rem',
                fontSize: '0.875rem',
                color: '#F0EDE6',
                fontFamily: 'var(--font-dm-sans)',
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                lineHeight: 1.5,
              }}
            />
          </div>
        ))}
      </div>

      {error && (
        <p style={{ fontSize: '0.82rem', color: '#FF6B6B', fontFamily: 'var(--font-dm-sans)', margin: 0 }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          background: submitting ? 'rgba(200,245,90,0.4)' : '#C8F55A',
          border: 'none',
          borderRadius: 10,
          padding: '0.85rem',
          fontSize: '0.925rem',
          fontWeight: 600,
          color: '#0A0A0A',
          cursor: submitting ? 'not-allowed' : 'pointer',
          fontFamily: 'var(--font-dm-sans)',
          width: '100%',
        }}
      >
        {submitting ? 'Submitting…' : 'Submit feedback'}
      </button>
    </form>
  )
}
