'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type OrgEvent = {
  id: string
  title: string
  slug: string
  capacity: number | null
  deadline: string | null
  confirmedCount: number
  waitlistCount: number
  dashboardToken: string
  createdAt: string
}

export default function MyEventsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [events, setEvents] = useState<OrgEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/my-events')
      .then(r => r.json())
      .then(data => {
        if (data.success) setEvents(data.events)
      })
      .finally(() => setLoading(false))
  }, [status])

  function isActive(deadline: string | null) {
    if (!deadline) return true
    return new Date(deadline) > new Date()
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/${slug}`
    navigator.clipboard.writeText(url)
    setCopied(slug)
    setTimeout(() => setCopied(null), 2000)
  }

  function formatDeadline(deadline: string) {
    return new Date(deadline).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (status === 'loading' || (status === 'unauthenticated')) return null

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '2rem',
          gap: '1rem',
          flexWrap: 'wrap',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-instrument-serif)',
            fontSize: '1.8rem',
            color: '#F0EDE6',
            margin: 0,
            fontWeight: 400,
          }}
        >
          Your events
        </h1>
        <Link
          href="/create"
          style={{
            background: '#C8F55A',
            color: '#0A0A0A',
            borderRadius: 100,
            padding: '0.6rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            fontFamily: 'var(--font-dm-sans)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Create an event
        </Link>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{ color: 'rgba(240,237,230,0.4)', fontSize: '0.875rem', fontFamily: 'var(--font-dm-sans)' }}>
          Loading…
        </div>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && (
        <div
          style={{
            background: '#141414',
            border: '0.5px solid rgba(240,237,230,0.08)',
            borderRadius: 16,
            padding: '3rem 2rem',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              color: 'rgba(240,237,230,0.4)',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: '0.9rem',
              margin: '0 0 1.5rem',
            }}
          >
            You have not created any events yet.
          </p>
          <Link
            href="/create"
            style={{
              background: '#C8F55A',
              color: '#0A0A0A',
              borderRadius: 100,
              padding: '0.7rem 1.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              fontFamily: 'var(--font-dm-sans)',
              textDecoration: 'none',
            }}
          >
            Create your first event
          </Link>
        </div>
      )}

      {/* Event cards */}
      {!loading && events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {events.map(event => {
            const active = isActive(event.deadline)
            return (
              <div
                key={event.id}
                style={{
                  background: '#141414',
                  border: '0.5px solid rgba(240,237,230,0.08)',
                  borderRadius: 16,
                  padding: '1.5rem',
                }}
              >
                {/* Title row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    marginBottom: '0.75rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <h2
                    style={{
                      fontFamily: 'var(--font-instrument-serif)',
                      fontSize: '1.15rem',
                      color: '#F0EDE6',
                      margin: 0,
                      fontWeight: 400,
                    }}
                  >
                    {event.title}
                  </h2>
                  {/* Status badge */}
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 500,
                      fontFamily: 'var(--font-dm-sans)',
                      borderRadius: 100,
                      padding: '0.25rem 0.75rem',
                      background: active ? 'rgba(200,245,90,0.12)' : 'rgba(255,107,107,0.1)',
                      color: active ? '#C8F55A' : '#FF6B6B',
                      border: `0.5px solid ${active ? 'rgba(200,245,90,0.3)' : 'rgba(255,107,107,0.3)'}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {active ? 'Active' : 'Closed'}
                  </span>
                </div>

                {/* Meta row */}
                <p
                  style={{
                    fontSize: '0.82rem',
                    color: 'rgba(240,237,230,0.5)',
                    fontFamily: 'var(--font-dm-sans)',
                    margin: '0 0 0.375rem',
                  }}
                >
                  {event.confirmedCount} confirmed · {event.waitlistCount} waitlisted ·{' '}
                  {event.capacity ? `${event.capacity} capacity` : 'Unlimited'}
                </p>

                {/* Deadline */}
                {event.deadline && (
                  <p
                    style={{
                      fontSize: '0.78rem',
                      color: 'rgba(240,237,230,0.35)',
                      fontFamily: 'var(--font-dm-sans)',
                      margin: '0 0 1rem',
                    }}
                  >
                    Deadline: {formatDeadline(event.deadline)}
                  </p>
                )}
                {!event.deadline && <div style={{ marginBottom: '1rem' }} />}

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => copyLink(event.slug)}
                    style={{
                      background: 'transparent',
                      border: '0.5px solid rgba(240,237,230,0.15)',
                      borderRadius: 100,
                      padding: '0.45rem 1rem',
                      fontSize: '0.8rem',
                      color: copied === event.slug ? '#C8F55A' : 'rgba(240,237,230,0.6)',
                      fontFamily: 'var(--font-dm-sans)',
                      cursor: 'pointer',
                    }}
                  >
                    {copied === event.slug ? 'Copied!' : 'Registration link'}
                  </button>
                  <Link
                    href={`/dashboard/${event.slug}?token=${event.dashboardToken}`}
                    style={{
                      background: 'transparent',
                      border: '0.5px solid rgba(240,237,230,0.15)',
                      borderRadius: 100,
                      padding: '0.45rem 1rem',
                      fontSize: '0.8rem',
                      color: 'rgba(240,237,230,0.6)',
                      fontFamily: 'var(--font-dm-sans)',
                      textDecoration: 'none',
                    }}
                  >
                    Dashboard →
                  </Link>
                  <Link
                    href={`/edit/${event.slug}`}
                    style={{
                      background: 'transparent',
                      border: '0.5px solid rgba(240,237,230,0.15)',
                      borderRadius: 100,
                      padding: '0.45rem 1rem',
                      fontSize: '0.8rem',
                      color: 'rgba(240,237,230,0.6)',
                      fontFamily: 'var(--font-dm-sans)',
                      textDecoration: 'none',
                    }}
                  >
                    Edit
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
