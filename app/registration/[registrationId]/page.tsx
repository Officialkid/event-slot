import prisma from '@/lib/prisma'

function getCommunityLinkLabel(url: string): string {
  if (url.includes('whatsapp') || url.includes('wa.me')) return 'Join WhatsApp Group →'
  if (url.includes('t.me') || url.includes('telegram')) return 'Join Telegram Group →'
  return url
}

export default async function RegistrationStatusPage({ params }: { params: { registrationId: string } }) {
  const registration = await prisma.registration.findUnique({
    where: { id: params.registrationId },
  })

  if (!registration) {
    return (
      <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem' }}>
        <div style={{ maxWidth: 480, width: '100%', background: '#141414', border: '1px solid rgba(240,237,230,0.08)', borderRadius: 12, padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ color: 'rgba(240,237,230,0.4)', fontFamily: 'var(--font-dm-sans)', fontSize: '0.95rem', margin: 0 }}>
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
      organizerEmail: true,
      eventDate: true,
      location: true,
      communityLink: true,
      status: true,
      deadline: true,
    },
  })

  if (!event) {
    return (
      <main style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 1.5rem' }}>
        <div style={{ maxWidth: 480, width: '100%', background: '#141414', border: '1px solid rgba(240,237,230,0.08)', borderRadius: 12, padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ color: 'rgba(240,237,230,0.4)', fontFamily: 'var(--font-dm-sans)', fontSize: '0.95rem', margin: 0 }}>
            Registration not found.
          </p>
        </div>
      </main>
    )
  }

  const isConfirmed = registration.status === 'confirmed'

  return (
    <main style={{ maxWidth: 480, margin: '0 auto', padding: '3rem 1.5rem' }}>

      {/* Event header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.8rem', color: '#F0EDE6', lineHeight: 1.2, fontWeight: 400, marginBottom: '0.35rem' }}>
          {event.title}
        </h1>
        <p style={{ fontSize: '0.78rem', color: 'rgba(240,237,230,0.4)', margin: '0 0 0.6rem' }}>
          Organised by {event.organizerEmail}
        </p>
        {(event.eventDate || event.location) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {event.eventDate && (
              <p style={{ fontSize: '0.82rem', color: 'rgba(240,237,230,0.5)', margin: 0 }}>
                {new Date(event.eventDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}
                {new Date(event.eventDate).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}
              </p>
            )}
            {event.location && (
              <p style={{ fontSize: '0.82rem', color: 'rgba(240,237,230,0.5)', margin: 0 }}>
                📍 {event.location}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Status card */}
      <div style={{ background: '#141414', border: '1px solid rgba(240,237,230,0.08)', borderRadius: 12, padding: '2rem' }}>
        {isConfirmed ? (
          <>
            {/* Lime checkmark circle */}
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(200,245,90,0.12)', border: '1px solid rgba(200,245,90,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <span style={{ display: 'block', width: 20, height: 12, borderBottom: '4px solid #C8F55A', borderLeft: '4px solid #C8F55A', transform: 'rotate(-45deg)', marginTop: '-4px' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.6rem', color: '#F0EDE6', fontWeight: 400, textAlign: 'center', margin: '0 0 0.75rem' }}>
              Your slot is confirmed
            </h2>
            <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '0.95rem', color: 'rgba(240,237,230,0.6)', textAlign: 'center', lineHeight: 1.6, maxWidth: 360, margin: '0 auto 1rem' }}>
              You are registered for {event.title}. We look forward to seeing you.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: event.communityLink ? '1.25rem' : 0 }}>
              <span style={{ borderRadius: 999, border: '1px solid rgba(200,245,90,0.3)', background: 'rgba(200,245,90,0.12)', padding: '4px 12px', fontSize: '0.7rem', color: '#C8F55A' }}>
                Confirmed
              </span>
            </div>
            {event.communityLink && (
              <div style={{ background: 'rgba(200,245,90,0.06)', border: '0.5px solid rgba(200,245,90,0.15)', borderRadius: 8, padding: '1rem 1.25rem' }}>
                <p style={{ fontSize: '0.7rem', color: '#C8F55A', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.6rem' }}>
                  Join the community
                </p>
                <a
                  href={event.communityLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', textAlign: 'center', borderRadius: 999, border: '1px solid rgba(200,245,90,0.4)', padding: '8px 16px', fontSize: '0.875rem', color: '#C8F55A', fontFamily: 'var(--font-dm-sans)', textDecoration: 'none' }}
                >
                  {getCommunityLinkLabel(event.communityLink)}
                </a>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Muted clock circle */}
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(240,237,230,0.06)', border: '1px solid rgba(240,237,230,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(240,237,230,0.55)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h2 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.6rem', color: '#F0EDE6', fontWeight: 400, textAlign: 'center', margin: '0 0 0.75rem' }}>
              You are on the waitlist
            </h2>
            <p style={{ fontFamily: 'var(--font-dm-sans)', fontSize: '0.95rem', color: 'rgba(240,237,230,0.6)', textAlign: 'center', lineHeight: 1.6, maxWidth: 360, margin: '0 auto 1rem' }}>
              You are currently position #{registration.waitlistPosition} for {event.title}. If a slot opens, you will be notified by email.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span style={{ borderRadius: 999, border: '1px solid rgba(240,237,230,0.15)', background: 'rgba(240,237,230,0.06)', padding: '4px 12px', fontSize: '0.7rem', color: 'rgba(240,237,230,0.55)' }}>
                Waitlist #{registration.waitlistPosition}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginTop: '1.25rem' }}>
        {/* Register another person — only for open events */}
        {event.status === 'active' && (!event.deadline || new Date(event.deadline) > new Date()) && (
          <a
            href={`/${event.slug}`}
            style={{
              display: 'inline-block',
              background: '#C8F55A',
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
          style={{ fontSize: '0.82rem', color: 'rgba(200,245,90,0.5)', fontFamily: 'var(--font-dm-sans)', textDecoration: 'none' }}
        >
          Edit your answers →
        </a>
      </div>

    </main>
  )
}
