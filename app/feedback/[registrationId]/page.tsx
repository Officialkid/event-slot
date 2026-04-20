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
    <main style={{ minHeight: '100vh', background: '#0A0A0A', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#C8F55A', fontFamily: 'var(--font-dm-sans)', marginBottom: '0.75rem' }}>
            EventSlot
          </div>
          <h1 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.8rem', fontWeight: 400, color: '#F0EDE6', margin: '0 0 0.5rem' }}>
            How was the event?
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'rgba(240,237,230,0.45)', fontFamily: 'var(--font-dm-sans)', margin: 0 }}>
            {registration.event.title}
          </p>
        </div>

        {alreadySubmitted ? (
          <div style={{ background: '#141414', border: '0.5px solid rgba(240,237,230,0.08)', borderRadius: 14, padding: '2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>✓</div>
            <p style={{ fontSize: '0.925rem', color: 'rgba(240,237,230,0.6)', fontFamily: 'var(--font-dm-sans)', margin: 0 }}>
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
