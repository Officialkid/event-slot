import { notFound } from 'next/navigation'
import prisma from '@/lib/prisma'
import FeedbackForm from './FeedbackForm'

interface Props {
  params: Promise<{ registrationId: string }>
}

export default async function FeedbackPage({ params }: Props) {
  const { registrationId } = await params

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      status: true,
      event: { select: { title: true, eventDate: true } },
    },
  })

  if (!registration || registration.status !== 'confirmed') {
    notFound()
  }

  const alreadySubmitted = !!(await prisma.attendeeFeedback.findUnique({
    where: { registrationId },
    select: { id: true },
  }))

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', fontFamily: 'var(--font-dm-sans)', marginBottom: '0.75rem' }}>
            EventSlot
          </div>
          <h1 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.8rem', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
            How was the event?
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontFamily: 'var(--font-dm-sans)', margin: 0 }}>
            {registration.event.title}
          </p>
        </div>

        {alreadySubmitted ? (
          <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border-subtle)', borderRadius: 14, padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✓</div>
            <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)', margin: 0 }}>
              You&apos;ve already submitted feedback for this event. Thanks!
            </p>
          </div>
        ) : (
          <FeedbackForm registrationId={registrationId} />
        )}
      </div>
    </main>
  )
}
