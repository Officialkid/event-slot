import prisma from '@/lib/prisma'
import { getCommunityLinkLabel, normalizeCommunityLink } from '@/lib/communityLink'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isCalendarConnected } from '@/lib/googleCalendar'
import { AddToCalendarButton } from '@/components/AddToCalendarButton'
import { APP_URL } from '@/lib/config'
import { buildGoogleCalendarTemplateUrl } from '@/lib/calendarLinks'

export default async function RegistrationStatusPage(props: { params: Promise<{ registrationId: string }> }) {
  const params = await props.params;
  const { registrationId } = await params
  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
  })

  if (!registration) {
    return (
      <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem' }}>
        <div style={{ maxWidth: 480, width: '100%', background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)', fontSize: '0.95rem', margin: 0 }}>
            Registration not found.
          </p>
        </div>
      </main>
    )
  }

  const event = await prisma.event.findUnique({
    where: { id: registration.eventId },
    select: {
      title: true,
      slug: true,
      organizerName: true,
      organizerEmail: true,
      eventDate: true,
      eventEndAt: true,
      location: true,
      communityLink: true,
      status: true,
      deadline: true,
      organizer: { select: { name: true } },
    },
  })

  if (!event) {
    return (
      <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem' }}>
        <div style={{ maxWidth: 480, width: '100%', background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)', fontSize: '0.95rem', margin: 0 }}>
            Registration not found.
          </p>
        </div>
      </main>
    )
  }

  const isConfirmed = registration.status === 'confirmed'

  // Calendar data for the waitlist "Save the date" section
  let attendeeCalendarConnected = false
  let staticGoogleUrl = ''
  if (!isConfirmed && event.eventDate) {
    const session = await getServerSession(authOptions)
    const userId = session?.user?.id ?? null
    if (userId) {
      attendeeCalendarConnected = await isCalendarConnected(userId)
    }
    const start = new Date(event.eventDate)
    const waitlistTitle = `[Waitlisted] ${event.title}`
    const details = `You are on the waitlist for ${event.title}.${registration.waitlistPosition != null ? ` Position: #${registration.waitlistPosition}.` : ''}\n\nYou will be notified if a spot opens up.\n\nCheck your status: ${APP_URL}/registration/${registrationId}`
    staticGoogleUrl = buildGoogleCalendarTemplateUrl({
      title: waitlistTitle,
      description: details,
      location: event.location,
      startDate: start,
      endDate: event.eventEndAt ? new Date(event.eventEndAt) : null,
    })
  }

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '3rem 1.5rem' }}>

      {/* Event header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.8rem', color: 'var(--text-primary)', lineHeight: 1.2, fontWeight: 400, marginBottom: '0.35rem' }}>
          {event.title}
        </h1>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 0.6rem' }}>
          Organised by {event.organizerName || event.organizer?.name || event.organizerEmail}
        </p>
        {(event.eventDate || event.location) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {event.eventDate && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                {new Date(event.eventDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}
                {new Date(event.eventDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}
              </p>
            )}
            {event.location && (
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                📍 {event.location}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Status card */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '2rem' }}>
        {isConfirmed ? (
          <>
            {/* Lime checkmark circle */}
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-dim)', border: '1px solid var(--border-emphasis)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <span style={{ display: 'block', width: 20, height: 12, borderBottom: '4px solid var(--accent)', borderLeft: '4px solid var(--accent)', transform: 'rotate(-45deg)', marginTop: '-4px' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.6rem', color: 'var(--text-primary)', fontWeight: 400, textAlign: 'center', margin: '0 0 0.75rem' }}>
              Your slot is confirmed
            </h2>
            <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '0.95rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, maxWidth: 360, margin: '0 auto 1rem' }}>
              You are registered for {event.title}. We look forward to seeing you.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: event.communityLink ? '1.25rem' : 0 }}>
              <span style={{ borderRadius: 999, border: '1px solid var(--border-emphasis)', background: 'var(--accent-dim)', padding: '4px 12px', fontSize: '0.7rem', color: 'var(--accent)' }}>
                Confirmed
              </span>
            </div>
            {event.communityLink && (
              <div style={{ background: 'var(--accent-dim)', border: '0.5px solid var(--accent-dim)', borderRadius: 8, padding: '1rem 1.25rem' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.6rem' }}>
                  Join the community
                </p>
                <a
                  href={normalizeCommunityLink(event.communityLink) || event.communityLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', textAlign: 'center', borderRadius: 999, border: '1px solid var(--border-emphasis)', padding: '8px 16px', fontSize: '0.875rem', color: 'var(--accent)', fontFamily: 'var(--font-dm-sans)', textDecoration: 'none' }}
                >
                  {getCommunityLinkLabel(normalizeCommunityLink(event.communityLink) || event.communityLink)}
                </a>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Muted clock circle */}
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h2 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.6rem', color: 'var(--text-primary)', fontWeight: 400, textAlign: 'center', margin: '0 0 0.75rem' }}>
              You are on the waitlist
            </h2>
            <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '0.95rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6, maxWidth: 360, margin: '0 auto 1rem' }}>
              You are currently position #{registration.waitlistPosition} for {event.title}. If a slot opens, you will be notified by email.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span style={{ borderRadius: 999, border: '1px solid var(--border-subtle)', background: 'var(--border-subtle)', padding: '4px 12px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                Waitlist #{registration.waitlistPosition}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Save the date — waitlist only */}
      {!isConfirmed && staticGoogleUrl && (
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_5%,transparent)] p-5 space-y-3 mt-4">
          <div className="flex items-center gap-2">
            <span className="text-[var(--warning)]">&#128197;</span>
            <p className="text-white font-semibold text-sm">Save the date</p>
          </div>
          <p className="text-[var(--text-secondary)] text-sm">
            You&apos;re on the waitlist. Save the date so you don&apos;t forget &mdash;
            your calendar entry will be updated automatically if you&apos;re confirmed.
          </p>
          <AddToCalendarButton
            eventSlug={event.slug}
            _eventTitle={`[Waitlisted] ${event.title}`}
            isConnected={attendeeCalendarConnected}
            staticGoogleUrl={staticGoogleUrl}
            staticIcsUrl={`/api/events/${event.slug}/calendar.ics`}
          />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
        {/* Register another person — only for open events */}
        {event.status === 'active' && (!event.deadline || new Date(event.deadline) > new Date()) && (
          <a
            href={`/${event.slug}`}
            style={{
              display: 'inline-block',
              background: 'var(--accent)',
              color: '#0A0A0A',
              fontFamily: 'var(--font-dm-sans)',
              fontSize: '0.875rem',
              fontWeight: 600,
              padding: '0.6rem 1.5rem',
              borderRadius: 999,
              textDecoration: 'none',
            }}
          >
            Register another person
          </a>
        )}
        <a
          href={`/registration/${params.registrationId}/edit`}
          style={{ fontSize: '0.82rem', color: 'var(--accent)', fontFamily: 'var(--font-dm-sans)', textDecoration: 'none' }}
        >
          Edit your answers →
        </a>
      </div>

    </main>
  )
}
