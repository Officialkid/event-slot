'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'

interface QuestionAnswer {
  questionId: string
  label: string
  type: string
  required: boolean
  answer: string | null
}

interface RegistrationDetail {
  id: string
  status: string
  registeredAt: string
  attendeeEmail: string | null
  confirmationCode: string | null
  ticketCode: string | null
  checkedIn: boolean
  checkedInAt: string | null
  registrationNumber: number | null
  questionAnswers: QuestionAnswer[]
}

interface Neighbours {
  total: number
  currentIndex: number
  prevId: string | null
  nextId: string | null
}

function extractDisplayName(questionAnswers: QuestionAnswer[]): string {
  return questionAnswers.find((qa) => qa.answer?.trim())?.answer?.trim() ?? 'Attendee'
}

function extractPhone(questionAnswers: QuestionAnswer[]): string | null {
  return (
    questionAnswers.find(
      (qa) => qa.answer && /^\+?\d[\d\s\-().]{6,}$/.test(qa.answer.trim())
    )?.answer ?? null
  )
}

function downloadResponseAsCSV(registration: RegistrationDetail, displayName: string) {
  const rows: string[][] = [
    ['Field', 'Value'],
    ['Name', displayName],
    ['Email', registration.attendeeEmail ?? ''],
    ['Status', registration.status],
    ['Registered At', new Date(registration.registeredAt).toLocaleString()],
    ['Confirmation Code', registration.confirmationCode ?? ''],
    ['Ticket Code', registration.ticketCode ?? ''],
    ['Checked In', registration.checkedIn ? 'Yes' : 'No'],
    ...(registration.checkedInAt
      ? [['Checked In At', new Date(registration.checkedInAt).toLocaleString()]]
      : []),
    ['', ''],
    ['Question', 'Answer'],
    ...registration.questionAnswers.map((qa) => [
      qa.label + (qa.required ? ' *' : ''),
      qa.answer ?? '',
    ]),
  ]

  const csv = rows
    .map((row) =>
      row
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `response-${displayName.replace(/\s+/g, '-').toLowerCase()}-${registration.confirmationCode ?? registration.id.slice(0, 8)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function RegistrationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { slug, registrationId } = params as { slug: string; registrationId: string }
  const fromTab = searchParams.get('from') ?? 'confirmed'
  const neighbourStatus = fromTab === 'waitlist' ? 'waitlist' : 'confirmed'

  const [registration, setRegistration] = useState<RegistrationDetail | null>(null)
  const [neighbours, setNeighbours] = useState<Neighbours | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pageBg = 'var(--bg-page)'
  const surfaceBg = 'var(--surface)'
  const mutedSurfaceBg = 'var(--surface-muted)'
  const borderColor = 'var(--border)'
  const textPrimary = 'var(--text-primary)'
  const textSecondary = 'var(--text-secondary)'
  const textMuted = 'var(--text-muted)'

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [regRes, navRes] = await Promise.all([
          fetch(`/api/events/${slug}/registrations/${registrationId}`),
          fetch(`/api/events/${slug}/registrations/${registrationId}/neighbours?status=${neighbourStatus}`),
        ])
        if (!regRes.ok) throw new Error('Failed to load registration')
        const regData = await regRes.json()
        const navData = navRes.ok ? await navRes.json() : null
        setRegistration(regData)
        setNeighbours(navData)
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [slug, registrationId, neighbourStatus])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && neighbours?.prevId) {
        router.push(`/dashboard/events/${slug}/registrations/${neighbours.prevId}${fromTab !== 'confirmed' ? `?from=${fromTab}` : ''}`)
      }
      if (e.key === 'ArrowRight' && neighbours?.nextId) {
        router.push(`/dashboard/events/${slug}/registrations/${neighbours.nextId}${fromTab !== 'confirmed' ? `?from=${fromTab}` : ''}`)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [neighbours, slug, router, fromTab])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: pageBg }}>
        <div
          className="h-6 w-6 animate-spin rounded-full border-2"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (error || !registration) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: pageBg }}>
        <p className="text-sm font-medium" style={{ color: 'var(--error)' }}>
          {error ?? 'Registration not found'}
        </p>
      </div>
    )
  }

  const displayName = extractDisplayName(registration.questionAnswers)
  const phone = extractPhone(registration.questionAnswers)

  return (
    <div className="min-h-screen" style={{ background: pageBg, color: textPrimary }}>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href={`/dashboard/events/${slug}?tab=${fromTab}`}
          className="mb-6 inline-flex items-center gap-2 text-sm transition-colors hover:text-[var(--accent)]"
          style={{ color: textSecondary }}
        >
          ← Back to registrations
        </Link>

        {neighbours && (
          <div
            className="mb-6 flex items-center justify-between rounded-lg px-4 py-3"
            style={{ background: surfaceBg, border: `0.5px solid ${borderColor}` }}
          >
            <button
              onClick={() =>
                neighbours.prevId &&
                router.push(`/dashboard/events/${slug}/registrations/${neighbours.prevId}${fromTab !== 'confirmed' ? `?from=${fromTab}` : ''}`)
              }
              disabled={!neighbours.prevId}
              className="flex items-center gap-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-[var(--accent)]"
              style={{ color: textSecondary }}
            >
              ← Previous
            </button>
            <span className="text-sm" style={{ color: textMuted }}>
              {neighbours.currentIndex + 1} of {neighbours.total}
            </span>
            <button
              onClick={() =>
                neighbours.nextId &&
                router.push(`/dashboard/events/${slug}/registrations/${neighbours.nextId}${fromTab !== 'confirmed' ? `?from=${fromTab}` : ''}`)
              }
              disabled={!neighbours.nextId}
              className="flex items-center gap-1 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-30 hover:text-[var(--accent)]"
              style={{ color: textSecondary }}
            >
              Next →
            </button>
          </div>
        )}

        <div className="mb-6 rounded-xl border p-6" style={{ background: surfaceBg, borderColor }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div
                className="mb-3 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)' }}
              >
                <span className="text-lg font-semibold" style={{ color: 'var(--accent)' }}>
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <h1 className="text-2xl font-semibold" style={{ color: textPrimary }}>
                {displayName}
              </h1>
              {registration.attendeeEmail && (
                <p className="mt-1 text-sm" style={{ color: textSecondary }}>
                  {registration.attendeeEmail}
                </p>
              )}
              {phone && (
                <p className="text-sm" style={{ color: textSecondary }}>
                  {phone}
                </p>
              )}
            </div>
            <div className="flex items-start gap-3">
              <span
                className="shrink-0 rounded-full px-3 py-1 text-xs font-medium"
                style={{
                  background:
                    registration.status === 'confirmed'
                      ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                      : registration.status === 'cancelled' || registration.status === 'rejected'
                      ? 'color-mix(in srgb, var(--error) 10%, transparent)'
                      : 'color-mix(in srgb, var(--warning) 10%, transparent)',
                  color:
                    registration.status === 'confirmed'
                      ? 'var(--accent)'
                      : registration.status === 'cancelled' || registration.status === 'rejected'
                      ? 'var(--error)'
                      : 'var(--warning)',
                }}
              >
                {registration.status}
              </span>
              <button
                onClick={() => downloadResponseAsCSV(registration, displayName)}
                className="shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:text-[var(--accent)]"
                style={{ background: mutedSurfaceBg, color: textSecondary, borderColor }}
                title="Download this response as CSV"
              >
                ↓ Download
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 border-t pt-4" style={{ borderColor }}>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider" style={{ color: textMuted }}>
                Registered
              </p>
              <p className="text-sm" style={{ color: textSecondary }}>
                {format(new Date(registration.registeredAt), 'dd MMM yyyy, HH:mm')}
              </p>
            </div>
            {registration.ticketCode && (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wider" style={{ color: textMuted }}>
                  Ticket code
                </p>
                <p className="text-sm font-mono" style={{ color: textSecondary }}>
                  {registration.ticketCode}
                </p>
              </div>
            )}
            {registration.confirmationCode && (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wider" style={{ color: textMuted }}>
                  Confirmation code
                </p>
                <p className="text-sm font-mono" style={{ color: textSecondary }}>
                  {registration.confirmationCode}
                </p>
              </div>
            )}
            {registration.checkedIn && (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wider" style={{ color: textMuted }}>
                  Checked in
                </p>
                <p className="text-sm" style={{ color: textSecondary }}>
                  {registration.checkedInAt
                    ? format(new Date(registration.checkedInAt), 'dd MMM yyyy, HH:mm')
                    : 'Yes'}
                </p>
              </div>
            )}
          </div>
        </div>

        {registration.questionAnswers.length > 0 ? (
          <div className="space-y-4">
            <h2 className="px-1 text-sm font-medium uppercase tracking-wider" style={{ color: textMuted }}>
              Registration responses ({registration.questionAnswers.length} questions)
            </h2>
            {registration.questionAnswers.map((qa, index) => (
              <div
                key={qa.questionId}
                className="rounded-xl border p-5"
                style={{ background: surfaceBg, borderColor }}
              >
                <p className="mb-3 text-sm font-medium" style={{ color: textSecondary }}>
                  <span className="mr-2" style={{ color: textMuted }}>
                    {index + 1}.
                  </span>
                  {qa.label}
                  {qa.required && <span className="ml-1" style={{ color: 'var(--accent)' }}>*</span>}
                </p>
                {qa.answer ? (
                  <p className="whitespace-pre-wrap text-base leading-relaxed" style={{ color: textPrimary }}>
                    {qa.answer}
                  </p>
                ) : (
                  <p className="text-sm italic" style={{ color: textMuted }}>
                    No answer provided
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border p-6 text-center" style={{ background: surfaceBg, borderColor }}>
            <p className="text-sm" style={{ color: textMuted }}>
              No custom questions for this event.
            </p>
          </div>
        )}

        {neighbours && (
          <p className="mt-8 text-center text-xs" style={{ color: textMuted }}>
            Use ← → arrow keys to navigate between responses
          </p>
        )}
      </div>
    </div>
  )
}
