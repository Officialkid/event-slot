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

/** Returns the first non-empty answer value — conventionally the attendee's name. */
function extractDisplayName(questionAnswers: QuestionAnswer[]): string {
  return questionAnswers.find((qa) => qa.answer?.trim())?.answer?.trim() ?? 'Attendee'
}

/** Returns first answer value that looks like a phone number. */
function extractPhone(questionAnswers: QuestionAnswer[]): string | null {
  return (
    questionAnswers.find(
      (qa) => qa.answer && /^\+?\d[\d\s\-().]{6,}$/.test(qa.answer.trim())
    )?.answer ?? null
  )
}

export default function RegistrationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { slug, registrationId } = params as { slug: string; registrationId: string }
  const fromTab = searchParams.get('from') ?? 'confirmed'
  // Map URL 'from' value to the DB status value used in the neighbours query
  const neighbourStatus = fromTab === 'waitlist' ? 'waitlist' : 'confirmed'

  const [registration, setRegistration] = useState<RegistrationDetail | null>(null)
  const [neighbours, setNeighbours] = useState<Neighbours | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  // Keyboard navigation
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

  if (loading)
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#C8F55A] border-t-transparent rounded-full animate-spin" />
      </div>
    )

  if (error || !registration)
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <p className="text-red-400">{error ?? 'Registration not found'}</p>
      </div>
    )

  const displayName = extractDisplayName(registration.questionAnswers)
  const phone = extractPhone(registration.questionAnswers)

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Back link */}
        <Link
          href={`/dashboard/events/${slug}?tab=${fromTab}`}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white mb-6 transition-colors"
        >
          ← Back to registrations
        </Link>

        {/* Navigation bar */}
        {neighbours && (
          <div className="flex items-center justify-between mb-6 bg-zinc-900 rounded-lg px-4 py-3">
            <button
              onClick={() =>
                neighbours.prevId &&
                router.push(`/dashboard/events/${slug}/registrations/${neighbours.prevId}${fromTab !== 'confirmed' ? `?from=${fromTab}` : ''}`)
              }
              disabled={!neighbours.prevId}
              className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Previous
            </button>
            <span className="text-sm text-zinc-500">
              {neighbours.currentIndex + 1} of {neighbours.total}
            </span>
            <button
              onClick={() =>
                neighbours.nextId &&
                router.push(`/dashboard/events/${slug}/registrations/${neighbours.nextId}${fromTab !== 'confirmed' ? `?from=${fromTab}` : ''}`)
              }
              disabled={!neighbours.nextId}
              className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        )}

        {/* Header card */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="w-12 h-12 rounded-full bg-[#C8F55A]/10 flex items-center justify-center mb-3">
                <span className="text-[#C8F55A] font-semibold text-lg">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <h1 className="text-2xl font-semibold text-white">{displayName}</h1>
              {registration.attendeeEmail && (
                <p className="text-zinc-400 text-sm mt-1">{registration.attendeeEmail}</p>
              )}
              {phone && <p className="text-zinc-400 text-sm">{phone}</p>}
            </div>
            <span
              className={`shrink-0 text-xs px-3 py-1 rounded-full font-medium ${
                registration.status === 'confirmed'
                  ? 'bg-[#C8F55A]/10 text-[#C8F55A]'
                  : 'bg-yellow-500/10 text-yellow-400'
              }`}
            >
              {registration.status}
            </span>
          </div>

          <div className="mt-4 pt-4 border-t border-zinc-800 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Registered</p>
              <p className="text-sm text-zinc-300">
                {format(new Date(registration.registeredAt), 'dd MMM yyyy, HH:mm')}
              </p>
            </div>
            {registration.ticketCode && (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Ticket code</p>
                <p className="text-sm text-zinc-300 font-mono">{registration.ticketCode}</p>
              </div>
            )}
            {registration.confirmationCode && (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">
                  Confirmation code
                </p>
                <p className="text-sm text-zinc-300 font-mono">{registration.confirmationCode}</p>
              </div>
            )}
            {registration.checkedIn && (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Checked in</p>
                <p className="text-sm text-zinc-300">
                  {registration.checkedInAt
                    ? format(new Date(registration.checkedInAt), 'dd MMM yyyy, HH:mm')
                    : 'Yes'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Question answers */}
        {registration.questionAnswers.length > 0 ? (
          <div className="space-y-4">
            <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wider px-1">
              Registration responses ({registration.questionAnswers.length} questions)
            </h2>
            {registration.questionAnswers.map((qa, index) => (
              <div
                key={qa.questionId}
                className="bg-zinc-900 rounded-xl border border-zinc-800 p-5"
              >
                <p className="text-sm font-medium text-zinc-400 mb-3">
                  <span className="text-zinc-600 mr-2">{index + 1}.</span>
                  {qa.label}
                  {qa.required && <span className="text-[#C8F55A] ml-1">*</span>}
                </p>
                {qa.answer ? (
                  <p className="text-white text-base leading-relaxed whitespace-pre-wrap">
                    {qa.answer}
                  </p>
                ) : (
                  <p className="text-zinc-600 text-sm italic">No answer provided</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6 text-center">
            <p className="text-zinc-500 text-sm">No custom questions for this event.</p>
          </div>
        )}

        {/* Keyboard hint */}
        {neighbours && (
          <p className="text-center text-xs text-zinc-700 mt-8">
            Use ← → arrow keys to navigate between responses
          </p>
        )}
      </div>
    </div>
  )
}
