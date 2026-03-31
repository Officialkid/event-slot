'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import React from 'react'

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
  archived: boolean
}

export default function MyEventsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [events, setEvents] = useState<OrgEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [renameTarget, setRenameTarget] = useState<OrgEvent | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<OrgEvent | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/signin')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/my-events')
      .then(r => r.json())
      .then(data => { if (data.success) setEvents(data.events) })
      .finally(() => setLoading(false))
  }, [status])

  useEffect(() => {
    if (!openMenu) return
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [openMenu])

  async function handleRename() {
    if (!renameTarget || !renameValue.trim()) return
    setActionLoading(true)
    setActionError('')
    try {
      const res = await fetch(`/api/events/${renameTarget.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', title: renameValue.trim() }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) { setActionError(data.error || 'Failed'); return }
      setEvents(ev => ev.map(e => e.id === renameTarget.id ? { ...e, title: renameValue.trim() } : e))
      setRenameTarget(null)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleArchive(event: OrgEvent) {
    try {
      await fetch(`/api/events/${event.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', archived: !event.archived }),
      })
      setEvents(ev => ev.map(e => e.id === event.id ? { ...e, archived: !event.archived } : e))
    } catch { /* silent */ }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setActionLoading(true)
    setActionError('')
    try {
      const res = await fetch(`/api/events/${deleteTarget.slug}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok || !data.success) { setActionError(data.error || 'Failed'); return }
      setEvents(ev => ev.filter(e => e.id !== deleteTarget.id))
      setDeleteTarget(null)
    } finally {
      setActionLoading(false)
    }
  }

  function copyLink(slug: string) {
    navigator.clipboard.writeText(`${window.location.origin}/${slug}`)
    setCopied(slug)
    setTimeout(() => setCopied(null), 2000)
  }

  if (status === 'loading' || status === 'unauthenticated') return null

  const activeEvents = events.filter(e => !e.archived)
  const archivedEvents = events.filter(e => e.archived)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', gap: '1rem', flexWrap: 'wrap' }}>
        <h1 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.8rem', color: '#F0EDE6', margin: 0, fontWeight: 400 }}>
          Your events
        </h1>
        <Link href="/create" style={{ background: '#C8F55A', color: '#0A0A0A', borderRadius: 100, padding: '0.6rem 1.25rem', fontSize: '0.875rem', fontWeight: 500, fontFamily: 'var(--font-dm-sans)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Create an event
        </Link>
      </div>

      {loading && (
        <div style={{ color: 'rgba(240,237,230,0.4)', fontSize: '0.875rem', fontFamily: 'var(--font-dm-sans)' }}>Loading...</div>
      )}

      {!loading && events.length === 0 && (
        <div style={{ background: '#141414', border: '0.5px solid rgba(240,237,230,0.08)', borderRadius: 16, padding: '3rem 2rem', textAlign: 'center' }}>
          <p style={{ color: 'rgba(240,237,230,0.4)', fontFamily: 'var(--font-dm-sans)', fontSize: '0.9rem', margin: '0 0 1.5rem' }}>
            You have not created any events yet.
          </p>
          <Link href="/create" style={{ background: '#C8F55A', color: '#0A0A0A', borderRadius: 100, padding: '0.7rem 1.5rem', fontSize: '0.875rem', fontWeight: 500, fontFamily: 'var(--font-dm-sans)', textDecoration: 'none' }}>
            Create your first event
          </Link>
        </div>
      )}

      {!loading && events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {activeEvents.map(event => (
            <EventCard
              key={event.id}
              event={event}
              copied={copied}
              openMenu={openMenu}
              menuRef={menuRef}
              onCopy={s => { copyLink(s); setOpenMenu(null) }}
              onOpenMenu={id => setOpenMenu(id === openMenu ? null : id)}
              onRename={ev => { setRenameTarget(ev); setRenameValue(ev.title); setOpenMenu(null) }}
              onArchive={ev => { handleArchive(ev); setOpenMenu(null) }}
              onDelete={ev => { setDeleteTarget(ev); setOpenMenu(null) }}
            />
          ))}

          {archivedEvents.length > 0 && (
            <>
              <p style={{ fontSize: '0.75rem', color: 'rgba(240,237,230,0.3)', fontFamily: 'var(--font-dm-sans)', margin: '0.5rem 0 0', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Archived ({archivedEvents.length})
              </p>
              {archivedEvents.map(event => (
                <EventCard
                  key={event.id}
                  event={event}
                  copied={copied}
                  openMenu={openMenu}
                  menuRef={menuRef}
                  onCopy={s => { copyLink(s); setOpenMenu(null) }}
                  onOpenMenu={id => setOpenMenu(id === openMenu ? null : id)}
                  onRename={ev => { setRenameTarget(ev); setRenameValue(ev.title); setOpenMenu(null) }}
                  onArchive={ev => { handleArchive(ev); setOpenMenu(null) }}
                  onDelete={ev => { setDeleteTarget(ev); setOpenMenu(null) }}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Rename modal */}
      {renameTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: '#141414', border: '0.5px solid rgba(240,237,230,0.1)', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 420 }}>
            <h3 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.2rem', color: '#F0EDE6', margin: '0 0 1rem', fontWeight: 400 }}>Rename event</h3>
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenameTarget(null) }}
              style={{ width: '100%', background: '#0A0A0A', border: '0.5px solid rgba(240,237,230,0.15)', borderRadius: 8, padding: '0.6rem 0.875rem', color: '#F0EDE6', fontSize: '0.9rem', fontFamily: 'var(--font-dm-sans)', boxSizing: 'border-box' }}
            />
            {actionError && <p style={{ color: '#FF6B6B', fontSize: '0.8rem', margin: '0.5rem 0 0', fontFamily: 'var(--font-dm-sans)' }}>{actionError}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => { setRenameTarget(null); setActionError('') }} style={{ background: 'transparent', border: '0.5px solid rgba(240,237,230,0.15)', borderRadius: 100, padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'rgba(240,237,230,0.6)', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)' }}>
                Cancel
              </button>
              <button onClick={handleRename} disabled={actionLoading || !renameValue.trim()} style={{ background: '#C8F55A', color: '#0A0A0A', borderRadius: 100, padding: '0.5rem 1.1rem', fontSize: '0.8rem', fontWeight: 500, border: 'none', cursor: actionLoading ? 'wait' : 'pointer', fontFamily: 'var(--font-dm-sans)' }}>
                {actionLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: '#141414', border: '0.5px solid rgba(240,237,230,0.1)', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 420 }}>
            <h3 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.2rem', color: '#F0EDE6', margin: '0 0 0.5rem', fontWeight: 400 }}>Delete event?</h3>
            <p style={{ fontSize: '0.85rem', color: 'rgba(240,237,230,0.5)', fontFamily: 'var(--font-dm-sans)', margin: '0 0 1.25rem' }}>
              <strong style={{ color: '#F0EDE6' }}>{deleteTarget.title}</strong> and all its registrations will be permanently deleted. This cannot be undone.
            </p>
            {actionError && <p style={{ color: '#FF6B6B', fontSize: '0.8rem', margin: '0 0 0.75rem', fontFamily: 'var(--font-dm-sans)' }}>{actionError}</p>}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => { setDeleteTarget(null); setActionError('') }} style={{ background: 'transparent', border: '0.5px solid rgba(240,237,230,0.15)', borderRadius: 100, padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'rgba(240,237,230,0.6)', cursor: 'pointer', fontFamily: 'var(--font-dm-sans)' }}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={actionLoading} style={{ background: '#FF6B6B', color: '#0A0A0A', borderRadius: 100, padding: '0.5rem 1.1rem', fontSize: '0.8rem', fontWeight: 500, border: 'none', cursor: actionLoading ? 'wait' : 'pointer', fontFamily: 'var(--font-dm-sans)' }}>
                {actionLoading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── EventCard ────────────────────────────────────────────────────────────────

type EventCardProps = {
  event: OrgEvent
  copied: string | null
  openMenu: string | null
  menuRef: React.RefObject<HTMLDivElement>
  onCopy: (slug: string) => void
  onOpenMenu: (id: string) => void
  onRename: (ev: OrgEvent) => void
  onArchive: (ev: OrgEvent) => void
  onDelete: (ev: OrgEvent) => void
}

function EventCard({ event, copied, openMenu, menuRef, onCopy, onOpenMenu, onRename, onArchive, onDelete }: EventCardProps) {
  const active = !event.deadline || new Date(event.deadline) > new Date()
  const isOpen = openMenu === event.id

  function formatDeadline(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div style={{ background: '#141414', border: '0.5px solid rgba(240,237,230,0.08)', borderRadius: 16, padding: '1.5rem', opacity: event.archived ? 0.6 : 1 }}>
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <h2 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.15rem', color: '#F0EDE6', margin: 0, fontWeight: 400, flex: 1 }}>
          {event.title}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span style={{
            fontSize: '0.72rem', fontWeight: 500, fontFamily: 'var(--font-dm-sans)', borderRadius: 100,
            padding: '0.25rem 0.75rem', whiteSpace: 'nowrap',
            background: active ? 'rgba(200,245,90,0.12)' : 'rgba(255,107,107,0.1)',
            color: active ? '#C8F55A' : '#FF6B6B',
            border: `0.5px solid ${active ? 'rgba(200,245,90,0.3)' : 'rgba(255,107,107,0.3)'}`,
          }}>
            {active ? 'Active' : 'Closed'}
          </span>

          {/* Three-dot menu */}
          <div style={{ position: 'relative' }} ref={isOpen ? (menuRef as React.RefObject<HTMLDivElement>) : null}>
            <button
              type="button"
              onClick={() => onOpenMenu(event.id)}
              style={{ background: 'transparent', border: '0.5px solid rgba(240,237,230,0.12)', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(240,237,230,0.5)', fontSize: '1.1rem', lineHeight: 1 }}
              aria-label="More options"
            >
              &bull;&bull;&bull;
            </button>
            {isOpen && (
              <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 30, background: '#1C1C1C', border: '0.5px solid rgba(240,237,230,0.12)', borderRadius: 10, minWidth: 155, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                <MenuBtn onClick={() => onRename(event)}>Rename</MenuBtn>
                <MenuBtn onClick={() => onArchive(event)}>{event.archived ? 'Unarchive' : 'Archive'}</MenuBtn>
                <div style={{ height: '0.5px', background: 'rgba(240,237,230,0.08)' }} />
                <MenuBtn onClick={() => onDelete(event)} danger>Delete</MenuBtn>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meta */}
      <p style={{ fontSize: '0.82rem', color: 'rgba(240,237,230,0.5)', fontFamily: 'var(--font-dm-sans)', margin: '0 0 0.375rem' }}>
        {event.confirmedCount} confirmed &middot; {event.waitlistCount} waitlisted &middot; {event.capacity ? `${event.capacity} capacity` : 'Unlimited'}
      </p>
      {event.deadline && (
        <p style={{ fontSize: '0.78rem', color: 'rgba(240,237,230,0.35)', fontFamily: 'var(--font-dm-sans)', margin: '0 0 1rem' }}>
          Deadline: {formatDeadline(event.deadline)}
        </p>
      )}
      {!event.deadline && <div style={{ marginBottom: '1rem' }} />}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" onClick={() => onCopy(event.slug)} style={{ background: 'transparent', border: '0.5px solid rgba(240,237,230,0.15)', borderRadius: 100, padding: '0.45rem 1rem', fontSize: '0.8rem', color: copied === event.slug ? '#C8F55A' : 'rgba(240,237,230,0.6)', fontFamily: 'var(--font-dm-sans)', cursor: 'pointer' }}>
          {copied === event.slug ? 'Copied!' : 'Registration link'}
        </button>
        <Link href={`/dashboard/${event.slug}?token=${event.dashboardToken}`} style={{ background: 'transparent', border: '0.5px solid rgba(240,237,230,0.15)', borderRadius: 100, padding: '0.45rem 1rem', fontSize: '0.8rem', color: 'rgba(240,237,230,0.6)', fontFamily: 'var(--font-dm-sans)', textDecoration: 'none' }}>
          Dashboard &rarr;
        </Link>
        <Link href={`/edit/${event.slug}`} style={{ background: 'transparent', border: '0.5px solid rgba(240,237,230,0.15)', borderRadius: 100, padding: '0.45rem 1rem', fontSize: '0.8rem', color: 'rgba(240,237,230,0.6)', fontFamily: 'var(--font-dm-sans)', textDecoration: 'none' }}>
          Edit
        </Link>
      </div>
    </div>
  )
}

// ── MenuBtn ──────────────────────────────────────────────────────────────────

function MenuBtn({ children, onClick, danger = false }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '0.55rem 1rem', fontSize: '0.82rem', fontFamily: 'var(--font-dm-sans)',
        background: hovered ? 'rgba(240,237,230,0.05)' : 'transparent',
        border: 'none', cursor: 'pointer',
        color: danger
          ? (hovered ? '#FF6B6B' : 'rgba(255,107,107,0.7)')
          : (hovered ? '#F0EDE6' : 'rgba(240,237,230,0.65)'),
      }}
    >
      {children}
    </button>
  )
}
