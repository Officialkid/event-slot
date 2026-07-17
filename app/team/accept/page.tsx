import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

interface Props {
  searchParams: Promise<{ token?: string }>
}

export default async function TeamAcceptPage({ searchParams }: Props) {
  const { token } = await searchParams

  if (!token) {
    notFound()
  }

  const invite = await prisma.teamMember.findUnique({
    where: { inviteToken: token },
    include: {
      owner: { select: { name: true, email: true } },
      eventAccess: {
        take: 1,
        include: {
          event: { select: { slug: true, dashboardToken: true } },
        },
      },
    },
  })

  if (!invite) {
    notFound()
  }

  // Check expiry — 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  if (invite.createdAt < sevenDaysAgo) {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: 420, width: '100%', background: 'var(--surface)', border: '0.5px solid var(--border-subtle)', borderRadius: 14, padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)', margin: 0 }}>
            This invitation has expired. Ask the organiser to send a new invite.
          </p>
        </div>
      </main>
    )
  }

  if (invite.status === 'accepted') {
    return (
      <main style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: 420, width: '100%', background: 'var(--surface)', border: '0.5px solid var(--border-subtle)', borderRadius: 14, padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)', margin: 0 }}>
            You have already accepted this invitation.
          </p>
          <Link href="/dashboard" style={{ display: 'inline-block', marginTop: '1.25rem', background: 'var(--accent)', color: '#0A0A0A', borderRadius: 8, padding: '0.6rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-dm-sans)', textDecoration: 'none' }}>
            Go to dashboard
          </Link>
        </div>
      </main>
    )
  }

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=/team/accept?token=${encodeURIComponent(token)}`)
  }

  // Accept the invite
  await prisma.teamMember.update({
    where: { inviteToken: token },
    data: { memberId: session.user.id, status: 'accepted' },
  })

  const ownerName = invite.owner.name || invite.owner.email || 'the organiser'
  const assignedEvent = invite.eventAccess[0]?.event
  const postAcceptHref = assignedEvent
    ? `/dashboard/events/${assignedEvent.slug}?token=${encodeURIComponent(assignedEvent.dashboardToken)}`
    : '/dashboard'

  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ maxWidth: 420, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', fontFamily: 'var(--font-dm-sans)', marginBottom: '0.75rem' }}>
            EventSlot
          </div>
        </div>
        <div style={{ background: 'var(--surface)', border: '0.5px solid var(--border-emphasis)', borderRadius: 14, padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10l4 4 8-8" />
            </svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 0.75rem' }}>
            Invite accepted!
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)', margin: '0 0 1.75rem' }}>
            You are now part of <strong style={{ color: 'var(--text-secondary)' }}>{ownerName}</strong>&apos;s EventSlot team.
          </p>
          <Link
            href={postAcceptHref}
            style={{ display: 'inline-block', background: 'var(--accent)', color: '#0A0A0A', borderRadius: 8, padding: '0.7rem 2rem', fontSize: '0.925rem', fontWeight: 600, fontFamily: 'var(--font-dm-sans)', textDecoration: 'none' }}
          >
            {assignedEvent ? 'Open event dashboard' : 'Go to dashboard'}
          </Link>
        </div>
      </div>
    </main>
  )
}
