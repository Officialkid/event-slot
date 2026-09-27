import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { purgeUserCache } from '@/lib/cache'
import Link from 'next/link'
import SignOutAndContinueButton from './SignOutAndContinueButton'

interface Props {
  searchParams: Promise<{ token?: string; claim?: string }>
}

export default async function TeamAcceptPage({ searchParams }: Props) {
  const { token, claim } = await searchParams

  if (!token) {
    notFound()
  }

  const acceptPath = `/team/accept?token=${encodeURIComponent(token)}`
  const claimPath = `/team/accept?token=${encodeURIComponent(token)}&claim=true`

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
          <Link href="/dashboard" style={{ display: 'inline-block', marginTop: '1.25rem', background: 'var(--accent)', color: 'var(--accent-contrast, #FFFFFF)', borderRadius: 8, padding: '0.6rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, fontFamily: 'var(--font-dm-sans)', textDecoration: 'none' }}>
            Go to dashboard
          </Link>
        </div>
      </main>
    )
  }

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    redirect(`/signin?callbackUrl=${encodeURIComponent(acceptPath)}`)
  }

  // Prevent the event owner from joining their own team as a member
  if (session.user.id === invite.ownerId) {
    const assignedEvent = invite.eventAccess[0]?.event
    return (
      <main style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: 460, width: '100%', background: 'var(--surface)', border: '0.5px solid var(--border-subtle)', borderRadius: 14, padding: '2.5rem', textAlign: 'center' }}>
          <h1 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.45rem', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 0.75rem' }}>
            You are the event organizer
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)', margin: '0 0 1.5rem', lineHeight: 1.7 }}>
            You created this event and already have full administrative access to manage it.
          </p>
          <Link
            href={assignedEvent ? `/dashboard/events/${assignedEvent.slug}` : '/dashboard'}
            style={{ display: 'inline-block', background: 'var(--accent)', color: '#0A0A0A', borderRadius: 8, padding: '0.65rem 1.75rem', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'var(--font-dm-sans)', textDecoration: 'none' }}
          >
            {assignedEvent ? 'Open event dashboard' : 'Go to dashboard'}
          </Link>
        </div>
      </main>
    )
  }

  const inviteEmail = invite.email.trim().toLowerCase()
  const sessionEmail = session.user.email?.trim().toLowerCase() ?? null
  const isEmailMatch = sessionEmail === inviteEmail
  const isClaiming = claim === 'true'

  if (!isEmailMatch && !isClaiming) {
    const ownerName = invite.owner.name || invite.owner.email || 'the organiser'
    return (
      <main style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <div style={{ maxWidth: 480, width: '100%', background: 'var(--surface)', border: '0.5px solid var(--border-emphasis)', borderRadius: 14, padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--accent)', fontFamily: 'var(--font-dm-sans)', marginBottom: '0.85rem' }}>
            Team Access
          </div>
          <h1 style={{ fontFamily: 'var(--font-instrument-serif)', fontSize: '1.5rem', fontWeight: 400, color: 'var(--text-primary)', margin: '0 0 0.75rem' }}>
            Join {ownerName}&apos;s Event Team
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)', margin: '0 0 0.65rem', lineHeight: 1.7 }}>
            This team invite was sent to <strong style={{ color: 'var(--text-primary)' }}>{invite.email}</strong>.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-dm-sans)', margin: '0 0 1.5rem', lineHeight: 1.7 }}>
            You are signed in as <strong style={{ color: 'var(--text-primary)' }}>{session.user.email ?? 'another account'}</strong>. You can claim this invite with your current account, or switch accounts.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
            <Link
              href={claimPath}
              style={{ width: '100%', maxWidth: 320, display: 'inline-block', background: 'var(--accent)', color: '#0A0A0A', borderRadius: 8, padding: '0.7rem 1.25rem', fontSize: '0.9rem', fontWeight: 600, fontFamily: 'var(--font-dm-sans)', textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}
            >
              Claim &amp; join team as {session.user.email}
            </Link>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '0.25rem' }}>
              <SignOutAndContinueButton callbackUrl={acceptPath} />
              <Link
                href="/dashboard"
                style={{ display: 'inline-block', border: '0.5px solid var(--border-subtle)', color: 'var(--text-secondary)', borderRadius: 8, padding: '0.65rem 1.25rem', fontSize: '0.875rem', fontWeight: 500, fontFamily: 'var(--font-dm-sans)', textDecoration: 'none' }}
              >
                Cancel
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Accept the invite (or claim it under current logged in user)
  const finalEmail = session.user.email?.trim() || invite.email
  await prisma.teamMember.update({
    where: { inviteToken: token },
    data: {
      memberId: session.user.id,
      email: finalEmail,
      status: 'accepted',
    },
  })

  purgeUserCache(session.user.id, session.user.email ?? null)

  const ownerName = invite.owner.name || invite.owner.email || 'the organiser'
  const assignedEvent = invite.eventAccess[0]?.event
  const postAcceptHref = assignedEvent
    ? `/dashboard/events/${assignedEvent.slug}`
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
