'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

type CampaignStatus = 'DRAFT' | 'SENDING' | 'SENT' | 'FAILED'
type CampaignType = 'REMINDER' | 'UPDATE' | 'THANK_YOU' | 'CUSTOM'

interface Campaign {
  id: string
  subject: string
  type: CampaignType
  status: CampaignStatus
  sentAt: string | null
  recipientCount: number | null
  failureReason?: string | null
  createdAt: string
}

const TEMPLATES: Record<CampaignType, { subject: string; body: string }> = {
  REMINDER: {
    subject: 'Reminder: {{event}} is coming up!',
    body: 'Hi {{name}},\n\nJust a reminder that {{event}} is happening soon. We look forward to seeing you there!\n\nBest,\nThe EventSlot Team',
  },
  THANK_YOU: {
    subject: 'Thank you for attending {{event}}',
    body: 'Hi {{name}},\n\nThank you for attending {{event}}. It was wonderful having you with us!\n\nBest,\nThe EventSlot Team',
  },
  UPDATE: {
    subject: 'Important update about {{event}}',
    body: 'Hi {{name}},\n\nWe have an important update regarding {{event}}:\n\n[Your update here]\n\nBest,\nThe EventSlot Team',
  },
  CUSTOM: {
    subject: '',
    body: '',
  },
}

const TYPE_LABELS: Record<CampaignType, string> = {
  REMINDER: 'Reminder',
  UPDATE: 'Update',
  THANK_YOU: 'Thank You',
  CUSTOM: 'Custom',
}

const emailSurface = 'var(--surface)'
const emailSurfaceAlt = 'var(--surface-2)'
const emailInput = 'var(--bg-input)'
const emailBorder = '0.5px solid var(--border-subtle)'
const emailTextPrimary = 'var(--text-primary)'
const emailTextSecondary = 'var(--text-secondary)'
const emailTextMuted = 'var(--text-muted)'
const emailSoftAccent = 'color-mix(in srgb, var(--accent) 12%, transparent)'

const STATUS_COLORS: Record<CampaignStatus, string> = {
  SENT: '#C8F55A',
  SENDING: 'var(--text-secondary)',
  FAILED: '#FF6B6B',
  DRAFT: 'var(--text-muted)',
}

function extractEmailVerificationDomain(message: string | null | undefined): string | null {
  if (!message) return null
  const match = message.match(/(?:the\s+)?([a-z0-9.-]+\.[a-z]{2,})\s+domain is not verified/i)
  return match?.[1]?.toLowerCase() ?? null
}

export default function EmailDashboardPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [confirmedCount, setConfirmedCount] = useState(0)
  const [eventTitle, setEventTitle] = useState('')
  const [loading, setLoading] = useState(true)

  const [type, setType] = useState<CampaignType>('CUSTOM')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [preview, setPreview] = useState(false)
  const [sending, setSending] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const failedVerificationDomain = campaigns
    .map((campaign) => extractEmailVerificationDomain(campaign.failureReason))
    .find(Boolean) ?? null

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${slug}/campaigns`)
      if (res.status === 401 || res.status === 403) {
        router.push('/dashboard/events')
        return
      }
      if (!res.ok) return
      const data = await res.json()
      setCampaigns(data.campaigns ?? [])
      setConfirmedCount(data.confirmedCount ?? 0)
      setEventTitle(data.eventTitle ?? '')
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [slug, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const applyTemplate = (t: CampaignType) => {
    setType(t)
    const tpl = TEMPLATES[t]
    setSubject(tpl.subject.replace(/\{\{event\}\}/g, eventTitle))
    setBody(tpl.body.replace(/\{\{event\}\}/g, eventTitle))
    setPreview(false)
  }

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return
    setErrorMsg('')
    setSending(true)
    try {
      const res = await fetch(`/api/events/${slug}/campaigns/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, type }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Failed to send emails.')
        return
      }
      setSuccessMsg(`✓ Sending to ${data.recipientCount} attendee${data.recipientCount === 1 ? '' : 's'}. Emails will arrive shortly.`)
      setSubject('')
      setBody('')
      setType('CUSTOM')
      setPreview(false)
      fetchData()
      setTimeout(() => setSuccessMsg(''), 6000)
    } catch {
      setErrorMsg('Unable to send emails. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const canSend = subject.trim().length > 0 && body.trim().length > 0 && confirmedCount > 0 && !sending

  const previewHtml = body
    .replace(/\{\{name\}\}/g, 'Attendee')
    .replace(/\{\{event\}\}/g, eventTitle || '[Event]')
    .replace(/\n/g, '<br/>')

  if (loading) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1rem' }}>
        <div style={{ height: 20, width: '40%', borderRadius: 8, background: emailSurfaceAlt, animation: 'pulse 1.4s ease-in-out infinite', marginBottom: '1rem' }} />
        <div style={{ height: 300, borderRadius: 12, background: emailSurfaceAlt, animation: 'pulse 1.4s ease-in-out infinite' }} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Back link */}
      <Link
        href={`/dashboard/events/${slug}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.78rem', color: emailTextMuted, fontFamily: 'var(--font-dm-sans)', textDecoration: 'none', marginBottom: '1.75rem' }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8.5 2.5L4 7l4.5 4.5" />
        </svg>
        Back to event dashboard
      </Link>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.6rem', fontWeight: 400, color: emailTextPrimary, margin: '0 0 0.35rem' }}>
          Email Attendees
        </h1>
        <p style={{ fontSize: '0.82rem', color: emailTextSecondary, fontFamily: 'var(--font-dm-sans)', margin: 0 }}>
          {confirmedCount > 0
            ? `Send a message to all ${confirmedCount} confirmed attendee${confirmedCount === 1 ? '' : 's'} of ${eventTitle || 'this event'}`
            : `No confirmed attendees yet for ${eventTitle || 'this event'}`}
        </p>
      </div>

      {/* Compose card */}
      <div style={{ background: emailSurface, border: emailBorder, borderRadius: 14, padding: '1.5rem', marginBottom: '1.25rem' }}>
        {/* Template picker */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: emailTextMuted, fontFamily: 'var(--font-dm-sans)' }}>
            Compose
          </span>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {(['REMINDER', 'THANK_YOU', 'UPDATE', 'CUSTOM'] as CampaignType[]).map((t) => (
              <button
                key={t}
                onClick={() => applyTemplate(t)}
                style={{
                  background: type === t ? emailSoftAccent : 'transparent',
                  border: type === t ? '0.5px solid color-mix(in srgb, var(--accent) 55%, transparent)' : emailBorder,
                  borderRadius: 8,
                  padding: '0.3rem 0.7rem',
                  fontSize: '0.75rem',
                  color: type === t ? 'var(--accent)' : emailTextSecondary,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans)',
                  transition: 'all 0.15s',
                }}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Subject */}
        <input
          type="text"
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setPreview(false) }}
          placeholder="Subject line"
          style={{
            width: '100%',
            background: emailInput,
            border: emailBorder,
            borderRadius: 8,
            padding: '0.65rem 0.875rem',
            fontSize: '0.875rem',
            color: emailTextPrimary,
            fontFamily: 'var(--font-dm-sans)',
            outline: 'none',
            boxSizing: 'border-box',
            marginBottom: '0.75rem',
          }}
        />

        {/* Body */}
        <textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); setPreview(false) }}
          placeholder={'Write your message here…\n\nUse {{name}} for the attendee\'s name and {{event}} for the event title.'}
          rows={8}
          style={{
            width: '100%',
            background: emailInput,
            border: emailBorder,
            borderRadius: 8,
            padding: '0.65rem 0.875rem',
            fontSize: '0.875rem',
            color: emailTextPrimary,
            fontFamily: 'var(--font-dm-sans)',
            outline: 'none',
            resize: 'vertical',
            boxSizing: 'border-box',
            lineHeight: '1.6',
            marginBottom: '0.75rem',
          }}
        />

        {/* Preview toggle */}
        {subject.trim() && body.trim() && (
          <div style={{ marginBottom: '0.75rem' }}>
            <button
              onClick={() => setPreview((p) => !p)}
              style={{
                background: 'transparent',
                border: emailBorder,
                borderRadius: 8,
                padding: '0.4rem 0.875rem',
                fontSize: '0.78rem',
                color: emailTextSecondary,
                cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans)',
              }}
            >
              {preview ? '✕ Hide preview' : '👁 Preview email'}
            </button>
          </div>
        )}

        {/* Preview pane */}
        {preview && (
          <div
            style={{
              background: emailSurfaceAlt,
              border: emailBorder,
              borderRadius: 10,
              padding: '1.25rem',
              marginBottom: '0.75rem',
            }}
          >
            <div style={{ fontSize: '0.7rem', letterSpacing: '0.07em', textTransform: 'uppercase', color: emailTextMuted, fontFamily: 'var(--font-dm-sans)', marginBottom: '0.5rem' }}>
              Email preview (sample name: &quot;Attendee&quot;)
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: emailTextPrimary, fontFamily: 'var(--font-dm-sans)', marginBottom: '0.35rem' }}>
              {subject.replace(/\{\{event\}\}/g, eventTitle || '[Event]').replace(/\{\{name\}\}/g, 'Attendee')}
            </div>
            <div
              style={{ fontSize: '0.82rem', color: emailTextSecondary, fontFamily: 'var(--font-dm-sans)', lineHeight: 1.75 }}
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        )}

        {/* Tip + Send row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontSize: '0.73rem', color: emailTextMuted, fontFamily: 'var(--font-dm-sans)' }}>
            Use <code style={{ background: emailSurfaceAlt, padding: '0 4px', borderRadius: 4 }}>{'{{name}}'}</code> and{' '}
            <code style={{ background: emailSurfaceAlt, padding: '0 4px', borderRadius: 4 }}>{'{{event}}'}</code> to personalise
          </p>
          <button
            onClick={handleSend}
            disabled={!canSend}
            style={{
              background: canSend ? '#C8F55A' : 'rgba(200,245,90,0.12)',
              border: 'none',
              borderRadius: 100,
              padding: '0.6rem 1.4rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: canSend ? '#0A0A0A' : 'rgba(200,245,90,0.35)',
              cursor: canSend ? 'pointer' : 'not-allowed',
              fontFamily: 'var(--font-dm-sans)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
            {sending ? 'Sending…' : `Send to ${confirmedCount} attendee${confirmedCount === 1 ? '' : 's'}`}
          </button>
        </div>

        {successMsg && (
          <div style={{ marginTop: '0.875rem', background: 'rgba(200,245,90,0.08)', border: '0.5px solid rgba(200,245,90,0.25)', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#C8F55A', fontFamily: 'var(--font-dm-sans)' }}>
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div style={{ marginTop: '0.875rem', background: 'rgba(255,107,107,0.08)', border: '0.5px solid rgba(255,107,107,0.25)', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#FF6B6B', fontFamily: 'var(--font-dm-sans)' }}>
            {errorMsg}
          </div>
        )}
      </div>

      {/* Advanced features — Coming Up */}
      <div style={{ background: emailSurface, border: emailBorder, borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem', opacity: 0.86 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: emailTextMuted, fontFamily: 'var(--font-dm-sans)' }}>
            Advanced Email Features
          </span>
          <span style={{ background: emailSurfaceAlt, border: emailBorder, borderRadius: 100, padding: '0.15rem 0.6rem', fontSize: '0.65rem', color: emailTextMuted, fontFamily: 'var(--font-dm-sans)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Coming Up
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
          {['Scheduled Sends', 'Segmented Lists', 'Open Rate Analytics'].map((f) => (
            <div key={f} style={{ background: emailSurfaceAlt, border: emailBorder, borderRadius: 8, padding: '0.65rem', fontSize: '0.75rem', textAlign: 'center', color: emailTextSecondary, fontFamily: 'var(--font-dm-sans)' }}>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Sent history */}
      <div>
        <div style={{ fontSize: '0.78rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: emailTextMuted, fontFamily: 'var(--font-dm-sans)', marginBottom: '0.875rem' }}>
          Sent History
        </div>
        {failedVerificationDomain && (
          <div style={{ marginBottom: '0.875rem', background: 'rgba(255,107,107,0.08)', border: '0.5px solid rgba(255,107,107,0.24)', borderRadius: 10, padding: '0.875rem 1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: '0 0 0.2rem', fontSize: '0.82rem', color: '#FF6B6B', fontFamily: 'var(--font-dm-sans)', fontWeight: 600 }}>
                Email sending is paused for {failedVerificationDomain}.
              </p>
              <p style={{ margin: 0, fontSize: '0.76rem', color: emailTextSecondary, fontFamily: 'var(--font-dm-sans)', lineHeight: 1.5 }}>
                Configure SMTP or verify the sender domain with the active email provider, then send the campaign again. Until that is done, organizer emails can keep failing even when the rest of the dashboard works.
              </p>
            </div>
            <a
              href='/admin/health'
              target='_blank'
              rel='noreferrer'
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '0.5px solid rgba(255,107,107,0.3)', borderRadius: 8, padding: '0.45rem 0.8rem', textDecoration: 'none', color: '#FF6B6B', fontSize: '0.75rem', fontFamily: 'var(--font-dm-sans)', whiteSpace: 'nowrap' }}
            >
              Open email health
            </a>
          </div>
        )}
        {campaigns.length === 0 ? (
          <p style={{ fontSize: '0.82rem', color: emailTextMuted, fontFamily: 'var(--font-dm-sans)', margin: 0 }}>
            No emails sent yet for this event.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {campaigns.map((c) => {
              const failedDomain = extractEmailVerificationDomain(c.failureReason)
              return (
                <div
                  key={c.id}
                  style={{
                    background: emailSurface,
                    border: emailBorder,
                    borderRadius: 10,
                    padding: '0.875rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                <div>
                  <p style={{ margin: '0 0 0.2rem', fontSize: '0.875rem', color: emailTextPrimary, fontFamily: 'var(--font-dm-sans)', fontWeight: 500 }}>
                    {c.subject}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.73rem', color: emailTextMuted, fontFamily: 'var(--font-dm-sans)' }}>
                    {new Date(c.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {c.recipientCount != null && ` · ${c.recipientCount} recipient${c.recipientCount === 1 ? '' : 's'}`}
                    {' · '}<span style={{ textTransform: 'uppercase', fontSize: '0.68rem', letterSpacing: '0.04em' }}>{TYPE_LABELS[c.type]}</span>
                  </p>
                  {c.status === 'FAILED' && c.failureReason && (
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.73rem', color: emailTextSecondary, fontFamily: 'var(--font-dm-sans)' }}>
                      {c.failureReason}
                    </p>
                  )}
                  {failedDomain && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', color: '#FF6B6B', fontFamily: 'var(--font-dm-sans)' }}>
                        Verify {failedDomain} in Resend before retrying this email.
                      </span>
                      <a
                        href='https://resend.com/domains'
                        target='_blank'
                        rel='noreferrer'
                        style={{ fontSize: '0.72rem', color: 'var(--accent)', fontFamily: 'var(--font-dm-sans)', textDecoration: 'none' }}
                      >
                        View domains
                      </a>
                    </div>
                  )}
                </div>
                <span
                  style={{
                    background: c.status === 'SENT'
                      ? 'rgba(200,245,90,0.1)'
                      : c.status === 'FAILED'
                        ? 'rgba(255,107,107,0.1)'
                        : 'color-mix(in srgb, var(--text-primary) 5%, transparent)',
                    border: `0.5px solid ${STATUS_COLORS[c.status]}40`,
                    borderRadius: 100,
                    padding: '0.2rem 0.65rem',
                    fontSize: '0.68rem',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase' as const,
                    color: STATUS_COLORS[c.status],
                    fontFamily: 'var(--font-dm-sans)',
                    whiteSpace: 'nowrap' as const,
                    flexShrink: 0,
                  }}
                >
                  {c.status}
                </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
